# lambda AGENTS.md

## 参照する docs

- データモデルは `docs/03-domain-and-data-model.md`
- API の入出力は `docs/04-api-design.md`
- 環境変数や構成変更は必要に応じて `docs/05-architecture-notes.md`

## 実装ルール

- 既存の API Gateway イベント直接処理の構成に合わせて実装してください。
- ハンドラー追加時は既存のドメイン単位の分割に合わせてください。
- DynamoDB との通信は AWS SDK v3 を使ってください。
- `userId` は Cognito の JWT claims から一貫した方法で取得してください。
- DynamoDB 操作では `userId` を条件に含めてください。
- エラーレスポンスは `docs/04-api-design.md` の形式に合わせてください。

## よく使うコマンド

- `npm run lambda:type-check`
- `npm run lambda:build`
- `npm run lambda:watch`
- `npm run lambda:rebuild`
