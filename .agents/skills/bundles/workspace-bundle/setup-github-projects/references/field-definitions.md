# フィールド定義

## Product Backlog ボード

| フィールド       | 型            | 選択肢                | 説明                       |
| ---------------- | ------------- | --------------------- | -------------------------- |
| harness-status   | SINGLE_SELECT | IDEA, TODO, WIP, DONE | PBI のライフサイクル状態   |
| harness-size     | SINGLE_SELECT | XS, S, M, L, XL       | Tシャツサイズ見積もり      |
| harness-priority | NUMBER        | 任意の小数            | 値が小さいほど優先度が高い |

## Sprint Board

| フィールド     | 型            | 値              | 説明                                |
| -------------- | ------------- | --------------- | ----------------------------------- |
| harness-status | SINGLE_SELECT | TODO, WIP, DONE | WP の完了状態                       |
| harness-parent | TEXT          | Issue 完全URL   | 親 PBI Issue へのクリック可能リンク |
