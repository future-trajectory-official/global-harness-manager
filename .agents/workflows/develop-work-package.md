---
description: ローカル環境に最適化された安全な機能・Work Package開発サイクル
---

# 汎用Work Package開発ワークフロー (/develop-work-package)

本ワークフローは機能追加やバグ修正などのPR開発時の**「実装・遂行ステップ」**を定義します。
**前提条件**: 本ワークフローは、必ず `/session-start` にてWork
Packageの特定と実装計画（`implementation_plan.md`）の承認が完了した後に呼び出してください。

常に各ステップで呼び出す役割（Role）に定義された制約を厳格に守ってください。

---

## 1. 実行環境構築フェーズ

### 1-1. 開発環境のセットアップ

- **ロール**: `[platform-engineer.md](/.opencode/agents/platform-engineer.md)` (すべての制約を遵守)
- **実行スキル**:
  `[develop-environment-setup](/.agents/skills/bundles/development-bundle/develop-environment-setup/SKILL.md)`
- **セルフチェック**:
  - [ ] **設計フェーズで決定した** ツールチェーンや実行環境が正しく構成・起動しているか。

**停止指示**: 次のステップの内容を先読みして実行してはならない。PO の次の指示を待て。

<!-- STOP -->

---

## 2. 開発フェーズ

### 2-1. 作業ブランチの作成

- **ロール**: `[version-control-specialist.md](/.opencode/agents/version-control-specialist.md)`
  (すべての制約を遵守)
- **実行スキル**:
  `[initialize-branch](/.agents/skills/bundles/git-bundle/initialize-branch/SKILL.md)`
- **セルフチェック**:
  - [ ] **[制約遵守]** ブランチ作成の目的をユーザーに説明し、承認を得たか。

**停止指示**: 次のステップの内容を先読みして実行してはならない。PO の次の指示を待て。

<!-- STOP -->

### 2-2. インフラ・基盤実装とWIP保存

- **ロール**: `[developer.md](/.opencode/agents/developer.md)` (すべての制約を遵守)
- **実行スキル**:
  `[hybrid-triage-commit](/.agents/skills/bundles/git-bundle/hybrid-triage-commit/SKILL.md)`
- **セルフチェック**:
  - [ ] **[Git/Hygiene Check]** 編集・作成対象のファイルが `.gitignore`
        で除外されていないか（`git check-ignore` 等）をピンポイントで事前検証したか。
  - [ ] 依存パッケージ、ディレクトリ構成、型定義などの土台となるインフラを実装したか。
  - [ ] 基盤が構築できた時点で、`hybrid-triage-commit` スキル（`wip`
        モード）を実行し、セーブポイントを作成したか。

**停止指示**: 次のステップの内容を先読みして実行してはならない。PO の次の指示を待て。

<!-- STOP -->

### 2-3. TDDによる機能実装とWIP保存

- **ロール**: `[developer.md](/.opencode/agents/developer.md)` (すべての制約を遵守)
- **実行スキル**:
  `[tdd-implementation](/.agents/skills/bundles/development-bundle/tdd-implementation/SKILL.md)`
- **セルフチェック**:
  - [ ] **[原則: Reference Validation]** 新規ファイルのパス解決や依存関係を機械的に検証したか。
  - [ ] 失敗するテストを先に書き、テストがパスする最小限の実装を行う TDD サイクルを回したか。
  - [ ] マイルストーン達成やテスト成功ごとに、`[hybrid-triage-commit](/.agents/skills/bundles/git-bundle/hybrid-triage-commit/SKILL.md)`
        スキル（`wip`
        モード）を実行し、セーブポイントを作成したか（追跡対象外や一時ファイルが誤って混入していないことを事前確認したか）。
  - [ ] **[客観的指標]** テスト件数、成功率、および主要ロジックの網羅状況を数値で提示したか。

**停止指示**: 次のステップの内容を先読みして実行してはならない。PO の次の指示を待て。

<!-- STOP -->

---

## 3. 仕上げ・検証フェーズ

### 3-1. 網羅的な品質検証

