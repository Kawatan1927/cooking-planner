# frontend AGENTS.md

## 参照する docs

- 画面と振る舞いは `docs/docs/features/screens.md`
- API の入出力は `docs/docs/features/api-design.md`
- 環境変数や全体構成は必要に応じて `docs/docs/development/environment-variables.mdx` と `docs/docs/architecture/overview.md`

## 実装ルール

- API 呼び出しは `src/lib/apiClient.ts` 経由で行ってください。
- エンドポイント単位の API ラッパーは `src/features/<domain>/api/` に置いてください。
- サーバー状態は React Query のカスタムフックで扱ってください。
- 機能追加は `src/features/<domain>/` を優先して配置してください。
- 画面追加や導線変更を行う場合は、既存のルーティング構成と `/login` 導線を崩さないでください。

## よく使うコマンド

- `bun run frontend:dev`
- `bun run frontend:lint`
- `bun run frontend:format:check`
- `bun run frontend:type-check`
- `bun run frontend:build`
- `bun run frontend:test`
