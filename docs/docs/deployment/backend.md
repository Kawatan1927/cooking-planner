---
id: deployment-backend
title: バックエンドデプロイ
sidebar_position: 3
---

## 概要

バックエンド（Lambda + API Gateway）およびインフラ（DynamoDB、Cognito 等）は AWS CDK で管理する方針とする。
変更は `cdk deploy` コマンドでデプロイする運用を想定している。

`infra/lib/cooking-planner-stack.ts` に CDK スタックが実装されており、現時点では **DynamoDB テーブル**（Recipes / RecipeIngredients / Menus）が定義されている。
Lambda・API Gateway・Cognito・S3+CloudFront などのリソースは今後の Issue で順次追加予定。

---

## 手動デプロイ手順

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

| 変数名                          | 説明                           |
| ------------------------------- | ------------------------------ |
| `RECIPES_TABLE_NAME`            | Recipes テーブル名             |
| `RECIPE_INGREDIENTS_TABLE_NAME` | RecipeIngredients テーブル名   |
| `MENUS_TABLE_NAME`              | Menus テーブル名               |
| `PANTRY_ITEMS_TABLE_NAME`       | PantryItems テーブル名（将来） |

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

## 初回デプロイ（CDK スタック未完成時）

> **TODO**: Lambda・API Gateway・Cognito・S3+CloudFront などのリソースが CDK スタックに追加され次第、手順を追記する。
> 現在 `infra/lib/cooking-planner-stack.ts` には DynamoDB テーブルのみ定義されている。
> 参考: `infra/CDK_INTEGRATION.md`
