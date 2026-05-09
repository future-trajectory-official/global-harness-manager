---
name: merge-branch
description: ユーザーの承認後にGitHubのPull Requestをマージし、ローカル環境を同期・クリーンアップします。
tags:
  - trigger: merge-pr, merge-branch, complete-task, finish-pr
  - category: git
  - constraints: requires-gh-cli, requires-user-approval
---

# merge-branch

ユーザーの承認（GOサイン）が出た後、GitHub CLI (`gh`)
とローカルGitを操作してマージと後始末を行います。

## 手順

// turbo-all

1. **[Pre-check]** ユーザーの承認があっても、マージ前に `gh pr status` や `gh pr checks`
   等でコンフリクトがないことやCIがパスしていることを確認する。
2. `gh pr merge` コマンド等を用いて、承認されたPRを自動マージし、リモートの作業ブランチを削除する。
   - **⚠️ 必須要件**: 非対話モードで実行すること（例: `gh pr merge --merge --delete-branch`
     など、状況に応じたフラグを明示する）。
3. ローカル環境で `git checkout main` (または対象のベースブランチ) と `git pull origin main`
   を行い、ローカル状態を最新に同期する。
4. マージが完了したローカルの作業用ブランチと、リモート追跡ブランチを削除する:
   `git branch -d [作業ブランチ名] && git branch -dr origin/[作業ブランチ名]`
