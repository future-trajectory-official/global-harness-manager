# ラベル定義一覧

Harness のプロジェクト管理で使用する標準ラベルの定義です。 命名規則:
`Key小文字:Value大文字`（Keyは分類、Valueは選択肢）

## type（種別）

| ラベル     | 色        | 説明                 | 使用タイミング                                            |
| ---------- | --------- | -------------------- | --------------------------------------------------------- |
| `type:PBI` | `#0366d6` | Product Backlog Item | プロダクトバックログの単位。Issueテンプレートから自動作成 |
| `type:WP`  | `#28a745` | Work Package         | PBIを分解した作業単位。WP Issue作成時に付与               |

## status（状態）

| ラベル        | 色        | 説明                   | 使用タイミング                        |
| ------------- | --------- | ---------------------- | ------------------------------------- |
| `status:IDEA` | `#c5def5` | 未精査のバックログ候補 | 新規PBI Issue作成時にデフォルトで付与 |
| `status:TODO` | `#f9c513` | 実装予定               | スプリント計画時にIDEAから昇格        |
| `status:WIP`  | `#f66a0a` | 作業中                 | 実装着手時にTODOから変更              |
| `status:DONE` | `#6f42c1` | 完了                   | スプリント終了時のアーカイブ時に付与  |

## size（見積サイズ）

| ラベル    | 色        | 説明        | Weight |
| --------- | --------- | ----------- | ------ |
| `size:XS` | `#e6e6e6` | Extra Small | 1      |
| `size:S`  | `#b4e8b4` | Small       | 2      |
| `size:M`  | `#f9d866` | Medium      | 3      |
| `size:L`  | `#f9a866` | Large       | 5      |
| `size:XL` | `#ff6666` | Extra Large | 8      |

## このファイルの管理対象外

- **Epic / Feature**: ラベルではなく Issue 階層（Epic Issue → Feature Issue）で表現する
- **Sprint**: GitHub の Milestone 機能で管理する

## ラベル追加・変更手順

1. `label-definitions.yaml` に新しいラベル定義を追記する
2. `setup-labels` スキルを `--mode force` で実行する
3. 既存ラベルは削除され、新しい定義で再作成される
