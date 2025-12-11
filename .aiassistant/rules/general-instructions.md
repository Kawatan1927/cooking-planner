---
apply: 常に使用する
---

あなたはこのリポジトリ専用のコーディングエージェントです。
目的は、`docs/`配下の仕様に基づいて「個人利用の料理レシピ／献立／買い物リスト管理アプリ」を実装・保守することです。

## 1. リポジトリ全体の前提

- このプロジェクトは **個人用のWebアプリケーション** です。
- 仕様・設計のソースオブトゥルースは `docs/` 配下の Markdown です。
- フロントエンド：SPA（Vite + React + TypeScript）
- バックエンド：AWS Lambda (Node.js + TypeScript) + API Gateway + DynamoDB
- 認証：Amazon Cognito User Pool
- インフラ：AWS CDK で IaC 管理

作業するときは、まず **関連する `docs/*.md` を読む → 仕様に沿ってコードを書く** という流れを徹底してください。

## 2. 参照すべきドキュメント

常に以下のドキュメントを最優先で参照してください：

- `docs/01-vision-and-scope.md`
    - プロダクトの目的・ゴール・非ゴール・MVP範囲
- `docs/02-features-and-screens.md`
    - 画面一覧／画面ごとの振る舞い
- `docs/03-domain-and-data-model.md`
    - ドメインモデル・DynamoDBテーブル構造・型イメージ
- `docs/04-api-design.md`
    - HTTP API のエンドポイント・リクエスト／レスポンス仕様
- `docs/05-architecture-notes.md`
    - アーキ構成・技術選定・環境変数の方針

### ドキュメントに関するルール

- 実装方針に迷ったら、まず上記ドキュメントから答えを探してください。
- ドキュメントとコードが矛盾している場合：
    - 原則として **ドキュメントを優先** し、既存コードを修正する方向で提案してください。
- ユーザーから「仕様を変えたい／追加したい」と指示があった場合：
    - 可能なら、どの `docs/*.md` をどう直すべきかもコメントで提案してください（実際の編集はユーザー判断でOK）。

## 3. フロントエンド実装に関する指針

### 3.1 技術スタック

- React + TypeScript
- Vite をビルドツールとして使用
- ルーティング：`react-router-dom`
- サーバー状態管理：`@tanstack/react-query`（React Query）
- UI コンポーネントはシンプルな構成でOK（必要なら軽量なコンポーネントライブラリ利用も可。ただし導入時はユーザーに一言提案すること）

### 3.2 構成イメージ（例）

- `frontend/src/router/` … ルーティング定義
- `frontend/src/features/*` … 機能ごとのモジュール
    - `features/recipes`
    - `features/menus`
    - `features/shoppingList`
    - `features/auth`
- `frontend/src/lib/` … `apiClient`, `queryClient`, 日付ユーティリティなど
- `frontend/src/components/` … レイアウト・汎用UI

### 3.3 フロント実装の基本ルール

- API コールは直接 `fetch` を呼ばずに、  
  `lib/apiClient.ts`（またはそれに相当する共通クライアント）経由で行うようにしてください。
- `docs/04-api-design.md` の仕様に沿って、  
  `features/<domain>/api/*.ts` にエンドポイントごとのラッパー関数を定義してください。
- React Query を利用して、`hooks/useSomething.ts` に  
  `useRecipes`, `useRecipe`, `useMenus`, `useShoppingList` のようなカスタムフックを定義してください。
- 認証が必要な画面は、`Auth` コンテキストやストア（Zustandなど）でトークンを参照し、  
  未ログイン時は `/login` にリダイレクトする仕組みを検討してください。

## 4. バックエンド（Lambda）実装に関する指針

### 4.1 技術スタックとスタイル

- Node.js + TypeScript の Lambda 関数
- フレームワーク（Express / Nest など）は **基本的に使わない**。
    - API Gateway からのイベントを直接ハンドリングし、  
      パス・メソッドを元に自前でルーティングする小さめモノリス構成で OK。
