---
name: assess-alignment
description: プロジェクトのビジョンと、現在行使可能な能力（ロール・スキル）を確認し、セッションの価値判断基準を整える。
tags:
  - trigger: assess-alignment, alignment-check, capability-check
  - category: management
---

# assess-alignment

プロジェクトのビジョンとプロダクトゴール、現在のチーム保有能力（ロール・スキル）のアライメントを評価する。
出力JSONには `vision`、`productGoal`（未設定時はnull）、`roles`、`skills` が含まれる。

## Quick-Start

Task tool のサブエージェントに以下のコマンドを実行させる。

```bash
echo '{}' | deno run -A .agents/skills/bundles/management-bundle/assess-alignment/scripts/assess_alignment.ts
```

返ってきた JSON を
[references/display-principles.md](/.agents/skills/bundles/management-bundle/assess-alignment/references/display-principles.md)
の原則に従ってユーザーが理解しやすいよう表示する。
