---
id: backend
title: バックエンド
sidebar_position: 3
---

## 技術スタック

- AWS Lambda (Node.js + TypeScript)
  - 1つの Lambda 関数で複数パスをさばく小規模モノリス構成
- API Gateway HTTP API
  - Cognito User Pool を用いた JWT 認証（Authorizer）
- DynamoDB
  - `Recipes`, `RecipeIngredients`, `Menus` などのテーブル
  - 当面はユーザーは 1人前提だが、`userId` 属性は持たせておく
- Amazon Cognito User Pool
  - SPA 向けの App Client
  - Hosted UI or フロントから直接トークン取得

## 設計方針

### Serverless（Lambda + API Gateway）

- 常時稼働のサーバー（EC2 / App Runner）を持たないため、**個人利用に適した料金体系**になる。
- トラフィックが少ない前提であれば、Lambda のコールドスタートも許容範囲。
- Spring Boot などの重量級フレームワークを使わず、シンプルな TypeScript/Node.js コードで実装できる。

### DynamoDB 選定理由

- データ量は少なく、スキーマも比較的単純。
- 「レシピ」「献立」「材料」などのエンティティが明確なキー構造を持っており、NoSQL で問題ない。
- フルマネージドで、オートスケーリング・運用負荷が低い。
- RDS よりもコストと運用を抑えられる。

### Cognito 認証

- 一般公開はせず、**自分専用のアプリにログインをかけたい**。
- Amazon Cognito User Pool を利用することで、
  - ID/パスワード管理
  - Hosted UI（ログイン画面）
  - JWT 発行
    をマネージドで利用できる。
- API Gateway の JWT Authorizer と相性が良い。

## セキュリティ・アクセス制御

### 認証

- Cognito User Pool にユーザーを 1人（自分）登録。
- SPA から Cognito Hosted UI でログインし、トークンを取得。
- API 呼び出し時は `Authorization: Bearer <JWT>` ヘッダを付与。

### 認可（Lambda 側）

- Lambda 内で `userId` を決定するためのルール：
  - JWT の `sub` or `email` を `userId` として扱う
- DynamoDB 操作時に必ず `userId` をキー条件に含めることで、他ユーザーのデータを誤って読むことを防ぐ。

（現時点ではユーザーは 1人だが、実装パターンとしては多ユーザーを前提とした書き方にしておく。）

### 通信の保護

- すべてのフロントアクセスは HTTPS（CloudFront + ACM 証明書）
- API Gateway エンドポイントも HTTPS のみ

## 環境変数（Lambda 側）

Lambda の環境変数として設定：

| 変数名                          | 説明                           |
| ------------------------------- | ------------------------------ |
| `RECIPES_TABLE_NAME`            | Recipes テーブル名             |
| `RECIPE_INGREDIENTS_TABLE_NAME` | RecipeIngredients テーブル名   |
| `MENUS_TABLE_NAME`              | Menus テーブル名               |
| `PANTRY_ITEMS_TABLE_NAME`       | PantryItems テーブル名（将来） |

CDK スタック内で DynamoDB テーブル生成時に名前を決め、その名前を Lambda の環境変数として渡す。
