# AWS CDK 廃止とローカル起動スクリプト整備 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Issue #131 に対応し、AWS CDK インフラ定義を削除して、ローカル Hono + Vite 構成を root コマンドで起動できる状態にする。

**Architecture:** CDK 専用ディレクトリと CI を削除し、root `package.json` を frontend/backend/docs の集約コマンドにする。backend は既存の Hono 静的配信を使い、`bun run start` では frontend build 後に backend を起動する。運用文書は AWS/CDK/Lambda 前提の説明を、Hono/PostgreSQL/Cloudflare Access/Tunnel 前提に置き換える。

**Tech Stack:** Bun scripts, Vite, React, Hono, PostgreSQL, Drizzle ORM, GitHub Actions, Lefthook, Docusaurus.

---

## File Map

- Delete: `infra/`
  - 旧 CDK スタック、CDK package、dist、cdk.out、CDK 関連メモをまとめて削除する。
- Delete: `.github/workflows/cdk-ci.yml`
  - `infra/**` 専用 CI を削除する。
- Modify: `package.json`
  - `cdk:*` scripts を削除し、`dev`, `start`, `lint`, `format`, `format:check`, `build:all` を現行構成に合わせる。
- Modify: `lefthook.yml`
  - `cdk-format`, `cdk-lint`, `cdk-build` を削除する。
- Modify: `backend/.env.example`
  - backend 環境変数を現行認証構成に合わせる。
- Create: `.env.example`
  - root から参照する frontend/backend の代表変数をまとめる。
- Modify: `AGENTS.md`
  - 旧 `infra/lambda` と CDK 記述を `backend/` とローカル構成へ置換する。
- Modify: `README.md`
  - セットアップ、ディレクトリ構成、起動、検証コマンドを現行構成にする。
- Modify: `CONTRIBUTING.md`
  - hooks と CI の説明を frontend/backend/docs 構成にする。
- Modify: `docs/docs/**`
  - Docusaurus 運用文書の AWS/CDK/Lambda/DynamoDB/Cognito/S3/CloudFront 前提を、Hono/PostgreSQL/Cloudflare 構成に合わせる。
- Do not modify: `docs/01-vision-and-scope.md`, `docs/02-features-and-screens.md`, `docs/03-domain-and-data-model.md`, `docs/04-api-design.md`, `docs/05-architecture-notes.md`.
- Do not stage: `.serena/project.yml`
  - 作業開始前からある未コミット差分のため Issue #131 には含めない。

## Task 1: Remove CDK-Owned Files

**Files:**

- Delete: `infra/`
- Delete: `.github/workflows/cdk-ci.yml`

- [ ] **Step 1: Confirm CDK paths exist**

Run:

```powershell
Test-Path infra
Test-Path .github\workflows\cdk-ci.yml
```

Expected:

```text
True
True
```

- [ ] **Step 2: Delete CDK directory and workflow**

Run:

```powershell
Remove-Item -Recurse -Force -LiteralPath infra
Remove-Item -Force -LiteralPath .github\workflows\cdk-ci.yml
```

Expected: command exits with code 0.

- [ ] **Step 3: Verify deleted paths**

Run:

```powershell
Test-Path infra
Test-Path .github\workflows\cdk-ci.yml
```

Expected:

```text
False
False
```

- [ ] **Step 4: Commit deletion**

Run:

```powershell
git add -A infra .github\workflows\cdk-ci.yml
git commit -m "chore: CDKインフラ定義を削除" -m "- ローカルHono構成への移行に伴いinfra配下を削除" -m "- CDK専用CIワークフローを削除"
```

Expected: commit succeeds and does not include `.serena/project.yml`.

## Task 2: Update Root Scripts, Env Examples, and Hooks

**Files:**

- Modify: `package.json`
- Modify: `lefthook.yml`
- Modify: `backend/.env.example`
- Create: `.env.example`

- [ ] **Step 1: Update `package.json` scripts**

Replace the `scripts` object in `package.json` with:

