# English Speaking Practice App — 設計書

## 1. プロジェクト概要

| 項目 | 内容 |
|------|------|
| アプリ名 | English Speaking Practice |
| 目的 | AI と英語で会話練習ができる Web アプリ |
| ホスティング | GitHub Pages（GitHub Actions でビルド・デプロイ） |
| アーキテクチャ | 完全クライアントサイド SPA（サーバー不要） |

## 2. 技術スタック

| 領域 | 技術 | バージョン |
|------|------|-----------|
| フレームワーク | Vue 3 (Composition API) | ^3.5 |
| ビルドツール | Vite | ^6.x |
| 言語 | TypeScript | ^5.x |
| 音声認識 (STT) | Azure Cognitive Services Speech SDK | ^1.x (npm) |
| 音声合成 (TTS) | Azure Cognitive Services Speech SDK | 同上 |
| AI 会話 | Azure OpenAI REST API (v1 互換) | デフォルト: gpt-4.1-nano |
| スタイリング | CSS (カスタムプロパティ) | — |
| デプロイ | GitHub Actions → GitHub Pages | — |

## 3. 機能一覧

### 3.1 コア機能

| # | 機能 | 説明 |
|---|------|------|
| F1 | 音声入力 | マイクから英語音声を認識してテキスト化（Azure Speech **連続認識**）|
| F2 | AI 応答生成 | 認識テキストを Azure OpenAI に送信し、**ストリーミング**で英語応答を生成 |
| F3 | 音声出力 | AI の応答を**文単位で順次読み上げ**（Azure Speech TTS キュー）|
| F4 | 会話履歴表示 | ユーザーと AI の会話をチャット形式で表示 |
| F5 | 設定画面 | API キー・リージョンなどの接続情報を入力・保存 |

### 3.2 補助機能

| # | 機能 | 説明 |
|---|------|------|
| F6 | テキスト入力 | キーボードからも英語を入力可能（音声が使えない環境向け） |
| F7 | 会話リセット | 会話履歴をクリアして最初からやり直し（履歴は Ref 保持のみ、リロードでリセット）|
| F8 | TTS 音声選択 | 読み上げ音声の種類を設定で選択可能 |
| F9 | システムプロンプト設定 | AI の役割・会話シナリオをカスタマイズ |

## 4. アーキテクチャ

### 4.1 全体構成図

```
┌─────────────────────────────────────────────────┐
│                  Browser (SPA)                   │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │ Settings  │  │   Chat   │  │  Speech       │  │
│  │  View     │  │   View   │  │  Controls     │  │
│  └────┬─────┘  └────┬─────┘  └───────┬───────┘  │
│       │              │                │          │
│  ┌────▼──────────────▼────────────────▼───────┐  │
│  │           Composables Layer                │  │
│  │  useSettings / useChat / useSpeech         │  │
│  │          useConversation (orchestrator)     │  │
│  └────┬──────────────┬────────────────┬───────┘  │
│       │              │                │          │
│  localStorage   Azure OpenAI    Azure Speech     │
│  (API keys)     REST API        SDK (STT/TTS)    │
└─────────────────────────────────────────────────┘
         │                │                │
         ▼                ▼                ▼
    ブラウザ内       Azure OpenAI      Azure Speech
    ストレージ        Service           Service
```

### 4.2 データフロー（会話1ターン — ストリーミング対応）

```
1. 連続音声認識 (Continuous Recognition) が常時稼働
2. ユーザーが話し始めると中間結果をリアルタイム表示
3. 発話終了を自動検出 → 確定テキストを会話履歴に追加
4. 会話履歴を Azure OpenAI API にストリーミングリクエスト (stream: true)
5. レスポンスをチャンクで受信し、文単位で蓄積
6. 最初の1文が完成した時点で即座に TTS 再生開始
7. 後続の文も順次 TTS キューに追加し、連続再生
8. 全 TTS 再生完了 → 連続音声認識を再開し、次の発話を待機
```

### 4.3 状態遷移図

```
[IDLE] ──(認識開始)──▶ [LISTENING]
  ▲                        │
  │                   (発話終了検出)
  │                        ▼
  │                  [THINKING]  ← OpenAI ストリーミング中
  │                        │
  │                   (最初の文到着)
  │                        ▼
  │                  [SPEAKING]  ← TTS 文単位再生中
  │                        │
  │                   (全文再生完了)
  └────────────────────────┘
```

アプリ状態: `idle` | `listening` | `thinking` | `speaking`

## 5. コンポーネント設計

### 5.1 コンポーネントツリー

```
App.vue
├── SettingsModal.vue        # 設定モーダル（API キー入力）
├── ChatView.vue             # メイン会話画面
│   ├── MessageBubble.vue    # 個別メッセージ（user / assistant）
│   └── ChatInput.vue        # テキスト入力 + 送信ボタン
└── SpeechControls.vue       # 録音ボタン + 状態表示
```

