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

- **pre-commit**: コミット前にフォーマットチェックとlintを実行
- **pre-push**: プッシュ前にTypeScript型チェック、ビルド、テストを実行

### Gitフックについて

[lefthook](https://github.com/evilmartians/lefthook)を使用してローカルでCI相当のチェックを自動実行します。これにより、CIで失敗するケースを事前に防ぎます。

#### 自動実行されるチェック

- **pre-commit**: コミット前にフォーマットチェック（Prettier）とlint（ESLint）を実行
- **pre-push**: プッシュ前にTypeScript型チェック、ビルド、テストを実行

詳細は [CONTRIBUTING.md](./CONTRIBUTING.md) を参照してください。

#### フックをスキップする場合

```bash
git commit --no-verify  # pre-commitをスキップ
git push --no-verify    # pre-pushをスキップ
```

**⚠️ 注意**: フックをスキップしてもCIでは同様のチェックが実行されるため、CI失敗のリスクがあります。

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

# すべてのTypeScript型チェックとビルド
npm run type-check

# テスト実行
npm run test
```

## CI/CD

GitHub Actionsを使用してCI/CDを実行しています：

- **Frontend CI**: フロントエンドのlint、フォーマットチェック、型チェック、ビルド
- **Lambda CI**: Lambdaの型チェック、ビルド

詳細は `.github/workflows/` を参照してください。

## ドキュメント

詳細な仕様とアーキテクチャについては、`docs/` ディレクトリを参照してください：

- `docs/01-vision-and-scope.md` - ビジョンとスコープ
- `docs/02-features-and-screens.md` - 機能と画面
- `docs/03-domain-and-data-model.md` - ドメインモデルとデータモデル
- `docs/04-api-design.md` - API設計
- `docs/05-architecture-notes.md` - アーキテクチャノート

## ライセンス

Private repository
