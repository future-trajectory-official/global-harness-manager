---
name: setup-github-labels
description: "任意のGitHubリポジトリにHarness標準ラベル（type 6種）を一括構築する"
tags:
  trigger:
    - github-label-setup
    - label-create
    - repo-init
  category: onboarding
  constraints: requires-gh-cli
---

# setup-github-labels

任意のGitHubリポジトリに対して、type の6種ラベルを一括作成します。

## 実行方法

```bash
deno run -A .agents/skills/bundles/workspace-bundle/setup-github-labels/scripts/setup-labels.ts --repo <owner/repo> --mode safe|force
```

### モード説明

| モード  | 動作                                                        |
| ------- | ----------------------------------------------------------- |
| `safe`  | 競合する既存ラベルが1つでもあれば中断し、競合一覧を報告する |
| `force` | 既存ラベルを全削除してから全6種を再作成する                 |

## リファレンス

- [ラベル定義YAML](/.agents/skills/bundles/workspace-bundle/setup-github-labels/references/label-definitions.yaml)
  — 機械可読なラベル定義
- [ラベル定義解説](/.agents/skills/bundles/workspace-bundle/setup-github-labels/references/label-definitions.md)
  — 各ラベルの意味・使用タイミング