- **ロール**: `[tester.md](/.opencode/agents/tester.md)` (すべての制約を遵守)
- **セルフチェック**:
  - [ ] **[原則: Verification Integrity]** 修正箇所だけでなく、必ず `deno task qa`
        を一括実行し、プロジェクト全体の静的解析・型チェック・全テストが完璧にグリーン（合格）であることを確認したか。
  - [ ] **[品質保証: カバレッジ]**
        テスト実行時のテストカバレッジを測定し、実装前と同水準以上であることを確認したか（低下している場合は技術的理由をPOへ明記して報告したか）。

**停止指示**: 次のステップの内容を先読みして実行してはならない。PO の次の指示を待て。

<!-- STOP -->

### 3-2. 軽度のリファクタリング（仕上げ）

- **ロール**: `[refactor.md](/.opencode/agents/refactor.md)` (すべての制約を遵守)
- **セルフチェック**:
  - [ ] 実装したコードに冗長な箇所や命名の不備がないか見直し、洗練させたか。
  - [ ] リファクタリング後も、全てのテストがグリーンであることを再確認したか。

**停止指示**: 次のステップの内容を先読みして実行してはならない。PO の次の指示を待て。

<!-- STOP -->

---

## 4. 完了フェーズ

### 4-1. コミット履歴のトリアージと再構築

- **ロール**: `[version-control-specialist.md](/.opencode/agents/version-control-specialist.md)`
  (すべての制約を遵守)
- **実行スキル**:
  `[hybrid-triage-commit](/.agents/skills/bundles/git-bundle/hybrid-triage-commit/SKILL.md)`
- **セルフチェック**:
  - [ ] 開発および検証が完了した時点で、`hybrid-triage-commit` スキル（`triage`
        モード）を実行し、WIP履歴を美しいアトミックコミットへと再構築したか。
  - [ ] **[コミット内容の機械的検証]** トリアージ後、各コミットについて `git show <hash>` または
        `git log --stat`
        でコミットメッセージ・対象ファイル・差分内容を確認し、「このコミットログとファイル一覧を見ただけで変更内容が過不足なく予想できるか」を客観的に検証したか。予想と差分が一致しない場合はコミットを分割・修正すること。
  - [ ] **[追跡対象外ファイルの混入防止]** `git diff --cached`
        でステージングの内容を確認し、`.gitignore`
        対象の一時ファイルや追跡対象外ファイルが混入していないことを機械的に確認したか。混入している場合は
        `git restore --staged <file>` でアンステージし、強制コミットを試みないこと。

**停止指示**: 次のステップの内容を先読みして実行してはならない。PO の次の指示を待て。

<!-- STOP -->

### 4-2. PR作成と報告

- **ロール**: `[version-control-specialist.md](/.opencode/agents/version-control-specialist.md)`
  (すべての制約を遵守)
- **実行スキル**:
  `[create-pull-request](/.agents/skills/bundles/git-bundle/create-pull-request/SKILL.md)`
- **セルフチェック**:
  - [ ] **[制約遵守]** 変更内容を要約して報告し、規格に沿ったメッセージで記録したか。
  - [ ] **[コンテキスト]** `git log` を確認し、現セッション以外の変更内容も PR 説明に含めたか。

**停止指示**: 次のステップの内容を先読みして実行してはならない. PO の次の指示を待て。

<!-- STOP -->

### 4-3. マージとクリーンアップ

- **ロール**: `[version-control-specialist.md](/.opencode/agents/version-control-specialist.md)`
  (すべての制約を遵守)
- **実行スキル**: `[merge-branch](/.agents/skills/bundles/git-bundle/merge-branch/SKILL.md)`
- **セルフチェック**:
  - [ ] **[制約遵守]** ユーザーの明示的な承認を得た後にマージを実行し、環境を同期したか。

**停止指示**:
実装フェーズ（マージおよびクリーンアップ）が完了しました。作業完了を報告し、セッションの継続や終了を含め、PO
の次の指示を待機してください。独断で次のアクション（要約等）を提案・実行してはなりません。

<!-- STOP -->
