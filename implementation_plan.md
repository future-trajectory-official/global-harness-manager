# Implementation Plan: Enforce-Hybrid-Triage-Commit-Reference-Access

## 目的と概要

既存の `hybrid-triage-commit`
スキルが手順書ベースでAIの「手なり」に依存している問題を解消する。`version-control-specialist.md`
にハイブリッドトリアージコミットの参照義務を明記し、スキル手順を
`git-triage.ts`（Denoスクリプト）の起動に変更してプロセスを物理的に強制する。同時に、既に完了しているWIPアイテムのバックログステータスを更新する。

## 受け入れ基準 (AC)

### AC0: バックログステータス更新（管理タスク）

- [ ] `Enforce-Velocity-Cap-and-Semantic-Splitting-in-Backlog` の `[WIP]` を `[Done]` に変更し、ACを
      `[x]` で埋める。（エビデンス: マージ済みPR #40）

### AC1: version-control-specialist.md の参照強化

- [ ] `version-control-specialist.md` にハイブリッドトリアージコミット概念の理解と
      `hybrid-triage-commit-process.md` の参照義務を明記する。

### AC2: スキル手順のスクリプト起動化

- [ ] `hybrid-triage-commit` SKILL.md の手動 git 操作手順を `deno run -A git-triage.ts <mode>`
      の起動に変更する。

### AC3: git-triage.ts の対話的ガイド機能

- [ ] `git-triage.ts` が以下の機能を提供する:
  - `wip` モード: 全変更を WIP コミット（セーブポイント）として保存
  - `triage` モード:
    変更ファイル一覧の表示、コミット対象ファイルの選択、コミットメッセージ入力の対話的ガイド
  - 標準出力による進行状況の可視化

### AC4: 論理的境界バリデーション

- [ ] `git-triage.ts` の `triage` モードにおいて、異なる Conventional Commits タイプ（例: `feat` と
      `docs`）のファイルが同一コミットに含まれる場合に警告を出力する、またはコミットをブロックする。

### 品質

- [ ] `deno task qa` がエラーなく通過すること。

## 計画後見積もり（想定介入回数）

**1 回** — `git-triage.ts`
の対話的CLI設計（プロンプト表示、ユーザー入力受付のインタラクション設計）に関する確認でPO介入1回を見込む。

## 具体的な作業ステップ

### Step 1: バックログステータス更新

- **対象**: `.agents/management/product-backlog.md`
- **内容**: `Enforce-Velocity-Cap-and-Semantic-Splitting-in-Backlog` の `[WIP]` → `[Done]`、ACを
  `[x]` に変更

### Step 2: AC1 — version-control-specialist.md の更新

- **対象**: `.agents/rules/version-control-specialist.md`
- **内容**:
  - 専門知識に「ハイブリッドトリアージコミット（WIPセーブ + ポストトリアージ）」の理解を追加
  - 制約に `hybrid-triage-commit-process.md` の参照義務を追加

### Step 3: AC3+AC4 — git-triage.ts の作成

- **配置先**: `.agents/skills/bundles/git-bundle/hybrid-triage-commit/scripts/git-triage.ts`
- **使用方法**:
  ```bash
  deno run -A .agents/skills/bundles/git-bundle/hybrid-triage-commit/scripts/git-triage.ts wip
  deno run -A .agents/skills/bundles/git-bundle/hybrid-triage-commit/scripts/git-triage.ts triage
  ```
- **機能概要**:
  - `wip` モード: `git add -A && git commit -m "[wip] savepoint"` を安全に実行
  - `triage` モード:
    1. `git log --oneline` でWIP履歴を確認
    2. `git reset --soft origin/main` でステージング状態に戻す
    3. 全変更ファイルをdiff --stat で一覧表示
    4. ユーザーにファイル選択とコミットメッセージ入力を促す
    5. 論理境界バリデーション（異なるConventional Commitsタイプの混在を検出）
    6. 選択されたファイルのみをコミット
    7. 未コミットのファイルが残っている場合、次のコミット作成に戻る

### Step 4: AC2 — hybrid-triage-commit SKILL.md の更新

- **対象**: `.agents/skills/bundles/git-bundle/hybrid-triage-commit/SKILL.md`
- **内容**: `wip` モードと `triage` モードの手順を `git-triage.ts` の起動に差し替え

### Step 5: テスト作成

- **対象**: `.agents/skills/bundles/git-bundle/hybrid-triage-commit/scripts/git-triage_test.ts`
- **内容**: 論理境界バリデーションのユニットテスト

### Step 6: 品質検証

- `deno task qa` を実行し全テストパス + 静的解析通過を確認

## セルフチェック項目

- [ ] `git-triage.ts` が単独で `deno run -A` 可能であること
- [ ] `triage` モードで異なるタイプの混在を正しく検出/警告すること
- [ ] `version-control-specialist.md` の変更が既存制約と矛盾しないこと
- [ ] 既存テストが壊れていないこと
- [ ] `deno task qa` が通過すること
