---
name: hybrid-triage-commit
description: 開発・リファクタリング中のWIP一時コミットと、完了後のアトミックコミット再構築（ポストトリアージ）を制御するスキル
tags:
  trigger:
    - save-wip
    - triage-commit
    - git-commit
  category: git
  constraints: requires-git-repo
---

# hybrid-triage-commit

本スキルは、認知負荷を下げつつ「芸術的に美しいアトミックコミット」を維持するためのハイブリッド・トリアージ戦略を制御します。
本スキルには `wip` と `triage` の2つの実行モードがあります。

**重要な制約**: `git reset --soft` / `git commit --amend` / `git rebase`
等の歴史改変操作は使用しません。代わりにブランチの作成と破棄で履歴を構築します。

## 1. Quick-Start & モード別詳細手順

### A. 【wip モード】進行状況の自動セーブ（開発中）

マイルストーンの達成、テストの通過、またはファイル書き換えの成功時など、こまめに実行して作業のセーブポイントを作ります。

WIP専用ブランチ（例: `feature/xxx-wip`）上で通常の `git add` + `git commit` を積み重ねます：

```bash
git add <files>
git commit -m "[wip] <savepoint description>"
```

### B. 【triage モード】歴史の編纂（プッシュ・PR作成直前）

すべての実装、検証、リファクタリングが完了したタイミングで実行し、雑多なWIP履歴を美しいアトミックコミットへと再構築します。

`git reset --soft` は使用せず、ベースブランチから新しくブランチを切って再構成します。

1. ベースブランチ（例: `github-management`）に移動し、最新状態を取得する
2. ベースブランチから新ブランチ（例: `feature/xxx`）を切る
3. WIPブランチとの差分を確認する: `git diff --name-only <base>..<wip-branch>`
4. 差分ファイルを論理グループに分類する（feat / fix / refactor / test / chore / docs）
5. グループごとに `git add <files>` + `git commit` を繰り返す
6. 完了後、WIPブランチは削除する（必要な変更は新ブランチに全て移っている）

```bash
# 実例：
git checkout github-management
git pull origin github-management
git checkout -b feature/xxx
# グループ1: 機能追加
git add path/to/feat/files
git commit -m "feat(scope): 機能追加の説明"
# グループ2: リファクタリング
git add path/to/refactor/files
git commit -m "refactor(scope): リファクタリングの説明"
# グループ3: テスト
git add path/to/test/files
git commit -m "test(scope): テスト追加の説明"
```

### C. 【非対話環境での代替手順】手動トリアージ

トリアージスクリプトが使用できない環境では、以下の手動手順でアトミックコミットを再構築します。歴史改変コマンドは使用しません。

1. **WIPブランチの最新状態を確認**: `git log --oneline <wip-branch>` で作業履歴を確認
2. **ベースブランチに移動**: `git checkout <base-branch> && git pull`
3. **新ブランチを作成**: `git checkout -b <clean-branch-name>`
4. **差分ファイルの確認**: `git diff --name-only <base-branch>..<wip-branch>` で全変更を把握
5. **論理グループへの分割**:
   - 変更内容を確認し、`feat`（機能追加）、`fix`（修正）、`chore`（雑務）、`docs`（ドキュメント）、`refactor`（リファクタリング）、`test`（テスト）などの論理単位に分類
   - 各グループごとに `git add <ファイル>` でステージングし、`git commit -m "type(scope): 説明"`
     でコミット
6. **Conventional Commits の遵守**: コミットメッセージは `type(scope): 説明` の形式に従う
7. **最終確認**: `git log --oneline` で履歴の論理性を確認
8. **WIPブランチの削除**: `git branch -D <wip-branch>`

```bash
# 実例：3つの論理コミットに分割する場合
git checkout github-management
git pull origin github-management
git checkout -b feature/xxx
git diff --name-only github-management..feature/xxx-wip
# グループ1: 機能追加
git add path/to/feat/files
git commit -m "feat: rename X to Y"
# グループ2: 設定更新
git add path/to/chore/files
git commit -m "chore: update trigger tags"
# グループ3: ドキュメント更新
git add path/to/docs/files
git commit -m "docs: update references"
# WIPブランチ削除
git branch -D feature/xxx-wip
```

## 2. 詳細仕様 (Sidecar Reference)

具体的なトリアージの決定木や、コミットメッセージの分類規格については、以下のサイドカーリファレンスを参照してください。

- **[トリアージプロセス詳細](/.agents/skills/bundles/git-bundle/hybrid-triage-commit/references/hybrid-triage-commit-process.md)**
