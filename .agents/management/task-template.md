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
- Phase 3: リファクタリングと品質検証
  - refactoring-loop
  - quality-verification
  - hybrid-triage-commit
- Phase 4: 公開（push・PR作成・マージ）
  - git push
  - create-pull-request
  - merge-branch

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

### 💬 介入履歴と理由

<!-- POからの明示的な方針変更・軌道修正指示があった場合のみ追記。
     介入の定義は backlogs-guidelines.md を参照。
     AIの自律的な手戻りやテスト修正は含めない。 -->
```

---

## 📋 実行タスク一覧

### Phase 1: 準備（環境隔離・ブランチ準備）

- [ ] **develop-environment-setup**（サンドボックス構築）
  - [ ] 必要なツールチェーンや実行環境が正しく構成されているか確認。
- [ ] **initialize-branch**（作業ブランチ作成）
  - [ ] 作業ブランチの作成と、ブランチ作成目的をPOに説明。

### Phase 2: Foreach (AC[].count) ACベースの開発

- [ ] **ac-checkpoint-implementation (AC-1)**: [AC-1の内容]
- [ ] **ac-checkpoint-implementation (AC-2)**: [AC-2の内容]
- [ ] ...（AC数に応じて展開）
- [ ] **hybrid-triage-commit (wip)**: 各AC完了後にWIP保存

### Phase 3: リファクタリングと品質検証

- [ ] **refactoring-loop**: コードの内部構造を改善
- [ ] **quality-verification**: `deno task qa` 完全版品質検証
- [ ] **hybrid-triage-commit (triage)**: WIPコミットの解体とアトミックコミット再構築

### Phase 4: 公開（push・PR作成・マージ）

- [ ] **git push**: アトミックコミットをリモートへ反映
- [ ] **create-pull-request**: Conventional Commits形式のPR作成
- [ ] **merge-branch**: PO承認後のマージとクリーンアップ
