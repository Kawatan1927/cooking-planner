# Cloudflare Access 認証移行設計

## 対象 Issue

- https://github.com/Kawatan1927/cooking-planner/issues/129

## 方針

Cooking Planner は当面、開発者本人だけが利用する個人用アプリとして扱う。外部公開時の認証境界は Cloudflare Access に置き、アプリ内では Cognito のログイン、コールバック、トークン保存、Authorization ヘッダ付与を行わない。

バックエンドは Cloudflare Access を通過したリクエストだけが届く前提で、Cloudflare Access JWT の署名検証は実装しない。これは `docs/04-api-design.md` と `docs/05-architecture-notes.md` の現行方針を優先した判断である。

## スコープ

### やること

- フロントエンドから Cognito Hosted UI 連携コードを削除する。
- フロントエンドの API 呼び出しから認証トークン引き回しと Authorization ヘッダ付与を削除する。
- ルーティングから Cognito 用の `/callback` とアプリ内ログインガードを削除する。
- `/login` は Cloudflare Access 前段認証の説明またはダッシュボードへの戻り口として軽量化する。
- バックエンドの `getUserId(c)` は `DEV_USER_ID` を返す単一ユーザー向け実装として正式化する。
- Cognito を前提にした README、実装メモ、CDK 関連の記述または依存を整理する。

### やらないこと

- Cloudflare Tunnel や Cloudflare Access ポリシーのセットアップ。
- Cloudflare Access JWT の JWKS 取得、署名検証、audience 検証。
- DB スキーマの変更。
- 複数ユーザーやロール管理の追加。

## フロントエンド設計

`frontend/src/lib/apiClient.ts` は `VITE_API_BASE_URL` と JSON 通信だけを扱う。`token` オプション、localStorage の Cognito token 参照、Authorization ヘッダ付与を削除する。

各 feature hook は `useAuthToken()` を呼ばず、API ラッパーも token 引数を受け取らない。API 呼び出しの権限は Cloudflare Access のセッション Cookie と前段ポリシーに委ねる。

`ProtectedRoute` と `AuthProvider` は不要になるため、通常ページは `AppLayout` 配下に直接配置する。`/login` は Cloudflare Access が未認証アクセスを遮断するため実質的には通常到達しないが、既存導線との互換性として残し、アプリへ戻る簡単なページにする。

## バックエンド設計

`backend/src/shared/auth.ts` は `DEV_USER_ID` を userId として返す。未設定時は `local-dev-user` を使う。Hono 側で JWT を検証しないため、業務ハンドラーは従来どおり `getUserId(c)` から userId を取得するだけでよい。

ローカル開発と本番のどちらでも同じ `DEV_USER_ID` を使える。単一ユーザー運用では値を固定すれば既存データの `user_id` スコープを維持できる。

## ドキュメントとインフラ整理

仕様書本体 `docs/01-vision-and-scope.md` から `docs/05-architecture-notes.md` は既に Cloudflare Access 方針と概ね一致しているため、自動エージェントでは変更しない。

一方で `backend/README.md`、`backend/IMPLEMENTATION_NOTES.md`、`infra/AGENTS.md`、`infra/CDK_INTEGRATION.md`、`infra/lib/cooking-planner-stack.ts`、`infra/bin/cooking-planner.ts` には Cognito や旧 AWS 構成の残存がある。Issue #129 では、現在の Hono + PostgreSQL + Cloudflare Tunnel 構成に合わない Cognito 依存を削除または明確に非対象化する。

## テスト方針

- フロントエンド: type-check と build で Cognito import の撤去漏れを検出する。
- バックエンド: `getUserId` の単体テストを追加し、`DEV_USER_ID` 指定時と未指定時の挙動を確認する。
- リポジトリ全体: `bun run lint`、`bun run format:check`、`bun run type-check`、`bun run build:all` を PR 前チェックとして実行する。

## リスクと対応

- Cognito token を前提にした hook や API wrapper の型が残ると、削除後にコンパイルエラーになる。呼び出し元から順に token 引数を取り除く。
- 既存データの `user_id` と `DEV_USER_ID` が変わるとデータが見えなくなる。README に `DEV_USER_ID` を固定する運用を明記する。
- Cloudflare Access を経由せず Hono に直接到達できると認証境界が崩れる。`docs/05-architecture-notes.md` のとおり、Hono は `127.0.0.1` にバインドする前提を維持する。
