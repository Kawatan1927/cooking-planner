---
id: maintenance-troubleshooting
title: トラブルシューティング
sidebar_position: 2
---

## 概要

ローカル PC 上の Hono server、PostgreSQL、Tailscale Serve で問題が発生した場合の確認ポイントをまとめます。

## フロントエンドが表示されない

### 確認手順

1. Hono server が起動しているか確認する。
2. `bun run start` 実行時に frontend build が成功しているか確認する。
3. `tailscale serve status` の転送先が Hono server の port と一致しているか確認する。
4. ブラウザのコンソールにエラーがないか確認する。

### よくある原因

- `frontend/dist/` が生成されていない。
- Hono server が停止している。
- Tailscale Serve の転送先 port が `.env` の `PORT` と一致していない。
- `VITE_API_BASE_URL` が意図しない URL を指している。

## API が 401 / 403 エラーを返す

### 確認手順

1. 開発時は `DEV_USER_ID` が設定されているか確認する。
2. 本番相当では `DEV_USER_ID=local-dev-user` が Hono server の実行環境に残っているか確認する。
3. Cloudflare Access を代替案として使う場合は、`CLOUDFLARE_ACCESS_TEAM_NAME` と `CLOUDFLARE_ACCESS_AUD` が正しいか確認する。
4. Hono server のログに userId 取得や JWT 検証のエラーが出ていないか確認する。

### よくある原因

- ローカル開発で `DEV_USER_ID` が未設定。
- Tailscale Serve 構成なのに `DEV_USER_ID` を外している。
- Cloudflare Access の代替構成では、許可ポリシーにユーザーが含まれていない。
- Cloudflare Access の代替構成では、Access Application Audience と環境変数が一致していない。

## API が 500 エラーを返す

### 確認手順

1. Hono server の標準出力に出ている stack trace を確認する。
2. PostgreSQL が起動しているか確認する。
3. `DATABASE_URL` が正しいか確認する。
4. migration が適用済みか確認する。

### よくある原因

- PostgreSQL が停止している。
- database、ユーザー、パスワード、port のいずれかが誤っている。
- 必要なテーブルが作成されていない。
- アプリケーションコードのバリデーションや DB 操作にバグがある。

## Tailscale Serve から接続できない

### 確認手順

1. Tailscale client が接続済みか確認する。
2. `tailscale serve status` の転送先が `http://127.0.0.1:<PORT>` になっているか確認する。
3. Hono server が同じ port で起動しているか確認する。
4. 確認端末が同じ tailnet に参加しているか確認する。
5. Serve 設定が消えている場合は `tailscale serve --bg 3000` を再実行する。

## ドキュメントサイトが更新されない

### 確認手順

1. GitHub Actions の docs ワークフローが正常に完了しているか確認する。
2. `docs/**` 配下のファイルが変更に含まれているか確認する。
3. Docusaurus の build エラーがないか確認する。

## ログ確認

```bash
# Hono server を起動して標準出力を確認
bun run backend:start

# 開発時は frontend/backend をまとめて起動
bun run dev

# PostgreSQL 接続情報を確認
echo $DATABASE_URL
```
