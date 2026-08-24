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

> [!IMPORTANT] 各ステップの責任者 各ステップの見出しに **責任者** を明記する。
>
> - `[責任者: AI]`: AIが自律実行する（確認不要）
> - `[責任者: PO]`: POが実行する
> - `[責任者: 共同]`: AIが案を提示し、**POの確定を経てから**次のステップへ進む
>   共同ステップでは、POの確定なしに記録・実行を行ってはならない。

### Step 1: 採点データの準備 [責任者: AI]

介入履歴（フェーズ・種別・件数）とKPT対話内容を整理する。

### Step 2: 各指標の採点 [責任者: 共同]

[references/metrics-guide.md](/.agents/skills/bundles/management-bundle/record-work-package-metrics/references/metrics-guide.md)
の定義に基づき、各指標のスコア案と根拠をPOに提示する。 **POが最終スコアを決定する。**

**POの確定を経るまで Step 4 へ進んではならない。**

### Step 3: コメントの記録 [責任者: 共同]

総合所見をPOと合意する。

### Step 4: メトリクスの記録 [責任者: AI]

合意した内容を記録する。

**dry-run（Plan 表示のみ・記録しない）**: `--dry-run` を付与すると、実際に実行される Plan（summary /
steps）を表示するだけで、GitHub 上の WP を変更せずに終了する。 PO への提示・確認に利用する。

```bash
echo '<JSON>' | deno run -A .agents/skills/bundles/management-bundle/record-work-package-metrics/scripts/record_metrics.ts --dry-run
```

**本記録（GitHub へ反映）**:

```bash
echo '<JSON>' | deno run -A .agents/skills/bundles/management-bundle/record-work-package-metrics/scripts/record_metrics.ts
```

入力パラメータは
[references/reference.md](/.agents/skills/bundles/management-bundle/record-work-package-metrics/references/reference.md)
を参照すること。

### Step 5: 結果報告 [責任者: AI]

記録完了をPOに報告する。
