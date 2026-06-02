# Task Tracking: Enforce-Hybrid-Triage-Commit-Reference-Access

完了済みPBIのステータス更新 + `hybrid-triage-commit` スキルのスクリプト強制化とガードレール構築

---

## 📊 セッションメトリクス & 予実管理

```markdown
### ⏳ 見積もりと実績

- **初期見積 (想定介入回数)**: 1 回
- **計画後見積 (想定介入回数)**: 1 回
- **実際の介入回数**: 0

### 💬 介入履歴と理由

<!-- ユーザーからのフィードバックや軌道修正があった場合、ここにカウントアップと理由を追記します -->

- [ ] 介入 1: （理由: ）
- [ ] 介入 2: （理由: ）
- [ ] 介入 3: （理由: ）
```

---

## 📋 実行タスク一覧

### Phase 1: 開発環境・ブランチ準備

- [ ] **[1-1. 開発環境のセットアップ]** (`platform-engineer.md`)
  - [ ] 必要なツールチェーン（Deno, git）が正しく構成されているか確認。
- [ ] **[1-2. 作業ブランチの作成]** (`version-control-specialist.md`)
  - [ ] `feat/enforce-hybrid-triage-commit` ブランチを作成し、目的をPOに説明。

### Phase 2: 設計・実装フェーズ

- [ ] **[2-1. バックログステータス更新（管理タスク）]**
  - [ ] `Enforce-Velocity-Cap-and-Semantic-Splitting-in-Backlog` を `[WIP]` → `[Done]` に変更
  - [ ] ACを `[x]` に更新（エビデンス: PR #40）
- [ ] **[2-2. AC1: version-control-specialist.md の更新]** (`developer.md`)
  - [ ] 専門知識に「ハイブリッドトリアージコミット」の概念を追加
  - [ ] 制約に `hybrid-triage-commit-process.md` の参照義務を追加
  - [ ] WIPコミット（セーブポイント作成）
- [ ] **[2-3. AC3+AC4: git-triage.ts の作成]** (`developer.md`)
  - [ ] `.agents/skills/bundles/git-bundle/hybrid-triage-commit/scripts/git-triage.ts` の作成
  - [ ] `wip` モード: 全変更をWIPコミットとして保存する機能
  - [ ] `triage` モード: ファイル一覧表示、選択、コミットメッセージ入力の対話的ガイド
  - [ ] 論理的境界バリデーション（異なるConventional Commitsタイプの混在検出）
  - [ ] WIPコミット（セーブポイント作成）
- [ ] **[2-4. AC2: hybrid-triage-commit SKILL.md の更新]** (`developer.md`)
  - [ ] WIPモードとトリアージモードの手順を `git-triage.ts` 起動に差し替え
  - [ ] WIPコミット（セーブポイント作成）
- [ ] **[2-5. テスト作成]** (`developer.md` / `tester.md`)
  - [ ] `.agents/skills/bundles/git-bundle/hybrid-triage-commit/scripts/git-triage_test.ts` の作成
  - [ ] 論理境界バリデーションのユニットテスト

### Phase 3: 仕上げ・検証フェーズ

- [ ] **[3-1. 網羅的な品質検証]** (`tester.md`)
  - [ ] `deno task qa` を一括実行し、全テスト・静的解析がグリーンであることを確認
  - [ ] カバレッジを測定し、低下時は理由を報告
- [ ] **[3-2. 軽度のリファクタリング]** (`refactor.md`)
  - [ ] 実装コードやドキュメントに冗長な箇所がないか見直し
  - [ ] リファクタリング後も全テストがグリーンであることを再確認

### Phase 4: 完了・クリーンアップ

- [ ] **[4-1. コミット履歴のトリアージと再構築]** (`version-control-specialist.md`)
  - [ ] `hybrid-triage-commit` スキルにより、アトミックコミットへ履歴を編纂
- [ ] **[4-2. PR作成と報告]** (`version-control-specialist.md`)
  - [ ] 変更内容を要約し、Conventional Commits 規格に沿った PR を作成・報告
- [ ] **[4-3. マージとクリーンアップ]** (`version-control-specialist.md`)
  - [ ] POの明示的承認を経てマージを実行
