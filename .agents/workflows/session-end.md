---
description: セッションの成果を要約し、内省（KPT）とメトリクス記録を行う「マイクロ・スプリント」の終了儀式
---

# セッション終了ワークフロー (/session-end)

本ワークフローは、セッション（マイクロ・スプリント）の成果を定量・定性的に振り返り、人間が AI
をより効果的に管理するための気づきを蓄積するプロセスを定義します。

---

## 1. 成果確認フェーズ

### 1-1. 実績の要約

- **ロール**: 進行役（例：`[scrum-master.md](file://.agents/rules/scrum-master.md)`）
- **実行スキル**:
  `[summarize-session-outcomes](file://.agents/skills/bundles/management-bundle/summarize-session-outcomes/SKILL.md)`
- **成果物**: 「Session Outcome Summary」報告

**停止指示**: 次のステップの内容を先読みして実行してはならない。PO の次の指示を待て。

<!-- STOP -->

---

## 2. 内省（リフレクション）フェーズ

### 2-1. 共進化 KPT

- **ロール**: 進行役（例：`[scrum-master.md](file://.agents/rules/scrum-master.md)`）
- **実行スキル**:
  `[kpt-session-reflection](file://.agents/skills/bundles/management-bundle/kpt-session-reflection/SKILL.md)`
- **成果物**: 「Session Reflection (KPT)」報告
- **重要**: AI から人間への建設的なフィードバックを真摯に受け止め、次回の協働品質向上に繋げます。

**停止指示**: 次のステップの内容を先読みして実行してはならない。PO の次の指示を待て。

<!-- STOP -->

---

## 3. 計測と記録フェーズ

### 3-1. 協働メトリクスの記録

- **ロール**: 進行役（例：`[scrum-master.md](file://.agents/rules/scrum-master.md)`）
- **実行スキル**:
  `[record-session-metrics](file://.agents/skills/bundles/management-bundle/record-session-metrics/SKILL.md)`
- **成果物**: `metrics.jsonl` へのデータ蓄積と傾向レポートの出力

**停止指示**: 次のステップの内容を先読みして実行してはならない。PO の次の指示を待て。

<!-- STOP -->

---

## 4. 完了フェーズ

### 4-1. バックログ更新

- **ロール**: 進行役（例：`[scrum-master.md](file://.agents/rules/scrum-master.md)`）
- **実行スキル**:
  `[update-backlog](file://.agents/skills/bundles/management-bundle/update-backlog/SKILL.md)`
- **内容**: セッションの成果に基づき、PBI のステータスを更新（Done
  への移動や、残タスクの整理）します。

<!-- STOP -->
