# English Speaking Practice App — テスト設計

> 基本設計: [design.md](./design.md) | 詳細設計: [detailed-design.md](./detailed-design.md)

## 1. テスト方針

| 方針 | 内容 |
|------|------|
| テストフレームワーク | Vitest |
| コンポーネントテスト | @vue/test-utils + happy-dom |
| モック | vitest の vi.mock / vi.fn |
| 外部 API | モック化（Azure サービスには接続しない） |
| カバレッジ目標 | Composables 80%以上、コンポーネント主要パス |

### テスト対象の優先度

```
[高] Composables（ビジネスロジック）
 │    useSettings / useChat / useSpeech / useConversation
 │
[中] コンポーネント（UI ロジック）
 │    SettingsModal / ChatView / SpeechControls
 │
[低] 表示のみのコンポーネント
      MessageBubble / ChatInput
```

外部 SDK (Speech SDK) と API (Azure OpenAI) はモック化し、ユニットテストでロジックを検証する。

## 2. ディレクトリ構成

```
src/
├── composables/
│   ├── useSettings.ts
│   ├── useSettings.test.ts      ← コロケーション
│   ├── useChat.ts
│   ├── useChat.test.ts
│   ├── useSpeech.ts
│   ├── useSpeech.test.ts
│   ├── useConversation.ts
│   └── useConversation.test.ts
├── components/
│   ├── SettingsModal.vue
│   ├── SettingsModal.test.ts
│   ├── ChatView.vue
│   ├── ChatView.test.ts
│   ├── SpeechControls.vue
│   └── SpeechControls.test.ts
```

## 3. Composable テスト

### 3.1 `useSettings`

| # | テストケース | 検証内容 |
|---|------------|---------|
| S1 | 初回ロード（localStorage 空） | デフォルト値が返される |
| S2 | 設定の保存と読み込み | save → load で同じ値が取れる |
| S3 | バリデーション（全項目入力済み） | `isConfigured = true` |
| S4 | バリデーション（必須項目欠落） | `isConfigured = false`、errors に欠落項目 |
| S5 | 設定クリア | clear 後に `isConfigured = false` |
| S6 | endpoint の形式チェック | `https://` で始まらない場合にエラー |

### 3.2 `useChat`

| # | テストケース | 検証内容 |
|---|------------|---------|
| C1 | メッセージ送信 | messages に user メッセージが追加される |
| C2 | ストリーミング受信 | fetch モックから SSE チャンクを流し、currentAssistantText が逐次更新される |
| C3 | 文分割コールバック | `onSentence` が文末 `.!?` で発火する |
| C4 | 文分割 — 略語 | `Mr.` `Dr.` で誤分割されない |
| C5 | 文分割 — 省略記号 | `...` で文分割される |
| C6 | ストリーム完了 | messages に assistant メッセージが追加される、`isStreaming = false` |
| C7 | 401 エラー | error に `source: 'openai'` がセットされる |
| C8 | 429 エラー | error メッセージにレート制限の旨が含まれる |
| C9 | ネットワークエラー | fetch 失敗時に error がセットされる |
| C10 | ストリーム中断 | 途中のテキストが保持される + error がセットされる |
| C11 | 会話履歴クリア | clearHistory 後に messages が空（system prompt のみ） |
| C12 | システムプロンプト変更 | setSystemPrompt が messages[0] に反映される |

### 3.3 `useSpeech`

Speech SDK はモック化して振る舞いをシミュレーションする。

```typescript
// モック例
vi.mock('microsoft-cognitiveservices-speech-sdk', () => ({
  SpeechConfig: { fromSubscription: vi.fn(() => mockSpeechConfig) },
  SpeechRecognizer: vi.fn(() => mockRecognizer),
  SpeechSynthesizer: vi.fn(() => mockSynthesizer),
  AudioConfig: { fromDefaultMicrophoneInput: vi.fn(), fromDefaultSpeakerOutput: vi.fn() },
  ResultReason: { RecognizedSpeech: 1, NoMatch: 2 },
}));
```

| # | テストケース | 検証内容 |
|---|------------|---------|
| SP1 | 連続認識開始 | `startContinuousRecognitionAsync` が呼ばれる |
| SP2 | 中間結果コールバック | `recognizing` イベント → `onRecognizing` が発火 |
| SP3 | 確定結果コールバック | `recognized` イベント → `onRecognized` が発火 |
| SP4 | 認識停止 | `stopContinuousRecognitionAsync` が呼ばれる |
| SP5 | TTS キュー — 単文 | enqueueSpeech → `speakTextAsync` が1回呼ばれる |
| SP6 | TTS キュー — 複数文 | 3文 enqueue → 順番に `speakTextAsync` が3回呼ばれる |
| SP7 | TTS キャンセル | cancelSpeech → キューがクリアされる |
| SP8 | TTS 完了待ち | waitForSpeechEnd → 全文再生後に resolve |
| SP9 | マイク権限エラー | `canceled` イベント → error がセットされる |
| SP10 | 認証エラー | `canceled` (AuthFailure) → error.source = 'speech' |
| SP11 | dispose | recognizer と synthesizer が close される |

