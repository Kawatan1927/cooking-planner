# PR レビュー自動化プロンプト

以下の手順で PR レビュー対応を進めてください。

前提:

- 入力として渡される Markdown は、「未解決かつ non-outdated の review thread」のみを含みます
- 通常の PR conversation comment は、この作業では対象外です
- 対応が必要な thread が 1 件もない場合は、そこで作業を終了してよいです

進め方:

1. 指定された review inbox の Markdown を読み、PR の `headRefName` と各 `reviewCommentId` を確認する。
2. PR の `headRefName` を checkout し、必要なら `origin/<headRefName>` を取得して最新化する。
3. 各 thread の指摘が現行 head で妥当かを確認する。
4. すでに解消済みの指摘は、現行コードで解消済みであることを説明して返信する。
5. 妥当な指摘だけを対象に、最小限のコード修正を行う。
6. 修正後は repo root で次の順に検証する。
7. `npm run format:check`
8. `npm run lint`
9. `npm run type-check`
10. `npm run build:all`
11. `npm run test`
12. 修正があり、検証がすべて通った場合のみ、日本語のコミットメッセージで commit し、現在の head ブランチを origin へ push する。
13. 各 thread に対して、日本語で短い返信文を作成し、`gh api --method POST repos/<repo>/pulls/<pr>/comments/<reviewCommentId>/replies -f body=...` を直接使って投稿する。
14. 最後に、確認した thread の要約、修正内容、検証結果、commit / push の成否、返信投稿の成否を日本語で報告する。

判断ルール:

- inbox に載っていない thread は扱わない
- まず妥当性確認を行い、必要な修正だけに絞る
- 仕様判断に迷ったら `docs/` を優先する
- 関係ないリファクタや広い整形はしない
- 検証に失敗した場合は、修正完了として返信しない
- push に失敗した場合は、修正完了として返信しない
- 変更が不要だった thread には、現行コードの確認結果だけを簡潔に返信する

返信文のルール:

- すべて日本語で書く
- 1 thread につき 3 文以内を基本にする
- 断定できないことは断定しない
- 修正済みなら、何をどう直したかを具体的に書く
- 修正済みの返信では、commit / push まで済ませたことを簡潔に書く
- 説明のみの場合は、現行 head で確認した内容を簡潔に書く

禁止事項:

- resolved / outdated thread を掘り返さない
- 通常コメントを unresolved thread と同列に扱わない
- 検証や push が未完了なのに、完了済みと返信しない
- 対応対象がないのに、形式を埋めるためだけの空作業をしない
