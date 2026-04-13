---
id: operations-monitoring
title: 監視・ログ
sidebar_position: 1
---

## 概要

個人利用アプリのため、重厚な監視システムは導入せず、AWS のマネージドサービス（CloudWatch）を活用した最小限の監視を行う。

---

## ログ

### Lambda ログ（CloudWatch Logs）

Lambda の標準出力（`console.log`, `console.error`）は自動的に CloudWatch Logs に送信される。

**ロググループ名**: `/aws/lambda/<関数名>`

#### ログ出力方針

各 API リクエストで以下の情報を出力する。

| 項目             | 内容                              |
| ---------------- | --------------------------------- |
| HTTP メソッド    | `GET`, `POST`, `PUT`, `DELETE` 等 |
| パス             | `/recipes`, `/menus` 等           |
| userId           | JWT の `sub`（わかる範囲で）      |
| ステータスコード | レスポンスの HTTP ステータス      |

エラー時は stack trace を出力する（ただし機微情報は含めない）。

#### ログの確認方法

```bash
# AWS CLI でログを確認（リアルタイム）
aws logs tail /aws/lambda/<関数名> --follow

# 特定の時間帯を確認
aws logs filter-log-events \
  --log-group-name /aws/lambda/<関数名> \
  --start-time <エポックミリ秒>
```

または AWS コンソール → CloudWatch → ロググループから確認する。

---

## メトリクス・アラート

### 現在の方針（初期段階）

初期段階では細かいアラートは設定しない。
問題が発生した場合は CloudWatch コンソールで手動確認する。

### 将来的に追加を検討するアラート

| メトリクス             | 閾値（目安）          | 備考                  |
| ---------------------- | --------------------- | --------------------- |
| Lambda エラーレート    | 5 分間で 5 件以上     | `Errors` メトリクス   |
| API Gateway 5xx レート | 5 分間で 10 件以上    | `5XXError` メトリクス |
| Lambda 実行時間        | タイムアウトの 80% 超 | `Duration` メトリクス |

> **TODO**: 運用が安定してきたら CloudWatch アラーム + SNS（メール通知）の設定を追加する。

---

## コスト管理

個人利用のため、コストが想定外に増加しないよう定期的に確認する。

- AWS コンソール → Billing → Cost Explorer で月次コストを確認する
- Lambda・API Gateway・DynamoDB はリクエスト課金のため、異常なリクエスト数がないか確認する

> **TODO**: AWS Budgets でコスト上限アラートを設定することを検討する（例：月 $10 超で通知）。