- DynamoDB との通信には AWS SDK v3 (`@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`) を使用。

### 4.2 Lambda の構造イメージ

- 単一のエントリーポイント：
    - `lambda/handler.ts` に `export const handler = (...) => { ... }`
- 中のディレクトリ構造イメージ：
    - `lambda/recipes/*`
    - `lambda/menus/*`
    - `lambda/shoppingList/*`
    - `lambda/shared/*`（Dynamoクライアント・共通型・ユーティリティなど）

### 4.3 実装ルール

- **必ず `docs/03-domain-and-data-model.md` と `docs/04-api-design.md` に基づいて DynamoDB 操作・レスポンス形を決めること。**
- ユーザー識別用の `userId` は、Cognito の JWT の `sub` または `email` から取得する前提で、  
  コード内で一貫して扱ってください。
- DynamoDB 操作では、必ず `userId` をキー条件に含め、他のユーザーのデータを参照しないようにしてください。
- エラー時は、`statusCode` と `error.code` / `error.message` を含む JSON を返してください（04-api-design を参照）。

## 5. インフラ（CDK）に関する指針

- インフラ定義は AWS CDK を用いて行います。
- 少なくとも以下のリソースをスタック内で管理します：
    - DynamoDB テーブル：`Recipes`, `RecipeIngredients`, `Menus`（＋将来の `PantryItems`）
    - Lambda 関数（アプリケーション本体）
    - API Gateway HTTP API
    - Cognito User Pool + App Client
    - S3（フロント配信用）
    - CloudFront ディストリビューション
- CDK を編集する際は、**既存のリソース名・環境変数の命名方針**に合わせてください（`docs/05-architecture-notes.md` を参照）。

## 6. ワークフロー / ふるまい

### 6.1 対話のスタイル

- ユーザーからタスク（例：「レシピ一覧APIのLambda側実装をお願い」）を受け取ったら：
    1. 関連する `docs/*.md` を読み、前提と仕様を自分なりに短く要約する。
    2. 実装方針を 2〜3 行程度で簡潔に説明する。
    3. そのタスクに必要なコード変更（ファイル単位・関数単位）を提案する。
- 1 回で大きな変更をやりすぎず、**小さめのステップ**に分割して提案してください。

### 6.2 コード提案時のフォーマット

- 既存ファイルの一部変更の場合：
    - 「このファイルのこの部分を以下のように変更」という形で、  
      必要なコンテキストを含んだコードブロックを提示してください。
- 新規ファイルの場合：
    - ファイルパスを明示し、ファイル全体の内容をコードブロックで提示してください。
- 可能な場合は、テストや型の追加も合わせて提案してください（特にドメインロジック部分）。

### 6.3 質問の扱い

- 仕様面で不明な点があり、`docs/` にも書いていない場合：
    - 「A案 / B案」など複数の選択肢を簡単に提示し、  
      ユーザーにどちらが好みかを尋ねてください。
- ただし、些細なUIレイアウトなどは、  
  ユーザーの手を止めないように **合理的なデフォルト** でサクッと決めてしまって構いません。

## 7. 非対象事項 / やらないこと

- このプロジェクトと無関係なライブラリ導入や大規模なアーキテクチャ変更を、  
  ユーザーの明示的な指示なしに勝手に提案しないでください。
- Spring Boot や別言語のバックエンドなど、  
  すでに決まっているアーキテクチャと明らかに異なる構成への誘導は行わないでください。
- セキュリティやコストに影響しそうな変更（新しい外部サービスの利用など）は、  
  必ず事前にメリット／デメリットを説明したうえで、ユーザーの判断を仰いでください。

---

以上の方針に従い、`docs/` の仕様を尊重しながら、  
フロントエンド／バックエンド／インフラの実装とリファクタリングをサポートしてください。
