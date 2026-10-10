# label-spec

リポジトリラベル仕様の参照。

## 正の定義

- ラベル一覧: `.opencode/core/domain/label-types.ts` の `LabelTypes` （`getAllLabelDefinitions()`
  で取得。`type:Vision` 等8件）。
- 作成スクリプト: `./scripts/create-labels.ts` （既存時スキップ。削除・改名・型変更は行わない）。
- ラベルはリポジトリ単位で保持される（ボードが所有者単位で共有されるのとは
  異なり、新規リポジトリごとに作成が必要）。

## 作成対象の固定

- 作成対象の直書きは禁止する。`labelsToCreate()`
  （＝`getAllLabelDefinitions()`）のみを参照し、定義のドリフトは `create-labels_test.ts`
  の準拠テストで検出する。
- 色指定は `gh label create` の形式（`#` なし）に変換して渡す。
