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

### triage モード（プッシュ直前。詳細は後続リンクを参照）

1. ベースブランチから新ブランチを作成する
2. WIP ブランチからファイルを適用する: `git checkout <wip-branch> -- <files>`
3. `deno run -A scripts/git-triage.ts triage` を実行し、対話的にアトミックコミットを作成する

詳細手順: [references/hybrid-triage-commit-process.md](references/hybrid-triage-commit-process.md)
スクリプトリファレンス: [scripts/git-triage.ts](scripts/git-triage.ts) 非対話環境での代替手順:
[references/hybrid-triage-commit-process.md#非対話環境でのトリアージ手順](references/hybrid-triage-commit-process.md)
