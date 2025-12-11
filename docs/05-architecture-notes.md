# 05. Architecture Notes

このドキュメントでは、本アプリケーションのアーキテクチャ構成と  
主要な技術選定・設計方針をメモとして残す。

---

## 1. 全体構成概要

### 1.1 システム構成

- フロントエンド
    - Vite + React + TypeScript による SPA
    - S3 バケットに静的ホスティング
    - CloudFront を介して配信（HTTPS / キャッシュ / ドメイン）

- バックエンド
    - AWS Lambda (Node.js + TypeScript)
        - 1つの Lambda で複数のパスを処理する小さめモノリス構成
    - API Gateway (HTTP API)
        - Lambda プロキシ統合
        - Cognito User Pool による JWT 認証

- データストア
    - DynamoDB
        - `Recipes`, `RecipeIngredients`, `Menus` など

- 認証
    - Amazon Cognito User Pool
        - SPA 用の App Client
        - Hosted UI or SDK によるログインフロー

- インフラ管理
    - AWS CDK（TypeScript or Python 想定）

---

### 1.2 コンポーネント図（ざっくり）

```mermaid
flowchart LR
  subgraph Browser
    UI[React SPA]
  end

  subgraph AWS
    CF[CloudFront]
    S3[S3 Static Hosting]
    APIGW[API Gateway HTTP API]
    LAMBDA[Lambda (Node.js)]
    DDB[(DynamoDB)]
    COG[Cognito User Pool]
  end

  UI -->|HTTPS (HTML/JS/CSS)| CF --> S3
  UI -->|HTTPS /api/* + Authorization: Bearer JWT| APIGW --> LAMBDA --> DDB
  UI -->|OIDC/OAuth| COG
  APIGW -->|JWT Authorizer| COG
````

---

## 2. 技術選定の理由

### 2.1 SPA + 静的ホスティング

* 想定ユーザーは自分1人（＋せいぜい少人数）で、
  **SEO が不要**なため SSR や SSG の必要性が低い。
* S3 + CloudFront による静的ホスティングは

    * コストが安く
    * 運用も軽い
* React SPA にすることで UI ロジックをすべてブラウザ側に集約できる。

### 2.2 Serverless（Lambda + API Gateway）構成

* 常時稼働のサーバー（EC2 / App Runner）を持たないため、
  **個人利用に適した料金体系**になる。
* トラフィックが少ない前提であれば、
  Lambda のコールドスタートも許容範囲。
* Spring Boot などの重量級フレームワークを使わず、
  シンプルな TypeScript/Node.js コードで実装できる。

### 2.3 DynamoDB 選定理由

* データ量は少なく、スキーマも比較的単純。
* 「レシピ」「献立」「材料」などのエンティティが
  明確なキー構造を持っており、NoSQLで問題ない。
* フルマネージドで、オートスケーリング・運用負荷が低い。
* RDS よりもコスト・運用を抑えられる。

### 2.4 Cognito 認証

* 一般公開はせず、**自分専用のアプリにログインをかけたい**。
* Amazon Cognito User Pool を利用することで、

    * ID/パスワード管理
    * Hosted UI（ログイン画面）
    * JWT 発行
      をマネージドで利用できる。
* API Gateway の JWT Authorizer と相性が良い。

---

## 3. 環境構成

### 3.1 想定環境

* `dev`（任意）：開発中に使う環境（必要であれば）
* `prod`：本番環境（実際に自分が使う環境）

個人開発のため、最初は `prod` のみでもよい。
CDK 上では `stage` （例：`dev` or `prod`）をパラメータとして扱えるようにしておくと、
後で環境を分けたくなった際に便利。

---

## 4. 設定値 / 環境変数

### 4.1 フロントエンド側

例：`frontend/.env` など

* `VITE_API_BASE_URL`

    * 例：`https://xxx.cloudfront.net/api`
* `VITE_COGNITO_USER_POOL_ID`
* `VITE_COGNITO_CLIENT_ID`
* `VITE_COGNITO_REGION`
* `VITE_COGNITO_REDIRECT_URI`
* `VITE_COGNITO_LOGOUT_REDIRECT_URI`

