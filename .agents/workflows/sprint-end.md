---
description: スプリントの終了プロセス（レビュー、アーカイブ、ベロシティ記録、メトリクス・予実評価、KPT、自己スキル最適化、ステートレスリセット）を安全に1ステップずつ実行するワークフロー。
---

# Sprint End Workflow (`/sprint-end`)

このワークフローは、スプリントのクローズ（終了）にあたり、定性的なデモ検証から定量的な予実乖離分析、マクロなプロセス改善（KPT）、自己スキルの最適化、および作業環境のクリーンアップ（ステートレスリセット）までをブレなく安全に実行するためのものです。
本ワークフローは各スキルを呼び出す「ファサード（窓口）」として機能し、各フェーズにおける期待される結果（契約）を厳格に管理します。

## ワークフローの進行ルール

- 以下のフェーズを順番に実行します。
- 各フェーズでは、指定された **ペルソナ（ルールファイル）** を読み込み、その立場になりきって
  **スキル** を実行してください。
- AI
  はフェーズを跨いで先読みしてはなりません。1つのフェーズ（スキルの実行）が完全に終了し、ユーザーから「次のフェーズへ」という承認を得てから、次のフェーズへ移行してください。
- **中断・再開時のルール**: ツールエラーやセッション中断からの復帰時は、必ず `[RECOVERY LOG]`
  において「現在 `/sprint-end` ワークフローの Phase X
  の途中である」と宣言し、文脈を同期してください。

---

## Phase 1: スプリントレビュー (Sprint Review)

スプリントゴールに対する最終的な達成状況を検証し、動くプロダクトのデモ検証と成果サマリーをPOに提示します。

- **読み込むペルソナ**:
  - `[scrum-master.md](/.agents/rules/scrum-master.md)` (進行・ファシリテーション)
  - `[tester.md](/.agents/rules/tester.md)` (品質検証・客観的エビデンス提示)
- **実行するスキル**:
  `[sprint-outcome-review](/.agents/skills/bundles/management-bundle/sprint-outcome-review/SKILL.md)`
- **入力（前提条件）**: スプリント対象PBIが完了した最新の
  `[product-backlog.md](/.agents/management/product-backlog.md)`。
- **手続き**:
  完了したPBIに対するテスト合格ログや実機動作ログ等の客観的なエビデンスを提示し、デモ可能なインクリメントの動作確認をPOに求めます。
- **期待される結果（終了条件）**:
  1. 「Sprint Review
     Report」のフォーマットに沿ってゴール達成度評価およびPBI完了・未完了状況が提示されていること。
  2. PO（ユーザー）がデモ内容および成果物を承認していること。

> [!IMPORTANT]
> 上記の「期待される結果」を満たすエビデンスを提示し、**「Phase
> 1が完了しました。よろしければ『次のフェーズ（Phase 2）へ進む』とご指示ください」**
> と明確にプロンプトして停止してください。

<!-- STOP -->

---

## Phase 2: 完了PBIのアーカイブ (Archive)

Phase 1で確認された完了PBIをアーカイブし、バックログをクリーンな状態にします。

- **読み込むペルソナ**:
  - `[scrum-master.md](/.agents/rules/scrum-master.md)` (進行・ファシリテーション)
- **実行するスキル**:
  `[archive-backlog](/.agents/skills/bundles/management-bundle/archive-backlog/SKILL.md)`
- **入力（前提条件）**: Phase 1 でPO承認を得た完了PBIの一覧。
- **手続き**:
  1. スプリント内の全 `[DONE]` PBI を特定する。
  2. 各PBIについて予実差分析JSONを構成する。
  3. `archive_backlog.ts` を実行し、アーカイブカードを生成してバックログから除去する。
- **期待される結果（終了条件）**:
  1. 全完了PBIが `product-backlog-archive.md` に移動されていること。
  2. `product-backlog.md` から該当PBIが除去されていること。

> [!IMPORTANT]
> 上記の「期待される結果」を満たすエビデンスを提示し、**「Phase
> 2が完了しました。よろしければ『次のフェーズ（Phase 3/Record Velocity）へ進む』とご指示ください」**
> と明確にプロンプトして停止してください。

