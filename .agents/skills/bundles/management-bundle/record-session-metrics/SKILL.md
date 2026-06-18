---
name: record-session-metrics
description: セッションの協働指標を採点し、セッションメトリクスファイルに記録する。
tags:
  trigger:
    - session-end
    - metrics-update
  category: management
  constraints: none
---

# record-session-metrics

セッションの協働品質を定量化し、[metrics.jsonl](/.agents/management/metrics.jsonl)
に蓄積するためのスキルです。PO 指定の 4 つのコアメトリクスを記録し、履歴サマリーを出力します。

## 手順

// turbo-all

1. **採点と記録の実行**
   - ログに基づき採点および Effort（介入回数）の集計を行い、以下のコマンドを実行します。
   ```bash
   deno run -A .agents/skills/bundles/management-bundle/record-session-metrics/scripts/record.ts \
     --intent=<1-5> --constraint=<1-5> --context=<1-5> --stability=<1-5> \
     --metrics-reason="<採点の思考プロセス>" \
     --epic="<Epic ID>" --feature="<Feature ID>" --pbi="<PBI ID>" \
     --initial-effort=<初期見積数値> --planned-effort=<計画後見積数値> --actual-effort=<実績数値> \
     --effort-variance-reason="<予実乖離の理由、またはスムーズに完了した成功要因>"
   ```
   - ※各評価フラグには 1〜5 の数値を指定してください。
   - ※`--reason` も `--metrics-reason` のエイリアスとして後方互換性のために使用可能です。

   **サマリーのみ表示する場合（記録なし）**:
   ```bash
   deno run -A .agents/skills/bundles/management-bundle/record-session-metrics/scripts/record.ts --summary
   ```

2. **サマリーの確認**
   - 実行後に表示される「推移テーブル」および「履歴」を確認し、予実精度やプロセスの改善兆候を把握してください。

> [!TIP]
> 各品質メトリクスの採点基準およびスキーマ詳細は [metrics-guide.md](/guides/metrics-guide.md)
> を参照してください。 Effort（介入回数）の厳密な定義や3点見積もりフローについては
> [backlog-guidelines.md](/guides/backlog-guidelines.md) を参照してください。