※ セキュリティ上問題ない情報（User Pool ID, Client ID など）はフロントにも持たせる。

### 4.2 Lambda / API側

Lambda の環境変数として設定：

* `RECIPES_TABLE_NAME`
* `RECIPE_INGREDIENTS_TABLE_NAME`
* `MENUS_TABLE_NAME`
* `PANTRY_ITEMS_TABLE_NAME`（将来）
* （必要であれば）`NODE_ENV`, `LOG_LEVEL` など

CDK スタック内で DynamoDB テーブル生成時に名前を決め、
その名前を Lambda の環境変数として渡す。

---

## 5. デプロイ / CI の方針（初期）

### 5.1 手動デプロイ（初期想定）

* フロント

    * `npm run build` で `dist/` を生成
    * S3 に `sync`（`aws s3 sync dist/ s3://<bucket>/`）
    * CloudFront のキャッシュは必要に応じて無効化

* バックエンド & インフラ

    * CDK プロジェクトで `cdk deploy` を実行
    * Lambda コードは CDK 経由でデプロイ（`NodejsFunction` など）

### 5.2 CI/CD（余裕があれば）

* GitHub Actions などで、

    * mainブランチへの push / PR マージ時に

        * `npm test` / `npm run lint` を実行
        * CDK デプロイ
        * フロントのビルド＆S3デプロイ
          を自動化

---

## 6. セキュリティ・アクセス制御

### 6.1 認証

* Cognito User Pool にユーザーを1人（自分）登録。
* SPA から Cognito Hosted UI でログインし、トークンを取得。
* API 呼び出し時は `Authorization: Bearer <JWT>` ヘッダを付与。

### 6.2 認可（Lambda側）

* Lambda 内で `userId` を決定するためのルール：

    * JWT の `sub` or `email` を `userId` として扱う
* DynamoDB 操作時に必ず `userId` をキー条件に含めることで、
  他ユーザーのデータを誤って読むことを防ぐ。

（現時点ではユーザーは1人だが、実装パターンとしては多ユーザーを前提とした書き方にしておく。）

### 6.3 通信の保護

* すべてのフロントアクセスは HTTPS（CloudFront + ACM 証明書）
* API Gateway エンドポイントも HTTPS のみ

---

## 7. ログ・監視

### 7.1 CloudWatch Logs

* Lambda の標準出力（`console.log`, `console.error`）を CloudWatch Logs に送信。
* ログ設計（初期方針）：

    * APIリクエストごとに最低限の情報を出す：

        * HTTPメソッド
        * パス
        * userId（わかる範囲で）
        * ステータスコード
    * エラー時に stack trace を出力（ただし機微情報は含めない）

### 7.2 メトリクス

* 初期段階では、細かいアラートは不要。
* 必要になれば：

    * Lambda のエラーレート
    * API Gateway の 5xx レート
      に CloudWatch アラーム設定を検討。

---

## 8. 開発フロー（ざっくり）

### 8.1 ローカル開発

* フロント

    * `npm run dev`（Vite dev server）で開発
    * API は一旦モック or 実際の API Gateway を叩く（CORS 設定必要）

* バックエンド

    * ローカルで Lambda をそのまま実行して単体テスト
    * もしくは `sam local` / `lambda-local` ツールなどを使う
    * 基本は「型・ユニットテスト＋実環境の dev ステージで動作確認」という運用でもよい

### 8.2 インフラ変更時

* DynamoDB のテーブル構造や Lambda 環境変数を変更した場合：

    * `docs/03-domain-and-data-model.md` を更新
    * `cdk diff` で変更差分を確認
    * 問題なければ `cdk deploy` を実行

---

## 9. 今後のアーキ面での拡張余地（メモ）

* `Menus` の期間クエリ効率向上のための GSI 追加
* 単一テーブル設計（Single Table Design）への移行

    * 例：`PK: userId, SK: <entityType>#<id>...`
* PWA 対応（オフラインでの買い物リスト利用）
* CloudFront Functions / Lambda@Edge を使ったより細かいルーティングや認証前処理
* 家族など複数ユーザー利用を見据えた権限管理（role ベースなど）

---