### 5.2 Composables

| Composable | 責務 |
|------------|------|
| `useSettings()` | localStorage の読み書き、設定のバリデーション、設定完了状態の管理 |
| `useChat()` | 会話履歴の管理、Azure OpenAI **ストリーミング** API 呼び出し、文単位のチャンク分割、システムプロンプト管理 |
| `useSpeech()` | Speech SDK の初期化・破棄、**連続音声認識** (Continuous Recognition)、中間結果のリアルタイム表示、**TTS キュー管理**（文単位で順次再生）、アプリ状態遷移の制御 |
| `useConversation()` | 上記3つを統合するオーケストレーター。状態遷移 (idle→listening→thinking→speaking→idle) を管理し、各 composable を協調動作させる |

## 6. API 設計

### 6.1 Azure OpenAI（v1 互換ストリーミングチャット補完）

```
POST {endpoint}/openai/v1/chat/completions

Headers:
  api-key: {key}
  Content-Type: application/json

Body:
{
  "model": "{deployment}",
  "messages": [
    { "role": "system", "content": "You are a friendly English conversation partner..." },
    { "role": "user", "content": "Hello, how are you?" },
    { "role": "assistant", "content": "I'm doing great! ..." },
    ...
  ],
  "temperature": 0.7,
  "max_tokens": 256,
  "stream": true
}
```

**ストリーミング処理フロー:**
```typescript
// fetch + ReadableStream で SSE を読み取り
const response = await fetch(url, { method: 'POST', headers, body });
const reader = response.body.getReader();
const decoder = new TextDecoder();

let sentenceBuffer = '';
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const chunk = decoder.decode(value);
  // data: {"choices":[{"delta":{"content":"..."}}]} を解析
  sentenceBuffer += parsedContent;
  // 文末 (.!?) を検出したら TTS キューに投入
  if (/[.!?]\s*$/.test(sentenceBuffer)) {
    ttsQueue.enqueue(sentenceBuffer);
    sentenceBuffer = '';
  }
}
```

### 6.2 Azure Speech SDK（連続認識 + TTS キュー）

```typescript
// === STT: 連続音声認識 ===
const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(key, region);
speechConfig.speechRecognitionLanguage = "en-US";
const recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);

// 中間結果（リアルタイム表示用）
recognizer.recognizing = (s, e) => {
  interimText.value = e.result.text;  // 話している途中のテキスト
};

// 確定結果（発話終了検出）
recognizer.recognized = (s, e) => {
  if (e.result.reason === ResultReason.RecognizedSpeech) {
    finalText.value = e.result.text;  // 確定テキスト → OpenAI へ送信
  }
};

recognizer.startContinuousRecognitionAsync();  // 連続認識開始
recognizer.stopContinuousRecognitionAsync();   // AI応答中は停止

// === TTS: 文単位キュー再生 ===
class TtsQueue {
  private queue: string[] = [];
  private isPlaying = false;

  enqueue(sentence: string) {
    this.queue.push(sentence);
    if (!this.isPlaying) this.playNext();
  }

  private async playNext() {
    if (this.queue.length === 0) { this.isPlaying = false; return; }
    this.isPlaying = true;
    const text = this.queue.shift()!;
    await speakAsync(text);  // SpeechSynthesizer.speakTextAsync をPromise化
    this.playNext();
  }
}
```

## 7. 設定項目

localStorage に保存する設定値:

| キー | 説明 | 例 |
|------|------|----|
| `speech_region` | Azure Speech リージョン | `japaneast` |
| `speech_key` | Azure Speech サブスクリプションキー | `abc123...` |
| `openai_endpoint` | Azure OpenAI エンドポイント | `https://xxx.openai.azure.com` |
| `openai_key` | Azure OpenAI API キー | `def456...` |
| `openai_deployment` | デプロイメント名 | `gpt-4.1-nano` |
| `tts_voice` | TTS 音声名（デフォルト: `en-US-JennyNeural`） | `en-US-JennyNeural` |
| `system_prompt` | システムプロンプト | `You are a friendly English conversation tutor. Help the user practice speaking English naturally. Keep responses concise (2-3 sentences). Gently correct grammar mistakes.` |

## 8. 詳細設計

→ [detailed-design.md](./detailed-design.md) を参照

- 型定義（`AppState`, `ChatMessage`, `AppSettings`, `AppError` 等）
- Composable インターフェース（`useSettings`, `useChat`, `useSpeech`, `useConversation`）
- エラーハンドリング設計
- Azure OpenAI ストリーミング SSE パース仕様

## 8.5 テスト設計

→ [test-design.md](./test-design.md) を参照

- テスト方針（Vitest + @vue/test-utils）
- Composable テスト（38ケース）
- コンポーネントテスト（13ケース）
- モック設計（fetch SSE / localStorage / Speech SDK）
- CI 統合

