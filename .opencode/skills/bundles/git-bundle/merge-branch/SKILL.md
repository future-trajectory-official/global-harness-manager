---
name: merge-branch
description: ユーザーの承認後にGitHubのPull Requestをマージし、ローカル環境を同期・クリーンアップします。
tags:
  - trigger: merge-pr
  - trigger: merge-branch
  - trigger: complete-work-package
  - trigger: finish-pr
  - category: git
  - constraints: requires-gh-cli, requires-user-approval
---

# merge-branch

ユーザーの承認（GOサイン）が出た後、GitHub CLI (`gh`)
とローカルGitを操作してマージと後始末を行います。

## 手順

// turbo-all

0. **[PRの事実と宛先の確定]** マージ先は**推測せず、PRが持つ情報を正**とする。
   ```bash
   # 1) 提示用の情報（PR概要・head/base・状態・CI）
   gh pr view <N> --json number,title,headRefName,baseRefName,state,mergeable,statusCheckRollup

   # 2) マージ先（復帰先）の確定。PRの baseRefName を最優先で返す
   deno run -A .opencode/core/shared/git/resolve_base_branch.ts --from-pr <N>
   # → {"baseBranch":"release/1.2","source":"pr-base"}
   ```
   - 出力の `baseBranch` を以降の `<base>` として使う。**`main` を決め打ちしない。**
   - `source` が `pr-base` 以外（`fallback` 等）のときは推定値である。`gh pr view` の `baseRefName`
     と一致するか確認し、食い違う場合は**必ず** PO に報告する。
1. **[Pre-check]** `gh pr status` / `gh pr checks` 等で、コンフリクトがないこと・CIがパスして
   いること・PR が `OPEN` であることを確認する。
2. **[承認ゲート]**
   マージ前に、以下を**1つの画面で提示**して承認を求める。**提示せずにマージしない。**
   - PR: `#<N> <title>`（`<headRefName>` → `<baseRefName>`）
   - 状態: CI（パス / 失敗）、コンフリクトの有無、`state`
   - マージ後のローカル操作: `git checkout <base>` → `git pull origin <base>`
   - ⚠️ **推測と事実が食い違う場合は隠さず明示する** （例: 「推測=main / PRの宛先=release/1.2」）
3. `gh pr merge` コマンド等を用いて、承認されたPRを自動マージする。
   - **⚠️ 必須要件**: 非対話モードで実行すること（例: `gh pr merge --merge --delete-branch` など）。
4. GitHub上で削除されたリモートブランチの情報をローカルに反映するため、`git fetch --prune origin`
   を実行する。
5. ローカル環境のベースブランチ（分岐元）に切り替える。
   - `git checkout <base>`
   - ※すでに `gh pr merge` の自動クリーンアップで `<base>`
     に切り替わっている場合は、本ステップはスキップまたは確認のみとします。
6. ローカルのベースブランチを最新化するため、`git pull origin <base>` を実行する。
7. マージ済みのローカル作業用ブランチが残っている場合は、安全に削除する。
   - `git branch -d [作業ブランチ名]`
   - ※すでに自動削除されて `not found`
     になる場合は、クリーンアップ完了とみなしてエラーを無視し、正常終了とします。
8. **[Post-check] 対象WP/PBIの Issue state を確認する**。
   - PR本文にクローズキーワードが残っていると、マージによって Issue が**意図せず CLOSED**
     になる（`Status` は変わらないため「CLOSED かつ In Progress」というねじれが生じ、後の
     `archive-product-backlog-items` が前提（`open` かつ `Status=Done`）を満たせなくなる）。
   - 意図しない CLOSED を検出した場合は、POに報告し、`gh issue reopen <N>`
     で復帰させるか否かの判断を仰ぐこと。**AIの判断だけで reopen しない。**
