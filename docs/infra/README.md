# インフラストラクチャ設定ドキュメント

このディレクトリには、AWS CDK で定義されている Cooking Planner アプリケーションのインフラストラクチャリソースの設定状態をまとめたドキュメントが含まれています。

## ドキュメント一覧

### [DynamoDB テーブル設定](./dynamodb.md)

Cooking Planner で使用する3つの DynamoDB テーブルの詳細設定：

- **Recipes テーブル**: レシピ情報を保存
- **RecipeIngredients テーブル**: レシピに紐づく材料情報を保存
- **Menus テーブル**: 献立情報を保存

各テーブルのキー構造、データモデル、アクセスパターン、課金モデル、バックアップ設定などを記載。

### [Lambda 関数設定](./lambda.md)

API バックエンドを実装する Lambda 関数の設定：

- ランタイム環境（Node.js 20.x）
- 環境変数の設定
- IAM ロールと権限
- DynamoDB へのアクセス権限
- 実装予定のディレクトリ構造

### [API Gateway 設定](./api-gateway.md)

HTTP API エンドポイントを提供する API Gateway の設定：

- CORS 設定
- Lambda プロキシ統合
- ルーティング設定
- 認証設定（今後実装予定）
- ロギングとモニタリング

### [Cognito User Pool 設定](./cognito.md)

ユーザー認証を提供する Cognito User Pool の設定：

- User Pool の基本設定
- パスワードポリシー
- User Pool Client 設定
- OAuth 2.0 設定
- JWT トークンの構造
- フロントエンドでの使用方法

### [S3 + CloudFront 設定](./s3-cloudfront.md)

フロントエンド（React SPA）を配信する S3 バケットと CloudFront Distribution の設定：

- S3 バケット設定
- Origin Access Identity (OAI)
- CloudFront Distribution 設定
- エラーレスポンス設定（SPA ルーティング対応）
- キャッシュ戦略
- デプロイワークフロー

## リソース構成図

```
┌─────────────────────────────────────────────────────────────┐
│                         インターネット                         │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │   CloudFront CDN     │ ← フロントエンド配信
        │  (HTTPS 強制)        │
        └──────────┬───────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │   S3 Bucket          │ ← React SPA
        │  (Private)           │
        └──────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                      ブラウザ (SPA)                           │
└──────────────────┬──────────────────────────────────────────┘
                   │
       ┌───────────┴───────────┐
       │                       │
       ▼                       ▼
┌──────────────┐      ┌──────────────────┐
│   Cognito    │      │  API Gateway     │
│  User Pool   │      │   (HTTP API)     │
└──────────────┘      └────────┬─────────┘
                               │
                               ▼
                    ┌──────────────────┐
                    │  Lambda Function │
                    │   (Node.js 20)   │
                    └────────┬─────────┘
                             │
                 ┌───────────┼───────────┐
                 │           │           │
                 ▼           ▼           ▼
        ┌────────────┐ ┌────────────┐ ┌────────────┐
        │  Recipes   │ │  Recipe    │ │   Menus    │
        │   Table    │ │ Ingredients│ │   Table    │
        │ (DynamoDB) │ │   Table    │ │ (DynamoDB) │
        └────────────┘ └────────────┘ └────────────┘
```

## 環境設定

### 環境の種類

CDK スタックは `stage` パラメータで環境を切り替えることができます：

- **prod**: 本番環境（デフォルト）
  - リソース保持ポリシー: RETAIN
  - Point-in-Time Recovery: 有効
  - 想定用途: 実際の利用環境

- **dev**: 開発環境
  - リソース保持ポリシー: DESTROY
  - Point-in-Time Recovery: 無効
  - 想定用途: 開発・テスト環境

### 環境の切り替え方法

```bash
# prod 環境にデプロイ（デフォルト）
npx cdk deploy

# dev 環境にデプロイ
npx cdk deploy -c stage=dev
```

## CloudFormation Outputs

デプロイ後、以下の情報が CloudFormation Outputs として出力されます：

