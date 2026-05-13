import { describe, it, expect, beforeEach, vi } from "vitest";
import { ref } from "vue";

// Mock callbacks storage
let recognizedCb: ((text: string) => void) | null = null;
let sentenceCb: ((sentence: string) => void) | null = null;

const mockChatError = ref(null);
const mockSpeechError = ref(null);

const mockChat = {
  messages: ref([]),
  isStreaming: ref(false),
  currentAssistantText: ref(""),
  error: mockChatError,
  sendMessage: vi.fn(async () => {}),
  clearHistory: vi.fn(),
  setSystemPrompt: vi.fn(),
  onSentence: vi.fn((cb: (s: string) => void) => {
    sentenceCb = cb;
  }),
};

const mockSpeech = {
  speechState: ref({
    isRecognizing: false,
    interimText: "",
    isSpeaking: false,
  }),
  error: mockSpeechError,
  startListening: vi.fn(async () => {}),
  stopListening: vi.fn(async () => {}),
  enqueueSpeech: vi.fn(),
  cancelSpeech: vi.fn(),
  waitForSpeechEnd: vi.fn(async () => {}),
  onRecognized: vi.fn((cb: (text: string) => void) => {
    recognizedCb = cb;
  }),
  onRecognizing: vi.fn(),
  dispose: vi.fn(),
};

vi.mock("./useSettings", () => ({
  useSettings: () => ({
    settings: ref({
      speechKey: "test-key",
      speechRegion: "japaneast",
      ttsVoice: "en-US-JennyNeural",
      systemPrompt: "You are a tutor.",
      openaiEndpoint: "https://test.openai.azure.com",
      openaiKey: "test-key",
      openaiDeployment: "gpt-4.1-nano",
    }),
    isConfigured: { value: true },
  }),
}));

vi.mock("./useChat", () => ({
  useChat: () => mockChat,
}));

vi.mock("./useSpeech", () => ({
  useSpeech: () => mockSpeech,
}));

// Must import after mocks
import { useConversation } from "./useConversation";

describe("useConversation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    recognizedCb = null;
    sentenceCb = null;
    mockChatError.value = null;
    mockSpeechError.value = null;
    mockChat.messages.value = [];
    mockChat.isStreaming.value = false;
    mockChat.currentAssistantText.value = "";
  });

  it("CV1: start() sets appState to listening and calls startListening", async () => {
    const { start, appState } = useConversation();
    await start();
    expect(appState.value).toBe("listening");
    expect(mockSpeech.startListening).toHaveBeenCalled();
  });

  it("CV2: onRecognized triggers thinking state and sendMessage", async () => {
    const { start } = useConversation();
    await start();

    // Trigger recognized callback
    recognizedCb?.("Hello world");
    // Give microtask a chance
    await vi.waitFor(() => {
      expect(mockChat.sendMessage).toHaveBeenCalledWith("Hello world");
    });
  });

  it("CV3: onSentence triggers speaking state and enqueueSpeech", async () => {
    const { start, appState } = useConversation();
    await start();

    // Simulate sentence arrival
    sentenceCb?.("Hello!");
    expect(appState.value).toBe("speaking");
    expect(mockSpeech.enqueueSpeech).toHaveBeenCalledWith("Hello!");
  });

  it("CV5: sendText triggers thinking and calls sendMessage", async () => {
    const { start, sendText } = useConversation();
    await start();

    await sendText("Hello");
    expect(mockSpeech.stopListening).toHaveBeenCalled();
    expect(mockChat.sendMessage).toHaveBeenCalledWith("Hello");
  });

  it("CV5: sendText ignores empty text", async () => {
    const { sendText } = useConversation();
    await sendText("   ");
    expect(mockChat.sendMessage).not.toHaveBeenCalled();
  });

  it("CV6: stop() sets appState to idle and calls stopListening", async () => {
    const { start, stop, appState } = useConversation();
    await start();
    await stop();
    expect(appState.value).toBe("idle");
    expect(mockSpeech.stopListening).toHaveBeenCalled();
    expect(mockSpeech.cancelSpeech).toHaveBeenCalled();
  });

  it("CV7: reset() clears history", async () => {
    const { reset } = useConversation();
    reset();
    expect(mockChat.clearHistory).toHaveBeenCalled();
    expect(mockSpeech.cancelSpeech).toHaveBeenCalled();
  });

  it("CV8: chat error resets appState to idle", async () => {
    const { start, appState, error } = useConversation();
    await start();
    expect(appState.value).toBe("listening");

    // Simulate chat error
    mockChatError.value = {
      source: "openai",
      message: "Authentication failed",
    } as never;

    // Vue watch is async; wait for it
    await vi.waitFor(() => {
      expect(appState.value).toBe("idle");
      expect(error.value).not.toBeNull();
      expect(error.value!.source).toBe("openai");
    });
  });

  it("CV8: speech error resets appState to idle", async () => {
    const { start, appState, error } = useConversation();
    await start();

    // Simulate speech error
    mockSpeechError.value = {
      source: "speech",
      message: "マイクを許可してください",
    } as never;

    await vi.waitFor(() => {
      expect(appState.value).toBe("idle");
      expect(error.value).not.toBeNull();
      expect(error.value!.source).toBe("speech");
    });
  });
});
