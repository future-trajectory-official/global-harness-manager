---
description: スプリントの終了プロセス（レビューのアーカイブ、effort分析、サイズ確定、メトリクス定量評価・予実分析、スプリントKPT記録、ベロシティ記録、スプリント評価記録、振り返りのアーカイブ、完了PBI/WPのアーカイブ、自己スキル最適化、スプリント終了、ステートレスリセット）を安全に1ステップずつ実行するワークフロー。
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
- **マクロタイミングの規約**: Retrospective ライフサイクルの各フェーズは「計画する（Phase 8
  `/sprint-start` の plan-retrospective）/ 実施する（Phase 5 record-sprint-kpt、Phase 7
  record-sprint-metrics）/ 保管する（Phase 8 archive-retrospective）」の3段階で管理します。
  各フェーズの記述に「マクロの呼出しタイミングは**◯◯**です」と明記します。

---

## Phase 1: スプリントレビューのアーカイブ (Archive Sprint Review)

- **読み込むペルソナ**:
  - `[scrum-master.md](/.agents/rules/scrum-master.md)` (進行・ファシリテーション)
- **実行するスキル**:
  `[archive-sprint-review](/.agents/skills/bundles/management-bundle/archive-sprint-review/SKILL.md)`
- **入力（前提条件）**: 本スプリントのレビュー検証が完了済みであること。
- **期待される結果（終了条件）**:
  1. `archive-sprint-review` スキルが正常に終了したこと。
  2. PO が結果を確認し、承認していること。

> [!IMPORTANT]
> 上記の「期待される結果」を満たすエビデンスを提示し、**「Phase
> 1が完了しました。よろしければ『次のフェーズ（Phase 2）へ進む』とご指示ください」**
> と明確にプロンプトして停止してください。

<!-- STOP -->

---

## Phase 2: PBI effort分析 (Record PBI Effort Analysis)

対象PBI配下の全WPのeffort（initial/planned/actual）を集計し、計画乖離・実行乖離の分析結果を対象PBIに記録します。

- **読み込むペルソナ**:
  - `[scrum-master.md](/.agents/rules/scrum-master.md)` (進行・ファシリテーション)
- **実行するスキル**:
  `[record-pbi-effort-analysis](/.agents/skills/bundles/management-bundle/record-pbi-effort-analysis/SKILL.md)`
- **入力（前提条件）**: スプリント内のPBI配下のWPが全て完了（`[DONE]`）しており、 effort実績（計画前
  / 計画後 / 実績）が対象PBI/WPに記録されていること。
- **手続き**:
  1. effort集計で対象PBI配下の全WPのeffortを集計する。
  2. 集計結果をもとに乖離分析（planning / execution）と改善提案を構成する。
  3. 分析結果の記録を実行する。
- **期待される結果（終了条件）**:
  1. effort集計値と乖離分析（計画乖離 / 実行乖離 / 改善提案）が対象PBIに記録されていること。
  2. ユーザー（PO）が記録内容を確認し、承認していること。

> [!IMPORTANT]
> 上記の「期待される結果」を満たすエビデンスを提示し、**「Phase
> 2が完了しました。よろしければ『次のフェーズ（Phase 3）へ進む』とご指示ください」**
> と明確にプロンプトして停止してください。

<!-- STOP -->

---

## Phase 3: PBIサイズ実績の確定 (Record PBI Size Analysis)

対象PBIの実感サイズを確定し、見積サイズとの乖離理由を対象PBIに記録します。

- **読み込むペルソナ**:
  - `[scrum-master.md](/.agents/rules/scrum-master.md)` (進行・ファシリテーション)
- **実行するスキル**:
  `[record-pbi-size-analysis](/.agents/skills/bundles/management-bundle/record-pbi-size-analysis/SKILL.md)`
- **入力（前提条件）**: 対象PBIの見積サイズが対象PBIに記録されていること。
- **手続き**:
  1. 見積サイズを取得する。
  2. セッション履歴から実感サイズを提案し、乖離理由を整理する。
  3. POの承認を得て実感サイズと乖離理由を記録する。
- **期待される結果（終了条件）**:
  1. 実感サイズと乖離理由が対象PBIに記録されていること。
  2. ユーザー（PO）が記録内容を確認し、承認していること。

> [!IMPORTANT]
> 上記の「期待される結果」を満たすエビデンスを提示し、**「Phase
> 3が完了しました。よろしければ『次のフェーズ（Phase 4）へ進む』とご指示ください」**
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
  - `[metrics-guide.md](/guides/metrics-guide.md)` の定量採点基準。
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

## Phase 5: スプリントKPTの記録 (Record Sprint KPT)

スプリント内の実績（完了した作業の規模・各セッションの振り返り）を確認し、それを材料としてスプリントの
KPT（Keep / Problem / Try / Advise）を記録します。マクロの呼出しタイミングは**実施する**です。

- **読み込むペルソナ**:
  - `[scrum-master.md](/.agents/rules/scrum-master.md)` (進行・ファシリテーション)
