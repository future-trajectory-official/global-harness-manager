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

WIP と Triage の2モードで、試行錯誤中のセーブとプッシュ直前の履歴整理を両立する。

## 制約

`git reset --soft` / `commit --amend` / `rebase` 等の歴史改変操作は禁止。 Triage
はベースから新ブランチを作成し、WIP ブランチとの diff を確認しながら `add + commit` で構築する。

## Quick-Start

### wip モード（開発中、こまめに実行）

```bash
git add <files>
git commit -m "[wip] <savepoint description>"
```

### triage モード（プッシュ直前）

1. ベースブランチから新ブランチを作成する
2. WIP ブランチとの差分を確認する: `git diff --name-only <base>..<wip-branch>`
3. ファイルを適用し、論理グループごとにコミットする:

   **対話環境**: `deno run -A scripts/git-triage.ts triage` **非対話環境**:
   `git checkout <wip-branch> -- <files>` + `git commit` を手動で繰り返す

詳細:
[hybrid-triage-commit-process.md](/.agents/skills/bundles/git-bundle/hybrid-triage-commit/references/hybrid-triage-commit-process.md)
スクリプト:
[git-triage.ts](/.agents/skills/bundles/git-bundle/hybrid-triage-commit/scripts/git-triage.ts)
