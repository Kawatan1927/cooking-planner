# Cooking Planner - Infrastructure (AWS CDK)

このディレクトリには、Cooking Planner アプリケーションの AWS インフラストラクチャを定義する CDK プロジェクトが含まれています。

## 概要

AWS CDK を使用して、以下のリソースを管理します：

- **DynamoDB テーブル**
  - `Recipes` - レシピ情報
  - `RecipeIngredients` - レシピの材料
  - `Menus` - 献立情報

- **Lambda 関数**
  - API バックエンド処理を実行

- **API Gateway HTTP API**
  - REST API エンドポイント

- **Cognito User Pool**
  - ユーザー認証

- **S3 + CloudFront**
  - フロントエンド静的ホスティング

## 前提条件

- Node.js 20.x 以上
- npm
- AWS CLI が設定済み（認証情報とリージョン）
- AWS CDK CLI (`npm install -g aws-cdk`)

## セットアップ

```bash
# 依存関係のインストール
npm install

# TypeScript のビルド
npm run build

# CDK プロジェクトの初期化（初回のみ、アカウント・リージョンごとに1回）
npx cdk bootstrap
```

## 主要コマンド

```bash
# TypeScript のコンパイル
npm run build

# ファイル変更の監視＆自動コンパイル
npm run watch

# テストの実行
npm test

# CloudFormation テンプレートの合成
npx cdk synth

# デプロイ前の差分確認
npx cdk diff

# スタックのデプロイ
npx cdk deploy

# スタックの削除（注意：データも削除されます）
npx cdk destroy
```

## 環境の切り替え

デフォルトでは `prod` 環境にデプロイされます。別の環境（例：`dev`）を使用する場合：

```bash
# dev 環境用のテンプレート合成
npx cdk synth -c stage=dev

# dev 環境へのデプロイ
npx cdk deploy -c stage=dev
```

## デプロイ後の出力

デプロイが完了すると、以下の情報が出力されます：

- `UserPoolId` - Cognito User Pool ID
- `UserPoolClientId` - Cognito Client ID
- `ApiEndpoint` - API Gateway のエンドポイント URL
- `DistributionDomainName` - CloudFront のドメイン名
- `FrontendBucketName` - S3 バケット名
- `RecipesTableName` - Recipes テーブル名
- `RecipeIngredientsTableName` - RecipeIngredients テーブル名
- `MenusTableName` - Menus テーブル名

これらの値はフロントエンドの環境変数設定に使用します。

## プロジェクト構造

```
infra/
├── bin/
│   └── infra.ts              # CDK アプリのエントリーポイント
├── lib/
│   └── cooking-planner-stack.ts  # メインスタック定義
├── test/
│   └── infra.test.ts         # スタックのユニットテスト
├── cdk.json                  # CDK 設定ファイル
├── package.json              # 依存関係
└── tsconfig.json            # TypeScript 設定
```

## 注意事項

### 本番環境（prod）

- DynamoDB テーブルは `RETAIN` ポリシーで保護されています
- Point-in-Time Recovery が有効化されています
- `cdk destroy` を実行してもテーブルは削除されません

### 開発環境（dev など）

- DynamoDB テーブルは `DESTROY` ポリシーです
- `cdk destroy` を実行するとテーブルも削除されます
- Point-in-Time Recovery は無効です

## 参考資料

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [プロジェクトドキュメント](/docs/)
  - [アーキテクチャ構成](/docs/05-architecture-notes.md)
  - [データモデル](/docs/03-domain-and-data-model.md)