<!-- STOP -->

---

## Phase 3: ベロシティ記録 (Record Velocity)

Phase 2 でアーカイブされた PBI
の実績データから合計ウェイト・実感サイズ一致率・乖離要約を自動集計し、`product-backlog.md`
の「スプリント実績推移」テーブルに追記します。

- **読み込むペルソナ**:
  - `[scrum-master.md](/.agents/rules/scrum-master.md)` (進行)
  - `[platform-engineer.md](/.agents/rules/platform-engineer.md)` (スクリプト実行・集計)
- **実行するスキル**:
  `[record-velocity](/.agents/skills/bundles/management-bundle/record-velocity/SKILL.md)`
- **入力（前提条件）**: Phase 2 でアーカイブが完了した `product-backlog-archive.md`。
- **手続き**:
  1. `record-velocity` スキルの手順に従い、アーカイブから対象スプリントの全 PBI ブロックを抽出する。
  2. 各 PBI の見積サイズ・実感サイズから合計ウェイト・一致率・乖離要約を算出する。
  3. `product-backlog.md` の「スプリント実績推移」テーブルに新規行を追記する。
- **期待される結果（終了条件）**:
  1. ベロシティデータ（開発PBI数・合計ウェイト・実感サイズ一致率・乖離要約）が `product-backlog.md`
     に正しく追記されていること。
  2. ユーザー（PO）が記録内容を確認し、承認していること。

> [!IMPORTANT]
> 上記の「期待される結果」を満たすエビデンスを提示し、**「Phase 3
> が完了しました。よろしければ『次のフェーズ（Phase 4）へ進む』とご指示ください」**
> と明確にプロンプトして停止してください。

<!-- STOP -->

---

## Phase 4: スプリントメトリクス定量評価・予実分析 (Metrics & Estimation Variance)

スプリント全体の規模消化力、品質健全性、プロセス規律を定量評価し、見積もり（Tシャツサイズ）と実労力（セッション数）の乖離を確定させます。

- **読み込むペルソナ**:
  - `[scrum-master.md](/.agents/rules/scrum-master.md)` (規律の評価)
  - `[po-coach.md](/.agents/rules/po-coach.md)` (ゴール消化効率の分析)
- **実行するスキル**:
  `[evaluate-sprint-metrics](/.agents/skills/bundles/management-bundle/evaluate-sprint-metrics/SKILL.md)`
- **入力（前提条件）**:
  - セッション履歴が記録されている `[metrics.jsonl](/.agents/management/metrics.jsonl)` (※
    またはそれに準ずるメトリクスログ)。
  - `[metrics-guide.md](/.agents/skills/bundles/management-bundle/evaluate-sprint-metrics/references/metrics-guide.md)`
    の定量採点基準。
- **手続き**:
  1. 採点基準に基づき、4つの主要指標（Goal Achievement, Velocity, Quality, Collaboration &
     Discipline）を1-5点で定量評価します。
  2. **【予実ギャップ分析】**：各PBIの見積時Tシャツサイズと、完了までに実際に要したセッション数（実労力）を集計し、乖離の傾向や差異を明確に記述します。
- **期待される結果（終了条件）**:
  1. 「Sprint Metrics Summary」のテーブル形式に沿って定量スコアと評価根拠が提示されていること。
  2. 見積もりと実際の労力の予実ギャップ乖離分析の結果が示されていること。
  3. ユーザーがその評価内容に同意していること。

> [!IMPORTANT]
> 上記の「期待される結果」を満たすエビデンスを提示し、**「Phase
> 4が完了しました。定量的な評価および予実差の確定を行いました。よろしければ『次のフェーズ（Phase
> 5）へ進む』とご指示ください」** と明確にプロンプトして停止してください。

<!-- STOP -->

---

## Phase 5: スプリントレトロスペクティブ (Retrospective KPT)

定量的なメトリクス評価結果をベースに、仕組みとプロセス全体のボトルネックや予実ギャップの根本原因をKPT形式で内省し、改善Tryを策定します。

- **読み込むペルソナ**:
  - `[scrum-master.md](/.agents/rules/scrum-master.md)` (マクロ内省の進行)
  - `[devils-advocate.md](/.agents/rules/devils-advocate.md)` (痛いところを突く批判的検証)
