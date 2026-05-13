import { describe, it, expect, beforeEach, vi } from "vitest";
import { useSpeech } from "./useSpeech";

// Mock Speech SDK
const mockRecognizer = {
  recognizing: null as Function | null,
  recognized: null as Function | null,
  canceled: null as Function | null,
  startContinuousRecognitionAsync: vi.fn((success: Function) => success?.()),
  stopContinuousRecognitionAsync: vi.fn((success: Function) => success?.()),
  close: vi.fn(),
};

const mockSynthesizer = {
  speakTextAsync: vi.fn((_text: string, onResult: Function) => {
    onResult?.({ reason: 1 });
  }),
  close: vi.fn(),
};

vi.mock("microsoft-cognitiveservices-speech-sdk", () => {
  function MockRecognizer() {
    return mockRecognizer;
  }
  function MockSynthesizer() {
    return mockSynthesizer;
  }
  return {
    SpeechConfig: {
      fromSubscription: vi.fn(() => ({
        speechRecognitionLanguage: "",
        speechSynthesisVoiceName: "",
      })),
    },
    SpeechRecognizer: MockRecognizer,
    SpeechSynthesizer: MockSynthesizer,
    AudioConfig: {
      fromDefaultMicrophoneInput: vi.fn(),
      fromDefaultSpeakerOutput: vi.fn(),
    },
    ResultReason: { RecognizedSpeech: 1, NoMatch: 2 },
    CancellationReason: { Error: 1 },
  };
});

vi.mock("./useSettings", () => ({
  useSettings: () => ({
    settings: {
      value: {
        speechKey: "test-key",
        speechRegion: "japaneast",
        ttsVoice: "en-US-JennyNeural",
      },
    },
  }),
}));

describe("useSpeech", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRecognizer.recognizing = null;
    mockRecognizer.recognized = null;
    mockRecognizer.canceled = null;
  });

  it("SP1: startListening calls startContinuousRecognitionAsync", async () => {
    const { startListening } = useSpeech();
    await startListening();
    expect(mockRecognizer.startContinuousRecognitionAsync).toHaveBeenCalled();
  });

  it("SP2: recognizing event fires onRecognizing callback", async () => {
    const { startListening, onRecognizing } = useSpeech();
    const texts: string[] = [];
    onRecognizing((t) => texts.push(t));
    await startListening();
    mockRecognizer.recognizing?.(null, { result: { text: "Hello" } });
    expect(texts).toContain("Hello");
  });

  it("SP3: recognized event fires onRecognized callback", async () => {
    const { startListening, onRecognized } = useSpeech();
    const texts: string[] = [];
    onRecognized((t) => texts.push(t));
    await startListening();
    mockRecognizer.recognized?.(null, {
      result: { text: "Hello world", reason: 1 },
    });
    expect(texts).toContain("Hello world");
  });

  it("SP4: stopListening calls stopContinuousRecognitionAsync", async () => {
    const { startListening, stopListening } = useSpeech();
    await startListening();
    await stopListening();
    expect(mockRecognizer.stopContinuousRecognitionAsync).toHaveBeenCalled();
  });

  it("SP5: enqueueSpeech calls speakTextAsync for single sentence", async () => {
    const { enqueueSpeech } = useSpeech();
    enqueueSpeech("Hello!");
    await new Promise((r) => setTimeout(r, 10));
    expect(mockSynthesizer.speakTextAsync).toHaveBeenCalledWith(
      "Hello!",
      expect.any(Function),
      expect.any(Function),
    );
  });

  it("SP6: enqueueSpeech processes multiple sentences in order", async () => {
    const { enqueueSpeech } = useSpeech();
    enqueueSpeech("First.");
    enqueueSpeech("Second.");
    enqueueSpeech("Third.");
    await new Promise((r) => setTimeout(r, 50));
    expect(mockSynthesizer.speakTextAsync).toHaveBeenCalledTimes(3);
    expect(mockSynthesizer.speakTextAsync.mock.calls[0][0]).toBe("First.");
    expect(mockSynthesizer.speakTextAsync.mock.calls[1][0]).toBe("Second.");
    expect(mockSynthesizer.speakTextAsync.mock.calls[2][0]).toBe("Third.");
  });

  it("SP7: cancelSpeech clears queue", async () => {
    const { enqueueSpeech, cancelSpeech, speechState } = useSpeech();
    enqueueSpeech("First.");
    cancelSpeech();
    expect(speechState.value.isSpeaking).toBe(false);
  });

  it("SP8: waitForSpeechEnd resolves when queue is empty", async () => {
    const { waitForSpeechEnd } = useSpeech();
    // No items in queue, should resolve immediately
    await waitForSpeechEnd();
  });

  it("SP9: mic permission error sets specific message", async () => {
    const { startListening, error } = useSpeech();
    await startListening();
    mockRecognizer.canceled?.(null, {
      reason: 1, // CancellationReason.Error
      errorDetails: "microphone Permission denied NotAllowedError",
    });
    expect(error.value).not.toBeNull();
    expect(error.value!.source).toBe("speech");
    expect(error.value!.message).toContain("マイクを許可してください");
  });

  it("SP10: auth error sets speech source error", async () => {
    const { startListening, error } = useSpeech();
    await startListening();
    mockRecognizer.canceled?.(null, {
      reason: 1, // CancellationReason.Error
      errorDetails: "AuthenticationFailure",
    });
    expect(error.value).not.toBeNull();
    expect(error.value!.source).toBe("speech");
    expect(error.value!.message).toContain("authentication");
  });

  it("SP11: dispose closes recognizer and synthesizer", async () => {
    const { startListening, enqueueSpeech, dispose } = useSpeech();
    await startListening();
    enqueueSpeech("Test");
    await new Promise((r) => setTimeout(r, 10));
    dispose();
    expect(mockRecognizer.close).toHaveBeenCalled();
  });
});
