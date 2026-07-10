# フロントエンド単体テスト基盤 設計

## ゴール

Issue #145 では、Vitest と React Testing Library を使い、フロントエンドの
コンポーネントと TanStack Query hooks をローカルおよび CI で安定してテストできる
共通基盤を整える。

## スコープ

- `frontend` に Vitest、jsdom、React Testing Library、user-event、jest-dom matcher を導入する。
- `bun run test` と watch モード用スクリプトを追加する。
- Vite 設定にテスト環境、セットアップファイル、エイリアス解決を設定する。
- QueryClientProvider と MemoryRouter を毎テスト生成する共通 render helper を用意する。
- テストの後処理で DOM と mock の状態を初期化し、QueryClient や mock が他テストへ漏れないようにする。
- ユーザーから観測できる表示を確認する最小のコンポーネントテストを追加する。
- `frontend/AGENTS.md` と Docusaurus の自動生成ドキュメント層に、フロントエンド単体テストの実行方法を記載する。

## 非スコープ

- 個別機能の網羅的なテスト追加
- Playwright などの E2E テスト
- CSS、レイアウト、スナップショットのテスト
- 一律のカバレッジ閾値
- `docs/01-vision-and-scope.md` から `docs/05-architecture-notes.md` の変更

## アーキテクチャ

テストランナーは Vite と統合された Vitest を使用し、ブラウザ API は jsdom が提供する。
`frontend/src/test/renderWithProviders.tsx` は、呼び出しごとに retry を無効化した新規
QueryClient と任意の初期 URL を持つ MemoryRouter を作成して React Testing Library の
`render` をラップする。アプリ本体の共有 `queryClient` や browser router をテストで
再利用しない。

`frontend/src/test/setup.ts` では jest-dom matcher を登録する。各テストファイルは
`afterEach` で Testing Library の cleanup と Vitest mock の復元を実行する。API 通信は
`vi.mock` で API ラッパーまたは `apiClient` を置き換え、実ネットワークに接続しない。

## テスト方針

最小サンプルは、API から取得する値を画面に表示する既存コンポーネントを対象とする。
API 呼び出しを mock し、読み込み後に利用者が見えるテキストが描画されることを確認する。
これにより、jsdom、Provider helper、非同期待機、mock の初期化が連携して動作することを
確認する。

hooks のテストでは `renderHook` に同じ QueryClientProvider を渡せるようにし、成功時の
キャッシュ無効化や失敗時の再試行がテスト間で共有されないことを担保する。

## 受け入れ条件との対応

- `cd frontend && bun run test` と `bun run test:watch` を実行できる。
- 共通 helper で React コンポーネントと TanStack Query hooks を描画できる。
- 各 helper 呼び出しが新しい QueryClient を使用し、afterEach が DOM と mock を初期化する。
- 追加したサンプルテスト、lint、型チェック、ビルドが通る。
