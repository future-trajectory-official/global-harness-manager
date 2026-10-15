---
name: assess-alignment
description: プロジェクトのビジョンと、現在行使可能な能力（ロール・スキル）を確認し、セッションの価値判断基準を整える。
tags:
  - trigger: assess-alignment
  - trigger: alignment-check
  - trigger: capability-check
  - category: management
---

# assess-alignment

プロジェクトのビジョンとプロダクトゴール、現在のチーム保有能力（ロール・スキル）のアライメントを評価する。
出力JSONには `vision`、`productGoal`（未設定時はnull）、`roles`、`skills` が含まれる。

## Quick-Start

Task tool のサブエージェントに以下のコマンドを実行させる。

```bash
echo '{}' | deno run -A .opencode/skills/bundles/management-bundle/assess-alignment/scripts/assess_alignment.ts
```

返ってきた JSON を
[references/display-principles.md](/.opencode/skills/bundles/management-bundle/assess-alignment/references/display-principles.md)
の原則に従ってユーザーが理解しやすいよう表示する。 出力に `warnings`
が含まれる場合は警告も合わせて提示する（部分成功時は exit 0 で継続するため見逃さないこと）。

## 失敗時のフォールバック手順

スクリプトが異常終了した場合（Vision取得失敗時の exit 1 等）は、以下の手動棚卸しで代替する。
`gh api`・GraphQL の直操作は禁止。必ず `read-project-state` スクリプト経由で行うこと。

1. **Vision / ProductGoal の取得**: `read_project_state.ts` の `find` で取得する（両Entityは
   `search` 対象外）。 Issue番号が不明な場合はPOに確認すること。

   ```bash
   echo '{"entityType":"Vision","operation":"find","params":{"itemId":"<VisionのIssue番号>"}}' | deno run -A .opencode/skills/bundles/management-bundle/read-project-state/scripts/read_project_state.ts
   echo '{"entityType":"ProductGoal","operation":"find","params":{"itemId":"<ProductGoalのIssue番号>"}}' | deno run -A .opencode/skills/bundles/management-bundle/read-project-state/scripts/read_project_state.ts
   ```

2. **ロール / スキルの棚卸し**: 以下の候補パスを存在するものから順に直接Readし、 frontmatter の
   `name`・`description` を読み取る。優先順位は opencode → claudecode → codex。
   同名は先勝とし、重複は警告として記録する。

   - ロール: `.opencode/agents/*.md` → `.claude/agents/*.md` → `~/.harness/agents/*.md`
     （workspace直下の `.agents/agents`
     は対象外。Antigravityカスタムエージェントは実測不使用のため別PBI化）
   - スキル: `.opencode/skills/bundles/` 配下の `SKILL.md`（再帰）→ `.claude/skills/*/SKILL.md` →
     `.agents/skills/*/SKILL.md` → `~/.harness/skills/bundles/` 配下の `SKILL.md`（再帰）
