---
id: production-setup
title: 本番環境の初回セットアップ
sidebar_position: 2
---

このページでは、**AWS アカウントの作成から始めて** Cooking Planner を本番利用できる状態にするまでの、初回セットアップ手順を一通り説明します。

> **正本について**: インフラ・認証・フロント配信それぞれの詳細手順は `docs/docs/deployment/` 以下の各ページにあります。このページはそれらを統合した「はじめてのセットアップ向け早見表」として機能します。

---

## 必須ツールのインストール

以下のツールをあらかじめインストールしてください。

| ツール                 | バージョン | インストール方法                                                                                      |
| ---------------------- | ---------- | ----------------------------------------------------------------------------------------------------- |
| [Bun](https://bun.sh/) | 1.x 以上   | `curl -fsSL https://bun.sh/install \| bash`                                                           |
| Node.js                | 20.x 以上  | [nodejs.org](https://nodejs.org/) または [nvm](https://github.com/nvm-sh/nvm)                         |
| AWS CLI                | 2.x 以上   | [公式インストール手順](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) |
| Git                    | —          | OS 付属または [git-scm.com](https://git-scm.com/)                                                     |

```bash
# バージョン確認
bun --version
node --version
aws --version
git --version
```

---

## Step 0: AWS アカウントの作成・IAM 設定

:::tip AWS アカウントをすでに持っている場合
[Step 1](#step-1-リポジトリのクローンと依存インストール) へ進んでください。
:::

### 0-1. AWS アカウントの作成

1. [AWS サインアップページ](https://portal.aws.amazon.com/billing/signup) にアクセスする
2. メールアドレス・パスワード・AWS アカウント名を入力して「Continue」
3. 連絡先情報（氏名・住所・電話番号）を入力する（個人利用の場合は「Personal」を選択）
4. クレジットカード / デビットカード情報を入力する
   - フリーティア範囲内での利用なら実質無料（ただし初回 $1 の仮請求が発生する場合あり）
5. 電話番号 SMS または音声で本人確認コードを入力する
6. サポートプランは「**Basic（無料）**」を選択する
7. 登録完了後、[AWS マネジメントコンソール](https://console.aws.amazon.com/) にログインできることを確認する

:::caution ルートアカウントの扱い
サインアップ直後のアカウント（ルートユーザー）は強力な権限を持つため、以降の作業には IAM ユーザーを使ってください（次手順で作成します）。
:::

---

### 0-2. IAM ユーザーの作成とアクセスキーの発行

CDK でインフラをデプロイするには **AdministratorAccess** 相当の IAM ユーザーとアクセスキーが必要です。

#### コンソール操作

1. マネジメントコンソールで「IAM」を開く
2. 左メニュー「ユーザー」→「ユーザーを作成」をクリック
3. ユーザー名（例: `cooking-planner-deploy`）を入力して「次へ」
4. 「ポリシーを直接アタッチする」を選択し、「**AdministratorAccess**」にチェックを入れて「次へ」
5. 「ユーザーを作成」をクリック
6. 作成したユーザーをクリック →「セキュリティ認証情報」タブ→「アクセスキーを作成」
7. ユースケースは「**コマンドラインインターフェイス (CLI)**」を選択して「次へ」
8. **アクセスキー ID** と **シークレットアクセスキー** をメモまたはダウンロードする（この画面を閉じると再表示できない）

:::caution シークレットキーの管理
アクセスキーは **絶対にコードにコミットしないこと**。パスワードマネージャーなど安全な場所に保管してください。
:::

---

### 0-3. AWS CLI に認証情報を設定する

```bash
# 対話式で設定（推奨）
aws configure --profile cooking-planner
# → AWS Access Key ID: <アクセスキー ID>
# → AWS Secret Access Key: <シークレットアクセスキー>
# → Default region name: ap-northeast-1
# → Default output format: json

# プロファイルを使うよう環境変数に設定
export AWS_PROFILE=cooking-planner

# 設定を確認（アカウント ID が表示されれば OK）
aws sts get-caller-identity
```

---

## Step 1: リポジトリのクローンと依存インストール

```bash
git clone https://github.com/Kawatan1927/cooking-planner.git
cd cooking-planner

# ルートの依存関係（lefthook など）
bun install --frozen-lockfile

# フロントエンドの依存関係
cd frontend && bun install --frozen-lockfile && cd ..

# Lambda の依存関係
cd infra/lambda && bun install --frozen-lockfile && cd ../..

# CDK（infra）の依存関係
cd infra && bun install --frozen-lockfile && cd ..
```

---

## Step 2: CDK Bootstrap（初回のみ）

AWS アカウント × リージョンで CDK を初めて使う場合は Bootstrap が必要です。

```bash
cd infra
bunx cdk bootstrap aws://<アカウントID>/<リージョン>
# 例
bunx cdk bootstrap aws://123456789012/ap-northeast-1
```

> Bootstrap 済みの場合はこの手順をスキップできます。

---

## Step 3: インフラのデプロイ（CDK）

### 3-1. 差分の確認

```bash
cd infra
bunx cdk diff \
  --context stage=prod \
  --context allowedOrigins=https://仮の値 \
  --context callbackUrls=https://仮の値/callback \
  --context logoutUrls=https://仮の値
```

初回デプロイ時は CloudFront URL が未確定のため、まず仮の値でデプロイして URL を取得します。

### 3-2. デプロイ実行（初回：仮 URL でデプロイ）

```bash
cd infra
bunx cdk deploy \
  --context stage=prod \
  --context allowedOrigins=https://仮の値 \
  --context callbackUrls=https://仮の値/callback \
  --context logoutUrls=https://仮の値
```

デプロイ完了後、ターミナルに **Outputs** が表示されます。**この値を必ず手元に控えてください。**

| CDK Output キー            | 説明                                                   |
| -------------------------- | ------------------------------------------------------ |
| `CloudFrontUrl`            | CloudFront URL（以降の手順で使用）                     |
| `CloudFrontDistributionId` | CloudFront Distribution ID（フロントデプロイ時に使用） |
| `FrontendBucketName`       | S3 バケット名（フロントデプロイ時に使用）              |
| `UserPoolId`               | Cognito User Pool ID                                   |
| `UserPoolClientId`         | Cognito App Client ID                                  |
| `UserPoolDomainName`       | Cognito Hosted UI ドメイン名                           |
| `HttpApiUrl`               | API Gateway エンドポイント URL                         |

```bash
# Outputs を後から確認する場合
aws cloudformation describe-stacks \
  --stack-name CookingPlanner-prod \
  --query "Stacks[0].Outputs" \
  --output table
```

### 3-3. 本番 URL を正式に設定して再デプロイ

CloudFront URL（例: `https://xxxxxxxxxxxx.cloudfront.net`）が確定したら、正式な URL で再デプロイします。

```bash
cd infra
bunx cdk deploy \
  --context stage=prod \
  --context allowedOrigins=https://xxxxxxxxxxxx.cloudfront.net \
  --context callbackUrls=https://xxxxxxxxxxxx.cloudfront.net/callback \
  --context logoutUrls=https://xxxxxxxxxxxx.cloudfront.net
```

> **詳細**: [バックエンドデプロイ](../deployment/backend.md) を参照してください。

---

## Step 4: Cognito ユーザーの作成

CDK デプロイで作成された Cognito User Pool に、自分のユーザーを追加します。

### 4-1. ユーザー作成

```bash
aws cognito-idp admin-create-user \
  --user-pool-id <UserPoolId> \
  --username <メールアドレス> \
  --temporary-password "<TEMP_PASSWORD>" \
  --user-attributes Name=email,Value=<メールアドレス> Name=email_verified,Value=true \
  --message-action SUPPRESS
```

- `<UserPoolId>`: Step 3 の Outputs から取得した値（例: `ap-northeast-1_XXXXXXX`）
- `<メールアドレス>`: ログインに使うメールアドレス
- `--message-action SUPPRESS`: 招待メールの送信をスキップ（メール設定が不要な場合）

### 4-2. 仮パスワードを本パスワードに変更

初回ログイン時に Cognito Hosted UI でパスワード変更を求められます。
または、以下の CLI コマンドで事前に変更することもできます。

```bash
aws cognito-idp admin-set-user-password \
  --user-pool-id <UserPoolId> \
  --username <メールアドレス> \
  --password "<新しいパスワード>" \
  --permanent
```

> **パスワードポリシー**: 「8 文字以上、大文字・小文字・数字を含む」が必須です（記号は任意）。

---

## Step 5: フロントエンド環境変数の設定

`frontend/.env.production` ファイルを作成し、Step 3 の CDK Outputs の値を設定します。

```bash
# frontend/.env.example を参考に作成
cp frontend/.env.example frontend/.env.production
```

`frontend/.env.production` を開き、実際の値に書き換えます。

```dotenv
# CloudFront 経由の API ベース URL
VITE_API_BASE_URL=https://xxxxxxxxxxxx.cloudfront.net/api

# Cognito User Pool ID（CDK Output: UserPoolId）
VITE_COGNITO_USER_POOL_ID=ap-northeast-1_XXXXXXX

# Cognito Hosted UI ドメイン（CDK Output: UserPoolDomainName）
VITE_COGNITO_DOMAIN=cooking-planner-prod.auth.ap-northeast-1.amazoncognito.com

# Cognito App Client ID（CDK Output: UserPoolClientId）
VITE_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx

# AWS リージョン
VITE_COGNITO_REGION=ap-northeast-1

# OAuth コールバック URL
VITE_COGNITO_REDIRECT_URI=https://xxxxxxxxxxxx.cloudfront.net/callback

# ログアウト後リダイレクト URL
VITE_COGNITO_LOGOUT_REDIRECT_URI=https://xxxxxxxxxxxx.cloudfront.net
```

:::caution
`frontend/.env.production` はリポジトリにコミットしないでください（`.gitignore` で除外済み）。
実際の値は別途安全な場所（パスワードマネージャーなど）に保管し、**絶対にコミットしないこと**。
:::

> **詳細**: [フロントエンドデプロイ › 環境変数](../deployment/frontend.md#環境変数) も参照してください。

---

## Step 6: フロントエンドのデプロイ

### スクリプトによるデプロイ（推奨）

```bash
# リポジトリルートで実行
./scripts/deploy-frontend.sh prod
```

スクリプトは以下を自動で行います：

1. `frontend/.env.production` を読み込んでビルド（`bun run build`）
2. S3 へアップロード（`aws s3 sync`）
3. CloudFront キャッシュの無効化

> **詳細**: [フロントエンドデプロイ](../deployment/frontend.md) を参照してください。

---

## Step 7: 動作確認チェックリスト

デプロイ完了後、以下の項目を順番に確認してください。

### インフラ確認

- [ ] `aws cloudformation describe-stacks --stack-name CookingPlanner-prod` が正常に返る
- [ ] CloudFront URL（`https://xxxxxxxxxxxx.cloudfront.net`）にブラウザでアクセスできる

### 認証確認

- [ ] CloudFront URL にアクセスするとログイン画面（Cognito Hosted UI）にリダイレクトされる
- [ ] 作成したユーザー（メールアドレス + パスワード）でログインできる
- [ ] ログイン後、アプリのトップページ（レシピ一覧など）が表示される
- [ ] ログアウト操作で Cognito のログアウト画面に遷移し、CloudFront URL に戻る

### API 確認

- [ ] ログイン後にレシピ一覧 API が正常に返る（ブラウザの開発者ツールでネットワークタブを確認）
- [ ] CloudWatch Logs（`/aws/lambda/cooking-planner-api-prod`）にエラーが出ていない

```bash
# CloudWatch でエラーログを確認（直近 5 分）
aws logs filter-log-events \
  --log-group-name /aws/lambda/cooking-planner-api-prod \
  --start-time $(($(date +%s) - 300))000 \
  --filter-pattern ERROR
```

### フロントエンド確認

- [ ] ブラウザをリロードしてもページが表示される（SPA ルーティングが正しく動作している）
- [ ] `https://xxxxxxxxxxxx.cloudfront.net/health` にアクセスして `{"status":"ok"}` が返る

---

## トラブルシューティング

### CDK デプロイが失敗する

- `bunx cdk diff` で変更内容を確認し、不要なリソース変更・削除がないことを確認する
- `prod` 環境では `allowedOrigins`・`callbackUrls`・`logoutUrls` が必須。省略するとエラーになる（fail-closed 設計）

### ログインできない / リダイレクトループになる

- `frontend/.env.production` の `VITE_COGNITO_REDIRECT_URI` が Cognito App Client の **コールバック URL** と一致しているか確認する
- CDK 再デプロイ後に CloudFront URL が変わった場合は、`frontend/.env.production` を更新して再デプロイする

### API が 401 / 403 を返す

- ブラウザのトークンが古くなっている可能性がある。ログアウトして再ログインする
- Cognito JWT Authorizer の設定（User Pool ID / Client ID）が正しいか確認する

### S3 アップロードが失敗する

- AWS CLI の認証情報が `prod` 環境のものになっているか確認する
- `FrontendBucketName` の値が正しいか確認する

---

## 参考リンク

- [バックエンドデプロイ](../deployment/backend.md) — CDK デプロイの詳細
- [フロントエンドデプロイ](../deployment/frontend.md) — フロント S3 デプロイの詳細
- [環境変数リファレンス](../development/environment-variables.mdx) — フロントエンド・Lambda 環境変数の一覧
- [ローカル開発環境のセットアップ](./local-dev.md) — 開発時のセットアップ手順
