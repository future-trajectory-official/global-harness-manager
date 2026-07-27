---
name: complete-work-package
description: WPを完了状態に遷移し、必要に応じて親PBIも完了する。
tags:
  - trigger: complete-work-package
  - trigger: complete-wp
  - trigger: finish-work-package
  - category: management
---

# complete-work-package

セッション終了後、WPを完了状態に遷移し、兄弟WPが全て完了している場合は親PBIも完了する。

## Quick-Start

1. **WPの完了**: 現在のWPを完了状態に遷移する。
   ```bash
   echo '<JSON>' | deno run -A .agents/skills/bundles/management-bundle/complete-work-package/scripts/complete_wp.ts
   ```
   入力パラメータは
   [references/reference.md](/.agents/skills/bundles/management-bundle/complete-work-package/references/reference.md)
   を参照すること。

2. **兄弟WPの確認**: 親PBI配下の全WPを検索し、全て完了済みかを確認する。
   ```bash
   echo '<JSON>' | deno run -A .agents/skills/bundles/management-bundle/select-work-package/scripts/search_wp.ts
   ```

3. **PBI完了判定**:
   - 全兄弟WPが完了 → 親PBIを完了状態に遷移する
     ```bash
     echo '<JSON>' | deno run -A .agents/skills/bundles/management-bundle/complete-work-package/scripts/complete_pbi.ts
     ```
   - 未完了の兄弟WPあり → POにその旨を報告し、残作業を確認する

4. **結果報告**: 完了状態のサマリをPOに報告する。
