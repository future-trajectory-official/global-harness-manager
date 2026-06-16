---
name: github-pbi-archive
description: 完了したPBI（Issue）をクローズ（アーカイブ）する。
tags:
  trigger:
    - github-pbi-archive
    - pbi-archive
    - pbi-close
  category: management
  constraints: none
---

# github-pbi-archive

完了したPBI（Issue）をクローズ状態に遷移させ、アーカイブします。ラベル操作は行いません。

## 前提条件

- `--repo` に `owner/repo` 形式の有効なリポジトリを指定すること
- 対象Issueが完了状態であること

## Quick-Start

```bash
echo '{"number":42}' \
  | deno run -A .agents/skills/bundles/management-bundle/github-pbi-archive/scripts/github-pbi-archive.ts \
  --repo "owner/repo" --dry-run
```

## 手順

### 1. 入力データの準備

- 標準入力JSONに以下のフィールドを指定:
  - `number` (必須): アーカイブ対象のIssue番号

### 2. 実行

- Issueを `close()` してアーカイブ
- `--dry-run` で事前確認可能

### 3. 出力の確認

- 成功時: `{ success: true, data: { number, state } }`

## 詳細リファレンス

- アーカイフローの詳細は
  [spike-report-github-pbi-skills.md](/.local/spike-report-github-pbi-skills.md) を参照
