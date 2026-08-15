# plan-retrospective リファレンス

## 業務概要

スプリント終了時に、対象スプリントの振り返りを新規作成する。作成される振り返りにはスプリント
番号（Sprint N）がヘッダーとして記述される。

## plan_retrospective.ts — 振り返り作成

### 入力パラメータ

| パラメータ     | 型       | 必須 | 説明                                         |
| -------------- | -------- | ---- | -------------------------------------------- |
| `sprintNumber` | `number` | 必須 | 振り返りを作成するスプリント番号             |
| `scope`        | `object` | 任意 | 対象リポジトリのスコープ。省略時は実行時解決 |

### 出力

- **dry-run**: `{ summary, resolvedSprint, steps }` をJSONで出力する。何も変更しない。
- **実実行**: `ExecutionResult` をJSONで出力する。振り返りが作成される。

### dry-run 出力の解釈

`steps` に含まれる作成ステップの `params` が、実際に作成される振り返りのタイトル（`title`）と
本文（`body`）を示す。

```json
{
  "summary": "Plan retrospective: Sprint 20 Retrospective",
  "resolvedSprint": { "sprintNumber": 20 },
  "steps": [
    { "entity": "Scope", "operation": "resolve" },
    {
      "entity": "Retrospective",
      "operation": "plan",
      "params": {
        "title": "Sprint 20 Retrospective",
        "body": "## Sprint Retrospective\n\n- **Sprint**: Sprint 20"
      }
    }
  ]
}
```

チャットウィンドウでは、`summary` を見出しとして先頭に表示し、`steps` を以下の形式で展開する：

```
📋 Plan: <summary>
  • 対象: <title>
  • 操作: 振り返りを新規作成
```

### 実行例

```bash
# dry-run（作成内容の確認のみ・何も変更しない）
echo '<JSON>' | deno run -A .agents/skills/bundles/management-bundle/plan-retrospective/scripts/plan_retrospective.ts --dry-run

# 実実行（振り返りを作成）
echo '<JSON>' | deno run -A .agents/skills/bundles/management-bundle/plan-retrospective/scripts/plan_retrospective.ts
```

## アーキテクチャ上の責務

- スクリプトは「入力の検証・UseCase呼び出し・結果表示」を担当する
- 対話（対象スプリントの確認・承認）は SKILL.md の手順・AI側に保持する
- 外部操作は既存 UseCase のみを経由する
