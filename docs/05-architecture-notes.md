# 05. Architecture Notes

このドキュメントでは、本アプリケーションのアーキテクチャ構成と  
主要な技術選定・設計方針をメモとして残す。

---

## 1. 全体構成概要

### 1.1 システム構成

- フロントエンド
  - Vite + React + TypeScript による SPA
  - ビルド済み静的ファイルを Hono サーバーが配信

- バックエンド
  - Hono (Bun ランタイム) — ローカルPC上で常時起動
    - API + 静的ファイル配信を担う小規模モノリス構成

- データストア
  - PostgreSQL — ローカルPC上で起動
    - `recipes`, `recipe_ingredients`, `menus` など

- ネットワーク公開
  - Cloudflare Tunnel
    - ローカルPC の Hono サーバー（指定ポート）をインターネットに公開
    - HTTPS 終端は Cloudflare 側で処理

- 認証
  - Cloudflare Access（Zero Trust）
    - Cloudflare Tunnel のエンドポイントにアクセス制御を設定
    - 未認証リクエストは Hono サーバーに到達しない

---

### 1.2 コンポーネント図（ざっくり）

```mermaid
flowchart LR
  subgraph Browser
    UI["React SPA"]
  end

  subgraph Cloudflare
    ACCESS["Cloudflare Access\n(Zero Trust)"]
    TUNNEL["Cloudflare Tunnel"]
  end

  subgraph LocalPC["ローカルPC"]
    HONO["Hono Server\n(Bun)"]
    PG[("PostgreSQL")]
  end

  UI -->|"HTTPS"| ACCESS
  ACCESS -->|"認証済みリクエスト"| TUNNEL
  TUNNEL -->|"HTTP (ローカル)"| HONO
  HONO --> PG
```

---

## 2. 技術選定の理由

### 2.1 SPA + Hono による静的ファイル配信

- 想定ユーザーは自分1人（＋せいぜい少人数）で、
  **SEO が不要**なため SSR や SSG の必要性が低い。
- API サーバーと静的ファイル配信を同一プロセスで行うことで、
  - デプロイ手順がシンプルになる
  - 本番環境では CORS 設定が不要になる（API とフロントが同一オリジン）
  - ※ 開発時は Vite dev server が別ポートで動くため、Vite の proxy 設定または Hono 側の CORS 設定が必要

- React SPA にすることで UI ロジックをすべてブラウザ側に集約できる。

### 2.2 Hono + ローカルPC 構成

- 常時稼働のクラウドサーバーを持たないため、クラウドの費用がかからない。
- Bun ランタイムにより高速な起動・実行が可能。
- Hono は軽量なため、ローカルPCのリソース消費が少ない。
- Lambda のコールドスタートや DynamoDB の制約がなく、開発・デバッグが容易。

### 2.3 PostgreSQL 選定理由

- リレーショナルなデータ構造（レシピ・材料・献立）に適している。
- SQL によるクエリが直感的で、複雑な集計（買い物リスト生成など）に向いている。
- ローカルPCで動かすため、フルマネージドサービス（DynamoDB等）の制約を受けない。
- トランザクション（ACID）が標準でサポートされている。

### 2.4 Cloudflare Access 認証

- 一般公開はせず、**自分専用のアプリにアクセス制御をかけたい**。
- Cloudflare Access を利用することで、
  - Cloudflare のダッシュボードで認証ポリシーを管理できる
  - メール OTP・Google SSO などの認証方法をコードなしで設定できる
  - Hono 側に認証ロジックを書く必要がない

- Cloudflare Tunnel と組み合わせることで、
  ローカルPCのポートを直接インターネットに開放せずに済む。

### 2.5 Cloudflare Tunnel 選定理由

- ローカルPCで動くサーバーをインターネット公開するために必要。
- ルーターへのポート開放・固定IPが不要。
- Cloudflare のエッジで HTTPS 終端するため、TLS 証明書管理が不要。
- `cloudflared` コマンド1つで起動・停止できる。

---

## 3. 環境構成

### 3.1 想定環境

- ローカルPC 上で Hono + PostgreSQL を起動し、Cloudflare Tunnel で公開する構成のみ。
- クラウド環境（dev / prod のような分離）は現時点では設けない。
- 個人開発のため、本番＝ローカルPC という前提。

---

## 4. 設定値 / 環境変数

### 4.1 フロントエンド側

例：`frontend/.env` など

- `VITE_API_BASE_URL`
  - 例：`https://<cloudflare-tunnel-domain>/api`
  - 同一オリジンのため、空文字（相対パス）でも可

※ 認証は Cloudflare Access が担うため、Cognito 関連の環境変数は不要。

### 4.2 バックエンド（Hono）側

