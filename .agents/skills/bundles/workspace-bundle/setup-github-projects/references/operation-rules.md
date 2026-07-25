# 運用ルール

## Projects V2内蔵Status

Project V2の標準Statusフィールドを使用する（カスタムフィールド `harness-status` は削除）。

- **Product Backlog**: Backlog（旧IDEA） → Todo（旧TODO） → In Progress（旧WIP） → Done（旧DONE）
- **Sprint Board**: Todo（旧TODO） → In Progress（旧WIP） → Done（旧DONE）
- WPのStatusはそのWP単体の完了状態を表す
- 同一PBI配下の全WPがDoneになった後に、親PBIのStatusをDoneに更新する

## Sprint Board ビュー設定（手動）

1. **親Issue列を追加**: Fields → Parent issue にチェック
2. **親Issueでグループ化**: 列ヘッダー右クリック → Group by this field
3. **マイルストーン列を追加**: Fields → Milestone にチェック
4. **Closed Issue 非表示**: フィルタバーに `is:open` と入力

## harness-sequence（表示順序）

- 新規 PBI には `既存の最大値 + 1` を割り当てる（整数）
- スプリント中に順序を変更する場合、2値の間の値を設定する

## マイルストーン

スプリント管理には GitHub マイルストーンを使用する。 PBI 作成時に
`gh issue edit <number> --milestone "Sprint N"` で設定する。 WP 作成時も同様に親 PBI
と同じマイルストーンを手動設定する。