### 3.4 `useConversation`

useChat と useSpeech をモック化し、オーケストレーションのみをテスト。

| # | テストケース | 検証内容 |
|---|------------|---------|
| CV1 | 会話開始 | start() → appState = 'listening'、startListening 呼び出し |
| CV2 | 音声認識 → AI応答 | onRecognized 発火 → appState = 'thinking'、sendMessage 呼び出し |
| CV3 | AI応答 → TTS | onSentence 発火 → appState = 'speaking'、enqueueSpeech 呼び出し |
| CV4 | TTS完了 → 次の聞き取り | TTS完了 → appState = 'listening'、startListening 再呼び出し |
| CV5 | テキスト入力 | sendText() → appState = 'thinking'、stopListening → sendMessage |
| CV6 | 会話停止 | stop() → appState = 'idle'、stopListening 呼び出し |
| CV7 | リセット | reset() → messages クリア、appState = 'idle' |
| CV8 | エラー発生時 | openai エラー → appState = 'idle' にリセット |
| CV9 | 状態の排他制御 | speaking 中に recognized が来ても無視される |

## 4. コンポーネントテスト

### 4.1 `SettingsModal`

| # | テストケース | 検証内容 |
|---|------------|---------|
| SM1 | 表示/非表示 | props.show で表示切替 |
| SM2 | 既存設定の反映 | localStorage の値が入力欄に表示される |
| SM3 | 保存ボタン | 全項目入力 → save イベント emit |
| SM4 | バリデーションエラー | 必須項目空 → エラーメッセージ表示、保存不可 |
| SM5 | キャンセル | 変更を破棄して閉じる |

### 4.2 `ChatView`

| # | テストケース | 検証内容 |
|---|------------|---------|
| CH1 | メッセージ表示 | messages 配列の内容が MessageBubble として描画される |
| CH2 | 自動スクロール | 新メッセージ追加時に最下部にスクロール |
| CH3 | ストリーミング表示 | currentAssistantText が assistant バブルにリアルタイム反映 |
| CH4 | 中間テキスト表示 | interimText が表示される（薄い色） |

### 4.3 `SpeechControls`

| # | テストケース | 検証内容 |
|---|------------|---------|
| SC1 | idle 状態 | 「Start」ボタン表示 |
| SC2 | listening 状態 | 録音インジケーター表示 + 「Stop」ボタン |
| SC3 | thinking 状態 | ローディング表示 |
| SC4 | speaking 状態 | スピーカーアニメーション表示 |

## 5. テスト用モック設計

### 5.1 fetch モック（OpenAI ストリーミング）

```typescript
function createStreamResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        const data = JSON.stringify({
          choices: [{ index: 0, delta: { content: chunk }, finish_reason: null }],
        });
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

// 使用例
vi.stubGlobal('fetch', vi.fn(() =>
  Promise.resolve(createStreamResponse(["I'm ", "doing ", "great! ", "How ", "are ", "you?"]))
));
```

### 5.2 localStorage モック

```typescript
const store: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
  removeItem: vi.fn((key: string) => { delete store[key]; }),
  clear: vi.fn(() => { Object.keys(store).forEach(k => delete store[k]); }),
});
```

### 5.3 Speech SDK モック

```typescript
function createMockRecognizer() {
  let recognizingCb: Function | null = null;
  let recognizedCb: Function | null = null;
  let canceledCb: Function | null = null;

  return {
    // コールバック登録
    set recognizing(cb: Function) { recognizingCb = cb; },
    set recognized(cb: Function) { recognizedCb = cb; },
    set canceled(cb: Function) { canceledCb = cb; },

    startContinuousRecognitionAsync: vi.fn((success) => success?.()),
    stopContinuousRecognitionAsync: vi.fn((success) => success?.()),
    close: vi.fn(),

    // テストから発火
    _fireRecognizing: (text: string) => recognizingCb?.(null, { result: { text } }),
    _fireRecognized: (text: string) => recognizedCb?.(null, {
      result: { text, reason: 1 /* RecognizedSpeech */ },
    }),
    _fireCanceled: (reason: string) => canceledCb?.(null, { reason }),
  };
}

function createMockSynthesizer() {
  return {
    speakTextAsync: vi.fn((text, onResult, onError) => {
      onResult?.({ reason: 1 /* SynthesizingAudioCompleted */ });
    }),
    close: vi.fn(),
  };
}
```

## 6. テスト実行

```bash
# 全テスト実行
npx vitest

# カバレッジ付き
npx vitest --coverage

# 特定ファイル
npx vitest useChat

# ウォッチモード（開発中）
npx vitest --watch
```

## 7. CI 統合

GitHub Actions の deploy.yml に組み込み:

```yaml
steps:
  - uses: actions/checkout@v4
  - uses: actions/setup-node@v4
    with:
      node-version: '20'
  - run: npm ci
  - run: npx vitest --run              # ← テスト実行
  - run: npm run build
  # ... deploy steps
```

テスト失敗時はビルド・デプロイをスキップ。