例：`.env` など

- `PORT`
  - Hono サーバーのリスニングポート（例：`3000`）
  - Cloudflare Tunnel の転送先ポートと一致させる

- `DATABASE_URL`
  - PostgreSQL 接続文字列
  - 例：`postgresql://user:password@localhost:5432/cooking_planner`

---

## 5. デプロイ / 起動の方針

### 5.1 起動手順（ローカルPC）

1. PostgreSQL を起動する
2. Hono サーバーを起動する（例：`bun run start`）
3. Cloudflare Tunnel を起動する（例：`cloudflared tunnel run <tunnel-name>`）

### 5.2 フロントエンドのビルドと配信

- `cd frontend && bun run build`（Vite）で `frontend/dist/` を生成
- Hono サーバーが `frontend/dist/` を静的ファイルとして配信

### 5.3 CI（任意）

- GitHub Actions で `bun run lint` / `bun run type-check` / `bun run test` を実行
- デプロイは手動（ローカルPC での再起動）

### 5.4 ドキュメントサイト（GitHub Pages）

- Docusaurus で生成したドキュメントサイトを GitHub Pages で公開する。
- ワークフロー：`.github/workflows/docs-deploy.yml`
  - `main` ブランチへの push（`docs/**` 配下の変更時）に自動トリガー
  - `workflow_dispatch` で手動実行も可能
  - Bun でビルドし、`actions/deploy-pages` で GitHub Pages へデプロイ

- 公開 URL：`https://kawatan1927.github.io/cooking-planner/`

---

## 6. セキュリティ・アクセス制御

### 6.1 認証

- Cloudflare Access のポリシーで、自分のメールアドレスのみアクセスを許可。
- 未認証のリクエストは Cloudflare Access でブロックされ、Hono サーバーに到達しない。
- **重要**: Hono サーバーは `127.0.0.1`（ループバック）にのみバインドすること。
  `0.0.0.0` でバインドすると、同一LAN内のデバイスから Cloudflare Access を経由せず直接アクセスできてしまう。

### 6.2 認可（Hono側）

- 個人利用のため、厳密な多ユーザー認可は不要。
- 将来的に複数ユーザーを想定する場合は、Hono ミドルウェアで Cloudflare Access JWT を検証し、
  メールアドレスやユーザーIDをリクエストコンテキストに設定する実装を追加する。

### 6.3 通信の保護

- すべてのフロントアクセスは HTTPS（Cloudflare Tunnel + Cloudflare が HTTPS 終端）
- Cloudflare Tunnel → ローカルPC 間はローカルループバック（HTTP）で通信

---

## 7. ログ・監視

### 7.1 アプリケーションログ

- Hono の標準出力（`console.log`, `console.error`）でログを出力。
- ログ設計（初期方針）：
  - APIリクエストごとに最低限の情報を出す：
    - HTTPメソッド
    - パス
    - ステータスコード

  - エラー時に stack trace を出力（ただし機微情報は含めない）

### 7.2 メトリクス

- 初期段階では、細かい監視は不要。
- 必要になれば Cloudflare のダッシュボードでアクセスログ・トラフィックを確認できる。

---

## 8. 開発フロー（ざっくり）

### 8.1 ローカル開発

- フロント
  - `cd frontend && bun run dev`（Vite dev server）で開発
  - API は実際の Hono サーバー（ローカル）を叩く（Vite の proxy 設定または Hono 側 CORS 設定が必要）

- バックエンド
  - プロジェクトルートで `bun run dev`（Hono サーバーを Watch mode で起動）
  - PostgreSQL はローカルで起動しておく

### 8.2 スキーマ変更時

- PostgreSQL のテーブル構造を変更した場合：
  - `docs/03-domain-and-data-model.md` を更新
  - マイグレーションファイルを追加・実行

---

## 9. データ整合性とトランザクション

### 9.1 PostgreSQL トランザクション

- PostgreSQL はネイティブで ACID トランザクションをサポートしているため、
  DynamoDB 時代のような補償トランザクション（ベストエフォート）は不要。

- `PUT /recipes/{recipeId}` の実装では、単一トランザクション内で：
  1. `recipes` テーブルのレコードを更新
  2. 既存の `recipe_ingredients` を全削除
  3. 新しい `recipe_ingredients` を一括挿入

  を行い、いずれかで失敗した場合はロールバックされる。

---

## 10. 今後のアーキ面での拡張余地（メモ）

- Honoミドルウェアでの Cloudflare Access JWT 検証（多ユーザー対応時）
- PostgreSQL の接続プール設定（利用が増えた場合）
- PWA 対応（オフラインでの買い物リスト利用）
- 家族など複数ユーザー利用を見据えた権限管理（role ベースなど）

---
