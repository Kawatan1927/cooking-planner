---
id: maintenance-dependency-update
title: 依存関係の更新方針
sidebar_position: 1
---

## 概要

個人利用アプリのため、依存関係の更新は定期的かつ手動で行います。セキュリティ上重要なアップデートは優先的に対応します。

## 更新頻度の目安

| 種別                                | 頻度         | 対応方針                                 |
| ----------------------------------- | ------------ | ---------------------------------------- |
| セキュリティ修正（critical / high） | 発見次第     | 優先対応                                 |
| セキュリティ修正（medium 以下）     | 月次         | 定期更新時にまとめて対応                 |
| 機能追加・バグ修正                  | 月次〜四半期 | 破壊的変更がないか確認してから更新       |
| メジャーバージョンアップ            | 半年〜年次   | マイグレーションガイドを確認してから対応 |

## 更新可能なパッケージの確認

```bash
cd frontend && bun outdated && cd ..
cd backend && bun outdated && cd ..
cd docs && bun outdated && cd ..
```

## 更新

```bash
cd frontend && bun update && cd ..
cd backend && bun update && cd ..
cd docs && bun update && cd ..
```

特定パッケージを更新する場合:

```bash
cd frontend && bun add <package>@<version> && cd ..
cd backend && bun add <package>@<version> && cd ..
cd docs && bun add <package>@<version> && cd ..
```

## 検証

```bash
bun run lint
bun run format:check
bun run type-check
bun run build:all
bun run test
```

## 主要依存パッケージ

### フロントエンド

| パッケージ | 用途              |
| ---------- | ----------------- |
| React      | UI ライブラリ     |
| Vite       | ビルドツール      |
| TypeScript | 型付き JavaScript |

### バックエンド

| パッケージ | 用途                  |
| ---------- | --------------------- |
| Hono       | HTTP server / routing |
| Bun        | JavaScript runtime    |
| Drizzle    | PostgreSQL 用 ORM     |
| postgres   | PostgreSQL client     |
| TypeScript | 型付き JavaScript     |

### ドキュメント

| パッケージ | 用途               |
| ---------- | ------------------ |
| Docusaurus | ドキュメントサイト |
| Prettier   | ドキュメント整形   |

## 注意点

- `bun.lock` の変更を確認する。
- DB 周りの依存を更新した場合は migration と接続確認を行う。
- Tailscale Serve、または Cloudflare Access / Tunnel 代替構成の手動設定を変えた場合は、変更内容を Issue や運用メモに残す。
