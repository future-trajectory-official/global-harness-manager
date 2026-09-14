---
name: select-work-package
description: 条件に合致するWork Packageを検索し、POが次に着手するWPを選択する。
tags:
  - trigger: select-work-package
  - trigger: select-wp
  - trigger: choose-work-package
  - trigger: search-work-package
  - category: management
---

# select-work-package

条件に合致するWork Packageを検索し、POが次に着手するWPを選択する。

## Quick-Start

1. **検索条件の確認**:
   POにどのようなWPを探すか確認する（例：未着手のもの、特定スプリントのものなど）。

2. **WPの検索**: 検索を実行する。
   ```bash
   echo '<JSON>' | deno run -A .agents/skills/bundles/management-bundle/select-work-package/scripts/search_wp.ts
   ```
   入力パラメータは
   [references/reference.md](/.agents/skills/bundles/management-bundle/select-work-package/references/reference.md)
   を参照すること。

3. **親PBIの補完検索**: `search_wp.ts`
   の出力には親PBIの詳細（見積サイズ・状態）が含まれないため、各WPの親PBI番号を特定後、**read-project-state
   の find に委譲**して補完する（gh api・GraphQL 直操作での代替は禁止）。
   ```bash
   echo '{"entityType":"ProductBacklogItem","operation":"find","params":{"itemId":"<親PBI番号>"}}' | deno run -A .agents/skills/bundles/management-bundle/read-project-state/scripts/read_project_state.ts
   ```
4. **選択肢の提示**:
   検索結果を整形してPOに提示する。各WPのタイトル・識別子・親PBI（3.で補完した見積サイズ・状態を含む）・見積り値を含めること。

5. **選択**: POにどのWPに着手するか確認し、選んでもらう。

6. **確認**: POが選択したWPの識別情報を復唱して終了する。
