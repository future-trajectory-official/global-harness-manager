---
name: initialize-branch
description: 新機能開発やバグ修正等のWork Package着手時に、作業用のGitブランチを準備します。
tags:
  - trigger: create-branch
  - trigger: start-work-package
  - trigger: start-development
  - trigger: switch-branch
  - category: git
  - constraints: requires-git-repo
---

# initialize-branch

開発や修正作業を始める前に、リモートの最新状態に同期し、作業用のブランチを作成します。

## 手順

// turbo-all

1. **[Pre-check]** `git status`
   を実行し、作業ツリーに未コミットの変更がない（クリーンである）ことを確認する。変更がある場合は、ユーザーに相談するか
   stash して安全を確保する。

2. **[ベースブランチの移動]** `git checkout main` (または適切なベースブランチ)
   を実行し、作業基準となるブランチに移動する。

3. **[リモート状態の取得]** `git pull origin main` (または対象ブランチ)
   を実行し、最新状態を取得する。

4. **[作業ブランチの作成]** `git checkout -b [prefix]/[ブランチ名]`
   を実行し、新しいブランチを作成して移動する。
   - ※用途に応じて
     `feature/`（機能追加）、`fix/`（バグ修正）、`refactor/`（リファクタリング）等の適切なプレフィックスを必ず付与すること。
