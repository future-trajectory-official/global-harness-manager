# Automated Archive Logic

本ドキュメントは、`update-backlog`
スキルにおけるアーカイブ自動化の技術詳細を定義します。エージェントは、PBI
のアーカイブを実行する際に本情報を参照してください。

## 0. 設計思想：AI解釈変換

アーカイブは、バックログPBIのデータを機械的にコピーするのではなく、**AIが意味的に解釈して変換する**
ことを前提とします。その理由は以下の通りです：

- バックログは「どうあるべきか（計画志向）」を記述するのに対し、アーカイブは「計画と実績の差異（予実差志向）」を記録する。
- 見積サイズに対する実感サイズ、計画前見積に対する完了時実績など、**差分を抽出するには実装プロセス全体を踏まえた解釈が必要**。
- WPの達成状況も、スプリント計画時に存在したWPとスプリント中に追加されたWPを区別して記録するため、機械的なコピーでは不十分。

したがって、AIは以下の変換を自らの判断で行います：

1. バックログPBIの「見積サイズ」に対して、実際の難易度を踏まえた「実感サイズ」を判定
2. 各WPのEffort実績（計画前見積→計画後見積→完了時実績）をセッション履歴から集計
3. 計画時WPと追加WPをWP命名規則（WP_数字 / WP_アルファベット）に基づいて分類
4. 乖離が生まれた原因を「予実差分析」として記述

## 1. スクリプト仕様

アーカイブ処理は、以下の Deno スクリプトによって実行されます。

- **パス**: `scripts/archive_backlog.ts`

### 入力データ構造 (JSON)

AI は以下の構造を持つ JSON を生成し、引数 `--data` として渡します。

```json
{
  "id": "[Epic/Feature]/PBI-Name",
  "sprint": "Sprint N",
  "insights": "予実差分析の本文。乖離原因を具体的に記述する。",
  "tags": ["#Decision", "#Architecture", "#Troubleshooting", "#Pivot"],
  "metrics": { "turns": 15, "sessions": 1 },
  "outcomes": ["- 成果物1のリンク/パス", "- 成果物2の名称"],
  "size_estimated": "M",
  "size_actual": "S",
  "effort_preplan": 3,
  "effort_postplan": 4,
  "effort_actual": 5,
  "wp_planned_achieved": ["WP_1: AC1", "WP_1: AC2"],
  "wp_planned_missed": [],
  "wp_added_achieved": [],
  "wp_added_missed": ["WP_a: AC1"]
}
```

#### フィールド説明

| フィールド            | 必須 | 内容                             |
| --------------------- | ---- | -------------------------------- |
| `id`                  | ✅   | PBI識別子（そのまま保持）        |
| `sprint`              | ✅   | 完了スプリント（例: "Sprint N"） |
| `insights`            | ✅   | 予実差分析（AIが解釈して記述）   |
| `tags`                | ✅   | カテゴリタグ（知見の分類）       |
| `metrics.turns`       | ✅   | 総ターン数                       |
| `metrics.sessions`    | ✅   | 総セッション数                   |
| `outcomes`            | ✅   | 実際の成果物リスト               |
| `size_estimated`      | ✅   | 見積サイズ（S/M/L/XL）           |
| `size_actual`         | ✅   | 実感サイズ（S/M/L/XL）           |
| `effort_preplan`      | ❌   | 計画前見積合計（介入回数）       |
| `effort_postplan`     | ❌   | 計画後見積合計（介入回数）       |
| `effort_actual`       | ❌   | 完了時実績合計（介入回数）       |
| `wp_planned_achieved` | ❌   | 計画時WPの達成済みAC一覧         |
| `wp_planned_missed`   | ❌   | 計画時WPの未達成AC一覧           |
| `wp_added_achieved`   | ❌   | 追加WPの達成済みAC一覧           |
| `wp_added_missed`     | ❌   | 追加WPの未達成AC一覧             |

## 2. 実行手順

エージェントは以下の手順でアーカイブを実行します。

1. バックログPBIの情報とセッション履歴から、上記JSONを構成する
2. `deno run -A .agents/skills/bundles/management-bundle/archive-backlog/scripts/archive_backlog.ts --data '[構成したJSON]'`
   を実行する
3. `product-backlog-archive.md.example`
   のフォーマットに従い、アーカイブカードが正しく生成されていることを確認する

## 3. 知見タグの選定基準

アーカイブガイドライン（`[backlog-guidelines.md](/.agents/management/backlog-guidelines.md)`）に基づき、以下の優先順位でタグを付与してください。

1. **`#Decision`**: 設計や優先順位の変更があった場合。
2. **`#Pivot`**: 当初の AC や方針から転換した場合。
3. **`#Troubleshooting`**: 技術的なハマり所を解決した場合。
4. **`#Architecture`**: ディレクトリ構造や依存関係に影響を与えた場合。
5. **`#Efficiency`**: 自動化やプロセス改善による効率化があった場合。
6. **`#Lesson`**: プロセス上の反省や役割分担の最適化があった場合。
