---
name: initialize-branch
description: 新機能開発やバグ修正等のタスク着手時に、作業用のGitブランチを準備します。
tags:
  - trigger: create-branch, start-task, start-development, switch-branch
  - category: git
  - constraints: requires-git-repo
---

# initialize-branch

開発や修正作業を始める前に、リモートの最新状態に同期し、作業用のブランチを作成します。

## 手順

// turbo-all

1. **[Pre-check]** `git status` を実行し、作業ツリーに未コミットの変更がない（クリーンである）ことを確認する。変更がある場合は、ユーザーに相談するか stash して安全を確保する。
2. `git checkout main` (または適切なベースブランチ) で作業基準となるブランチに移動する。
3. `git pull origin main` (または対象ブランチ) で最新状態を取得する。
4. `git checkout -b [prefix]/[ブランチ名]` で新しいブランチを作成して移動する。
   - ※用途に応じて `feature/`（機能追加）、`fix/`（バグ修正）、`refactor/`（リファクタリング）等の適切なプレフィックスを必ず付与すること。
