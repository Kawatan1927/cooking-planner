# AWS CDK 廃止とローカル起動スクリプト整備 設計

## 背景

Issue #131 では、デプロイ先を AWS CDK 管理のクラウド構成から、ローカル PC 上で常時起動する Hono サーバー構成へ移行する。CDK スタック定義と CDK CI は不要になるため削除し、日常運用で使う起動コマンドと関連ドキュメントを現行構成に合わせる。

仕様書 `docs/01-vision-and-scope.md` から `docs/05-architecture-notes.md` はソースオブトゥルースであり、Issue の制約に従って変更しない。

## 対象範囲

- `infra/` の CDK 定義を削除する。
- `.github/workflows/cdk-ci.yml` を削除する。
- root `package.json` から CDK 関連 scripts を削除する。
- root `package.json` にローカル運用用 scripts を追加する。
  - `bun run dev`: Vite dev server と Hono backend を並行起動する。
  - `bun run start`: frontend をビルドしてから Hono backend を本番相当で起動する。
- `.env.example` を現行構成に合わせる。
  - AWS / Cognito 関連変数は含めない。
  - backend 用の `PORT`, `DATABASE_URL`, `DEV_USER_ID`, `CLOUDFLARE_ACCESS_TEAM_NAME`, `CLOUDFLARE_ACCESS_AUD` を整理する。
  - frontend 用の `VITE_API_BASE_URL` を整理する。
- `lefthook.yml` から CDK 用チェックを削除する。
- 運用文書を現行構成に合わせて更新する。
  - `AGENTS.md`
  - `README.md`
  - `CONTRIBUTING.md`
  - `docs/docs/**`

## 対象外

- AWS リソースの削除手順や destroy 相当の自動化は追加しない。
- Cloudflare Tunnel の詳細設定は別 Issue の範囲として扱う。
- `docs/01-vision-and-scope.md` から `docs/05-architecture-notes.md` は変更しない。
- Docusaurus サイトの全面的な情報設計再編は行わない。既存ページの矛盾解消に留める。

## 起動コマンド設計

`bun run dev` は frontend と backend の既存サブコマンドを組み合わせる。frontend は port 5173、backend は port 3000 で起動する前提とする。追加依存は増やさず、Bun scripts か小さなローカル起動 script で並行起動する。

`bun run start` は production 相当の導線として、まず `frontend` をビルドし、その成果物を backend の Hono サーバーが配信する。backend 側の既存 `bun run start` が本番相当の起動点になる。

## CI / hooks 設計

CDK 専用 CI は削除する。backend CI は既に `backend/` を対象にしているため維持し、root の集約 scripts から CDK 参照を外すことで `bun run lint`, `bun run format:check`, `bun run type-check`, `bun run build:all` が現行構成のみを検証する状態にする。

`lefthook.yml` は frontend と backend のチェックだけを残す。`infra/**` を対象にした pre-push build と `infra/{bin,lib}` を対象にした pre-commit check は削除する。

## ドキュメント設計

運用文書は、旧 AWS 構成の説明を現行構成に置き換える。

- AWS Lambda / API Gateway / DynamoDB / Cognito / CDK / S3 / CloudFront を前提にした説明を削除または置換する。
- backend は `backend/` の Bun + Hono サーバーとして記載する。
- データストアは PostgreSQL として記載する。
- 認証は Cloudflare Access、公開は Cloudflare Tunnel として記載する。
- セットアップやメンテナンス手順は、`frontend/`, `backend/`, `docs/` の Bun コマンドを中心にする。

## 検証

実装後に以下を実行する。

- `bun run lint`
- `bun run format:check`
- `bun run type-check`
- `bun run build:all`
- `bun run test`

起動確認として、短時間だけ `bun run dev` を起動し frontend port 5173 と backend port 3000 の応答を確認する。さらに `bun run start` を起動し、`/health` と frontend 静的ファイル配信の応答を確認する。

## リスクと対策

- `infra/` 削除後は CDK デプロイができなくなる。これは Issue の目的どおりであり、PR で明示する。
- 運用文書更新の範囲が広いため、仕様書と重複する記述は過度に作り込まず、現行構成との矛盾解消に限定する。
- `.serena/project.yml` に既存の未コミット差分があるため、Issue #131 のコミットには含めない。
