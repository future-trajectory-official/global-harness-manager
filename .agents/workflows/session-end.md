---
description: セッションの成果を要約し、内省（KPT）とメトリクス記録を行うセッション終了儀式
---

# セッション終了ワークフロー (/session-end)

本ワークフローは、セッションの成果を定量・定性的に振り返り、人間が AI
をより効果的に管理するための気づきを蓄積するプロセスを定義します。

---

## 1. 成果確認フェーズ

**開始条件**:
POから「次のフェーズに進めて」または同等の明示的な指示があるまで、このフェーズの内容を先読み・実行してはならない。

### 1-1. 実績effortの記録

- **ロール**: 進行役（例：`[scrum-master.md](/.agents/rules/scrum-master.md)`）
- **実行スキル**:
  `[record-work-package-effort](/.agents/skills/bundles/management-bundle/record-work-package-effort/SKILL.md)`
- **内容**: セッションの実績effort（介入回数）と乖離理由をGitHub Issueに記録します。

**停止指示**: 次のステップの内容を先読みして実行してはならない。PO の次の指示を待て。

<!-- STOP -->

---

## 2. 内省（リフレクション）フェーズ

**開始条件**:
POから「次のフェーズに進めて」または同等の明示的な指示があるまで、このフェーズの内容を先読み・実行してはならない。

### 2-1. 共進化 KPT

- **ロール**: 進行役（例：`[scrum-master.md](/.agents/rules/scrum-master.md)`）
- **実行スキル**:
  `[record-work-package-kpt](/.agents/skills/bundles/management-bundle/record-work-package-kpt/SKILL.md)`
- **成果物**: 「Session Reflection (KPT)」報告
- **重要**: AI から人間への建設的なフィードバックを真摯に受け止め、次回の協働品質向上に繋げます。

**停止指示**: 次のステップの内容を先読みして実行してはならない。PO の次の指示を待て。

<!-- STOP -->

---

## 3. 計測と記録フェーズ

**開始条件**:
POから「次のフェーズに進めて」または同等の明示的な指示があるまで、このフェーズの内容を先読み・実行してはならない。

### 3-1. 協働メトリクスの記録

- **ロール**: 進行役（例：`[scrum-master.md](/.agents/rules/scrum-master.md)`）
- **実行スキル**:
  `[record-work-package-metrics](/.agents/skills/bundles/management-bundle/record-work-package-metrics/SKILL.md)`
- **成果物**: GitHub Issueへのセッションメトリクス記録

**停止指示**: 次のステップの内容を先読みして実行してはならない。PO の次の指示を待て。

<!-- STOP -->

---

## 4. 完了フェーズ

**開始条件**:
POから「次のフェーズに進めて」または同等の明示的な指示があるまで、このフェーズの内容を先読み・実行してはならない。

### 4-1. WP完了

- **ロール**: 進行役（例：`[scrum-master.md](/.agents/rules/scrum-master.md)`）
- **実行スキル**:
  `[complete-work-package](/.agents/skills/bundles/management-bundle/complete-work-package/SKILL.md)`
- **内容**: WPをDone状態に遷移し、兄弟WPが全完了している場合は親PBIも完了します。

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