```json
{
  "build": "tsc",
  "prepare": "lefthook install",
  "dev": "bun run --filter './frontend' dev & bun run --filter './backend' dev",
  "start": "bun run frontend:build && bun run backend:start",
  "frontend:dev": "cd frontend && bun run dev",
  "frontend:type-check": "cd frontend && bunx tsc -b",
  "frontend:build": "cd frontend && bun run build",
  "frontend:preview": "cd frontend && bun run preview",
  "frontend:lint": "cd frontend && bun run lint",
  "frontend:format": "cd frontend && bun run format",
  "frontend:format:check": "cd frontend && bun run format:check",
  "backend:install": "cd backend && bun install",
  "backend:dev": "cd backend && bun run dev",
  "backend:start": "cd backend && bun run start",
  "backend:lint": "cd backend && bun run lint",
  "backend:format": "cd backend && bun run format",
  "backend:format:check": "cd backend && bun run format:check",
  "backend:type-check": "cd backend && bun run type-check",
  "backend:test": "cd backend && bun run test",
  "docs:dev": "cd docs && bun run start",
  "docs:build": "cd docs && bun run build",
  "docs:format": "cd docs && bun run format",
  "docs:format:check": "cd docs && bun run format:check",
  "lint": "bun run frontend:lint && bun run backend:lint",
  "format": "bun run frontend:format && bun run backend:format && bun run docs:format",
  "format:check": "bun run frontend:format:check && bun run backend:format:check && bun run docs:format:check",
  "type-check": "bun run frontend:type-check && bun run backend:type-check",
  "build:all": "bun run frontend:build && bun run backend:type-check && bun run docs:build",
  "test": "bun run backend:test"
}
```

If `bun run --filter` does not work in this repository, replace `dev` with a local Bun script in Task 2 Step 2.

- [ ] **Step 2: Add fallback dev script if needed**

If `bun run --filter './frontend' dev` fails locally, create `scripts/dev.ts`:

```ts
const processes = [
  Bun.spawn(["bun", "run", "frontend:dev"], {
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit",
  }),
  Bun.spawn(["bun", "run", "backend:dev"], {
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit",
  }),
];

const shutdown = () => {
  for (const process of processes) {
    process.kill();
  }
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

const exitCode = await Promise.race(processes.map((process) => process.exited));
shutdown();
process.exit(exitCode);
```

Then set `package.json` script:

```json
"dev": "bun scripts/dev.ts"
```

- [ ] **Step 3: Update `lefthook.yml`**

Remove the complete `cdk-format`, `cdk-lint`, and `cdk-build` command blocks. Keep frontend/backend pre-commit checks and frontend/backend/test pre-push checks.

Expected remaining command names:

```text
frontend-format
frontend-lint
backend-format
backend-lint
frontend-build
backend-typecheck
tests
```

- [ ] **Step 4: Update `backend/.env.example`**

Replace contents with:

```dotenv
# Hono サーバーのリスニングポート（任意、デフォルト 3000）
PORT=3000

# PostgreSQL 接続文字列
DATABASE_URL=postgresql://user:password@localhost:5432/cooking_planner

# ローカル開発用ユーザーID
# 設定時は Cloudflare Access JWT なしで API を利用できます。
DEV_USER_ID=local-dev-user

# Cloudflare Access の JWT 検証設定
# Cloudflare Tunnel / Access 経由で利用する場合に設定します。
CLOUDFLARE_ACCESS_TEAM_NAME=your-team-name
CLOUDFLARE_ACCESS_AUD=your-application-aud
```

- [ ] **Step 5: Create root `.env.example`**

Create `.env.example`:

```dotenv
# Frontend
# 開発時は Vite から Hono API を呼ぶため localhost:3000 を指定します。
# Cloudflare Tunnel 経由の同一オリジン配信では /api も利用できます。
VITE_API_BASE_URL=http://localhost:3000/api

# Backend
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/cooking_planner
DEV_USER_ID=local-dev-user
CLOUDFLARE_ACCESS_TEAM_NAME=your-team-name
CLOUDFLARE_ACCESS_AUD=your-application-aud
```

- [ ] **Step 6: Verify script references**

Run:

```powershell
rg -n "cdk:|cdk-ci|cdk synth|infra/" package.json lefthook.yml .github AGENTS.md README.md CONTRIBUTING.md
```

Expected: no matches in `package.json` or `lefthook.yml`. Documentation matches are handled in Task 3.

- [ ] **Step 7: Commit script and env changes**

Run:

```powershell
git add package.json lefthook.yml backend/.env.example .env.example scripts/dev.ts
git commit -m "chore: ローカル起動スクリプトを整備" -m "- rootのdev/startをHonoとViteのローカル構成に合わせて追加" -m "- CDK関連scriptsとlefthook設定を削除" -m "- 環境変数サンプルをCloudflare Access構成に更新"
```

If `scripts/dev.ts` was not created, omit it from `git add`.

## Task 3: Update Operational Documentation

**Files:**

- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `CONTRIBUTING.md`
- Modify: `docs/docs/index.mdx`
- Modify: `docs/docs/architecture/overview.md`
- Modify: `docs/docs/architecture/backend.md`
- Modify: `docs/docs/architecture/data-model.md`
- Modify: `docs/docs/architecture/infrastructure.md`
- Modify: `docs/docs/deployment/overview.md`
- Modify: `docs/docs/deployment/backend.md`
- Modify: `docs/docs/deployment/frontend.md`
- Modify: `docs/docs/development/environment-variables.mdx`
- Modify: `docs/docs/getting-started/local-dev.md`
- Modify: `docs/docs/getting-started/production-setup.md`
- Modify: `docs/docs/maintenance/dependency-update.md`
- Modify: `docs/docs/maintenance/troubleshooting.md`
- Modify: `docs/docs/features/vision-and-scope.md`
- Modify: `docs/docs/features/screens.md`

- [ ] **Step 1: Update `AGENTS.md`**

Change project overview bullets to:

```markdown
- フロントエンドは Vite + React + TypeScript です。
- バックエンドは Bun + Hono です。
- データストアは PostgreSQL です。
- 認証は Cloudflare Access を前提とします。
- 公開は Cloudflare Tunnel 経由で行います。
```

Change install checklist to:

```markdown
cd frontend && bun install --frozen-lockfile && cd ..
cd backend && bun install --frozen-lockfile && cd ..
cd docs && bun install --frozen-lockfile && cd ..
```

Remove the CDK synth section. Change area-specific rule to:

```markdown
- フロントエンド配下は `frontend/AGENTS.md` を参照してください。
- バックエンド配下は `backend/AGENTS.md` を参照してください。
```

- [ ] **Step 2: Update `README.md`**

Rewrite the repository layout section to include:

```markdown
├── frontend/ # Vite + React フロントエンド
├── backend/ # Bun + Hono API / 静的ファイル配信サーバー
├── docs/ # 仕様書とDocusaurusドキュメント
├── scripts/ # 補助スクリプト
└── .github/ # GitHub Actions / PRテンプレート
```

Ensure setup commands include:

```bash
bun install --frozen-lockfile
cd frontend && bun install --frozen-lockfile && cd ..
cd backend && bun install --frozen-lockfile && cd ..
cd docs && bun install --frozen-lockfile && cd ..
```

Ensure common commands include:

```bash
bun run dev
bun run start
bun run lint
bun run format:check
bun run type-check
bun run build:all
bun run test
```

Remove `lambda:*`, `cdk`, `aws s3 sync`, S3, CloudFront, DynamoDB, Cognito deployment instructions.

- [ ] **Step 3: Update `CONTRIBUTING.md`**

Replace `infra/lambda` references with `backend`. Replace `lambda-*` hook names with `backend-*`. Remove CDK deploy and CDK CI sections. Keep frontend/backend/docs contribution flow and root verification commands:

```bash
bun run lint
bun run format:check
bun run type-check
bun run build:all
bun run test
```

- [ ] **Step 4: Update Docusaurus architecture pages**

For `docs/docs/index.mdx` and `docs/docs/architecture/*.md`, replace AWS architecture with:

```markdown
- フロントエンド: Vite + React + TypeScript
- バックエンド: Bun + Hono
- データベース: PostgreSQL
- 認証: Cloudflare Access
- 公開: Cloudflare Tunnel
```

Use this Mermaid diagram where an overview diagram is needed:

```mermaid
flowchart LR
  Browser["Browser / React SPA"] --> Access["Cloudflare Access"]
  Access --> Tunnel["Cloudflare Tunnel"]
  Tunnel --> Hono["Local Hono Server"]
  Hono --> Postgres[("PostgreSQL")]
```

- [ ] **Step 5: Update Docusaurus deployment and getting-started pages**

For `docs/docs/deployment/*.md` and `docs/docs/getting-started/*.md`, replace AWS setup/deploy flow with:

```markdown
1. PostgreSQL を起動する。
2. `.env` に `DATABASE_URL` と `PORT` を設定する。
3. 開発時は `DEV_USER_ID` を設定する。
4. `bun run dev` で frontend/backend を起動する。
5. 本番相当では `bun run start` で frontend build 後に Hono server を起動する。
6. 公開時は Cloudflare Tunnel を Hono server の port に向ける。
7. Cloudflare Access で許可ユーザーを制限する。
```

Remove AWS account, IAM, AWS CLI, CDK bootstrap/diff/deploy, Cognito user creation, S3 upload, CloudFront cache invalidation instructions.

- [ ] **Step 6: Update maintenance and feature pages**

For `docs/docs/maintenance/*.md` and `docs/docs/features/*.md`, replace stale platform nouns:

```text
AWS Lambda -> Hono server
API Gateway -> Hono routing
DynamoDB -> PostgreSQL
Cognito -> Cloudflare Access
S3 / CloudFront -> Hono static file serving via Cloudflare Tunnel
CDK -> local scripts and manual Cloudflare configuration
infra/lambda -> backend
```

