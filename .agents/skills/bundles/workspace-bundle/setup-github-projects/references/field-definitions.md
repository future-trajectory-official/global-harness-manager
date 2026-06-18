# フィールド定義

## Product Backlog ボード

| フィールド            | 型            | 選択肢          | 説明                                |
| --------------------- | ------------- | --------------- | ----------------------------------- |
| harness-size-estimate | SINGLE_SELECT | XS, S, M, L, XL | Tシャツサイズ見積もり               |
| harness-size-actual   | SINGLE_SELECT | XS, S, M, L, XL | 実績Tシャツサイズ                   |
| harness-sequence      | NUMBER        | 任意の整数      | PBI/WPの表示順（ソート用）          |
| harness-variance-text | TEXT          | 複数行テキスト  | 予実差分析の定性理由（最大500文字） |

## Sprint Board

| フィールド             | 型     | 値             | 説明                                 |
| ---------------------- | ------ | -------------- | ------------------------------------ |
| harness-effort-initial | NUMBER | 任意の整数     | 初期見積（計画前の想定介入回数）     |
| harness-effort-planed  | NUMBER | 任意の整数     | 計画後見積（PO合意後の想定介入回数） |
| harness-effort-actual  | NUMBER | 任意の整数     | 完了時実績（実際の介入回数）         |
| harness-sequence       | NUMBER | 任意の整数     | PBI/WPの表示順（ソート用）           |
| harness-variance-text  | TEXT   | 複数行テキスト | 予実差分析の定性理由（最大500文字）  |
