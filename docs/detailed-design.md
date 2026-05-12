# English Speaking Practice App — 詳細設計

> 基本設計: [design.md](./design.md)

## 1. 型定義 (`src/types/index.ts`)

```typescript
// --- アプリ状態 ---
export type AppState = 'idle' | 'listening' | 'thinking' | 'speaking';

// --- 会話 ---
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: number;
}

// --- 設定 ---
export interface AppSettings {
  speechRegion: string;
  speechKey: string;
  openaiEndpoint: string;   // 例: "https://xxx.openai.azure.com"
  openaiKey: string;
  openaiDeployment: string; // 例: "gpt-4.1-nano"
  ttsVoice: string;         // デフォルト: "en-US-JennyNeural"
  systemPrompt: string;     // デフォルト: 下記 DEFAULT_SYSTEM_PROMPT
}

// デフォルト値
export const DEFAULT_SYSTEM_PROMPT =
  'You are a friendly English conversation tutor. Help the user practice speaking English naturally. Keep responses concise (2-3 sentences). Gently correct grammar mistakes.';

export const DEFAULT_TTS_VOICE = 'en-US-JennyNeural';

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
  interimText: string;     // 認識中の中間テキスト
  isSpeaking: boolean;     // TTS 再生中
}

// --- エラー ---
export interface AppError {
  source: 'speech' | 'openai' | 'settings';
  message: string;
  detail?: string;
}
```

## 2. Composable インターフェース

### 設定の受け渡し

`useChat()` と `useSpeech()` は内部で `useSettings()` を呼び出して API キー・エンドポイントを取得する。
ユーザーが UI（SettingsModal）で入力した設定は localStorage に保存され、各 composable が `useSettings().settings` から参照する。

```
SettingsModal (UI) → useSettings.save() → localStorage
useChat()  → useSettings().settings → openaiEndpoint / openaiKey / openaiDeployment
useSpeech() → useSettings().settings → speechRegion / speechKey / ttsVoice
useConversation() → useSettings().settings → systemPrompt
```

### `useSettings()`

```typescript
interface UseSettingsReturn {
  // 状態
  settings: Ref<AppSettings>;
  isConfigured: ComputedRef<boolean>;  // 必須項目がすべて入力済みか

  // 操作
  save(settings: AppSettings): void;   // localStorage に保存
  load(): AppSettings;                 // localStorage から読み込み
  clear(): void;                       // 設定をクリア
  validate(): { valid: boolean; errors: string[] };
}
```

### `useChat()`

```typescript
interface UseChatReturn {
  // 状態
  messages: Ref<ChatMessage[]>;
  isStreaming: Ref<boolean>;
  currentAssistantText: Ref<string>;   // ストリーミング中の蓄積テキスト
  error: Ref<AppError | null>;

  // 操作
  sendMessage(text: string): Promise<void>;
  // → messages に user メッセージを追加
  // → OpenAI ストリーミング開始
  // → onSentence コールバックで文単位通知
  // → 完了後 messages に assistant メッセージを追加

  clearHistory(): void;
  setSystemPrompt(prompt: string): void;

  // コールバック
  onSentence: (callback: (sentence: string) => void) => void;
  // → ストリーミング中に文末 (.!?) を検出するたびに呼ばれる
  // → TTS キューへの投入に使用
}
```

**ストリーミング文分割ロジック:**
```
受信チャンク: "I'm" → "doing" → "great!" → " How" → "are" → "you?"
                                    ↑                              ↑
                            文1完成 → onSentence("I'm doing great!")
                                                          文2完成 → onSentence("How are you?")
```

### `useSpeech()`

```typescript
interface UseSpeechReturn {
  // 状態
  speechState: Ref<SpeechState>;
  error: Ref<AppError | null>;

  // STT 操作
  startListening(): Promise<void>;    // 連続認識開始
  stopListening(): Promise<void>;     // 連続認識停止

  // TTS 操作
  enqueueSpeech(sentence: string): void;  // TTS キューに文を追加
  cancelSpeech(): void;                    // キューをクリアして再生停止
  waitForSpeechEnd(): Promise<void>;       // 全キュー再生完了を待つ

  // コールバック
  onRecognized: (callback: (text: string) => void) => void;
  // → 発話終了を検出し、確定テキストを返す

  onRecognizing: (callback: (text: string) => void) => void;
  // → 中間結果（話している途中のテキスト）

  // ライフサイクル
  dispose(): void;  // SDK リソース解放
}
```

