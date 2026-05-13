import { ref } from "vue";
import * as SpeechSDK from "microsoft-cognitiveservices-speech-sdk";
import type { SpeechState, AppError } from "../types";
import { useSettings } from "./useSettings";

export function useSpeech() {
  const { settings } = useSettings();

  const speechState = ref<SpeechState>({
    isRecognizing: false,
    interimText: "",
    isSpeaking: false,
  });
  const error = ref<AppError | null>(null);

  let recognizer: SpeechSDK.SpeechRecognizer | null = null;
  let synthesizer: SpeechSDK.SpeechSynthesizer | null = null;

  let recognizedCallback: ((text: string) => void) | null = null;
  let recognizingCallback: ((text: string) => void) | null = null;

  // TTS queue
  const ttsQueue: string[] = [];
  let isTtsPlaying = false;
  let speechEndResolve: (() => void) | null = null;

  function onRecognized(callback: (text: string) => void) {
    recognizedCallback = callback;
  }

  function onRecognizing(callback: (text: string) => void) {
    recognizingCallback = callback;
  }

  function createRecognizer(): SpeechSDK.SpeechRecognizer {
    const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(
      settings.value.speechKey,
      settings.value.speechRegion,
    );
    speechConfig.speechRecognitionLanguage = "en-US";
    const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
    return new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);
  }

  function createSynthesizer(): SpeechSDK.SpeechSynthesizer {
    const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(
      settings.value.speechKey,
      settings.value.speechRegion,
    );
    speechConfig.speechSynthesisVoiceName = settings.value.ttsVoice;
    const audioConfig = SpeechSDK.AudioConfig.fromDefaultSpeakerOutput();
    return new SpeechSDK.SpeechSynthesizer(speechConfig, audioConfig);
  }

  async function startListening(): Promise<void> {
    error.value = null;
    if (!recognizer) {
      recognizer = createRecognizer();

      recognizer.recognizing = (_s, e) => {
        speechState.value.interimText = e.result.text;
        recognizingCallback?.(e.result.text);
      };

      recognizer.recognized = (_s, e) => {
        if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
          speechState.value.interimText = "";
          recognizedCallback?.(e.result.text);
        }
      };

      recognizer.canceled = (_s, e) => {
        if (e.reason === SpeechSDK.CancellationReason.Error) {
          const detail = e.errorDetails || "";
          let message = "Speech recognition error";

          if (
            detail.includes("microphone") ||
            detail.includes("Permission") ||
            detail.includes("NotAllowedError")
          ) {
            message = "マイクを許可してください";
          } else if (
            detail.includes("AuthenticationFailure") ||
            detail.includes("401")
          ) {
            message =
              "Speech authentication failed. Check your region and key.";
          }

          error.value = {
            source: "speech",
            message,
            detail,
          };
        }
        speechState.value.isRecognizing = false;
      };
    }

    return new Promise<void>((resolve, reject) => {
      recognizer!.startContinuousRecognitionAsync(
        () => {
          speechState.value.isRecognizing = true;
          resolve();
        },
        (err) => {
          error.value = {
            source: "speech",
            message: "Failed to start recognition",
            detail: err,
          };
          reject(err);
        },
      );
    });
  }

  async function stopListening(): Promise<void> {
    if (!recognizer) return;
    return new Promise<void>((resolve) => {
      recognizer!.stopContinuousRecognitionAsync(
        () => {
          speechState.value.isRecognizing = false;
          speechState.value.interimText = "";
          resolve();
        },
        () => resolve(),
      );
    });
  }

  function enqueueSpeech(sentence: string): void {
    ttsQueue.push(sentence);
    if (!isTtsPlaying) {
      playNext();
    }
  }

  async function playNext(): Promise<void> {
    if (ttsQueue.length === 0) {
      isTtsPlaying = false;
      speechState.value.isSpeaking = false;
      speechEndResolve?.();
      speechEndResolve = null;
      return;
    }

    isTtsPlaying = true;
    speechState.value.isSpeaking = true;
    const text = ttsQueue.shift()!;

    if (!synthesizer) {
      synthesizer = createSynthesizer();
    }

    return new Promise<void>((resolve) => {
      synthesizer!.speakTextAsync(
        text,
        () => {
          resolve();
          playNext();
        },
        (err) => {
          error.value = { source: "speech", message: "TTS error", detail: err };
          resolve();
          playNext();
        },
      );
    });
  }

  function cancelSpeech(): void {
    ttsQueue.length = 0;
    isTtsPlaying = false;
    speechState.value.isSpeaking = false;
    if (synthesizer) {
      synthesizer.close();
      synthesizer = null;
    }
    speechEndResolve?.();
    speechEndResolve = null;
  }

  function waitForSpeechEnd(): Promise<void> {
    if (!isTtsPlaying && ttsQueue.length === 0) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      speechEndResolve = resolve;
    });
  }

  function dispose(): void {
    cancelSpeech();
    if (recognizer) {
      recognizer.close();
      recognizer = null;
    }
    if (synthesizer) {
      synthesizer.close();
      synthesizer = null;
    }
  }

  return {
    speechState,
    error,
    startListening,
    stopListening,
    enqueueSpeech,
    cancelSpeech,
    waitForSpeechEnd,
    onRecognized,
    onRecognizing,
    dispose,
  };
}
