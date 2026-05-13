---
name: record-session-metrics
description: セッションの協働指標を採点し、metrics.jsonl に記録する。
tags:
  trigger:
    - session-end
    - metrics-update
  category: management
  constraints: none
---

# record-session-metrics

セッションの協働品質を定量化し、`metrics.jsonl` に蓄積するためのスキルです。PO 指定の 4
つのコアメトリクスを記録し、履歴サマリーを出力します。

## 手順

// turbo-all

1. **採点と記録の実行**
   - ログに基づき採点を行い、以下のコマンドを実行します。
   ```bash
   deno run -A .agents/skills/bundles/management-bundle/record-session-metrics/scripts/record.ts <intent> <constraint> <context> <stability>
   ```
   - ※各引数には 1-5 の数値を入力してください。

2. **サマリーの確認**
   - 実行後に表示される「直近 5 セッションの推移」を確認し、改善の兆候や課題を把握してください。

> [!TIP]
> 各メトリクスの詳細な採点基準は [metrics-guide.md](references/metrics-guide.md)
> を参照してください。
