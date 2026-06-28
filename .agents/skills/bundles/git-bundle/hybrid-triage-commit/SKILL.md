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

**「意味単位で分割する」** が唯一の目的。

```bash
# 準備: ベースから新ブランチ
git checkout <base> && git pull && git checkout -b <clean-name>
# 俯瞰: WIP との差分を確認
git diff --name-status <base>..<wip-branch>
```

出力されたファイル一覧を意味単位（feat / fix / refactor / test / docs / chore）に分類し、単位ごとに
`git checkout <wip-branch> -- <files>` + `git add` + `git commit` を繰り返す。

```bash
# 例: feat グループ
git checkout <wip-branch> -- path/to/files
git add path/to/files
git commit -m "feat(scope): 説明"
```

- 追跡対象外のファイル（`.gitignore` で除外されたもの）は commit できない。`git ls-files`
  で確認すること。
- 完了後: `git branch -D <wip-branch>`

詳細な手順と実例:
[hybrid-triage-commit-process.md](/.agents/skills/bundles/git-bundle/hybrid-triage-commit/references/hybrid-triage-commit-process.md)
対話的仕分けスクリプト:
[git-triage.ts](/.agents/skills/bundles/git-bundle/hybrid-triage-commit/scripts/git-triage.ts)
