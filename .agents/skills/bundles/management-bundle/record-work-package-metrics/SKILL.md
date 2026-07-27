---
name: record-work-package-metrics
description: セッション完了時に4つの協働品質指標をPOと採点し、バックログに記録する。
tags:
  - trigger: record-work-package-metrics
  - trigger: record-wp-metrics
  - trigger: record-metrics
  - category: management
---

# record-work-package-metrics

セッション完了時に4つの協働品質指標をPOと採点し、バックログに記録する。

介入事実とKPT対話の両方を踏まえてスコアリングする。

## Quick-Start

1. **採点データの準備**: 介入履歴（フェーズ・種別・件数）とKPT対話内容を整理する。

2. **各指標の採点**:
   [references/metrics-guide.md](/.agents/skills/bundles/management-bundle/record-work-package-metrics/references/metrics-guide.md)
   の定義に基づき、各指標のスコア案と根拠をPOに提示する。 POが最終スコアを決定する。

3. **コメントの記録**: 総合所見をPOと合意する。

4. **メトリクスの記録**: 合意した内容を記録する。
   ```bash
   echo '<JSON>' | deno run -A .agents/skills/bundles/management-bundle/record-work-package-metrics/scripts/record_metrics.ts
   ```
   入力パラメータは
   [references/reference.md](/.agents/skills/bundles/management-bundle/record-work-package-metrics/references/reference.md)
   を参照すること。

5. **結果報告**: 記録完了をPOに報告する。
