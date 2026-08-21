---
id: deployment-tailscale-serve
title: Tailscale Serve
sidebar_position: 4
---

## 概要

Tailscale Serve を使い、ローカル PC 上で動く Hono server を tailnet 内の HTTPS URL として公開します。Cooking Planner は独自ドメインやインターネット一般公開を当面不要とし、Tailscale 導入済みの PC / スマホ / タブレットだけから利用する構成を第一候補にします。

Hono server は `127.0.0.1` に bind したまま維持します。Tailscale Serve が `https://<device>.<tailnet>.ts.net` から `http://127.0.0.1:3000` へ転送するため、Hono server を `0.0.0.0` で LAN 公開する必要はありません。

## 前提条件

- 利用する PC / スマホ / タブレットが同じ Tailscale tailnet に参加していること。
- ローカル PC に Tailscale がインストールされ、ログイン済みであること。
- Tailscale の MagicDNS と HTTPS 証明書機能を利用できること。
- ローカル PC でアプリを `http://127.0.0.1:3000` として起動できること。
- `.env` に `DEV_USER_ID=local-dev-user` を設定し、単一ユーザー運用の前提を理解していること。

## 1. Hono server を起動する

リポジトリ root で PostgreSQL を起動し、`.env` に接続情報を設定します。

```bash
DATABASE_URL=postgresql://user:password@localhost:5432/cooking_planner
PORT=3000
DEV_USER_ID=local-dev-user
VITE_API_BASE_URL=/api
```

frontend build 後に Hono server を起動します。

```bash
bun run start
```

ローカル PC で同一オリジン配信を確認します。

```text
http://127.0.0.1:3000/
http://127.0.0.1:3000/health
```

## 2. Tailscale Serve を起動する

Hono server の port が `3000` の場合は次のコマンドで HTTPS 公開します。

```bash
tailscale serve --bg 3000
```

設定状態を確認します。

```bash
tailscale serve status
```

出力に `https://<device>.<tailnet>.ts.net` から `http://127.0.0.1:3000` への転送が表示されていれば、Tailscale Serve 側の設定は完了です。

## 3. tailnet 端末から確認する

スマホまたはタブレットなど、同じ tailnet に参加している別端末から以下を開きます。

```text
https://<device>.<tailnet>.ts.net/
https://<device>.<tailnet>.ts.net/health
https://<device>.<tailnet>.ts.net/api/recipes
```

主要画面（レシピ一覧、献立、買い物リスト）が表示され、`/health` と主要 API が応答すれば、本番相当の単一オリジン配信と tailnet 内限定公開を確認できます。

## 認証境界

Tailscale Serve 構成では、アプリに到達できるかどうかを Tailscale tailnet への参加状態で制御します。アプリ側は当面 `DEV_USER_ID=local-dev-user` を固定し、すべてのデータを単一ユーザーの `user_id` として扱います。

この運用では、tailnet に参加できる端末・ユーザーを Tailscale 側で厳密に管理してください。`DEV_USER_ID` は利用者識別や端末別監査には使えません。複数ユーザー運用や端末ごとの権限分離が必要になった場合は、Tailscale identity / header を Hono server で扱う実装を別途検討します。

Cloudflare Access を使う場合は、Cloudflare Tunnel + Access を代替案として構成し、`DEV_USER_ID` を外して Cloudflare Access の JWT 検証用環境変数を設定します。

## PC 再起動後の確認

PC を再起動した後は、次の順に確認します。

1. PostgreSQL が起動している。
2. `bun run start` で Hono server が `127.0.0.1:3000` に応答している。
3. `tailscale serve status` で Serve 設定が残っている。
4. Serve 設定がない場合は `tailscale serve --bg 3000` を再実行する。
5. tailnet 内端末から `https://<device>.<tailnet>.ts.net` を開ける。

## トラブルシューティング

### tailnet 端末から開けない

- 対象端末が同じ tailnet に参加しているか確認する。
- ローカル PC 側の Tailscale が接続済みか確認する。
- `tailscale serve status` で HTTPS URL と転送先 port を確認する。
- Hono server が `http://127.0.0.1:3000/health` に応答するか確認する。

### API だけ失敗する

- `VITE_API_BASE_URL=/api` で frontend を build しているか確認する。
- `DEV_USER_ID=local-dev-user` が Hono server の実行環境に設定されているか確認する。
- Hono server の標準出力に DB 接続エラーや認証エラーが出ていないか確認する。

### LAN から直接アクセスできてしまう

- Hono server が `127.0.0.1` に bind していることを確認する。
- `0.0.0.0` や LAN IP で bind する起動オプションを追加していないか確認する。
