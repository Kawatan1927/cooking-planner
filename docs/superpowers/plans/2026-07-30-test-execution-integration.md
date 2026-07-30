# フロントエンド・バックエンドテスト実行統合 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ルート、lefthook、GitHub Actionsからフロントエンドとバックエンドの単体テストを一貫したコマンドで実行できるようにする。

**Architecture:** ルート`package.json`に領域別スクリプトと順次実行する統合スクリプトを定義する。既存のFrontend CIとBackend CIは各領域だけを検証し、新しいUnit Tests CIがルート統合スクリプトを検証する。

**Tech Stack:** Bun 1.3.11、Vitest 4、GitHub Actions、lefthook 2、Markdown

## Global Constraints

- SerenaとGit Worktreeは使用せず、既存チェックアウトの`chore/155-integrate-frontend-backend-tests`で作業する。
- アプリケーションの本番コードと既存の単体テストは変更しない。
- 新しい依存関係を追加せず、`bun.lock`、`frontend/bun.lock`、`backend/bun.lock`、`docs/bun.lock`を変更しない。
- 仕様書`docs/01-vision-and-scope.md`から`docs/05-architecture-notes.md`は変更しない。
- `.serena/project.yml`の既存変更をステージ、コミット、PRへ含めない。
- コミットメッセージと要約は日本語で記載する。
- Unit Tests CIはBun 1.3.11を使用し、Node.jsセットアップを追加しない。

## File Structure

- Modify: `package.json` — 領域別テストと統合テストのルートスクリプトを定義する。
- Modify: `.github/workflows/frontend-ci.yml` — Frontend CIからフロントエンドテストだけを実行する。
- Modify: `.github/workflows/backend-ci.yml` — Backend CIからルートのバックエンドテストスクリプトを実行する。
- Create: `.github/workflows/unit-tests-ci.yml` — frozen install後にルートの統合テストを実行する。
- Modify: `README.md` — コマンド、lefthook、CIの説明を同期する。
- Modify: `AGENTS.md` — ルートで使用できる領域別テストコマンドを追記する。
- Modify: `frontend/AGENTS.md` — `npm`表記を`bun`へ修正し、フロントエンドテストコマンドを追記する。
- Modify: `docs/docs/getting-started/local-dev.md` — 統合テストと領域別テストの使い分けを記載する。
- Verify only: `lefthook.yml` — 既存の`bun run test`再利用を維持し、変更しない。
- Verify only: `backend/AGENTS.md` — 既存の`bun run backend:test`記載が正しいため変更しない。

---

### Task 1: ルートテストスクリプトの統合

**Files:**

- Modify: `package.json:11-35`

**Interfaces:**

- Consumes: `frontend/package.json`の`test`スクリプトと`backend/package.json`の`test`スクリプト。
- Produces: `frontend:test`、既存の`backend:test`、両方を順次実行する`test`スクリプト。

- [ ] **Step 1: 現在のルートスクリプトが契約を満たさないことを確認する**

Run:

```powershell
bun -e "const pkg = await Bun.file('package.json').json(); if (pkg.scripts['frontend:test'] !== 'cd frontend && bun run test') throw new Error('frontend:test is missing'); if (pkg.scripts.test !== 'bun run frontend:test && bun run backend:test') throw new Error('root test is not integrated')"
```

Expected: `frontend:test is missing`で終了コード1になる。

- [ ] **Step 2: 最小のルートスクリプト変更を実装する**

`package.json`の`frontend:format:check`直後に次を追加する。

```json
"frontend:test": "cd frontend && bun run test",
```

既存の`backend:test`は維持し、ルート`test`を次へ置き換える。

```json
"test": "bun run frontend:test && bun run backend:test"
```

- [ ] **Step 3: スクリプト契約を再検証する**

Run:

```powershell
bun -e "const pkg = await Bun.file('package.json').json(); if (pkg.scripts['frontend:test'] !== 'cd frontend && bun run test') throw new Error('frontend:test is invalid'); if (pkg.scripts['backend:test'] !== 'cd backend && bun run test') throw new Error('backend:test changed'); if (pkg.scripts.test !== 'bun run frontend:test && bun run backend:test') throw new Error('root test is invalid')"
```