- **実行するスキル**:
  `[sprint-retrospective-kpt](/.agents/skills/bundles/management-bundle/sprint-retrospective-kpt/SKILL.md)`
- **入力（前提条件）**: Phase 4 で確定した定量評価スコアおよび予実差分析レポート。
- **手続き**:
  1. 定量データをインプットとし、Keep (継続)、Problem (課題・ギャップ原因)、Try (仕組み改善)
     を抽出します。
  2. AIから人間（PO）へ、個人の反省ではなく「指示、ルール、自動化の設計レベル」に還元した高度なマクロプロセス共進化提言を行います。
- **期待される結果（終了条件）**:
  1. 「Sprint Retrospective
     (KPT)」のフォーマットに従ってKPTおよびAIからの改善提言が提示されていること。
  2. 次スプリントの改善Try（具体的なアクションやルール改修）について、ユーザーと合意が形成されていること。

> [!IMPORTANT]
> 上記の「期待される結果」を満たすエビエビデンスを提示し、**「Phase
> 5が完了しました。よろしければ『次のフェーズ（Phase 6）へ進む』とご指示ください」**
> と明確にプロンプトして停止してください。

<!-- STOP -->

---

## Phase 6: 自己スキルオプティマイザー (Skill Optimization)

スプリント中の実行ログを分析し、スキルの発見性・再利用性向上、および不要な重複スキルのクリーンアップを自律的に提案・実行します。

- **読み込むペルソナ**:
  - `[skill-writer.md](/.agents/rules/skill-writer.md)` (スキル定義の最適化)
  - `[technical-advisor.md](/.agents/rules/technical-advisor.md)` (中長期的な保守性の担保)
- **実行するスキル**:
  `[skill-optimizer](/.agents/skills/bundles/meta-bundle/skill-optimizer/SKILL.md)`
- **入力（前提条件）**: スプリント中のセッションログ、振り返りでの改善Try。
- **手続き**:
  1. スプリントを通じて利用頻度の低かった「無駄なスキル」を検出し、整理を提案します。
  2. よく使われたスキルの説明文（description）やCSOタグを、実際の利用文脈に合わせて最適化します。
- **期待される結果（終了条件）**:
  1. スキル資産の現状評価と、最適化または削除対象のスキル提案が提示されていること。
  2. ユーザーがその整理方針に合意していること。

> [!IMPORTANT]
> 上記の「期待される結果」を満たすエビデンスを提示し、**「Phase
> 6が完了しました。スキルのクリーンアップ・最適化案が提示されました。よろしければ『次のフェーズ（Phase
> 7）へ進む』とご指示ください」** と明確にプロンプトして停止してください。

<!-- STOP -->

---

## Phase 7: ステートレスリセットの検討 (Stateless Reset)

スプリントの完了を宣言し、次回スプリントに向けてキャッシュ、一時ファイル、記憶フォルダの退避を行い、環境をステートレスにクリアします。

- **読み込むペルソナ**: `[platform-engineer.md](/.agents/rules/platform-engineer.md)`
  (環境クリーンアップ)
- **実行するスキル**:
  `[stateless-reset](/.agents/skills/bundles/meta-bundle/stateless-reset/SKILL.md)`
- **手続き**:
  退避スクリプト（`[reset.ts](/.agents/skills/bundles/meta-bundle/stateless-reset/scripts/reset.ts)`）の実行手続きを示し、不要キャッシュ等を完全に退避させ、クリーンなセッションで新たなスプリントを開始できるようにします。
- **期待される結果（終了条件）**:
  1. ステートレスリセットの実行が完了し、環境がクリーンアップされていること。
  2. スプリントの完全終了が宣言されること。

> [!IMPORTANT]
> 完了後、**「/sprint-end
> ワークフローがすべて完了しました！スプリント全体の儀式、アーカイブ、ベロシティ記録、メトリクス評価、スキル最適化、および環境のリセットが完了しました。次回スプリントはクリーンな状態で、新たに
> `/sprint-start` を呼び出して開始してください」** と宣言し、POの最終指示をお待ちください。

<!-- STOP -->
