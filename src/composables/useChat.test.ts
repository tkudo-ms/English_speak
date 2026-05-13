import { describe, it, expect, beforeEach, vi } from "vitest";
import { useChat } from "./useChat";

// Mock useSettings
vi.mock("./useSettings", () => ({
  useSettings: () => ({
    settings: {
      value: {
        openaiEndpoint: "https://test.openai.azure.com",
        openaiKey: "test-key",
        openaiDeployment: "gpt-4.1-nano",
        systemPrompt: "You are a tutor.",
      },
    },
  }),
}));

function createStreamResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        const data = JSON.stringify({
          id: "test",
          choices: [
            { index: 0, delta: { content: chunk }, finish_reason: null },
          ],
        });
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

function createErrorResponse(status: number): Response {
  return new Response("error", { status });
}

function createInterruptedStreamResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  let readerCancelled = false;
  const stream = new ReadableStream({
    async start(controller) {
      for (const chunk of chunks) {
        if (readerCancelled) return;
        const data = JSON.stringify({
          id: "test",
          choices: [
            { index: 0, delta: { content: chunk }, finish_reason: null },
          ],
        });
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        // Yield to allow reader to process
        await new Promise((r) => setTimeout(r, 0));
      }
      controller.error(new Error("Stream interrupted"));
    },
    cancel() {
      readerCancelled = true;
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

describe("useChat", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("C1: sendMessage adds user message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(createStreamResponse(["Hello!"]))),
    );
    const { messages, sendMessage } = useChat();
    await sendMessage("Hi");
    expect(messages.value[0].role).toBe("user");
    expect(messages.value[0].content).toBe("Hi");
  });

  it("C2: streaming updates currentAssistantText", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(createStreamResponse(["I'm ", "doing ", "great!"])),
      ),
    );
    const { sendMessage, currentAssistantText } = useChat();
    await sendMessage("Hi");
    expect(currentAssistantText.value).toBe("I'm doing great!");
  });

  it("C3: onSentence fires on sentence boundaries", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          createStreamResponse([
            "I'm ",
            "doing ",
            "great! ",
            "How ",
            "are ",
            "you?",
          ]),
        ),
      ),
    );
    const { sendMessage, onSentence } = useChat();
    const sentences: string[] = [];
    onSentence((s) => sentences.push(s));
    await sendMessage("Hi");
    expect(sentences.length).toBeGreaterThanOrEqual(1);
    expect(sentences[0]).toContain("great!");
  });

  it("C4: abbreviations do not trigger sentence split", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          createStreamResponse(["Mr. ", "Smith ", "is ", "here."]),
        ),
      ),
    );
    const { sendMessage, onSentence } = useChat();
    const sentences: string[] = [];
    onSentence((s) => sentences.push(s));
    await sendMessage("Hi");
    expect(sentences.length).toBe(1);
    expect(sentences[0]).toBe("Mr. Smith is here.");
  });

  it("C5: ellipsis triggers sentence split", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(createStreamResponse(["Well... ", "That's ", "nice."])),
      ),
    );
    const { sendMessage, onSentence } = useChat();
    const sentences: string[] = [];
    onSentence((s) => sentences.push(s));
    await sendMessage("Hi");
    expect(sentences.length).toBe(2);
    expect(sentences[0]).toContain("Well...");
  });

  it("C6: stream completion adds assistant message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(createStreamResponse(["Hello!"]))),
    );
    const { sendMessage, messages, isStreaming } = useChat();
    await sendMessage("Hi");
    expect(messages.value.find((m) => m.role === "assistant")).toBeTruthy();
    expect(isStreaming.value).toBe(false);
  });

  it("C7: 401 error sets error with source openai", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(createErrorResponse(401))),
    );
    const { sendMessage, error } = useChat();
    await sendMessage("Hi");
    expect(error.value).not.toBeNull();
    expect(error.value!.source).toBe("openai");
    expect(error.value!.message).toContain("Authentication");
  });

  it("C8: 429 error sets rate limit message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(createErrorResponse(429))),
    );
    const { sendMessage, error } = useChat();
    await sendMessage("Hi");
    expect(error.value!.message).toContain("Rate limited");
  });

  it("C9: network error sets error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("Network failed"))),
    );
    const { sendMessage, error } = useChat();
    await sendMessage("Hi");
    expect(error.value).not.toBeNull();
    expect(error.value!.source).toBe("openai");
    expect(error.value!.message).toContain("Network");
  });

  it("C10: stream interruption preserves partial text and sets error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(createInterruptedStreamResponse(["Hello ", "world"])),
      ),
    );
    const { sendMessage, currentAssistantText, error } = useChat();
    await sendMessage("Hi");
    expect(currentAssistantText.value).toContain("Hello");
    expect(error.value).not.toBeNull();
  });

  it("C11: clearHistory empties messages", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(createStreamResponse(["Hello!"]))),
    );
    const { sendMessage, messages, clearHistory } = useChat();
    await sendMessage("Hi");
    expect(messages.value.length).toBeGreaterThan(0);
    clearHistory();
    expect(messages.value.length).toBe(0);
  });

  it("C12: setSystemPrompt changes the system message", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(createStreamResponse(["OK!"])),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { sendMessage, setSystemPrompt } = useChat();
    setSystemPrompt("New prompt");
    await sendMessage("Hi");
    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(call[1].body as string);
    expect(body.messages[0].role).toBe("system");
    expect(body.messages[0].content).toBe("New prompt");
  });
});
