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

## Quick-Start

1. **介入の記録**:
   初回計画提案から計画承認までに発生したPOからの軌道修正・方針変更指示を、介入履歴として記録する。

2. **見積りの算出**:
   実装計画の規模・AC数・複雑性・介入実績を分析し、このWPの完了までに必要と見込まれる計画後effort（想定介入回数）を算出する。

3. **見積りの提示と了承**: 算出した見積りをPOに提示し、了承を得る。

4. **見積りの記録**: 見積りを記録する。
   ```bash
   echo '<JSON>' | deno run -A .agents/skills/bundles/management-bundle/start-work-package/scripts/estimate_planned_effort.ts
   ```
   入力パラメータは
   [references/reference.md](/.agents/skills/bundles/management-bundle/start-work-package/references/reference.md)
   を参照すること。

5. **着手の了承**: POに開始の了承を得る。

6. **着手の記録**: 着手を記録する。
   ```bash
   echo '<JSON>' | deno run -A .agents/skills/bundles/management-bundle/start-work-package/scripts/start_wp.ts
   ```
   入力パラメータは
   [references/reference.md](/.agents/skills/bundles/management-bundle/start-work-package/references/reference.md)
   を参照すること。

7. **結果報告**: 見積り値と着手完了をPOに報告する。
