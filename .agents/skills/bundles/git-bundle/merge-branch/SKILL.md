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
2. `gh pr merge` コマンド等を用いて、承認されたPRを自動マージする。
   - **⚠️ 必須要件**: 非対話モードで実行すること（例: `gh pr merge --merge --delete-branch` など）。
3. GitHub上で削除されたリモートブランチの情報をローカルに反映するため、`git fetch --prune origin`
   を実行する。
4. ローカル環境のベースブランチへ移動するため、`git checkout main` (または対象のベースブランチ)
   を実行する。
5. ローカルのベースブランチを最新化するため、`git pull origin main` を実行する。
6. マージ済みのローカル作業用ブランチを削除するため、`git branch -d [作業ブランチ名]` を実行する。
