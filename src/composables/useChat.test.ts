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

  it("C7: 401 error sets error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(createErrorResponse(401))),
    );
    const { sendMessage, error } = useChat();
    await sendMessage("Hi");
    expect(error.value).not.toBeNull();
    expect(error.value!.source).toBe("openai");
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
});
