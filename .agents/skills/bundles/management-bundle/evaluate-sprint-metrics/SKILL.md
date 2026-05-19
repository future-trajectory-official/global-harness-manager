---
name: evaluate-sprint-metrics
description: スプリント全体のベロシティの安定性、テスト品質の健全性、プロセス規律の遵守状況、およびセッションメトリクス履歴の集計・推移評価を行う。
tags:
  trigger:
    - sprint-end
  category: management
  constraints: none
---

# evaluate-sprint-metrics

スプリント全体の協働と開発の品質を定量的に測定し、推移を分析するための専用スキルです。

## 🚀 Quick-Start (実行手順)

本スキルを実行するAI（および人間）は、以下の手順を最短経路で実行してください。

1. **インプット情報の読み込み**
   - [metrics-guide.md](.agents/skills/bundles/management-bundle/evaluate-sprint-metrics/references/metrics-guide.md)
     を読み込み、評価指標と採点基準を把握します。
   - セッション履歴が記録されている [metrics.jsonl](.agents/management/metrics.jsonl)
     を読み込み、4大指標（Intent, Constraint 等）のスコアを抽出します。
   - [product-backlog.md](.agents/management/product-backlog.md)
     のスプリント内のPBI完了実績とTシャツサイズの見積もりデータを把握します。

2. **メトリクスの評価と採点**
   - ガイドに定義された採点基準に従って、4つの主要指標（Goal Achievement, Velocity, Quality,
     Collaboration & Discipline）を1-5点で定量評価します。

3. **サマリーの出力**
   - 定義された「Sprint Metrics
     Summary」のテーブルフォーマットに沿って評価結果を出力し、PO（ユーザー）に提示します。

## 📋 詳細手順

1. **メトリクス評価の実行**
   - 評価ガイドに基づき、スプリント全体のベロシティ（計画対実績）、テスト網羅性、バグ率、およびセッションごとのメトリクスデータを総合評価します。

2. **4大指標の採点**
   - 基準に従って各指標を1-5点で採点し、スプリントの品質状況を分析します。

3. **サマリーの出力**
   - スプリント全体の評価スコアと、次スプリントの品質向上に向けた改善提言を提示し、POと同期してください。
