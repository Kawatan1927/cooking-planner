---
id: deployment-backend
title: バックエンドデプロイ
sidebar_position: 3
---

## 概要

バックエンド（Lambda + API Gateway）およびインフラ（DynamoDB、Cognito 等）は、将来的に AWS CDK で管理する方針とする。
CDK アプリ実装完了後は、変更を `cdk deploy` コマンドでデプロイする運用を想定している。
現時点では `infra/` 配下に CDK アプリ実装が存在しないため、このページの CDK 操作手順は実装完了後に有効となる予定である。

---

## 手動デプロイ手順

> **TODO**: 以下の手順は `infra/` 配下の CDK アプリ実装完了後に利用する。

### 1. 差分確認

```bash
cd infra
cdk diff
```

- 意図しないリソースの変更・削除が含まれていないことを必ず確認する
- DynamoDB テーブルの削除（`DESTROY` ポリシー）には特に注意する

### 2. デプロイ実行

```bash
cd infra
cdk deploy
```

- Lambda コードのバンドルと API Gateway・DynamoDB 等のリソース更新が一括で行われる
- デプロイ完了後、出力（Outputs）に API Gateway の URL 等が表示される

### 3. Lambda のみ更新する場合

インフラ変更なしで Lambda コードだけ更新する場合も `cdk deploy` を使用する。
CDK が差分を検出して Lambda 関数のみ更新する。

---

## 環境変数（Lambda）

Lambda の環境変数は CDK スタック内で定義し、DynamoDB テーブル名等を自動的に渡す。
手動で変更する必要は基本的にない。

| 変数名 | 説明 |
|---|---|
| `RECIPES_TABLE_NAME` | Recipes テーブル名 |
| `RECIPE_INGREDIENTS_TABLE_NAME` | RecipeIngredients テーブル名 |
| `MENUS_TABLE_NAME` | Menus テーブル名 |
| `PANTRY_ITEMS_TABLE_NAME` | PantryItems テーブル名（将来） |

---

## CDK Bootstrap（初回のみ）

AWS アカウント・リージョンで CDK を初めて使う場合は以下を実行する。

```bash
cdk bootstrap aws://<アカウント ID>/<リージョン>
# 例
cdk bootstrap aws://123456789012/ap-northeast-1
```

---

## ロールバック

CDK のデプロイは CloudFormation 経由で行われるため、デプロイ失敗時には CloudFormation の自動ロールバック機能が既定で有効になっている。
ただし、過去の正常な状態へ明示的に戻すための簡易なロールバックコマンドは用意されていないため、前のバージョンに戻すには対象コミットをチェックアウトして再度 `cdk deploy` を実行する。

```bash
git checkout <前のコミット SHA>
cd infra
cdk deploy
```

> **TODO**: CloudFormation スタックのロールバック（`aws cloudformation cancel-update-stack`）も選択肢として検討する。

---

## 初回デプロイ（CDK スタック未作成時）

> **TODO**: CDK スタックの実装完了後に手順を追記する。
> 現在 `infra/` 配下には CDK アプリ実装（`infra/lib` 等）はなく、Lambda コードと統合メモのみ存在する。
> 参考: `infra/CDK_INTEGRATION.md`
