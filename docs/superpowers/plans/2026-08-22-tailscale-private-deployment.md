# Tailscale Private Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cooking Planner の本番相当構成を Cloudflare Tunnel / Access 前提から Tailscale tailnet 内限定公開を第一候補に更新する。

**Architecture:** `bun run start` で frontend build 済みファイルと API を Hono server から同一オリジン配信し、Tailscale Serve が `127.0.0.1:3000` へ HTTPS 転送する構成を正式手順にする。認証境界は tailnet 参加端末に置き、当面は `DEV_USER_ID=local-dev-user` の単一ユーザー運用を許容し、Cloudflare は代替公開案として分離する。

**Tech Stack:** Bun, Hono, Vite + React, PostgreSQL, Tailscale Serve, Docusaurus

**Spec:** GitHub Issue #175 `Tailscale前提のプライベート公開構成へ移行する`

## Global Constraints

- 仕様のソースオブトゥルースは `docs/` 配下の Markdown。
- Issue、PR、レビューコメント、コミットメッセージ、要約は日本語で書く。
- ブランチ名は `docs/175-tailscale-private-deployment`。
- 変更対象は docs、AGENTS、env example、OpenAPI の説明に限定し、アプリ動作コードは変更しない。
- Hono server は `127.0.0.1` bind を維持し、`0.0.0.0` で bind しない。

---

### Task 1: 方針とエージェントルール

**Files:**

- Modify: `AGENTS.md`
- Modify: `backend/AGENTS.md`
- Modify: `docs/docs/architecture/overview.md`
- Modify: `docs/docs/architecture/backend.md`
- Modify: `docs/docs/architecture/frontend.md`
- Modify: `docs/docs/architecture/infrastructure.md`

**Interfaces:**

- Consumes: Issue #175 の受け入れ条件。
- Produces: Tailscale Serve を第一候補、Cloudflare を代替案とする共通方針。

- [ ] **Step 1: Write failing search checks**

Run:

```bash
rg -n "Cloudflare Tunnel で公開|Cloudflare Tunnel 経由で行います|Cloudflare Access を前提|本番相当では `DEV_USER_ID` を設定しません" AGENTS.md backend/AGENTS.md docs/docs/architecture
```

Expected: FAIL-equivalent signalとして、Cloudflare 固定の文言が表示される。

- [ ] **Step 2: Update architecture and AGENTS wording**

Replace Cloudflare-first wording with Tailscale-first wording:

```markdown
- 認証境界は Tailscale tailnet を第一候補とし、当面は DEV_USER_ID による単一ユーザー運用を許容します。
- 公開は Tailscale Serve 経由の tailnet 内限定公開を第一候補とします。
```

Architecture pages must state:

```markdown
`tailscale serve --bg 3000` で `https://<device>.<tailnet>.ts.net` から Hono server へ転送する。
Hono server は `127.0.0.1` bind のまま維持する。
Cloudflare Tunnel / Access は独自ドメインやインターネット公開が必要になった場合の代替案として扱う。
```

- [ ] **Step 3: Re-run search**

Run:

```bash
rg -n "Cloudflare Tunnel で公開|Cloudflare Tunnel 経由で行います|Cloudflare Access を前提|本番相当では `DEV_USER_ID` を設定しません" AGENTS.md backend/AGENTS.md docs/docs/architecture
```

Expected: no Cloudflare-first contradictory lines remain.

### Task 2: デプロイ・起動・運用手順

**Files:**

- Modify: `docs/docs/deployment/overview.md`
- Create or Modify: `docs/docs/deployment/tailscale-serve.md`
- Modify: `docs/docs/deployment/cloudflare-tunnel.md`
- Modify: `docs/docs/deployment/backend.md`
- Modify: `docs/docs/deployment/frontend.md`
- Modify: `docs/docs/getting-started/production-setup.md`
- Modify: `docs/docs/operations/monitoring.md`
- Modify: `docs/docs/operations/release.md`
- Modify: `docs/docs/maintenance/troubleshooting.md`

**Interfaces:**

- Consumes: Task 1 の Tailscale-first 方針。
- Produces: PC 再起動後から tailnet 端末確認までの運用手順。

- [ ] **Step 1: Write failing search checks**

Run:

```bash
rg -n "Cloudflare Tunnel 経由で確認|Cloudflare Access の認証フロー|DEV_USER_ID を外す|Cloudflare Tunnel が Hono server|Cloudflare のダッシュボード" docs/docs/deployment docs/docs/getting-started docs/docs/operations docs/docs/maintenance
```

Expected: FAIL-equivalent signalとして、Cloudflare 固定の確認手順が表示される。

- [ ] **Step 2: Add Tailscale Serve page**

Create `docs/docs/deployment/tailscale-serve.md` with these sections:

```markdown
---
id: deployment-tailscale-serve
title: Tailscale Serve
sidebar_position: 4
---

## 概要

