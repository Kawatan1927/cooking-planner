# ローカル Hono フロントエンド配信 設計

## ゴール

Issue #130 では、フロントエンドの配信方式を S3 + CloudFront からローカルの
Hono サーバーへ変更する。バックエンドが Vite のビルド成果物
`frontend/dist/` を静的ファイルとして配信し、React Router の直接 URL アクセスに
対応するため、非 API ルートは `index.html` にフォールバックする。

## スコープ

- Hono バックエンドで `frontend/dist/` の静的ファイルを配信する。
- `/recipes`、`/menus`、`/shopping-list` などの非 API パスでは
  `frontend/dist/index.html` を返す。
- 正規の API は `/api/*` に統一する。
- 既存のローカル疎通確認用として `/health` は維持する。
- ローカル Hono/API 構成に合わせてフロントエンドの環境変数サンプルを更新する。
- SPA フォールバックと API ルーティングが衝突しないことをバックエンドテストで確認する。

## 非スコープ

- React コンポーネントや UI の振る舞いは変更しない。
- S3 バケット、CloudFront ディストリビューション、CDK インフラの削除や廃止手順は
  この Issue では扱わない。
- nginx は導入しない。
- CloudFront 向けの `_redirects` などの設定ファイルは追加しない。
- `docs/04-api-design.md` に記載された API レスポンス形式は変更しない。

## アーキテクチャ

`backend/src/app.ts` は Hono アプリの組み立て場所として維持する。API ルートは
`/api` 配下に登録し、`/health` は `/api` なしでも利用できる軽量なヘルスチェック
として残す。静的ファイル配信は API ルート登録後に追加し、API パスが先に解決される
ようにする。

SPA フォールバックは非 API リクエストだけに適用する。未定義の `/api/*` パスは
既存どおり JSON 形式の 404 エラーを返し、未定義の非 API パスは
`frontend/dist/index.html` を返す。

## データフロー

1. ブラウザが `/` にアクセスする。
2. Hono が `frontend/dist/index.html` を返す。
3. ブラウザが同一オリジンから静的アセットを読み込む。
4. フロントエンドの API 呼び出しは `VITE_API_BASE_URL=/api` を使う。
5. Hono が既存の `/api/*` ルートで API リクエストを処理する。

## テスト

- `backend/src/app.test.ts` にテストを追加する。
- テスト実行中に一時的な `frontend/dist` フィクスチャを作成する。
- `/recipes` が API JSON ではなく SPA の HTML を返すことを確認する。
- `/api/health` が引き続き JSON を返すことを確認する。
- 未定義の `/api/*` が JSON 形式の 404 を返すことを確認する。

## 環境変数サンプル

`frontend/.env.example` には、ローカル開発で Hono API を参照する設定を記載する。

```env
VITE_API_BASE_URL=http://localhost:3000/api
```

`frontend/.env.production.example` には、Cloudflare Tunnel 経由で同一オリジン配信する
設定例を記載する。

```env
VITE_API_BASE_URL=/api
```

現在の Cloudflare Access 構成では Cognito 関連の環境変数は不要とする。
