# Task Tracking: [Task Name]

[Task description or summary]

<!--
注意: このブロックはテンプレート定義専用です。task.md を作成する際は、この HTML コメントブロック（"<!--" から "-->" まで）全体を必ず削除してください。

GUARD:REQUIRED_H2

- 📊 セッションメトリクス & 予実管理
- 📋 実行タスク一覧

GUARD:REQUIRED_H3

- Phase 1
- Phase 2
- Phase 3
- Phase 4

GUARD:REQUIRED_METRICS

- 計画前見積 (想定介入回数)
- 計画後見積 (想定介入回数)
- 完了時実績

GUARD:REQUIRED_TASKS

- Phase 1: 準備（環境隔離・ブランチ準備）
  - develop-environment-setup
  - initialize-branch
- Phase 2: Foreach (AC[].count) ACベースの開発
  - ac-checkpoint-implementation
  - hybrid-triage-commit
- Phase 3: コードレビューと品質検証
  - sub-agent:cross-role-review
  - レビュー指摘対応
  - refactoring-loop
  - quality-verification
  - hybrid-triage-commit
- Phase 4: 公開（push・PR作成・マージ）
  - git push
  - create-pull-request
  - merge-branch

GUARD:PHASE_HOOKS

- Phase 1: after=validate-task
- Phase 2: before-step=phase-gate
- Phase 3: before-step=phase-gate

GUARD:NOTE この GUARD ブロックはテンプレートの不変契約を宣言します。
以下のルールを遵守してください：

- GUARD で宣言された H2/H3 の見出し文言は削除・リネームしないでください
- GUARD で宣言されたメトリクスフィールド名は削除・リネームしないでください
- GUARD:REQUIRED_TASKS で宣言された Phase 名は変更しないでください
- GUARD:REQUIRED_TASKS で宣言された必須タスクキーワードは削除しないでください
- 新しいセクションの追加や内容の拡張は自由です
- Foreach (AC[].count) が付いた Phase は、計画ファイルの AC 数だけ各キーワードを展開してください
- GUARD ブロック自体を変更する場合は、検証ロジックとの整合をとってください -->

---

## 📊 セッションメトリクス & 予実管理

```markdown
### ⏳ 見積もりと実績

- **計画前見積 (想定介入回数)**: [N] 回
- **計画後見積 (想定介入回数)**: [N] 回
- **完了時実績**: 0

### 💬 介入履歴

| # | フェーズ       | 種別 | 内容 |
| - | -------------- | ---- | ---- |
| 1 | 計画立案〜承認 | -    | -    |
| 2 | 実装           | -    | -    |

#### 傾向分析

- **全体**: 介入 N 回（計画:N, 実装:N）
- **主な課題**: -
- **改善アクション**: -

### ✅ セッション成果

-
```

---

## 📋 実行タスク一覧

### Phase 1: 準備（環境隔離・ブランチ準備）

- [ ] **[skill:develop-environment-setup]**（サンドボックス構築）
  - [ ] 必要なツールチェーンや実行環境が正しく構成されているか確認。
- [ ] **[skill:initialize-branch]**（作業ブランチ作成）
  - [ ] 作業ブランチの作成と、ブランチ作成目的をPOに説明。

### Phase 2: Foreach (AC[].count) ACベースの開発

ACごとに「実装→WIP保存」を1セットとして逐次実行する：

- [ ] **[skill:ac-checkpoint-implementation] (AC-1)**: [AC-1の内容]
- [ ] **[skill:hybrid-triage-commit] (wip)**: AC-1完了をWIP保存
- [ ] **[skill:ac-checkpoint-implementation] (AC-2)**: [AC-2の内容]
- [ ] **[skill:hybrid-triage-commit] (wip)**: AC-2完了をWIP保存
- [ ] ...（以降、AC数に応じて展開）

### Phase 3: コードレビューと品質検証

- [ ] **[sub-agent:cross-role-review]**: サブエージェントによるコードレビュー
  - [ ] `git diff origin/<base>` を取得し、4ロール（Architect / Developer / Tester / Refactor）の
        Task tool サブエージェントを**独立並列起動**する
  - [ ] 各エージェントは自ロールのルールファイル（`.agents/rules/*.md`）を読み、コード差分をレビュー
  - [ ] AI が4件のレビュー報告を取りまとめ、指摘を **Critical / Medium / Minor** に分類してPOに提示
  - [ ] PO が対応する指摘を選択 → AI が修正を実施
- [ ] **[対応]**: レビュー指摘の修正（PO選択分を実装）
- [ ] **[skill:refactoring-loop]**: コード内部構造の改善（挙動不変）
- [ ] **[skill:quality-verification]**: `deno task qa` 完全版品質検証
- [ ] **[skill:hybrid-triage-commit] (triage)**: WIPコミットの解体とアトミックコミット再構築

### Phase 4: 公開（push・PR作成・マージ）

- [ ] **git push**: アトミックコミットをリモートへ反映
- [ ] **[skill:create-pull-request]**: Conventional Commits形式のPR作成
- [ ] **[skill:merge-branch]**: PO承認後のマージとクリーンアップ
