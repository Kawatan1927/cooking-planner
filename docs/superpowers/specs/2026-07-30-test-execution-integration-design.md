# フロントエンド・バックエンドテスト実行統合設計

## 目的

リポジトリルート、lefthook、GitHub Actionsからフロントエンドとバックエンドの単体テストを一貫したコマンドで実行できるようにする。領域別CIの責務は維持し、失敗した領域をログとCIの単位から判別できる構成にする。

## 対象範囲

- ルートにフロントエンド単体テスト用スクリプトを追加する
- 既存のバックエンド単体テスト用スクリプトを維持する
- ルートの統合テスト用スクリプトから両領域を順次実行する
- Frontend CIとBackend CIで各領域の単体テストを実行する
- ルートの統合テスト用スクリプトを検証するUnit Tests CIを追加する
- lefthookからルートの統合テスト用スクリプトを再利用する
- 開発者向け文書と各`AGENTS.md`のコマンド記載を同期する

アプリケーションの本番コード、新しい単体テスト、スモークテスト、E2Eテスト、カバレッジ閾値、実PostgreSQLを使用する統合テストは追加しない。依存関係も追加しないため、lockfileは原則として変更しない。

仕様書である`docs/01-vision-and-scope.md`から`docs/05-architecture-notes.md`は変更しない。

## ルートスクリプト

ルートの`package.json`に次のスクリプトを定義する。

- `frontend:test`: `frontend/`へ移動して`bun run test`を実行する
- `backend:test`: 現在の定義を維持し、`backend/`へ移動して`bun run test`を実行する
- `test`: `bun run frontend:test && bun run backend:test`を実行する

テストはフロントエンド、バックエンドの順に実行する。フロントエンドが失敗した場合はその時点で終了し、不要な後続実行を避ける。並列実行や失敗後の継続処理は追加しない。

Bunが各スクリプト名とVitestの結果を出力するため、ログから失敗した領域を判別できる。

## 領域別CI

既存のFrontend CIとBackend CIは分離したまま維持する。

Frontend CIでは、既存の型チェック、lint、フォーマットチェック、ビルドに加えて、ルートから`bun run frontend:test`を実行する。Frontend CIはフロントエンドの依存関係だけを導入し、バックエンドテストは実行しない。

Backend CIでは、既存の型チェック、lint、フォーマットチェック、単体テスト、`/health`疎通確認を維持する。単体テストはルートから`bun run backend:test`を実行し、開発者向けの領域別コマンドと揃える。Backend CIはバックエンドの依存関係だけを導入し、フロントエンドテストは実行しない。

領域別CIの既存のパスフィルタ、Node.jsセットアップ、Bun 1.3.11、ビルド成果物、疎通確認は今回の目的に不要な変更を加えない。

## Unit Tests CI

ルートの統合テスト用スクリプト自体を検証するため、専用の`.github/workflows/unit-tests-ci.yml`を追加する。

実行手順は次のとおりとする。

1. リポジトリをcheckoutする
2. Bun 1.3.11をセットアップする
3. ルートで`bun install --frozen-lockfile`を実行する
4. `frontend/`で`bun install --frozen-lockfile`を実行する
5. `backend/`で`bun install --frozen-lockfile`を実行する
6. ルートで`bun run test`を実行する

Unit Tests CIではNode.js固有のコマンドを使わないため、Node.jsのセットアップは追加しない。

## Unit Tests CIの発火条件

`main`または`develop`へのpushと、これらのブランチを対象とするpull requestで、次のパスに変更がある場合に発火する。

- `frontend/**`
- `backend/**`
- ルートの`package.json`
- ルートの`bun.lock`
- `.github/workflows/unit-tests-ci.yml`

必要なときに統合テストを再実行できるよう、`workflow_dispatch`にも対応する。

`docs/**`、各`AGENTS.md`、`README.md`、`lefthook.yml`だけの変更では、単体テスト結果に直接影響しないため自動発火させない。

## lefthook

pre-pushのテストコマンドは、既存どおりルートの`bun run test`を使用する。これにより開発者の手動実行、pre-push、Unit Tests CIで同じ統合コマンドを再利用する。

pre-pushの対象は既存どおり`frontend/**`または`backend/**`に変更がある場合とし、今回の変更で対象範囲を広げない。

## 文書同期

次の文書を実際のコマンドとCI構成に同期する。

- ルート`README.md`
- ルート`AGENTS.md`
- `frontend/AGENTS.md`
- 必要に応じて`backend/AGENTS.md`
- `docs/docs/getting-started/local-dev.md`

文書では、全単体テストを実行する`bun run test`と、個別実行用の`bun run frontend:test`、`bun run backend:test`を区別する。

`frontend/AGENTS.md`に残っている`npm run frontend:*`表記は、実際のルートスクリプトに合わせて`bun run frontend:*`へ修正する。

## 検証方法

個別コマンドと統合コマンドをそれぞれ実行し、同じテスト群を実行できることを確認する。

```bash
bun run frontend:test
bun run backend:test
bun run test
```

PR作成前に、リポジトリルートから次を順番に実行する。

```bash
bun run lint
bun run format:check
bun run type-check
bun run build:all
bun run test
```

文書変更に対して`docs/`の依存関係をfrozen lockfileから導入し、フォーマットチェックとビルドを実行する。ルート、frontend、backendについてもfrozen installが成功することを確認する。

最後にGit差分、workflow定義、`git diff --check`を確認し、`.serena/project.yml`の既存変更をコミットやPRへ含めない。