### `useConversation()`

```typescript
interface UseConversationReturn {
  // 状態
  appState: Ref<AppState>;
  messages: Ref<ChatMessage[]>;
  interimText: Ref<string>;        // 認識中の中間テキスト
  currentAssistantText: Ref<string>; // AI応答のストリーミング表示用
  error: Ref<AppError | null>;

  // 操作
  start(): void;          // 会話セッション開始（→ listening へ）
  stop(): void;           // 会話セッション停止（→ idle へ）
  sendText(text: string): Promise<void>;  // テキスト入力から送信
  reset(): void;          // 会話履歴クリアして最初から
}
```

**オーケストレーションフロー:**
```
start()
  └→ appState = 'listening'
     └→ useSpeech.startListening()

onRecognized(text)
  └→ appState = 'thinking'
     └→ useSpeech.stopListening()
     └→ useChat.sendMessage(text)

onSentence(sentence)
  └→ appState = 'speaking'  (初回の文到着時)
     └→ useSpeech.enqueueSpeech(sentence)

useChat streaming完了 + useSpeech TTS完了
  └→ appState = 'listening'
     └→ useSpeech.startListening()
```

## 3. エラーハンドリング設計

| 発生箇所 | エラー内容 | ハンドリング | UI 表示 |
|----------|-----------|-------------|---------|
| Settings | 必須項目未入力 | バリデーションで弾く | 入力欄にエラーメッセージ |
| Speech STT | マイク権限なし | `recognizer.canceled` で検出 | トースト通知 + 「マイクを許可してください」 |
| Speech STT | リージョン/キー不正 | `recognizer.canceled` (AuthFailure) | トースト + 設定画面を開く |
| Speech TTS | 音声合成失敗 | `synthesizer` エラーコールバック | トースト通知（テキストは表示済み） |
| OpenAI | 401 Unauthorized | fetch レスポンスステータス | トースト + 設定画面を開く |
| OpenAI | 429 Rate Limited | fetch レスポンスステータス | トースト「しばらく待ってから再試行」 |
| OpenAI | ネットワークエラー | fetch の catch | トースト「接続を確認してください」 |
| OpenAI | ストリーム中断 | ReadableStream の途中エラー | 途中までのテキストを保持 + トースト |

**エラー表示の統一ルール:**
- すべてのエラーは `AppError` 型に正規化
- UI では画面上部にトースト通知（3秒で自動消去、手動閉じ可）
- 認証エラーのみ設定画面を自動で開くボタンを表示
- エラー発生時は `appState` を `idle` にリセット

## 4. Azure OpenAI ストリーミング SSE 詳細

**リクエスト (v1 互換):**
```http
POST {endpoint}/openai/v1/chat/completions
Content-Type: application/json
api-key: {key}

{"model": "{deployment}", "messages": [...], "stream": true, "temperature": 0.7, "max_tokens": 256}
```

**レスポンス (Server-Sent Events):**
```
data: {"id":"chatcmpl-xxx","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}

data: {"id":"chatcmpl-xxx","choices":[{"index":0,"delta":{"content":"I'm"},"finish_reason":null}]}

data: {"id":"chatcmpl-xxx","choices":[{"index":0,"delta":{"content":" doing"},"finish_reason":null}]}

data: {"id":"chatcmpl-xxx","choices":[{"index":0,"delta":{"content":" great!"},"finish_reason":null}]}

data: [DONE]
```

**パース処理:**
```typescript
// 1. ReadableStream から行単位で読み取り
// 2. "data: " プレフィックスを除去
// 3. "[DONE]" なら終了
// 4. JSON.parse → choices[0].delta.content を取得
// 5. sentenceBuffer に蓄積
// 6. 文末記号 (.!?) + 空白/EOL を検出 → onSentence コールバック発火
```

**文分割の境界条件:**
- `Mr.` `Dr.` `U.S.` などの略語 → ピリオド後に大文字が続く場合のみ文末と判定
- `...` → 文末として扱う
- `!?` の連続 → 1つの文末として扱う
- 最終チャンク (`[DONE]`) → バッファ残があれば最後の文として flush
