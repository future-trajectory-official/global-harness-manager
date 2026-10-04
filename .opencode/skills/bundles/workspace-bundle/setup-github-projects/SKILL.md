---
name: setup-github-projects
description: GitHub Project V2 の3ボード・カスタムフィールド・.harnessrc を順に構築します。新規プロジェクトのオンボーディング時やボード再作成時に使用します。
tags:
  trigger:
    - setup-projects
    - create-boards
    - onboarding-tools
  category: onboarding
  constraints: none
---

# setup-github-projects

GitHub Project V2 のボード・フィールド・設定ファイルを順に構築するスキル。

## 使用方法

boards → fields → harnessrc の順に実行する。

1. ボードを作成する。

```bash
deno run -A .opencode/skills/bundles/workspace-bundle/setup-github-projects/scripts/create-boards.ts <owner>
```

2. カスタムフィールドを作成する。

```bash
deno run -A .opencode/skills/bundles/workspace-bundle/setup-github-projects/scripts/create-fields.ts <board-number> <productBacklog|sprintBoard|retrospectiveBoard>
```

3. `.harnessrc` を生成する。生成と同時に同一ディレクトリへ2行の `.gitignore`
   （`.harnessrc`＋`.gitignore` 自身）を冪等に併置する（WP#786 AC-1）。

```bash
deno run -A .opencode/skills/bundles/workspace-bundle/setup-github-projects/scripts/generate-harnessrc.ts --boards-json '<boards-json>' --repo <owner/repo>
```

> [!TIP]
> ボード仕様は [board-spec.md](./references/board-spec.md) を、 フィールド仕様は
> [field-spec.md](./references/field-spec.md) を、 アカウントの扱いは
> [account-usage.md](./references/account-usage.md) を参照してください。

## 前提条件

- `gh auth refresh -s project` で Project V2 の権限を付与済みであること。

## 注意（破壊防止）

- 既存ボード・既存フィールドは再利用・スキップし、削除・改名・型変更は行わない。
- フィールド型が不明な場合は推測で作成せず、PO へ報告して指示を仰ぐこと。
