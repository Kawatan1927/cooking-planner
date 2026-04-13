# infra/AGENTS.md

`infra/` 配下の AWS CDK プロジェクトに関する開発規約・方針をまとめます。

## プロジェクト構成

```
infra/
  bin/
    cooking-planner.ts   # CDK アプリのエントリポイント
  lib/
    cooking-planner-stack.ts  # ベーススタック（後続 Issue でリソースを追加）
  cdk.json             # CDK 設定・context デフォルト値
  package.json         # CDK 依存関係
  tsconfig.json        # TypeScript 設定
  CDK_INTEGRATION.md   # Lambda/API Gateway の CDK 統合方針
```

## よく使うコマンド

```bash
# 依存関係のインストール
npm install

# CloudFormation テンプレートの生成（動作確認用）
npm run synth
# または stage を指定
npx cdk synth --context stage=prod

# 変更差分の確認
npx cdk diff --context stage=prod

# デプロイ（AWS 認証情報が必要）
npx cdk deploy --context stage=prod
```

ルートから実行する場合:

```bash
npm run cdk:synth
npm run cdk:build
```

## stage パラメータの扱い方針

- `stage` は CDK context で受け取る。デフォルト値は `"dev"`。
- 有効な値は `"dev"` と `"prod"` の2種類。
- 個人開発のため、最初は `prod` のみで運用してもよい。
- スタック名は `CookingPlanner-{stage}` となる（例：`CookingPlanner-prod`）。

```bash
# dev 環境向け synth
npx cdk synth --context stage=dev

# prod 環境向け synth
npx cdk synth --context stage=prod
```

- DynamoDB テーブル名・Lambda 関数名などのリソース名には `stage` を含める規約とする。
  例：`recipes-table-prod`, `cooking-planner-api-dev`

## スタックへのリソース追加方針

`infra/lib/cooking-planner-stack.ts` にリソースを追加する。  
後続 Issue での追加予定リソース（順序は目安）:

1. DynamoDB テーブル（Recipes, RecipeIngredients, Menus など）
2. Lambda 関数（NodejsFunction を使用）
3. API Gateway HTTP API（Cognito JWT Authorizer 付き）
4. Cognito User Pool / App Client
5. S3 バケット + CloudFront ディストリビューション

詳細は `infra/CDK_INTEGRATION.md` を参照してください。

## 命名規約

- リソース ID（Construct ID）: `PascalCase`（例: `RecipesTable`, `ApiHandler`）
- AWS リソース名（`tableName`, `functionName` など）: `kebab-case-{stage}`
  - 例: `recipes-table-prod`, `cooking-planner-api-dev`
- タグ: すべてのリソースに `Project: cooking-planner`, `Stage: {stage}` を付与

## 参照ドキュメント

- `docs/05-architecture-notes.md`: アーキテクチャ全体像・stage 構成の方針
- `docs/01-vision-and-scope.md`: バックエンド/認証/配信基盤の要件
- `infra/CDK_INTEGRATION.md`: Lambda/API Gateway の CDK 統合コード例