Expected: 終了コード0。

- [ ] **Step 4: 領域別スクリプトと統合スクリプトを実行する**

Run:

```powershell
bun run frontend:test
bun run backend:test
bun run test
```

Expected: 3コマンドすべて終了コード0。統合実行ではフロントエンドのVitest完了後にバックエンドのVitestが開始される。

- [ ] **Step 5: ルートスクリプト変更をコミットする**

```powershell
git add -- package.json
git diff --cached --check
git commit -m 'chore: ルートから全単体テストを実行' -m "- フロントエンドの個別テストコマンドを追加`n- ルートテストからフロントとバックを順次実行"
```

### Task 2: 領域別CIとUnit Tests CIの整備

**Files:**

- Modify: `.github/workflows/frontend-ci.yml:37-58`
- Modify: `.github/workflows/backend-ci.yml:37-57`
- Create: `.github/workflows/unit-tests-ci.yml`

**Interfaces:**

- Consumes: Task 1の`bun run frontend:test`、`bun run backend:test`、`bun run test`。
- Produces: 領域別テスト結果と、ルート統合スクリプトを検証する`Unit Tests CI / unit-tests`チェック。

- [ ] **Step 1: CI契約が未実装であることを確認する**

Run:

```powershell
if (Test-Path '.github/workflows/unit-tests-ci.yml') { throw 'unit-tests-ci.yml already exists' }
if (Select-String -Path '.github/workflows/frontend-ci.yml' -SimpleMatch 'bun run frontend:test' -Quiet) { throw 'frontend test step already exists' }
if (Select-String -Path '.github/workflows/backend-ci.yml' -SimpleMatch 'bun run backend:test' -Quiet) { throw 'backend root test step already exists' }
throw 'expected RED: CI integration is missing'
```

Expected: `expected RED: CI integration is missing`で終了コード1になる。

- [ ] **Step 2: Frontend CIへ領域別テストを追加する**

`.github/workflows/frontend-ci.yml`のPrettierチェック後、ビルド前に次を追加する。

```yaml
- name: テストの実行
  run: bun run frontend:test
```

`working-directory`は指定しない。ルートスクリプトが`frontend/`へ移動する。

- [ ] **Step 3: Backend CIのテストをルートスクリプトへ揃える**

`.github/workflows/backend-ci.yml`の既存テストstepを次へ置き換える。

```yaml
- name: テストの実行
  run: bun run backend:test
```

このstepから`working-directory: ./backend`を削除する。型チェック、lint、フォーマット、`/health`疎通確認のstepは変更しない。

- [ ] **Step 4: Unit Tests CIを作成する**

`.github/workflows/unit-tests-ci.yml`を次の内容で作成する。

```yaml
name: Unit Tests CI

on:
  push:
    branches: [main, develop]
    paths:
      - "frontend/**"
      - "backend/**"
      - "package.json"
      - "bun.lock"
      - ".github/workflows/unit-tests-ci.yml"
  pull_request:
    branches: [main, develop]
    paths:
      - "frontend/**"
      - "backend/**"
      - "package.json"
      - "bun.lock"
      - ".github/workflows/unit-tests-ci.yml"
  workflow_dispatch:

jobs:
  unit-tests:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout リポジトリ
        uses: actions/checkout@v4

      - name: Bun のセットアップ
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: 1.3.11

      - name: ルート依存関係のインストール
        run: bun install --frozen-lockfile

      - name: フロントエンド依存関係のインストール
        working-directory: ./frontend
        run: bun install --frozen-lockfile

      - name: バックエンド依存関係のインストール
        working-directory: ./backend
        run: bun install --frozen-lockfile

      - name: 全単体テストの実行
        run: bun run test
