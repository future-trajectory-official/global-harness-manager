---
name: reflection-issue
description: スプリント振り返り記録用の Issue（type:Reflection）を作成する。
tags:
  trigger:
    - reflection-issue
    - kpt-create
    - sprint-reflection-create
  category: management
  constraints: none
---

# reflection-issue

## 前提条件

- `--repo owner/repo` が必須
- `gh` CLI が認証済みであること

## Quick-Start

```bash
echo '{"title":"Sprint 12 振り返り","milestoneNumber":12,"keep":["良かった点"],"problem":["課題"],"tryItems":["改善策"]}' | deno run -A .agents/skills/bundles/management-bundle/reflection-issue/scripts/reflection-issue.ts --repo owner/repo
```

## 手順

### 1. 入力JSONの準備

標準入力から `ReflectionIssueParams` 形式の JSON を渡す。入力パラメータの詳細は
[/.agents/skills/bundles/management-bundle/reflection-issue/references/input-params.md](/.agents/skills/bundles/management-bundle/reflection-issue/references/input-params.md)
を参照。

### 2. ドライラン（確認）

`--dry-run` フラグを付与して、実際の Issue 作成を行わずにパラメータ検証のみ行う。

```bash
echo '<json>' | deno run -A scripts/reflection-issue.ts --repo owner/repo --dry-run
```

### 3. 実行

ドライランで問題なければ `--dry-run` を外して実行する。

### 4. 出力

成功時は以下の JSON が出力される。

```json
{
  "success": true,
  "data": {
    "number": 124,
    "title": "Sprint 12 振り返り",
    "labels": ["type:Reflection"],
    "state": "open",
    "milestone": "Sprint 12"
  }
}
```
