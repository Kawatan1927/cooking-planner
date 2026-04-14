# Lambda Functions

このディレクトリには、Cooking Planner の Lambda 関数のコードが含まれています。

## 構成

```
infra/lambda/
├── src/
│   ├── index.ts              # メインのハンドラー (エントリーポイント)
│   ├── recipes/              # レシピ関連のロジック（実装済み）
│   └── shared/               # 共通の型・ユーティリティ
│       ├── types.ts          # 共通型定義
│       └── dynamodb.ts       # DynamoDB クライアント設定
├── dist/                     # ビルド成果物 (gitignore対象)
├── package.json
└── tsconfig.json
```

> **未実装ディレクトリ（今後の Issue で追加予定）**
>
> - `menus/` — 献立関連のロジック（[#28](https://github.com/Kawatan1927/cooking-planner/issues/28)）
> - `shoppingList/` — 買い物リスト関連のロジック（[#29](https://github.com/Kawatan1927/cooking-planner/issues/29)）

## セットアップ

```bash
# 依存パッケージのインストール
npm run lambda:install

# TypeScript のビルド
npm run lambda:build

# クリーンビルド
npm run lambda:rebuild

# Watch モード (開発時)
npm run lambda:watch
```

## 開発方針

- **小さめモノリス構成**: 1つの Lambda 関数で複数のパスを処理します
- **型安全性**: TypeScript の strict モードを有効化
- **DynamoDB アクセス**: `@aws-sdk/lib-dynamodb` を使用
- **認証**: API Gateway の JWT Authorizer で認証し、Lambda 側では `event.requestContext.authorizer.jwt.claims` から userId を取得

## ビルド成果物

`npm run lambda:build` を実行すると、`dist/` ディレクトリに以下が生成されます:

- `index.js` - Lambda ハンドラーのメインファイル
- `*.js`, `*.d.ts`, `*.map` - その他のコンパイル済みファイル

CDK スタックからは、この `dist/` ディレクトリを参照してデプロイします。

## 環境変数

Lambda 実行時に必要な環境変数 (CDK 側で設定):

- `RECIPES_TABLE_NAME` - Recipes テーブル名
- `RECIPE_INGREDIENTS_TABLE_NAME` - RecipeIngredients テーブル名
- `MENUS_TABLE_NAME` - Menus テーブル名
- `PANTRY_ITEMS_TABLE_NAME` - PantryItems テーブル名 (将来)

## ディレクトリ別の役割

### `recipes/`（実装済み）

レシピの主要操作を実装済み:

- GET /recipes - レシピ一覧取得
- POST /recipes - レシピ新規作成（材料含む）
- GET /recipes/{recipeId} - レシピ詳細取得（材料含む）

以下は今後の Issue で実装予定（[#50](https://github.com/Kawatan1927/cooking-planner/issues/50)）:

- PUT /recipes/{recipeId} - レシピ更新
- DELETE /recipes/{recipeId} - レシピ削除

### `menus/`（未実装 — [#28](https://github.com/Kawatan1927/cooking-planner/issues/28)）

献立の CRUD 操作（実装予定）:

- GET /menus - 献立一覧取得 (期間指定)
- POST /menus - 献立新規作成
- PUT /menus/{menuId} - 献立更新
- DELETE /menus/{menuId} - 献立削除

### `shoppingList/`（未実装 — [#29](https://github.com/Kawatan1927/cooking-planner/issues/29)）

買い物リストの生成ロジック（実装予定）:

- GET /shopping-list - 指定期間の献立から材料を集計

### `shared/`

共通のユーティリティや型定義:

- `types.ts` - エンティティの型定義
- `dynamodb.ts` - DynamoDB クライアント設定
