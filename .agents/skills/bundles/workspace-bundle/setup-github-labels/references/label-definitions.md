# ラベル定義一覧

Harness のプロジェクト管理で使用する標準ラベルの定義です。現在は **`type:*` ラベルのみ**
を管理する。

`status:*` ラベルは Projects V2 内蔵Status（Backlog/Todo/InProgress/Done）で代替する。 `size:*`
ラベルは Projects V2 カスタムフィールド（`harness-size-estimate` /
`harness-size-actual`）で代替する。

## type（種別）

| ラベル            | 色        | 説明                 | 使用タイミング                                            |
| ----------------- | --------- | -------------------- | --------------------------------------------------------- |
| `type:Epic`       | `#6f42c1` | Epic                 | 長期的な機能領域。手動作成                                |
| `type:Feature`    | `#0052cc` | Feature              | Epic配下の機能グループ。手動作成                          |
| `type:PBI`        | `#0366d6` | Product Backlog Item | プロダクトバックログの単位。Issueテンプレートから自動作成 |
| `type:WP`         | `#28a745` | Work Package         | PBIを分解した作業単位。WP Issue作成時に付与               |
| `type:Review`     | `#d73a4a` | Review               | スプリントレビュー用Issue                                 |
| `type:Reflection` | `#e4e669` | Reflection           | 振り返り・KPT用Issue                                      |

## ラベル追加・変更手順

1. `label-definitions.yaml` に新しいラベル定義を追記する
2. `setup-labels` スキルを `--mode force` で実行する
3. 既存ラベルは削除され、新しい定義で再作成される
