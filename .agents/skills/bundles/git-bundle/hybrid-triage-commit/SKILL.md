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

意味は問わない。動いたらセーブする。 ※ 本リポジトリは commit-msg フックで Conventional Commits
形式（`type: 内容`）を強制するため、 `[wip]` 形式は拒否される。WIP でも `chore(wip): <日本語>` （例:
`chore(wip): セーブポイント`）形式で記録すること。※ フックは内容に日本語文字を含むことを必須とする。

```bash
git add -A && git commit -m "chore(wip): セーブポイント"
```

### triage モード（プッシュ直前）

**「意味単位で分割する」** が唯一の目的。以下の値は
[hybrid-triage-commit-process.md](/.agents/skills/bundles/git-bundle/hybrid-triage-commit/references/hybrid-triage-commit-process.md)
で確認すること：

- `<base>` — ベースブランチ名の導出方法
- `<wip-branch>` — WIPブランチ名の特定方法
- `<clean-name>` — 新ブランチ名の命名規則
- 意味単位の分類基準（feat / fix / refactor / test / docs / chore の定義）

```bash
# 準備: ベースから新ブランチ
git checkout <base> && git pull && git checkout -b <clean-name>
# 俯瞰: WIP との差分を確認
git diff --name-status <base>..<wip-branch>
```

出力されたファイル一覧を意味単位に分類し、単位ごとに以下を繰り返す：

```bash
git checkout <wip-branch> -- <files>
git add <files>
git commit -m "<type>(<scope>): <description>"
```

- 追跡対象外のファイル（`.gitignore` で除外）は commit できない。`git ls-files` で確認。
- 完了後: `git branch -D <wip-branch>`

対話的仕分けにはスクリプト:
[git-triage.ts](/.agents/skills/bundles/git-bundle/hybrid-triage-commit/scripts/git-triage.ts)