- **実行するスキル**:
  `[record-sprint-kpt](/.agents/skills/bundles/management-bundle/record-sprint-kpt/SKILL.md)`
- **入力（前提条件）**: 対象スプリントの振り返りが作成済みであること（`/sprint-start` の Phase 8
  `plan-retrospective`
  実施済み）。対象スプリント内の各作業パッケージのセッション振り返り・メトリクスが記録済みであること。
- **手続き**:
  1. スプリント内の実績（完了した作業パッケージの規模・労力、各セッションの振り返り）を収集し、ふりかえりの材料として整理する。
  2. KPTの草案をPOに提示し、対話で内容を確定する。
  3. dry-run で記録内容を確認し、POの承認後に本実行でスプリントのKPTを記録する。
- **期待される結果（終了条件）**:
  1. スプリントのKPTが対象スプリントの振り返りに記録されていること。
  2. ユーザー（PO）が記録内容を確認し、承認していること。

> [!IMPORTANT]
> 上記の「期待される結果」を満たすエビデンスを提示し、**「Phase
> 5が完了しました。よろしければ『次のフェーズ（Phase 6）へ進む』とご指示ください」**
> と明確にプロンプトして停止してください。

<!-- STOP -->

---

## Phase 6: ベロシティ記録 (Record Sprint Velocity)

対象スプリントのベロシティ集計（完了PBI数・合計ウェイト・実感サイズ一致率・乖離要約）を算出し、
スプリントの説明に記録します。

- **読み込むペルソナ**:
  - `[scrum-master.md](/.agents/rules/scrum-master.md)` (進行)
  - `[platform-engineer.md](/.agents/rules/platform-engineer.md)` (スクリプト実行・集計)
- **実行するスキル**:
  `[record-sprint-velocity](/.agents/skills/bundles/management-bundle/record-sprint-velocity/SKILL.md)`
- **入力（前提条件）**: 対象スプリントのPBIに実感サイズが対象PBIに記録されていること。
- **手続き**:
  1. PBI実績データ（実感サイズ / 見積サイズ）から完了PBI数・合計ウェイト・
     実感サイズ一致率・乖離要約を算出する。
  2. 集計結果をPOに提示し、承認を得る。
  3. ベロシティ情報をスプリントの説明に追記/更新する。
- **期待される結果（終了条件）**:
  1. ベロシティデータ（開発PBI数・合計ウェイト・実感サイズ一致率・乖離要約）がスプリントの説明に
     正しく記録されていること。
  2. ユーザー（PO）が記録内容を確認し、承認していること。

> [!IMPORTANT]
> 上記の「期待される結果」を満たすエビデンスを提示し、**「Phase 6
> が完了しました。よろしければ『次のフェーズ（Phase 7）へ進む』とご指示ください」**
> と明確にプロンプトして停止してください。

<!-- STOP -->

---

## Phase 7: スプリント評価の記録 (Record Sprint Metrics)

スプリント内の実績（完了した作業の規模・労力・ベロシティ）と各セッションの振り返りを確認し、実績と
振り返りに基づいてスプリント全体を評価する5つの指標（目標達成度 / 見積精度 / 品質維持 / 協働規律 /
ベロシティ）を記録します。マクロの呼出しタイミングは**実施する**です。

- **読み込むペルソナ**:
  - `[scrum-master.md](/.agents/rules/scrum-master.md)` (進行・ファシリテーション)
- **実行するスキル**:
  `[record-sprint-metrics](/.agents/skills/bundles/management-bundle/record-sprint-metrics/SKILL.md)`
- **入力（前提条件）**: 対象スプリントの振り返りが作成済みであること（`/sprint-start` の Phase 8
  `plan-retrospective`
  実施済み）。各作業パッケージのセッション振り返り・メトリクスが記録済みであること。
  ベロシティ集計値が算出済みであること（Phase 6 `record-sprint-velocity` 実施済み）。
- **手続き**:
  1. スプリントの実績（完了した作業パッケージの規模・労力、ベロシティ、各セッションの振り返り）を収集し、評価材料として整理する。
  2. 5指標のスコア（1〜5）とベロシティ値を PO と対話で確定する。
  3. dry-run で記録内容を確認し、POの承認後に本実行でスプリント評価を記録する。
- **期待される結果（終了条件）**:
  1. スプリント評価（5指標 + ベロシティ）が対象スプリントの振り返りに記録されていること。
  2. ユーザー（PO）が記録内容を確認し、承認していること。

> [!IMPORTANT]
> 上記の「期待される結果」を満たすエビデンスを提示し、**「Phase 7
> が完了しました。よろしければ『次のフェーズ（Phase 8）へ進む』とご指示ください」**
> と明確にプロンプトして停止してください。

<!-- STOP -->

---

## Phase 8: 振り返りのアーカイブ (Archive Retrospective)

対象スプリントの振り返りに KPT とスプリント評価が記録済みであることを確認し、振り返りを終了
（アーカイブ）します。マクロの呼出しタイミングは**保管する**です。

