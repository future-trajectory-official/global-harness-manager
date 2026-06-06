---
description: セッションの成果を要約し、内省（KPT）とメトリクス記録を行うセッション終了儀式
---

# セッション終了ワークフロー (/session-end)

本ワークフローは、セッションの成果を定量・定性的に振り返り、人間が AI
をより効果的に管理するための気づきを蓄積するプロセスを定義します。

---

## 1. 成果確認フェーズ

### 1-1. 実績の要約

- **ロール**: 進行役（例：`[scrum-master.md](/.agents/rules/scrum-master.md)`）
- **実行スキル**:
  `[summarize-session-outcomes](/.agents/skills/bundles/management-bundle/summarize-session-outcomes/SKILL.md)`
- **成果物**: 「Session Outcome Summary」報告

**停止指示**: 次のステップの内容を先読みして実行してはならない。PO の次の指示を待て。

<!-- STOP -->

---

## 2. 内省（リフレクション）フェーズ

### 2-1. 共進化 KPT

- **ロール**: 進行役（例：`[scrum-master.md](/.agents/rules/scrum-master.md)`）
- **実行スキル**:
  `[kpt-session-reflection](/.agents/skills/bundles/management-bundle/kpt-session-reflection/SKILL.md)`
- **成果物**: 「Session Reflection (KPT)」報告
- **重要**: AI から人間への建設的なフィードバックを真摯に受け止め、次回の協働品質向上に繋げます。

**停止指示**: 次のステップの内容を先読みして実行してはならない。PO の次の指示を待て。

<!-- STOP -->

---

## 3. 計測と記録フェーズ

### 3-1. 協働メトリクスの記録

- **ロール**: 進行役（例：`[scrum-master.md](/.agents/rules/scrum-master.md)`）
- **実行スキル**:
  `[record-session-metrics](/.agents/skills/bundles/management-bundle/record-session-metrics/SKILL.md)`
- **成果物**: `metrics.jsonl` へのデータ蓄積と傾向レポートの出力

**停止指示**: 次のステップの内容を先読みして実行してはならない。PO の次の指示を待て。

<!-- STOP -->

---

## 4. 完了フェーズ

### 4-1. バックログ更新

- **ロール**: 進行役（例：`[scrum-master.md](/.agents/rules/scrum-master.md)`）
- **実行スキル**:
  `[update-backlog](/.agents/skills/bundles/management-bundle/update-backlog/SKILL.md)`
- **内容**: セッションの成果に基づき、PBI のステータスを更新（Done への移動や、残PBIの整理）します。

### 4-2. セッションアーティファクトのクリーンアップ

- **ロール**: 進行役（例：`[scrum-master.md](/.agents/rules/scrum-master.md)`）
- **実行内容**:
  - `.session/` ディレクトリが存在するか確認する（例: `ls .session/` または `test -d .session/`）。
  - 存在する場合:
    1. `deno eval "Deno.removeSync('.session', {recursive: true})"` で `.session/`
       を完全削除（クロスプラットフォーム）。
    2. `mkdir -p .session/` で空のディレクトリを再作成。
    3. `git checkout .session/.gitkeep` で追跡ファイルを復元。
  - 存在しない場合: 何もせずスキップ（エラーにはしない）。
- **注意**: このステップは Opencode 環境でのみ意味を持つ。Antigravity 環境では `.session/`
  が存在しないため常にスキップされる。

<!-- STOP -->
