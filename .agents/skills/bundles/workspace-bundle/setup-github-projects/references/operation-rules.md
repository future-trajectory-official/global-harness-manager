# 運用ルール

## harness-priority（小数運用）

- 新規 PBI には `既存の最大値 + 1` を割り当てる
- スプリント中に優先順位を変更する場合、2 値の間の小数を設定する（例: `10.0` と `11.0` の間に
  `10.5`）
- 小数が含まれていることは、スプリント開始後に挿入・再優先順位付けが行われた証拠となる

## harness-parent

親 PBI Issue の完全URL（`https://github.com/<owner>/<repo>/issues/<number>`）を記入する。 GitHub が
URL を自動リンクするため、クリック可能なリンクとして表示される。 Sprint Board
上でこの列を追加し、グループ化することで同一 PBI の WP を一覧表示できる。

## Sprint Board ビュー設定（手動）

1. **harness-parent 列を追加**: Fields → harness-parent にチェック
2. **harness-parent でグループ化**: 列ヘッダー右クリック → Group by this field
3. **マイルストーン列を追加**: Fields → Milestone にチェック
4. **Closed Issue 非表示**: フィルタバーに `is:open` と入力

## harness-status 遷移

- **Product Backlog**: IDEA → TODO → WIP → DONE
- **Sprint Board**: TODO → WIP → DONE
- WP の harness-status はその WP 単体の完了状態を表す
- 同一 PBI 配下の全 WP が DONE になった後に、親 PBI の harness-status を DONE に更新する

## マイルストーン

スプリント管理には GitHub マイルストーンを使用する。 PBI 作成時に
`gh issue edit <number> --milestone "Sprint N"` で設定する。 WP 作成時も同様に親 PBI
と同じマイルストーンを手動設定する。