- **読み込むペルソナ**:
  - `[scrum-master.md](/.agents/rules/scrum-master.md)` (進行・ファシリテーション)
- **実行するスキル**:
  `[archive-retrospective](/.agents/skills/bundles/management-bundle/archive-retrospective/SKILL.md)`
- **入力（前提条件）**: 対象スプリントの振り返りが作成済みであること（`plan-retrospective`
  実施済み）。 `record-sprint-kpt` で KPT が記録済みであり、`record-sprint-metrics`
  でスプリント評価が記録済みであること。
- **手続き**:
  1. 対象の振り返りを参照し、KPT とスプリント評価が記録済みであることを PO と確認する。
  2. dry-run で終了（アーカイブ）する対象を確認し、POの承認後に本実行で振り返りを終了する。
- **期待される結果（終了条件）**:
  1. 対象スプリントの振り返りが終了（アーカイブ）されていること。
  2. ユーザー（PO）が結果を確認し、承認していること。

> [!IMPORTANT]
> 上記の「期待される結果」を満たすエビデンスを提示し、**「Phase 8
> が完了しました。よろしければ『次のフェーズ（Phase 9）へ進む』とご指示ください」**
> と明確にプロンプトして停止してください。

<!-- STOP -->

---

## Phase 9: 完了PBI/WPのアーカイブ (Archive Product Backlog Items)

スプリントで完了したWPとPBIを、クローズすることでアーカイブします。 アーカイブ順序は **WP →
PBI**（子先にクローズ）です。

- **読み込むペルソナ**:
  - `[scrum-master.md](/.agents/rules/scrum-master.md)` (進行・ファシリテーション)
- **実行するスキル**:
  `[archive-product-backlog-items](/.agents/skills/bundles/management-bundle/archive-product-backlog-items/SKILL.md)`
- **入力（前提条件）**: アーカイブ対象のPBI/WPが `[DONE]`（done, open）状態であること。
- **手続き**:
  1. スプリント内の完了済み（`[DONE]`）PBI/WP を一覧でPOに提示する。
  2. アーカイブ順序（WP→PBI）と対象をPOが承認する。
  3. 対象のWP/PBIを順にクローズする。
- **期待される結果（終了条件）**:
  1. 全対象WP/PBIがクローズ（`closed`）になっていること。
  2. ローカル `product-backlog-archive.md` との関係（本スキルはクローズのみを担い、
     ローカルへの書き込みは行わない）を PO が理解し承認していること。

> [!IMPORTANT]
> 上記の「期待される結果」を満たすエビデンスを提示し、**「Phase
> 9が完了しました。よろしければ『次のフェーズ（Phase 10）へ進む』とご指示ください」**
> と明確にプロンプトして停止してください。

<!-- STOP -->

---

## Phase 10: 自己スキルオプティマイザー (Skill Optimization)

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
> 10が完了しました。スキルのクリーンアップ・最適化案が提示されました。よろしければ『次のフェーズ（Phase
> 11）へ進む』とご指示ください」** と明確にプロンプトして停止してください。

<!-- STOP -->

---

## Phase 11: スプリント終了 (Sprint Conclusion)

すべてのスプリント後処理が完了したことを確認し、スプリントを終了状態にします。

- **読み込むペルソナ**: `[scrum-master.md](/.agents/rules/scrum-master.md)` (スクラムマスター)
- **実行するスキル**:
  `[conclude-sprint](/.agents/skills/bundles/management-bundle/conclude-sprint/SKILL.md)`
- **入力（前提条件）**: Phase 1〜10
  の全後処理（レビュー検証・effort分析・サイズ確定・メトリクス評価・スプリントKPT記録・ベロシティ記録・スプリント評価記録・振り返りアーカイブ・アーカイブ・スキル最適化）が完了し、POがスプリント終了を承認していること。
- **手続き**:
  1. `conclude-sprint` スキルの Quick-Start に従い、対象スプリント番号を確定する。
  2. dry-run で終了される Plan を PO に提示し、承認を得る。
  3. 本実行でスプリントを終了する。
- **期待される結果（終了条件）**:
  1. 対象スプリントが終了状態（closed）になっていること。

> [!IMPORTANT]
> 上記の「期待される結果」を満たすエビデンスを提示し、**「Phase
> 11が完了しました。よろしければ『次のフェーズ（Phase 12）へ進む』とご指示ください」**
> と明確にプロンプトして停止してください。

<!-- STOP -->

---

## Phase 12: ステートレスリセットの検討 (Stateless Reset)

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
> ワークフローがすべて完了しました！スプリント全体の儀式、effort分析、サイズ確定、メトリクス評価、スプリントKPT記録、ベロシティ記録、スプリント評価記録、振り返りアーカイブ、アーカイブ、スキル最適化、および環境のリセットが完了しました。次回スプリントはクリーンな状態で、新たに
> `/sprint-start` を呼び出して開始してください」** と宣言し、POの最終指示をお待ちください。

<!-- STOP -->
