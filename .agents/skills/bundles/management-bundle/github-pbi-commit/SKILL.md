---
name: github-pbi-commit
description: PBIをアイデア（idea）から開発待ち（todo）へ状態遷移（コミット）する。
tags:
  trigger:
    - github-pbi-commit
    - pbi-commit
    - idea-to-todo
  category: management
  constraints: none
---

# github-pbi-commit

PBIのステータスを `status:idea` から `status:todo`
に遷移させ、開発待ち状態にコミットします。マイルストーンが指定された場合は同時に設定します。

## 前提条件

- `--repo` に `owner/repo` 形式の有効なリポジトリを指定すること
- 対象Issueが `status:idea` 状態であること

## Quick-Start

```bash
echo '{"number":42,"milestone":"v1.0"}' \
  | deno run -A .agents/skills/bundles/management-bundle/github-pbi-commit/scripts/github-pbi-commit.ts \
  --repo "owner/repo" --label-prefix "status:" --dry-run
```

## 手順

### 1. 入力データの準備

- 標準入力JSONに以下のフィールドを指定:
  - `number` (必須): コミット対象のIssue番号
  - `milestone` (任意): 割り当てるマイルストーン番号

### 2. 実行

- `status:idea` ラベルを削除し `status:todo` を追加
- Issueの状態を強制的に `open` に設定

## 詳細リファレンス

- ステータス遷移設計の詳細は
  [spike-report-github-pbi-skills.md](/.local/spike-report-github-pbi-skills.md) を参照
