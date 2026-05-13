# English Speaking Practice

AI と英語で会話練習ができる Web アプリ。Azure Speech SDK（音声認識・合成）と Azure OpenAI（会話生成）を使用。

## デモ

GitHub Pages: `https://tkudo-ms.github.io/English_speak/`

## 必要なもの

- **Azure Speech Service** のキーとリージョン
- **Azure OpenAI Service** のエンドポイント、APIキー、デプロイメント名

> ⚠️ API キーはブラウザの localStorage に保存されます。個人利用を前提としています。

## セットアップ

```bash
npm install
npm run dev
```

ブラウザで `http://localhost:5173/English_speak/` を開き、⚙️ ボタンから API キーを設定してください。

## API キーの取得方法

### Azure Speech Service
1. [Azure Portal](https://portal.azure.com) で「Speech Services」リソースを作成
2. 「キーとエンドポイント」からキーとリージョンをコピー

### Azure OpenAI Service
1. [Azure Portal](https://portal.azure.com) で「Azure OpenAI」リソースを作成
2. [Azure AI Foundry](https://ai.azure.com) でモデルをデプロイ（推奨: `gpt-4.1-nano`）
3. エンドポイント URL、API キー、デプロイメント名をコピー
4. **CORS 設定**: Azure Portal > OpenAI リソース > ネットワーク で GitHub Pages の URL（または `*`）を許可オリジンに追加

## 技術スタック

- Vue 3 + Vite + TypeScript
- Azure Cognitive Services Speech SDK
- Azure OpenAI REST API (v1 互換・ストリーミング)

## 開発

```bash
npm run dev      # 開発サーバー
npm run build    # プロダクションビルド
npx vitest       # テスト実行
```

## ライセンス

MIT