...

## 前提条件

...

## 1. Hono server を起動する

...

## 2. Tailscale Serve を起動する

...

## 3. tailnet 端末から確認する

...

## 認証境界

...

## PC 再起動後の確認

...

## トラブルシューティング

...
```

The command examples must include:

```bash
bun run start
tailscale serve --bg 3000
tailscale serve status
```

The checks must include:

```text
http://127.0.0.1:3000/
http://127.0.0.1:3000/health
https://<device>.<tailnet>.ts.net/
https://<device>.<tailnet>.ts.net/health
https://<device>.<tailnet>.ts.net/api/recipes
```

- [ ] **Step 3: Update deployment and operation docs**

Update each page so the primary flow is:

```markdown
1. PostgreSQL を起動する。
2. `.env` に `DATABASE_URL`, `PORT`, `DEV_USER_ID` を設定する。
3. `bun run start` で frontend build 後に Hono server を起動する。
4. ローカル PC で `http://127.0.0.1:3000/` と `/health` を確認する。
5. `tailscale serve --bg 3000` を起動する。
6. tailnet 内端末から `https://<device>.<tailnet>.ts.net` を確認する。
```

Keep `cloudflare-tunnel.md` but mark it as an alternative for custom domain or internet exposure.

- [ ] **Step 4: Re-run search**

Run:

```bash
rg -n "DEV_USER_ID を外す|Cloudflare Access の認証フロー|Cloudflare Tunnel が Hono server の port|Cloudflare Tunnel 経由で主要画面" docs/docs/deployment docs/docs/getting-started docs/docs/operations docs/docs/maintenance
```

Expected: no Tailscale-first contradictory lines remain.

### Task 3: 環境変数と API 説明

**Files:**

- Modify: `.env.example`
- Modify: `backend/.env.example`
- Modify: `frontend/.env.production.example`
- Modify: `docs/docs/development/environment-variables.mdx`
- Modify: `docs/docs/api-reference/index.md`
- Modify: `docs/docs/features/api-design.md`
- Modify: `docs/static/api/cooking-planner.yaml`

**Interfaces:**

- Consumes: Task 1 の認証境界。
- Produces: `DEV_USER_ID=local-dev-user` 単一ユーザー運用の前提とリスク、Tailscale-first API server URL。

- [ ] **Step 1: Write failing search checks**

Run:

```bash
rg -n "Cloudflare Access|Cf-Access-Jwt-Assertion|CLOUDFLARE_ACCESS|cloudflare_tunnel_domain|Cloudflare Tunnel endpoint" .env.example backend/.env.example frontend/.env.production.example docs/docs/development docs/docs/api-reference docs/docs/features/api-design.md docs/static/api/cooking-planner.yaml
```

Expected: FAIL-equivalent signalとして、Cloudflare-first API / env 説明が表示される。

- [ ] **Step 2: Update env examples**

Root and backend env examples must show:

```bash
VITE_API_BASE_URL=/api
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/cooking_planner
DEV_USER_ID=local-dev-user
```

Cloudflare variables must be commented as optional alternative only.

- [ ] **Step 3: Update API docs**

OpenAPI server must become:

```yaml
servers:
  - url: https://{tailscale_device}.{tailnet}.ts.net/api
    description: Tailscale Serve endpoint
```

Security description must state that tailnet membership is the primary boundary and `DEV_USER_ID` scopes data for a single user. Cloudflare Access security scheme may remain only as an optional alternative.

- [ ] **Step 4: Run formatting/build checks**

Run:

```bash
bun run docs:format:check
bun run docs:build
```

Expected: both pass.

### Task 4: Final Verification and Publish

**Files:**

- Modify: all changed files from Tasks 1-3.

**Interfaces:**

- Consumes: Completed docs/env/API updates.
- Produces: Commit and draft PR closing #175.

- [ ] **Step 1: Run scoped checks**

Run:

```bash
bun run docs:format:check
bun run docs:build
```

Expected: pass.

- [ ] **Step 2: Inspect diff**

Run:

```bash
git diff --check
git diff --stat
git diff
```

Expected: no whitespace errors; diff is limited to Issue #175 docs/env/AGENTS/API description changes.

- [ ] **Step 3: Commit**

Run:

```bash
git add -- AGENTS.md backend/AGENTS.md .env.example backend/.env.example frontend/.env.production.example docs/docs docs/static/api/cooking-planner.yaml docs/superpowers/plans/2026-08-22-tailscale-private-deployment.md
git commit -m "docs: Tailscale前提の公開手順に更新"
```

- [ ] **Step 4: Push and create draft PR**

Run:

```bash
git push -u origin docs/175-tailscale-private-deployment
gh pr create --draft --title "Tailscale前提のプライベート公開構成へ移行する" --label documentation --label enhancement
```

PR body must follow `.github/PULL_REQUEST_TEMPLATE.md` and include `closes #175`.
