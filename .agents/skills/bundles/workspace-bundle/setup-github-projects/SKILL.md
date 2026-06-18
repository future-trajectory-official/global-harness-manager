---
name: setup-github-projects
description: "GitHub Projects V2 に Product Backlog ボードと Sprint Board を一括構築する"
tags:
  trigger:
    - github-projects-setup
    - project-board-create
    - repo-init
  category: onboarding
  constraints: requires-gh-cli, requires-project-scope
---

# setup-github-projects

指定リポジトリに Product Backlog ボードと Sprint Board を作成し、カスタムフィールドを設定します。

## Quick Start

```bash
deno run -A .agents/skills/bundles/workspace-bundle/setup-github-projects/scripts/setup-projects.ts --repo <owner/repo>
```

`--repo` 省略時は `config/identities.md` から自動取得します。

## リファレンス

- [フィールド定義](/.agents/skills/bundles/workspace-bundle/setup-github-projects/references/field-definitions.md)
  — 各ボードのカスタムフィールドの型・選択肢
- [運用ルール](/.agents/skills/bundles/workspace-bundle/setup-github-projects/references/operation-rules.md)
  — Priority の小数運用、Parent の記入ルール、Stage 遷移
- [構成例](/.agents/skills/bundles/workspace-bundle/setup-github-projects/references/projects-config.json.example)
  — スクリプト実行後に自動生成される構成ファイルの雛形（実値はリポジトリごとに異なるため追跡対象外）
