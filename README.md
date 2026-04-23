# Cooking Planner

個人利用の料理レシピ／献立／買い物リスト管理アプリケーション

## プロジェクト構成

```
cooking-planner/
├── frontend/          # React + TypeScript フロントエンド
├── infra/
│   └── lambda/       # AWS Lambda バックエンド
└── docs/             # ドキュメント
```

## セットアップ

### 前提条件

- Node.js 20.x以上
- npm

### 初回セットアップ

1. リポジトリをクローン

```bash
git clone https://github.com/Kawatan1927/cooking-planner.git
cd cooking-planner
```

2. 依存関係のインストール

```bash
# ルートの依存関係をインストール（lefthookを含む）
npm install

# フロントエンドの依存関係をインストール
cd frontend
npm install
cd ..

# Lambdaの依存関係をインストール
cd infra/lambda
npm install
cd ../..
```

3. Gitフックのセットアップ

```bash
# lefthookフックを手動でインストール（npm installで自動実行されますが、念のため）
npm run prepare
```

これにより、以下のGitフックが自動的に設定されます：

- **pre-commit**: コミットに含める `frontend/` と `infra/lambda/` 配下の staged ファイルに対してフォーマットチェックと lint を実行
- **pre-push**: `frontend/**` または `infra/lambda/**` の変更があるときだけ、ビルドとテストを実行します（ビルド時に TypeScript の型エラーも検出）

### Gitフックについて

[lefthook](https://github.com/evilmartians/lefthook)を使用してローカルでCI相当のチェックを自動実行します。これにより、CIで失敗するケースを事前に防ぎます。

#### 自動実行されるチェック

- **pre-commit**: コミットに含める `frontend/` と `infra/lambda/` 配下の staged ファイルに対して、Prettier と ESLint を実行
- **pre-push**: `frontend/**` または `infra/lambda/**` の変更が push に含まれる場合だけ、対応するビルドを実行します（ビルド時に TypeScript の型エラーも検出）
- **test**: 現在の `npm run test` はプレースホルダーで、将来の自動テスト追加まで成功終了のみを返します

詳細は [CONTRIBUTING.md](./CONTRIBUTING.md) を参照してください。

#### フックをスキップする場合

```bash
git commit --no-verify  # pre-commitをスキップ
git push --no-verify    # pre-pushをスキップ
```

**⚠️ 注意**: フックをスキップすると、`frontend/**` や `infra/lambda/**` の変更を含む push では CI 失敗のリスクがあります。

## 開発

開発のガイドラインと詳細については [CONTRIBUTING.md](./CONTRIBUTING.md) を参照してください。

### フロントエンド

```bash
# 開発サーバーの起動
npm run frontend:dev

# ビルド
npm run frontend:build

# Lint
npm run frontend:lint

# フォーマット
npm run frontend:format

# フォーマットチェック
npm run frontend:format:check
```

### Lambda

```bash
# Lint
npm run lambda:lint

# フォーマット
npm run lambda:format

# フォーマットチェック
npm run lambda:format:check

# ビルド
npm run lambda:build

# ウォッチモード
npm run lambda:watch

# クリーン
npm run lambda:clean

# リビルド
npm run lambda:rebuild
```

### リポジトリ全体

```bash
# すべてのlint実行
npm run lint

# すべてのフォーマットチェック
npm run format:check

# フロントエンドとLambdaの型チェック
npm run type-check

# フロントエンドとLambdaのビルド
npm run build:all

# テスト実行
npm run test
```

## CI/CD

GitHub Actionsを使用してCI/CDを実行しています：

- **Frontend CI**: フロントエンドのlint、フォーマットチェック、型チェック、ビルド
- **Lambda CI**: Lambdaのlint、フォーマットチェック、型チェック、ビルド
- **Docs CI**: ドキュメントのフォーマットチェック、Docusaurus ビルド

詳細は `.github/workflows/` を参照してください。

## デプロイ

### インフラ（CDK）のデプロイ

```bash
cd infra
# dev 環境
cdk deploy --context stage=dev

# prod 環境（CloudFront URL を context で指定）
cdk deploy \
  --context stage=prod \
  --context allowedOrigins=https://xxx.cloudfront.net \
  --context callbackUrls=https://xxx.cloudfront.net/callback \
  --context logoutUrls=https://xxx.cloudfront.net
```

デプロイ後の Outputs から `CloudFrontUrl`・`FrontendBucketName`・`CloudFrontDistributionId` を取得して環境変数の設定に使う。

### フロントエンドのデプロイ

1. `frontend/.env.production` を作成し、CDK Outputs の値を設定する（`frontend/.env.example` を参照）
2. デプロイスクリプトを実行する

```bash
# prod 環境へデプロイ
./scripts/deploy-frontend.sh prod
```

スクリプトはビルド・S3 アップロード・CloudFront キャッシュ無効化を一括で実行する。
詳細は `docs/docs/deployment/` を参照してください。

## ドキュメント

詳細な仕様とアーキテクチャについては、`docs/` ディレクトリを参照してください：

- `docs/01-vision-and-scope.md` - ビジョンとスコープ
- `docs/02-features-and-screens.md` - 機能と画面
- `docs/03-domain-and-data-model.md` - ドメインモデルとデータモデル
- `docs/04-api-design.md` - API設計
- `docs/05-architecture-notes.md` - アーキテクチャノート

## ライセンス

Private repository
