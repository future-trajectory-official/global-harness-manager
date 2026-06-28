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

試行錯誤中は細かく WIP 保存し、完了後に diff を意味単位で再構成する。

## 制約

`git reset --soft` / `commit --amend` / `rebase` は禁止。 Triage
はベースから新ブランチを作成し、diff を俯瞰して意味単位で `add + commit` し直す。

## Quick-Start

### wip モード（開発中）

意味は問わない。動いたらセーブする。

```bash
git add -A && git commit -m "[wip] <savepoint>"
```

### triage モード（プッシュ直前）

**「意味単位で分割する」**
が唯一の目的。参考：[hybrid-triage-commit-process.md](/.agents/skills/bundles/git-bundle/hybrid-triage-commit/references/hybrid-triage-commit-process.md)

```bash
# 0. 事前準備（ベースから新ブランチ）
git checkout <base> && git pull && git checkout -b <clean-name>
# 1. WIP との差分を俯瞰
git diff --name-status <base>..<wip-branch>
# 2. 意味単位に分割してコミット
git checkout <wip-branch> -- path/to/feat/files   # feat グループ
git add path/to/feat/files
git commit -m "feat(scope): 機能追加"
git checkout <wip-branch> -- path/to/fix/files    # fix グループ
git add path/to/fix/files
git commit -m "fix(scope): バグ修正"
git checkout <wip-branch> -- path/to/test/files   # test グループ
git add path/to/test/files
git commit -m "test(scope): テスト追加"
# 3. WIP ブランチを削除
git branch -D <wip-branch>
```

対話的な仕分けにはスクリプトも利用可能:
[git-triage.ts](/.agents/skills/bundles/git-bundle/hybrid-triage-commit/scripts/git-triage.ts)
