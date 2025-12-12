# Cognito User Pool 設定

このドキュメントでは、Cooking Planner アプリケーションのユーザー認証を提供する Amazon Cognito User Pool の CDK 設定を記載します。

## 概要

Amazon Cognito User Pool を使用して、アプリケーションへのログイン機能を提供します。個人利用を想定しているため、管理者のみがユーザーを作成できる設定になっています。

## User Pool の基本設定

| 項目 | 値 | 説明 |
|-----|-----|------|
| User Pool 名 | `CookingPlanner-UserPool-{stage}` | stage は `prod` または `dev` |
| セルフサインアップ | 無効 | 管理者のみがユーザーを作成可能 |
| サインイン方式 | Email | メールアドレスでログイン |
| Email 自動検証 | 有効 | メールアドレスを自動検証 |
| Removal Policy (prod) | RETAIN | 本番環境ではスタック削除時も User Pool を保持 |
| Removal Policy (dev) | DESTROY | 開発環境ではスタック削除時に削除 |

## ユーザー属性

### 必須属性

| 属性名 | タイプ | 変更可否 | 説明 |
|-------|--------|---------|------|
| email | String | 不可 | ユーザーのメールアドレス（ログインIDとして使用） |

### 属性設定の背景

- **email を必須かつ不変に設定**: ユーザー識別子として使用するため、後から変更できないようにしています
- **最小限の属性のみ**: 個人利用のため、名前などの追加属性は不要

## パスワードポリシー

セキュリティを確保しつつ、個人利用に適したバランスの取れた設定：

| 項目 | 値 | 説明 |
|-----|-----|------|
| 最小文字数 | 8文字 | 十分な強度を確保 |
| 小文字 | 必須 | a-z を含む必要あり |
| 大文字 | 必須 | A-Z を含む必要あり |
| 数字 | 必須 | 0-9 を含む必要あり |
| 記号 | 不要 | 利便性のため不要 |

### パスワード例

- ✅ `Password123` - 有効
- ✅ `MySecret2024` - 有効
- ❌ `password` - 大文字と数字が不足
- ❌ `Pass1` - 文字数不足

## アカウント復旧設定

| 項目 | 値 |
|-----|-----|
| 復旧方法 | Email のみ |

パスワードを忘れた場合、登録メールアドレスに復旧コードが送信されます。

## User Pool Client 設定

SPA（Single Page Application）からのアクセス用にクライアントを設定しています。

### Client 基本設定

| 項目 | 値 | 説明 |
|-----|-----|------|
| Client 名 | `CookingPlanner-Client-{stage}` | stage は `prod` または `dev` |
| Client Secret | 生成しない | SPA は Secret を安全に保管できないため |

### 認証フロー

有効化されている認証フロー：

| フロー | 説明 |
|-------|------|
| USER_PASSWORD_AUTH | ユーザー名とパスワードによる認証 |
| USER_SRP_AUTH | Secure Remote Password プロトコルによる認証 |

### OAuth 2.0 設定

| 項目 | 値 | 説明 |
|-----|-----|------|
| OAuth フロー | Authorization Code Grant, Implicit Grant | SPA で使用可能なフロー |
| OAuth スコープ | openid, email, profile | 基本的なユーザー情報へのアクセス |

#### スコープの説明

- **openid**: OpenID Connect の基本スコープ
- **email**: ユーザーのメールアドレスへのアクセス
- **profile**: ユーザープロファイル情報へのアクセス

## フロントエンドでの使用方法

### 必要な情報

フロントエンドアプリケーションで Cognito を使用するために必要な情報：

| 情報 | CloudFormation Output 名 | 説明 |
|-----|--------------------------|------|
| User Pool ID | `UserPoolId` | Cognito User Pool の識別子 |
| Client ID | `UserPoolClientId` | アプリケーションクライアントの識別子 |
| Region | - | AWS リージョン（デプロイ先） |

### 環境変数の設定例

フロントエンドの `.env` ファイルに以下を設定：

```bash
VITE_COGNITO_USER_POOL_ID=ap-northeast-1_XXXXXXXXX
VITE_COGNITO_CLIENT_ID=1234567890abcdefghijklmnop
VITE_COGNITO_REGION=ap-northeast-1
```

### ライブラリの例

AWS Amplify や amazon-cognito-identity-js を使用して認証を実装：

```typescript
import { CognitoUserPool, CognitoUser, AuthenticationDetails } from 'amazon-cognito-identity-js';

const poolData = {
  UserPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
  ClientId: import.meta.env.VITE_COGNITO_CLIENT_ID,
};

const userPool = new CognitoUserPool(poolData);
```

## ユーザー管理

### ユーザーの作成方法