## 9. UI デザイン方針

### 9.1 画面レイアウト

```
┌─────────────────────────────────────┐
│  English Speaking Practice    ⚙️    │  ← ヘッダー（設定ボタン）
├─────────────────────────────────────┤
│                                     │
│  🤖 Hello! Ready to practice?      │  ← AI メッセージ（左寄せ）
│                                     │
│         Hi, how are you? 👤        │  ← ユーザーメッセージ（右寄せ）
│                                     │
│  🤖 I'm doing great! What would   │
│     you like to talk about?         │
│                                     │
│                                     │
├─────────────────────────────────────┤
│  [📝 Type a message...    ] [Send] │  ← テキスト入力
│       [ 🎤 Start ] / [ ⏹ Stop ]    │  ← 会話 Start/Stop トグル
└─────────────────────────────────────┘
```

### 9.2 テーマ

- ライトテーマベース
- 落ち着いた配色（学習アプリとして集中しやすい）
- フォント: システムフォント（追加読み込み不要）

## 10. ディレクトリ構成

```
english-speak/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── src/
│   ├── main.ts                  # エントリーポイント
│   ├── App.vue                  # ルートコンポーネント
│   ├── components/
│   │   ├── SettingsModal.vue    # 設定モーダル
│   │   ├── ChatView.vue         # 会話表示
│   │   ├── MessageBubble.vue    # メッセージ吹き出し
│   │   ├── ChatInput.vue        # テキスト入力
│   │   └── SpeechControls.vue   # 会話 Start/Stop ボタン
│   ├── composables/
│   │   ├── useSettings.ts       # 設定管理
│   │   ├── useChat.ts           # 会話ロジック（ストリーミング）
│   │   ├── useSpeech.ts         # 音声認識・合成（連続認識 + TTSキュー）
│   │   └── useConversation.ts   # 状態遷移オーケストレーター
│   │                            # （useSettings / useChat / useSpeech を統合）
│   ├── types/
│   │   └── index.ts             # 型定義
│   └── assets/
│       └── style.css            # グローバルスタイル
├── docs/
│   ├── design.md                # 基本設計
│   ├── detailed-design.md       # 詳細設計
│   └── test-design.md           # テスト設計
├── .github/
│   ├── workflows/
│   │   └── deploy.yml           # GitHub Pages デプロイ
│   └── agents/
│       ├── english-speak.agent.md   # メイン開発エージェント
│       ├── design-checker.agent.md  # 設計準拠チェックエージェント
│       └── test-writer.agent.md     # テスト作成エージェント
├── .devcontainer/
│   └── devcontainer.json        # Dev Container 設定
├── .gitignore
└── README.md
```

## 11. 開発環境

### Dev Container

Docker + VS Code Dev Containers 拡張で、環境構築なしに開発を開始できる。

| 項目 | 設定 |
|------|------|
| ベースイメージ | `mcr.microsoft.com/devcontainers/typescript-node:20` |
| 自動インストール拡張 | Volar, ESLint, Prettier, GitHub Copilot |
| ポートフォワード | 5173（Vite dev server） |
| 初期化コマンド | `npm install`（コンテナ作成時に自動実行） |

**使い方:**
1. VS Code で「Reopen in Container」を選択
2. コンテナ起動後、自動で `npm install` が実行される
3. `npm run dev` で開発サーバー起動 → `localhost:5173` でアクセス

## 12. GitHub Pages デプロイ

### GitHub Actions ワークフロー概要

```
trigger: push to main
steps:
  1. Checkout
  2. Setup Node.js
  3. npm ci
  4. npx vitest --run  (テスト実行、失敗時はここで停止)
  5. npm run build
  6. Deploy dist/ to GitHub Pages
```

Vite の `base` 設定をリポジトリ名に合わせる:
```ts
// vite.config.ts
export default defineConfig({
  base: '/English_speak/',  // リポジトリ名
})
```

## 13. セキュリティ考慮事項

| リスク | 対策 |
|--------|------|
| API キーの漏洩（ソースコード） | コードに含めない。localStorage から読み取り |
| API キーの漏洩（ブラウザ） | 個人利用前提。共有PCでは使わない旨を注記 |
| XSS | Vue のテンプレートが自動エスケープ。`v-html` を使用しない |
| CORS | Azure OpenAI リソースで CORS 許可オリジン設定が必要。Azure Portal > リソース > ネットワーク で `*` または GitHub Pages の URL を追加。Speech SDK はブラウザ対応済みで追加設定不要 |

## 14. 今後の拡張案（スコープ外）

- 発音評価（Azure Speech Pronunciation Assessment API）
- 会話ログのエクスポート（JSON/テキスト）
- 複数会話シナリオのプリセット
- PWA 対応（オフライン時のUI表示）