| Output 名 | 説明 | 用途 |
|----------|------|------|
| `UserPoolId` | Cognito User Pool ID | フロントエンド認証設定 |
| `UserPoolClientId` | Cognito Client ID | フロントエンド認証設定 |
| `ApiEndpoint` | API Gateway エンドポイント URL | フロントエンド API 接続設定 |
| `DistributionDomainName` | CloudFront ドメイン名 | フロントエンドアクセス URL |
| `FrontendBucketName` | S3 バケット名 | フロントエンドデプロイ先 |
| `RecipesTableName` | Recipes テーブル名 | Lambda 環境変数（自動設定済み） |
| `RecipeIngredientsTableName` | RecipeIngredients テーブル名 | Lambda 環境変数（自動設定済み） |
| `MenusTableName` | Menus テーブル名 | Lambda 環境変数（自動設定済み） |

## フロントエンド環境変数設定

デプロイ後の Outputs を使用して、フロントエンドの `.env` ファイルを設定します：

```bash
# CloudFormation Outputs から値を取得
VITE_API_BASE_URL=<ApiEndpoint の値>
VITE_COGNITO_USER_POOL_ID=<UserPoolId の値>
VITE_COGNITO_CLIENT_ID=<UserPoolClientId の値>
VITE_COGNITO_REGION=<デプロイしたリージョン>
```

## CDK プロジェクト構造

```
infra/
├── bin/
│   └── infra.ts                    # CDK アプリのエントリーポイント
├── lib/
│   └── cooking-planner-stack.ts    # メインスタック定義
├── test/
│   └── infra.test.ts              # ユニットテスト
├── cdk.json                        # CDK 設定
├── package.json                    # 依存関係
└── README.md                       # CDK プロジェクトの使い方
```

## デプロイ手順

### 初回デプロイ

```bash
# 1. CDK のブートストラップ（アカウント・リージョンごとに1回のみ）
cd infra
npx cdk bootstrap

# 2. スタックのデプロイ
npx cdk deploy

# 3. Outputs をメモして、フロントエンド環境変数に設定
```

### 更新デプロイ

```bash
# 1. 変更内容の確認
npx cdk diff

# 2. デプロイ
npx cdk deploy
```

## セキュリティ考慮事項

各リソースのセキュリティ設定については、個別のドキュメントを参照してください：

- **DynamoDB**: ユーザーごとのデータ分離（userId を必須キーとして使用）
- **Lambda**: IAM ロールによる最小権限の原則
- **API Gateway**: CORS 設定、認証設定（実装予定）
- **Cognito**: 強固なパスワードポリシー、管理者のみのユーザー作成
- **S3/CloudFront**: パブリックアクセスブロック、HTTPS 強制、OAI 使用

## コスト見積もり

個人利用を想定した場合の月間コスト概算（東京リージョン）：

- **DynamoDB**: 無料枠内（Pay-per-request、データ量少）
- **Lambda**: 無料枠内（月間100万リクエストまで無料）
- **API Gateway**: 月間100万リクエストまで無料（初年度）
- **S3**: $0.025/GB 程度（数MB程度）
- **CloudFront**: 無料枠 50GB/月（初年度）
- **Cognito**: 50,000 MAU まで無料

**総計**: 初年度は無料枠内、2年目以降も月額 $1 未満の見込み

## 関連ドキュメント

プロジェクト全体のドキュメントは `docs/` ディレクトリを参照：

- [ビジョンとスコープ](/docs/01-vision-and-scope.md)
- [機能と画面](/docs/02-features-and-screens.md)
- [ドメインとデータモデル](/docs/03-domain-and-data-model.md)
- [API 設計](/docs/04-api-design.md)
- [アーキテクチャ構成](/docs/05-architecture-notes.md)

## CDK リソース

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [CDK Examples](https://github.com/aws-samples/aws-cdk-examples)
- [CDK API Reference](https://docs.aws.amazon.com/cdk/api/v2/)