セルフサインアップが無効のため、管理者が AWS Console または CLI でユーザーを作成する必要があります。

#### AWS Console での作成手順

1. Cognito コンソールを開く
2. User Pool を選択
3. 「ユーザーの作成」をクリック
4. メールアドレスと一時パスワードを入力
5. ユーザーに一時パスワードを共有
6. 初回ログイン時にパスワード変更を要求

#### AWS CLI での作成例

```bash
aws cognito-idp admin-create-user \
  --user-pool-id ap-northeast-1_XXXXXXXXX \
  --username user@example.com \
  --user-attributes Name=email,Value=user@example.com \
  --temporary-password TempPass123 \
  --message-action SUPPRESS
```

## JWT トークン

### トークンの種類

Cognito は認証成功時に以下の3つのトークンを発行します：

| トークン | 用途 | 有効期間 |
|---------|------|---------|
| ID Token | ユーザー情報を含む（API 認証に使用） | 1時間（デフォルト） |
| Access Token | リソースへのアクセス権限 | 1時間（デフォルト） |
| Refresh Token | 新しいトークンの取得 | 30日（デフォルト） |

### ID Token の構造

JWT 形式で、以下のようなクレームを含みます：

```json
{
  "sub": "12345678-1234-1234-1234-123456789012",
  "email": "user@example.com",
  "email_verified": true,
  "iss": "https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_XXXXXXXXX",
  "cognito:username": "user@example.com",
  "aud": "1234567890abcdefghijklmnop",
  "token_use": "id",
  "auth_time": 1702371234,
  "exp": 1702374834
}
```

### API リクエストでの使用

フロントエンドから API を呼び出す際、Authorization ヘッダーに ID Token を含めます：

```typescript
const response = await fetch('https://api.example.com/recipes', {
  headers: {
    'Authorization': `Bearer ${idToken}`,
    'Content-Type': 'application/json',
  },
});
```

## CDK コード参照

### User Pool の定義

```typescript
const userPool = new cognito.UserPool(this, 'UserPool', {
  userPoolName: `CookingPlanner-UserPool-${stage}`,
  selfSignUpEnabled: false,
  signInAliases: {
    email: true,
  },
  autoVerify: {
    email: true,
  },
  standardAttributes: {
    email: {
      required: true,
      mutable: false,
    },
  },
  passwordPolicy: {
    minLength: 8,
    requireLowercase: true,
    requireUppercase: true,
    requireDigits: true,
    requireSymbols: false,
  },
  accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
  removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
});
```

### User Pool Client の定義

```typescript
const userPoolClient = userPool.addClient('UserPoolClient', {
  userPoolClientName: `CookingPlanner-Client-${stage}`,
  authFlows: {
    userPassword: true,
    userSrp: true,
  },
  oAuth: {
    flows: {
      authorizationCodeGrant: true,
      implicitCodeGrant: true,
    },
    scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL, cognito.OAuthScope.PROFILE],
  },
  generateSecret: false,
});
```

### CloudFormation Outputs

```typescript
new cdk.CfnOutput(this, 'UserPoolId', {
  value: userPool.userPoolId,
  description: 'Cognito User Pool ID',
  exportName: `CookingPlanner-UserPoolId-${stage}`,
});

new cdk.CfnOutput(this, 'UserPoolClientId', {
  value: userPoolClient.userPoolClientId,
  description: 'Cognito User Pool Client ID',
  exportName: `CookingPlanner-UserPoolClientId-${stage}`,
});
```

## セキュリティベストプラクティス

### 実装済み
- ✅ セルフサインアップ無効（管理者のみがユーザー作成可能）
- ✅ 強固なパスワードポリシー
- ✅ Email 検証必須
- ✅ Client Secret なし（SPA では安全に保管できないため）

### 今後の検討事項
- MFA（多要素認証）の有効化
- IP アドレス制限
- カスタムドメインの使用
- Hosted UI のカスタマイズ

## トラブルシューティング

### よくある問題

**Q: ユーザーが自分でサインアップできない**
A: セルフサインアップが無効になっています。これは意図的な設定です。管理者が AWS Console または CLI でユーザーを作成してください。

**Q: パスワードが要件を満たしているのにエラーが出る**
A: 8文字以上、大文字・小文字・数字をすべて含んでいることを確認してください。記号は不要です。

**Q: トークンの有効期限が切れた**
A: Refresh Token を使用して新しいトークンを取得してください。Refresh Token の有効期限（30日）も切れている場合は再ログインが必要です。

## 参考資料

- [アーキテクチャ構成](/docs/05-architecture-notes.md)
- [Amazon Cognito ドキュメント](https://docs.aws.amazon.com/cognito/)
- [Amazon Cognito User Pools](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-identity-pools.html)