```

- [ ] **Step 5: CI定義の構造を検証する**

Run:

```powershell
$unit = Get-Content -Raw '.github/workflows/unit-tests-ci.yml'
$frontend = Get-Content -Raw '.github/workflows/frontend-ci.yml'
$backend = Get-Content -Raw '.github/workflows/backend-ci.yml'
@('frontend/**', 'backend/**', "'package.json'", "'bun.lock'", 'workflow_dispatch:', 'bun-version: 1.3.11', 'bun run test') | ForEach-Object { if (-not $unit.Contains($_)) { throw "Unit Tests CI missing: $_" } }
if (-not $frontend.Contains('bun run frontend:test')) { throw 'Frontend CI test command is missing' }
if (-not $backend.Contains('bun run backend:test')) { throw 'Backend CI test command is missing' }
if ($backend -match 'working-directory: ./backend\r?\n\s+run: bun run backend:test') { throw 'Backend test still uses a working directory' }
```

Expected: 終了コード0。

- [ ] **Step 6: workflowと領域別コマンドを検証する**

Run:

```powershell
cd docs
bunx prettier --check '../.github/workflows/frontend-ci.yml' '../.github/workflows/backend-ci.yml' '../.github/workflows/unit-tests-ci.yml'
cd ..
bun run frontend:test
bun run backend:test
```

Expected: Prettierと両領域のテストが終了コード0。

- [ ] **Step 7: CI変更をコミットする**

```powershell
git add -- '.github/workflows/frontend-ci.yml' '.github/workflows/backend-ci.yml' '.github/workflows/unit-tests-ci.yml'
git diff --cached --check
git commit -m 'ci: 全単体テストの統合実行を追加' -m "- 領域別CIで各領域のテストを実行`n- 専用CIでルートの統合テストを検証"
```

### Task 3: 開発者向け文書の同期

**Files:**

- Modify: `README.md:63-123`
- Modify: `AGENTS.md:111-119`
- Modify: `frontend/AGENTS.md:17-23`
- Modify: `docs/docs/getting-started/local-dev.md:53-62`
- Verify only: `backend/AGENTS.md:39-48`

**Interfaces:**

- Consumes: Task 1の3つのテストスクリプトとTask 2のCI責務。
- Produces: 開発者と自動エージェントが同じコマンドを選べる文書。

- [ ] **Step 1: 文書が現在の契約と不一致であることを確認する**

Run:

```powershell
rg -n 'npm run frontend:|bun run backend:test を実行|フロントエンドの lint、フォーマットチェック、型チェック、ビルド' frontend/AGENTS.md README.md
```

Expected: `frontend/AGENTS.md`の`npm run frontend:*`、READMEのバックエンドのみのtest説明、テストを含まないFrontend CI説明が見つかる。

- [ ] **Step 2: READMEのコマンドと自動実行説明を更新する**

`README.md`のフロントエンド個別コマンドへ次を追加する。

```bash
bun run frontend:type-check
bun run frontend:test
```

Gitフックのtest説明を次へ置き換える。

```markdown
- **test**: `bun run frontend:test` と `bun run backend:test` を順次実行
```

CI/CDの箇条書きを次の内容へ更新する。

```markdown
- フロントエンドの lint、フォーマットチェック、型チェック、ビルド、テスト
- バックエンドの lint、フォーマットチェック、型チェック、テスト
- ルートの `bun run test` によるフロントエンド・バックエンド単体テストの統合実行
- ドキュメントのフォーマットチェック、Docusaurus ビルド
```

- [ ] **Step 3: AGENTS.mdのルートコマンドを同期する**

`AGENTS.md`の「よく使うコマンド」で`bun run test`の直前に次を追加する。

```markdown
- `bun run frontend:test`
- `bun run backend:test`
```

- [ ] **Step 4: frontend/AGENTS.mdのコマンドを同期する**

「よく使うコマンド」を次へ置き換える。

```markdown
## よく使うコマンド

