// --- アプリ状態 ---
export type AppState = "idle" | "listening" | "thinking" | "speaking";

// --- 会話 ---
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
  timestamp: number;
}

// --- 設定 ---
export interface AppSettings {
  speechRegion: string;
  speechKey: string;
  openaiEndpoint: string;
  openaiKey: string;
  openaiDeployment: string;
  ttsVoice: string;
  systemPrompt: string;
}

export const DEFAULT_SYSTEM_PROMPT =
  "You are a friendly English conversation tutor. Help the user practice speaking English naturally. Keep responses concise (2-3 sentences). Gently correct grammar mistakes.";

export const DEFAULT_TTS_VOICE = "en-US-JennyNeural";

// --- OpenAI ストリーミング ---
export interface OpenAIChatChunk {
  id: string;
  choices: {
    index: number;
    delta: { role?: string; content?: string };
    finish_reason: string | null;
  }[];
}

// --- Speech 状態 ---
export interface SpeechState {
  isRecognizing: boolean;
  interimText: string;
  isSpeaking: boolean;
}

// --- エラー ---
export interface AppError {
  source: "speech" | "openai" | "settings";
  message: string;
  detail?: string;
}