Do not change `docs/01-vision-and-scope.md` through `docs/05-architecture-notes.md`.

- [ ] **Step 7: Verify stale documentation references**

Run:

```powershell
rg -n "infra/lambda|lambda:|cdk|CDK|Cognito|DynamoDB|CloudFront|S3|API Gateway|AWS Lambda" README.md CONTRIBUTING.md AGENTS.md docs\docs
```

Expected: no stale references, except historical notes that explicitly say they are old and no longer used. Prefer removing historical notes unless needed.

- [ ] **Step 8: Format docs**

Run:

```powershell
bun run docs:format
```

Expected: command exits with code 0.

- [ ] **Step 9: Commit documentation changes**

Run:

```powershell
git add AGENTS.md README.md CONTRIBUTING.md docs/docs
git commit -m "docs: ローカルHono構成の運用文書に更新" -m "- AWS/CDK/Lambda前提の説明を現行構成に置換" -m "- セットアップと起動手順をfrontend/backend構成に整理"
```

## Task 4: Full Verification and Runtime Smoke Tests

**Files:**

- No source edits expected unless verification reveals a real defect.

- [ ] **Step 1: Run lint**

Run:

```powershell
bun run lint
```

Expected: exit code 0.

- [ ] **Step 2: Run format check**

Run:

```powershell
bun run format:check
```

Expected: exit code 0.

- [ ] **Step 3: Run type check**

Run:

```powershell
bun run type-check
```

Expected: exit code 0.

- [ ] **Step 4: Run build**

Run:

```powershell
bun run build:all
```

Expected: exit code 0.

- [ ] **Step 5: Run tests**

Run:

```powershell
bun run test
```

Expected: exit code 0.

- [ ] **Step 6: Smoke test `bun run dev`**

Run in a background PowerShell job:

```powershell
$job = Start-Job -ScriptBlock { Set-Location 'C:\Users\hkawata\WebstormProjects\cooking-planner'; bun run dev }
Start-Sleep -Seconds 8
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3000/health
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:5173/
Stop-Job $job
Remove-Job $job
```

Expected: both requests return HTTP 200.

- [ ] **Step 7: Smoke test `bun run start`**

Run in a background PowerShell job:

```powershell
$job = Start-Job -ScriptBlock { Set-Location 'C:\Users\hkawata\WebstormProjects\cooking-planner'; bun run start }
Start-Sleep -Seconds 10
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3000/health
Invoke-WebRequest -UseBasicParsing -Headers @{ Accept = 'text/html' } http://127.0.0.1:3000/
Stop-Job $job
Remove-Job $job
```

Expected: both requests return HTTP 200. The `/` response contains the built frontend HTML.

- [ ] **Step 8: Confirm final diff excludes pre-existing Serena change**

Run:

```powershell
git status --short
git diff --name-only HEAD
```

Expected: `.serena/project.yml` may remain modified, but it is not staged and is not included in Issue #131 commits.

- [ ] **Step 9: Commit verification fixes if needed**

If verification required fixes, commit them:

```powershell
git add <fixed-files>
git commit -m "fix: ローカル起動検証で見つかった不整合を修正" -m "- dev/start実行時の問題を修正" -m "- 検証コマンドが通る状態に調整"
```

If no fixes were needed, do not create an empty commit.

## Task 5: Push and Create Pull Request

**Files:**

- No file edits.

- [ ] **Step 1: Review commits**

Run:

```powershell
git log --oneline main..HEAD
git status --short
```

Expected: Issue #131 commits are present. `.serena/project.yml` is not staged.

- [ ] **Step 2: Push branch**

Run:

```powershell
git push -u origin feature/131-remove-cdk-local-start
```

Expected: branch is pushed to origin.

- [ ] **Step 3: Create PR**

Because `gh` is not installed in this environment, use the GitHub connector or install/use an available GitHub CLI if present later. PR title must match Issue title:

```text
AWS CDKインフラを廃止しローカル起動スクリプトを整備する
```

Use label:

```text
enhancement
```

Use body based on `.github/PULL_REQUEST_TEMPLATE.md`; set related issue/task to:

```text
closes #131
```

- [ ] **Step 4: Final report**

Report:

```text
対応内容:
- CDK infra と CDK CI を削除
- root dev/start と検証 scripts をローカル Hono 構成へ更新
- env example と運用文書を Cloudflare/PostgreSQL 構成へ更新

検証:
- bun run lint
- bun run format:check
- bun run type-check
- bun run build:all
- bun run test
- bun run dev smoke
- bun run start smoke

PR:
- <PR URL>
```