- `bun run frontend:dev`
- `bun run frontend:lint`
- `bun run frontend:format:check`
- `bun run frontend:type-check`
- `bun run frontend:build`
- `bun run frontend:test`
```

- [ ] **Step 5: Docusaurusのローカル開発文書を同期する**

`docs/docs/getting-started/local-dev.md`の「よく使うコマンド」コードブロック後へ次を追加する。

````markdown
`bun run test`はフロントエンドとバックエンドの単体テストを順次実行します。領域ごとに確認する場合は、次のコマンドを使用します。

```bash
bun run frontend:test
bun run backend:test
```
````

- [ ] **Step 6: 文書の古い表記がなくなったことを検証する**

Run:

```powershell
if (rg -n 'npm run frontend:|bun run backend:test を実行' frontend/AGENTS.md README.md) { throw 'stale test command documentation remains' }
rg -n 'bun run frontend:test|bun run backend:test|bun run test' README.md AGENTS.md frontend/AGENTS.md backend/AGENTS.md docs/docs/getting-started/local-dev.md
```

Expected: 古い表記の検索は0件。3つのテストコマンドが用途に応じた文書で見つかる。

- [ ] **Step 7: 文書をフォーマット検証する**

Run:

```powershell
cd docs
bunx prettier --check '../README.md' '../AGENTS.md' '../frontend/AGENTS.md' 'docs/getting-started/local-dev.md'
cd ..
```

Expected: 全対象ファイルがPrettierチェックに合格する。

- [ ] **Step 8: 文書変更をコミットする**

```powershell
git add -- README.md AGENTS.md frontend/AGENTS.md docs/docs/getting-started/local-dev.md
git diff --cached --check
git commit -m 'docs: 単体テスト実行コマンドを同期' -m "- ルートと領域別テストの使い分けを追記`n- lefthookとCIの実行内容を現在の構成へ更新"
```

### Task 4: frozen installと全体検証

**Files:**

- Verify: `bun.lock`
- Verify: `frontend/bun.lock`
- Verify: `backend/bun.lock`
- Verify: `docs/bun.lock`
- Verify: `lefthook.yml`
- Verify: Task 1からTask 3までの全変更ファイル

**Interfaces:**

- Consumes: Task 1からTask 3までの完成したコマンド、workflow、文書。
- Produces: PR作成へ進める検証証跡と、スコープが限定されたGit差分。

- [ ] **Step 1: 全領域のfrozen installを順次実行する**

Run:

```powershell
bun install --frozen-lockfile
cd frontend
bun install --frozen-lockfile
cd ../backend
bun install --frozen-lockfile
cd ../docs
bun install --frozen-lockfile
cd ..
```

Expected: 4回のinstallが終了コード0。lockfileに差分が発生しない。

- [ ] **Step 2: 個別テストと統合テストを順次実行する**

Run:

```powershell
bun run frontend:test
bun run backend:test
bun run test
```

Expected: 3コマンドが終了コード0。統合実行でフロントエンド、バックエンドの順にVitestが成功する。

- [ ] **Step 3: PR作成前の全共通チェックを順次実行する**

Run:

```powershell
bun run lint
bun run format:check
bun run type-check
bun run build:all
bun run test
```

Expected: lint、format、type-check、全ビルド、全単体テストがすべて終了コード0。

- [ ] **Step 4: docs変更の追加チェックを実行する**

Run:

```powershell
cd docs
bun run format:check
bun run build
cd ..
```

Expected: Docusaurus文書のformatとbuildが終了コード0。

- [ ] **Step 5: workflow、差分、コミット範囲を最終確認する**

Run:

```powershell
cd docs
bunx prettier --check '../.github/workflows/frontend-ci.yml' '../.github/workflows/backend-ci.yml' '../.github/workflows/unit-tests-ci.yml'
cd ..
git diff --check main...HEAD
git diff --stat main...HEAD
git diff --name-only main...HEAD
git status --short --branch
```

Expected:

- workflow 3ファイルがPrettierチェックに合格する。
- `git diff --check`が終了コード0。
- 差分は設計書、計画書、Task 1からTask 3の対象ファイルだけである。
- `.serena/project.yml`は未コミット変更として残り、`main...HEAD`の差分に含まれない。
- lockfile、仕様書、本番コード、単体テストに差分がない。

- [ ] **Step 6: 実装完了レビューへ引き渡す**

`superpowers:verification-before-completion`で直近の検証結果を確認し、`superpowers:requesting-code-review`でIssue #155、設計書、実装計画に対する差分レビューを行う。指摘対応後に再検証し、`superpowers:finishing-a-development-branch`とGitHub公開ワークフローでcommit、push、PR作成を完了する。
