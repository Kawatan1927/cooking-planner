# Recipes API単体テスト拡充設計

## 目的

Recipes APIの一覧・詳細・登録・更新について、入力検証、認証済みユーザーの境界、repository連携、エラー応答の既存契約を単体テストで固定し、将来の変更による回帰を防ぐ。

## 対象範囲

- `GET /api/recipes`
- `GET /api/recipes/:recipeId`
- `POST /api/recipes`
- `PUT /api/recipes/:recipeId`
- `backend/src/recipes/validation.ts` が担う主要な入力検証
- Recipes handlerとrepository間の引数変換
- JSON bodyのトップレベルが非null・非配列のオブジェクトであることを確認する最小限の入力検証

実PostgreSQL、Drizzle SQL、DELETE APIの新規実装、APIレスポンス仕様、上記のトップレベルbody検証以外の本番コードの責務は変更・検証対象外とする。仕様書 `docs/01-vision-and-scope.md` から `docs/05-architecture-notes.md` も変更しない。

## テスト境界

テストはHonoアプリの `app.request` を通して実行する。実際のルーティング、Recipes handler、`adapt` によるレスポンス変換を対象に含め、repositoryと認証だけをモジュールmockへ置き換える。

入力検証は公開APIから観測し、`validation.ts` の内部関数を直接テストしない。これにより、HTTP status、エラーbody、不正入力時にrepositoryを呼ばないことを一つのテスト境界で確認する。

テスト追加を理由に共通helperを追加しない。本番コードの変更は、トップレベルbodyを非null・非配列のオブジェクトに限定する判定だけとする。既存のAPI動作に仕様との差異が見つかった場合は、テストの期待値を実装へ安易に合わせず、仕様書とIssueの受け入れ条件を再確認する。

## テスト配置

エンドポイント単位で責務を分け、対象モジュールと同じディレクトリへ配置する。

- `backend/src/recipes/getRecipes.test.ts`
- `backend/src/recipes/createRecipe.test.ts`
- `backend/src/recipes/getRecipeById.test.ts`
- `backend/src/recipes/updateRecipe.test.ts`

既存の詳細取得テストは同じファイルで拡充する。全エンドポイントを一つのファイルへ集約せず、失敗したAPIとmock状態の影響範囲を特定しやすくする。

## GET一覧のテスト設計

`GET /api/recipes` は次の契約を検証する。

- repositoryへ認証済みの `userId` が渡る
- repositoryのレシピ一覧が公開APIの一覧形式へ変換される
- nullable項目は `null` として返る
- repositoryが空配列を返した場合はstatus 200と空配列を返す
- repository例外時はstatus 500と既存のエラーbodyを返す

一覧レスポンスには詳細用の `memo` や `ingredients` を含めない既存契約を維持する。

## GET詳細のテスト設計

既存の正常系、別ユーザーまたは対象なしの404、UUID不正の404を維持し、repository例外時のstatus 500と既存エラーbodyを追加で検証する。

正常系ではrepositoryが認証済みの `userId` と `recipeId` で呼ばれることを確認する。repositoryが `null` を返した場合はデータの存在や所有者を外部へ区別して公開せず、`RECIPE_NOT_FOUND` を返す。

## POSTのテスト設計

正常系ではstatus 201と作成された `recipeId` を検証する。repositoryには次の変換済み引数が渡ることを確認する。

- レシピ本体に認証済みの `userId` を含める
- 省略された `sourceBook`、`sourcePage`、`memo` を `null` へ変換する
- 材料の省略された `note` を `null` へ変換する
- 数値と文字列の `quantity` を保持する

不正入力はテーブル駆動テストで次の分岐を検証する。

- JSONとして解析できないbody
- トップレベルが `null`、配列、プリミティブのJSON body
- 空または文字列以外の `name`
- 0以下または数値以外の `baseServings`
- 配列ではない `ingredients`
- オブジェクトではない材料
- 空または文字列以外の `ingredientName`
- 大文字小文字と前後空白を正規化した結果が重複する材料名
- 0以下の数値、空文字、未対応型の `quantity`
- 空または文字列以外の `unit`

各ケースでstatus 400、`BAD_REQUEST` のエラーbody、repositoryが呼ばれていないことを確認する。repository例外時はstatus 500と既存エラーbodyを検証する。

## PUTのテスト設計

正常系ではstatus 200と対象の `recipeId` を検証する。repositoryには認証済みの `userId`、パスの `recipeId`、POSTと同じ規則で変換したレシピ本体と材料一覧が渡ることを確認する。

次の分岐ではrepositoryを呼ばない。

- UUID形式でない `recipeId`
- JSONとして解析できないbody
- トップレベルが `null`、配列、プリミティブのJSON body
- `validateRecipeBody` が拒否する入力

UUID不正は既存契約どおり404、body不正は400を返す。トップレベルがオブジェクトでないbodyはPOST/PUT共通で `Request body must be an object` を返す。repositoryが `false` を返す場合は、別ユーザーのレシピまたは対象なしとして `RECIPE_NOT_FOUND` を返す。repository例外時はstatus 500と既存エラーbodyを返す。

POSTで全バリデーション分岐を検証し、PUTでは同じvalidationを利用することとrepository非呼び出しを代表ケースで確認する。これにより、同一の入力規則を重複して列挙するテストを避ける。

## mockとテスト分離

各テストファイルでは `vi.hoisted` で対象repository関数のmockを定義し、既存テストと同じ認証mockで `user-123` を返す。`beforeEach` でmockの呼び出し履歴と実装をリセットし、テスト間や並列実行時に状態を共有しない。

repository mockはAPI境界の外側にあるDBアクセスを置き換えるためだけに使用する。mock自身の内部挙動は検証せず、handlerから渡された引数と外部から観測できるHTTPレスポンスを検証する。

対象repository関数はtype-only importと `vi.fn<typeof repositoryFunction>()` で実関数シグネチャへ追従させ、引数・戻り値の契約変更をテストコードの型検査で検出する。

## エラー応答

エラーは仕様書と既存HTTP helperに従い、次の形式を外部から検証する。

```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Recipe name is required",
    "details": null
  }
}
```

入力不正は400、対象なしとUUID不正は404、repository例外は500とする。例外テストでは想定された `console.error` をテスト中だけ抑制し、出力を確認したうえで必ず復元する。

## 検証方法

実装中は追加・変更したテストファイルを個別に実行し、期待するAPI契約を確認する。既存動作を固定するcharacterization testであるため、テストが現在の実装と一致しない場合は、仕様と実装の差異として原因を調査してから次へ進む。

完了時は次を実行する。

```bash
cd backend
bun run test -- src/recipes/getRecipes.test.ts src/recipes/createRecipe.test.ts src/recipes/getRecipeById.test.ts src/recipes/updateRecipe.test.ts
bun run test
cd ..
bun run lint
bun run format:check
bun run type-check
bun run build:all
git diff --check
```

これによりIssue #152の受け入れ条件とリポジトリのPR作成前チェックを満たす。
