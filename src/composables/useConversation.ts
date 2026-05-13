import { ref, watch, onUnmounted } from "vue";
import type { AppState, AppError } from "../types";
import { useSettings } from "./useSettings";
import { useChat } from "./useChat";
import { useSpeech } from "./useSpeech";

export function useConversation() {
  const { settings } = useSettings();
  const chat = useChat();
  const speech = useSpeech();

  const appState = ref<AppState>("idle");
  const interimText = ref("");
  const error = ref<AppError | null>(null);

  // Set system prompt from settings
  chat.setSystemPrompt(settings.value.systemPrompt);

  // Integrate errors from chat and speech into unified error
  watch(
    () => chat.error.value,
    (chatError) => {
      if (chatError) {
        error.value = chatError;
        appState.value = "idle";
      }
    },
  );

  watch(
    () => speech.error.value,
    (speechError) => {
      if (speechError) {
        error.value = speechError;
        appState.value = "idle";
      }
    },
  );

  // Wire up speech callbacks
  speech.onRecognizing((text) => {
    interimText.value = text;
  });

  speech.onRecognized(async (text) => {
    if (!text.trim()) return;
    interimText.value = "";
    appState.value = "thinking";
    await speech.stopListening();
    await chat.sendMessage(text);

    // After streaming completes, wait for TTS to finish then resume listening
    await speech.waitForSpeechEnd();
    appState.value = "listening";
    await speech.startListening();
  });

  // Wire up sentence callback for TTS
  chat.onSentence((sentence) => {
    if (appState.value !== "speaking") {
      appState.value = "speaking";
    }
    speech.enqueueSpeech(sentence);
  });

  async function start(): Promise<void> {
    error.value = null;
    chat.setSystemPrompt(settings.value.systemPrompt);
    appState.value = "listening";
    try {
      await speech.startListening();
    } catch {
      appState.value = "idle";
    }
  }

  async function stop(): Promise<void> {
    speech.cancelSpeech();
    await speech.stopListening();
    appState.value = "idle";
    interimText.value = "";
  }

  async function sendText(text: string): Promise<void> {
    if (!text.trim()) return;
    interimText.value = "";

    const wasListening = appState.value === "listening";
    if (wasListening) {
      await speech.stopListening();
    }

    appState.value = "thinking";
    await chat.sendMessage(text);
    await speech.waitForSpeechEnd();

    if (wasListening) {
      appState.value = "listening";
      await speech.startListening();
    } else {
      appState.value = "idle";
    }
  }

  function reset(): void {
    speech.cancelSpeech();
    chat.clearHistory();
    interimText.value = "";
    // Stay in current listening state if active
    if (appState.value !== "listening") {
      appState.value = "idle";
    }
  }

  onUnmounted(() => {
    speech.dispose();
  });

  return {
    appState,
    messages: chat.messages,
    interimText,
    currentAssistantText: chat.currentAssistantText,
    isStreaming: chat.isStreaming,
    error,
    speechError: speech.error,
    chatError: chat.error,
    start,
    stop,
    sendText,
    reset,
  };
}
