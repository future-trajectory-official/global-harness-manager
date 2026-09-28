# field-spec

カスタムフィールド仕様の参照。

## 正の定義

- フィールド一覧: `.opencode/core/gateway/field-registry.ts` の `HARNESS_FIELDS`。
- ボード別定義: 同ファイルの `BOARD_FIELDS[board]`。 作成対象は `BOARD_FIELDS[board]`
  に準拠し、`HARNESS_FIELDS` の直書きは禁止する。
- 作成スクリプト: `./scripts/create-fields.ts` （既存時スキップ。削除・型変更は行わない）。

## フィールド型

- 型は `gh project field-list` の実査を前提とし、型名は引数化する（既定は TEXT）。
- 型未確定でも動作する設計とするが、型が不明な場合は推測で作成せず、 PO
  へボード番号・フィールド名・実査結果を報告して指示を仰ぐこと。
