---
name: review-issue
description: スプリントレビュー記録用の Issue（type:Review）を作成する。
tags:
  trigger:
    - review-issue
    - sprint-review-create
  category: management
  constraints: none
---

# review-issue

## 前提条件

- `--repo owner/repo` が必須
- `gh` CLI が認証済みであること

## Quick-Start

```bash
echo '{"title":"Sprint 12 レビュー","milestone":"Sprint 12","milestoneNumber":12,"achievementRate":85}' | deno run -A .agents/skills/bundles/management-bundle/review-issue/scripts/review-issue.ts --repo owner/repo
```

## 手順

### 1. 入力JSONの準備

標準入力から `ReviewIssueParams` 形式の JSON を渡す。入力パラメータの詳細は
[/.agents/skills/bundles/management-bundle/review-issue/references/input-params.md](/.agents/skills/bundles/management-bundle/review-issue/references/input-params.md)
を参照。

### 2. ドライラン（確認）

`--dry-run` フラグを付与して、実際の Issue 作成を行わずにパラメータ検証のみ行う。

```bash
echo '<json>' | deno run -A scripts/review-issue.ts --repo owner/repo --dry-run
```

### 3. 実行

ドライランで問題なければ `--dry-run` を外して実行する。

### 4. 出力

成功時は以下の JSON が出力される。

```json
{
  "success": true,
  "data": {
    "number": 123,
    "title": "Sprint 12 レビュー",
    "labels": ["type:Review"],
    "state": "open",
    "milestone": "Sprint 12"
  }
}
```
