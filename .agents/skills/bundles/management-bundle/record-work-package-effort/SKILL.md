---
name: record-work-package-effort
description: セッション完了時に介入の整理・成果の記録・プロセス分析を行う。
tags:
  - trigger: record-work-package-effort
  - trigger: record-wp-effort
  - trigger: record-effort
  - trigger: session-closed
  - category: management
---

# record-work-package-effort

セッション完了時に、介入の整理・成果の記録・プロセス分析を行う。

## Quick-Start

1. **介入の自動収集**: セッション中のやり取りから、以下の軸で介入を整理する。
   - **フェーズ**: `計画立案〜承認` / `実装`
   - **種別**: `計画深度不足` / `既存資産の未読` / `プロセス逸脱` / `スコープ変動` / `意図誤認`
   - 各介入の事実（何が起きたか）

   POへの確認は不要。AIが自律的に抽出する。

2. **成果の整理**: このセッションで作成・編集したファイル、テスト結果、品質検証結果を整理する。

3. **介入傾向の分析とPOとの対話**:
   介入データを集計・分類し、POと共有する。この対話の中で以下を確定する。
   - 介入のカウント方法（複数まとめて1回にカウントするか、1つを分割するかなど）
   - プロセス分析の内容（計画の進め方、実行の進め方、改善提案）

4. **実績と分析の記録**: 確定した内容を一括で記録する。
   ```bash
   echo '<JSON>' | deno run -A .agents/skills/bundles/management-bundle/record-work-package-effort/scripts/record_effort_and_analysis.ts
   ```
   入力パラメータは
   [references/reference.md](/.agents/skills/bundles/management-bundle/record-work-package-effort/references/reference.md)
   を参照すること。

5. **タスクファイルの更新**: 介入履歴テーブル・傾向分析・セッション成果を作業中のtask.mdに反映する。

6. **結果報告**: 記録完了をPOに報告する。
