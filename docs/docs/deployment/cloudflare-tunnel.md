---
id: deployment-cloudflare-tunnel
title: Cloudflare Tunnel（代替案）
sidebar_position: 4
---

## 概要

Cloudflare Tunnel を使い、ローカル PC 上で動く Hono サーバーをインターネットへ公開する代替案です。
外部からのアクセスは Cloudflare Access のメール認証ポリシーで制御し、自分のメールアドレスだけを許可する。

Cooking Planner の第一候補は [Tailscale Serve](./tailscale-serve.md) による tailnet 内限定公開です。独自ドメインや tailnet 外からのアクセスが必要になった場合だけ、この手順を使います。

この手順では、リポジトリに含まれる `cloudflare/config.yml.example` をテンプレートとして使う。
実際の Tunnel UUID、認証情報 JSON、`cert.pem` はコミットしない。

---

## 前提条件

- Cloudflare アカウントと、Cloudflare に登録済みのドメインがあること
- ローカル PC でアプリを `http://127.0.0.1:3000` として起動できること
- Hono サーバーは `127.0.0.1` に bind し、LAN に直接公開しないこと
- Cloudflare Access で許可する自分のメールアドレスが決まっていること

---

## 1. cloudflared をインストールする

Cloudflare の公式ダウンロードページから、利用 OS に合う `cloudflared` をインストールする。

- Windows: GitHub Releases の MSI または実行ファイルを使う
- macOS: `brew install cloudflared`
- Linux: Cloudflare Package Repository または GitHub Releases の `.deb` / `.rpm` / binary を使う

インストール後にバージョンを確認する。

```bash
cloudflared --version
```

---

## 2. Cloudflare にログインする

`cloudflared` から Cloudflare アカウントへログインする。

```bash
cloudflared tunnel login
```

ブラウザが開くので、Cloudflare アカウントでログインし、対象ドメインを選択する。
成功すると既定の cloudflared ディレクトリに `cert.pem` が作成される。

---

## 3. Tunnel を作成する

Tunnel 名はわかりやすい名前にする。

```bash
cloudflared tunnel create cooking-planner
```

出力された Tunnel UUID と credentials file のパスを控える。
作成結果は次のコマンドでも確認できる。

```bash
cloudflared tunnel list
```

---

## 4. 設定ファイルを作成する

テンプレートを cloudflared の設定場所へコピーする。以下のコマンドはリポジトリ root で実行する。

```bash
# Windows PowerShell
New-Item -ItemType Directory -Force "$env:USERPROFILE\.cloudflared"
Copy-Item cloudflare/config.yml.example "$env:USERPROFILE\.cloudflared\config.yml"

# macOS / Linux
mkdir -p ~/.cloudflared
cp cloudflare/config.yml.example ~/.cloudflared/config.yml
```

コピーした `config.yml` を編集し、以下を実値に置き換える。

| プレースホルダ                               | 設定する値                                           |
| -------------------------------------------- | ---------------------------------------------------- |
| `<TUNNEL_UUID>`                              | `cloudflared tunnel create` で発行された Tunnel UUID |
| `<ABSOLUTE_PATH_TO_TUNNEL_CREDENTIALS_JSON>` | Tunnel credentials JSON の絶対パス                   |
| `<APP_HOSTNAME>`                             | 公開するホスト名（例: `cooking.example.com`）        |

設定例:

```yaml
tunnel: 00000000-0000-0000-0000-000000000000
credentials-file: C:\Users\your-name\.cloudflared\00000000-0000-0000-0000-000000000000.json

ingress:
  - hostname: cooking.example.com
    service: http://127.0.0.1:3000

  - service: http_status:404
```

:::caution
`credentials-file` に指定する JSON と `cert.pem` は認証情報である。
リポジトリ配下へコピーした場合もコミットしない。
:::

---

## 5. DNS ルートを作成する

公開ホスト名を Tunnel に紐付ける。

```bash
cloudflared tunnel route dns cooking-planner cooking.example.com
```

このコマンドにより、対象ホスト名から Tunnel への CNAME レコードが作成される。

---

## 6. Cloudflare Access を設定する

Cloudflare Zero Trust ダッシュボードで Access Application を作成する。

1. Cloudflare dashboard で `Zero Trust > Access controls > Applications` を開く
2. `Create new application` を選ぶ
3. `Self-hosted and private` を選ぶ
4. `Add public hostname` で `<APP_HOSTNAME>` と同じホスト名を指定する
5. Access policy で Allow policy を作成または選択する
6. Include ルールで自分のメールアドレスだけを許可する
7. 認証方法は One-time PIN または利用中の IdP を選ぶ

Cloudflare Access Application は既定で deny になり、Allow policy に一致したユーザーだけがアクセスできる。

---

## 7. Tunnel を起動する

先にアプリを起動する。以下のコマンドはリポジトリ root で実行する。

```bash
bun run build:all
bun run backend:start
```

別ターミナルで Tunnel を起動する。

```bash
cloudflared tunnel run cooking-planner
```

設定ファイルを既定の場所に置かない場合は `--config` を指定する。

```bash
cloudflared tunnel --config /path/to/config.yml run cooking-planner
```

systemd / Windows service / launch agent としての常駐登録はこの Issue の対象外。
必要になったら Cloudflare の service 登録手順に従って追加する。

---

## 8. 動作確認

### 許可ユーザーで確認する

1. スマホまたは別ネットワークの端末から `https://<APP_HOSTNAME>` を開く
2. Cloudflare Access の認証画面に遷移することを確認する
3. 許可したメールアドレスで認証する
4. Cooking Planner の画面が表示されることを確認する

### 未許可ユーザーで確認する

1. Access policy に含めていないメールアドレスで認証を試す
2. アプリ画面に到達できないことを確認する

### Tunnel 設定を確認する

```bash
cloudflared tunnel ingress validate
cloudflared tunnel ingress rule https://<APP_HOSTNAME>
cloudflared tunnel info cooking-planner
```

`ingress rule` の結果が `service: http://127.0.0.1:3000` に一致していれば、公開ホスト名からローカル Hono サーバーへ転送される。

---

## トラブルシューティング

### Access 認証後に 502 / 1033 になる

- Hono サーバーが起動しているか確認する
- `config.yml` の `service` が `http://127.0.0.1:3000` になっているか確認する
- Hono サーバーの `PORT` と Tunnel の転送先ポートが一致しているか確認する

### 認証画面が出ずにアプリへ到達する

- Access Application の hostname が `<APP_HOSTNAME>` と一致しているか確認する
- Access policy が Bypass になっていないか確認する
- ローカルサーバーを `0.0.0.0` で公開していないか確認する

### `cloudflared tunnel run` が設定ファイルを見つけられない

- `config.yml` が既定の cloudflared ディレクトリにあるか確認する
- 別の場所に置いた場合は `--config` で明示する
- `credentials-file` は絶対パスで指定する

---

## 参考

- [Cloudflare Tunnel downloads](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/)
- [Create a locally-managed tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/local-management/create-local-tunnel/)
- [Cloudflare Tunnel configuration file](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/local-management/configuration-file/)
- [Publish a self-hosted application to the Internet](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/)
