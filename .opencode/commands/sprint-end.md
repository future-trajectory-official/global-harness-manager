---
description: スプリントの終了プロセス（レビューのアーカイブ、effort分析、サイズ確定、スプリントKPT記録、ベロシティ記録、スプリント評価記録、振り返りのアーカイブ、完了PBI/WPのアーカイブ、自己スキル最適化、スプリント終了、ステートレスリセット）を安全に1ステップずつ実行するワークフロー。
subtask: false
---

# /sprint-end — Sprint End Workflow

本コマンドはワークフロー `sprint-end` をメインセッションで実行するための入口です。
**手順の単一の正は以下のワークフロー定義ファイルです。全文を読み、記載どおりにフェーズ進行すること。**

@.agents/workflows/sprint-end.md

## 実行順序と状態遷移（呼出側の概要）

| フェーズ | 実行スキル | 実行後の状態（業務用語） |
| --- | --- | --- |
| Phase 1-0. 用語の同期 | assess-context | スプリント終了時の共有言語をPOと再確認済み |
| Phase 1-1. スプリントレビューのアーカイブ | archive-sprint-review | レビュー結果をPO確認・承認の上でアーカイブ済み |
| Phase 2. PBI effort分析 | record-pbi-effort-analysis | effort集計と乖離分析が対象PBIに記録済み |
| Phase 3. PBIサイズ実績の確定 | record-pbi-size-analysis | 実感サイズと乖離理由が対象PBIに記録済み |
| Phase 4. スプリントKPTの記録 | record-sprint-kpt | スプリントKPTが対象振り返りに記録済み |
| Phase 5. ベロシティ記録 | record-sprint-velocity | ベロシティ集計がスプリントの説明に記録済み |
| Phase 6. スプリント評価の記録 | record-sprint-metrics | 5指標とベロシティの評価が振り返りに記録済み |
| Phase 7. 振り返りのアーカイブ | archive-retrospective | 記録完了確認の上、振り返りが終了（アーカイブ）済み |
| Phase 8. 完了PBI/WPのアーカイブ | archive-product-backlog-items | 対象WP/PBIがWP→PBI順でクローズ済み |
| Phase 9. 自己スキルオプティマイザー | skill-optimizer | スキル資産評価と最適化・削除提案が合意済み |
| Phase 10. スプリント終了 | conclude-sprint | 対象スプリントが終了状態（closed）に遷移 |
| Phase 11. ステートレスリセットの検討 | stateless-reset | キャッシュ・一時ファイルが退避され環境が初期化 |

## 遵守事項

- ワークフロー内の `<!-- STOP -->` と停止指示は Opencode の機能ではなく AI への指示表記である。到達点で必ず報告し、PO の明示的な指示があるまで次のフェーズを先読みしない。
- コマンドは呼出側の事情（実行順序・状態遷移）のみを表現する。各実行スキルの内部操作（手順・コマンド・JSON形式）には踏み込まない。
- 並行実行を要する個所がある場合、コマンド自身はサブエージェントを起動せず、該当スキル側がサブエージェントの作成・実行を明示的に行う方針に従う（本ワークフローに並行実行個所なし；将来のスキル変更時もこの方針を維持する）。
