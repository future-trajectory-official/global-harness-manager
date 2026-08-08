---
name: start-work-package
description: 計画承認後のWPに対して計画後effort見積りと着手準備を行う。
tags:
  - trigger: start-work-package
  - trigger: start-wp
  - trigger: begin-work-package
  - category: management
---

# start-work-package

計画承認後のWPに対して、計画後effort見積りと着手準備を行う。

## 事前条件

- WPがTodo状態（未着手）であること。
- 実装計画（`implementation_plan.md`）のPO承認が完了していること。

## Quick-Start

1. **介入の記録**:
   初回計画提案から計画承認までに発生したPOからの軌道修正・方針変更指示を、介入履歴として記録する。

2. **見積りの算出**:
   - まず、対象WPの**既存の計画前見積**を確認する。`read-project-state`
     スキルを呼び出して該当WPを閲覧する。
     ```bash
     echo '<JSON>' | deno run -A .agents/skills/bundles/management-bundle/read-project-state/scripts/read_project_state.ts
     # → 出力の projectItems[].effort に計画前見積（initial_estimate）が記録されている
     ```
     入力JSONの組み立て方は
     [references/reference.md](/.agents/skills/bundles/management-bundle/start-work-package/references/reference.md)
     を参照すること。
   - 計画後見積の定義と算出方法は [guides/backlog-guidelines.md](/guides/backlog-guidelines.md) の
     **2.2.1** に従うこと。

3. **見積りの提示と了承**: 算出した見積りをPOに提示し、了承を得る。

4. **見積りの記録**: 見積りを記録する。事前に `--dry-run` でPlanを確認し、PO承認後に本実行すること。
   ```bash
   echo '<JSON>' | deno run -A .agents/skills/bundles/management-bundle/start-work-package/scripts/estimate_planned_effort.ts --dry-run
   echo '<JSON>' | deno run -A .agents/skills/bundles/management-bundle/start-work-package/scripts/estimate_planned_effort.ts
   ```
   入力パラメータは
   [references/reference.md](/.agents/skills/bundles/management-bundle/start-work-package/references/reference.md)
   を参照すること。

5. **着手の了承**: POに開始の了承を得る。

6. **着手の記録**: 着手を記録する。事前に `--dry-run` でPlanを確認し、PO承認後に本実行すること。
   ```bash
   echo '<JSON>' | deno run -A .agents/skills/bundles/management-bundle/start-work-package/scripts/start_wp.ts --dry-run
   echo '<JSON>' | deno run -A .agents/skills/bundles/management-bundle/start-work-package/scripts/start_wp.ts
   ```
   入力パラメータは
   [references/reference.md](/.agents/skills/bundles/management-bundle/start-work-package/references/reference.md)
   を参照すること。

7. **親PBIの昇格判定**: 着手したWPが**最初のWP**（親PBI配下で最初の着手）かを確認する。
   - 該当WPを view して親PBIを特定し、親PBI配下の全WP（兄弟WP）を subIssues で列挙する。
     ```bash
     echo '{"entityType":"WorkPackage","operation":"find","params":{"itemId":<着手WP番号>}}' \
       | deno run -A .agents/skills/bundles/management-bundle/read-project-state/scripts/read_project_state.ts
     # → output.parent で親PBI番号を確認
     echo '{"entityType":"ProductBacklogItem","operation":"find","params":{"itemId":<親PBI番号>}}' \
       | deno run -A .agents/skills/bundles/management-bundle/read-project-state/scripts/read_project_state.ts
     # → output.children で兄弟WP一覧（number）を確認
     ```
   - 兄弟WP各々を view して Status を確認し、1件でも `In Progress` または `Done`
     がある場合は、親PBIは既に昇格済みのため昇格しない。
   - 全兄弟WPが `Todo`（かつ今回のWPが最初の着手）の場合、親PBIを `InProgress` へ昇格する。事前に
     `--dry-run` でPlanを確認し、PO承認後に本実行すること。
     ```bash
     echo '<JSON>' | deno run -A .agents/skills/bundles/management-bundle/start-work-package/scripts/start_pbi.ts --dry-run
     echo '<JSON>' | deno run -A .agents/skills/bundles/management-bundle/start-work-package/scripts/start_pbi.ts
     ```
   - 注意: 親PBIへ直接着手して不整合を起こさないよう、親PBI昇格は本手順の判定に従うこと。

8. **結果報告**: 見積り値と着手完了、および親PBI昇格の要否・実行結果をPOに報告する。
