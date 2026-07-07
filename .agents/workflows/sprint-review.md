---
description: スプリントレビューを意識合わせから検証実行まで段階的に行うワークフロー
---

# Sprint Review Workflow (`/sprint-review`)

このワークフローは、スプリント終了時のレビューを「何を・なぜ検証するか」の意識合わせから始め、バックログとReview
Issueの構造的整合性確認を経て、各ACの検証実行までを定義します。
本ワークフローは各スキルを呼び出す「ファサード（窓口）」として機能し、各フェーズにおける期待される結果（契約）を厳格に管理します。

## ワークフローの進行ルール

- 以下のフェーズを順番に実行します。
- 各フェーズでは、指定された **ペルソナ（ルールファイル）** を読み込み、その立場になりきって
  **スキル** を実行してください。
- AI
  はフェーズを跨いで先読みしてはなりません。1つのフェーズが完全に終了し、ユーザーから「次のフェーズへ」という承認を得てから、次のフェーズへ移行してください。
- **中断・再開時のルール**: ツールエラーやセッション中断からの復帰時は、必ず `[RECOVERY LOG]`
  において「現在 `/sprint-review` ワークフローの Phase X
  の途中である」と宣言し、文脈を同期してください。

---

## Phase 0: スプリントレビューの意識合わせ

POとレビューの目的・スコープを共有し、認識を揃えます。

- **読み込むペルソナ**:
  - `[scrum-master.md](/.agents/rules/scrum-master.md)` (進行・ファシリテーション)
  - `[tester.md](/.agents/rules/tester.md)` (品質検証・客観的エビデンス提示)
- **入力（前提条件）**:
  - 最新の
    `[product-backlog.md](/.agents/management/product-backlog.md)`（本スプリントのPBI/WP/AC一覧を含む）。
  - Review Issue（`plan-sprint-review` により事前作成済み）。
- **手続き**:
  1. AI は `product-backlog.md`
     から本スプリントのスプリントゴール、対象PBI数、WP数、AC総数を読み込み、内部コンテキストに保持する。
  2. POに以下の要約を提示する：
     > 「Sprint N のスプリントレビューを開始します。対象: M 件の PBI、N 件の
     > AC。実機デモ主体・エビデンス駆動で検証を進めます。」
  3. POがレビュー開始を合意したら、Phase 1 へ移行する。必要に応じて Phase 1
     のドリフトチェック実施有無を確認する。
- **期待される結果（終了条件）**:
  1. スプリントゴールとレビュースコープがPOと共有されていること。
  2. POがレビュー開始を承認し、次のフェーズへ進む指示を出したこと。

> [!IMPORTANT]
> 上記の「期待される結果」を満たすエビデンスを提示し、**「Phase
> 0が完了しました。よろしければ『次のフェーズ（Phase 1）へ進む』とご指示ください」**
> と明確にプロンプトしてください。

<!-- STOP -->

---

## Phase 1: アライメントチェックと計画最新化

現在のバックログ構成とReview Issueの検証計画を構造的に突合し、過不足があれば修正します。

- **読み込むペルソナ**:
  - `[scrum-master.md](/.agents/rules/scrum-master.md)` (進行・ファシリテーション)
  - `[tester.md](/.agents/rules/tester.md)` (品質検証・客観的エビデンス提示)
- **実行するスキル**:
  `[revise-sprint-review](/.agents/skills/bundles/management-bundle/revise-sprint-review/SKILL.md)`
- **入力（前提条件）**: Phase 0 完了。
- **手続き**:
  1. `revise-sprint-review examine` で現行の Review Issue を取得する。
  2. バックログの PBI/WP 構造と Review Issue の AC
     一覧を**構造的に突合**する（文字列比較ではない）。
     - **観点A**: Review Issue に存在する PBI/WP がバックログにも全て存在するか（削除された PBI
       に対応する AC が残っていないか）。
     - **観点B**: バックログに存在する PBI/WP が Review Issue にも全て存在するか（新規追加された PBI
       の AC が不足していないか）。
  3. 差分サマリーを PO に提示する。
  4. **差分あり**の場合: PO と変更内容を確定し、`revise-sprint-review revise` で計画を最新化する。
  5. **差分なし**の場合: そのまま Phase 2 へ進む。
- **期待される結果（終了条件）**:
  1. Review Issue の検証計画が最新のバックログ構成と整合していること。
  2. POが内容を確認し、次のフェーズへ進む指示を出したこと。

> [!IMPORTANT]
> 上記の「期待される結果」を満たすエビデンスを提示し、**「Phase
> 1が完了しました。よろしければ『次のフェーズ（Phase 2）へ進む』とご指示ください」**
> と明確にプロンプトしてください。

<!-- STOP -->

---

## Phase 2: スプリントレビュー実行

各ACの検証をPOと協働で実行し、結果をReview Issueに記録します。

- **読み込むペルソナ**:
  - `[scrum-master.md](/.agents/rules/scrum-master.md)` (進行・ファシリテーション)
  - `[tester.md](/.agents/rules/tester.md)` (品質検証・客観的エビデンス提示)
- **実行するスキル**:
  `[execute-sprint-review](/.agents/skills/bundles/management-bundle/execute-sprint-review/SKILL.md)`
- **入力（前提条件）**: Phase 1 完了（Review Issue の計画が最新であること）。
- **手続き**:
  1. `execute-sprint-review` の手順に従い、AC ごとに PO と検証を実行する。
  2. 各 AC の合否を判定し、エビデンスと共に記録する。
  3. エラーが発生した場合は PO に報告して中断し、復旧方針を協議する。
- **期待される結果（終了条件）**:
  1. 全 AC の合否が Review Issue に記録されていること。
  2. PO がレビュー結果を確認し、承認していること。

> [!IMPORTANT]
> 上記の「期待される結果」を満たすエビデンスを提示し、**「Phase
> 2が完了しました。スプリントレビューが完了しました。よろしければ次のアクション（例: `/sprint-end`
> の開始）をご指示ください」** と明確にプロンプトしてください。

<!-- STOP -->
