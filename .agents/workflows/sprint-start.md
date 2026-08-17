---
description: スプリントの開始プロセス（プロダクトゴール確認、プロダクトバックログリファインメント、分類階層改善、スプリント開始宣言、スプリントプランニング、作業分解、レビュー計画、振り返りの計画）を安全に1ステップずつ実行するワークフロー。
---

# Sprint Start Workflow (`/sprint-start`)

このワークフローは、スプリントの開始にあたり「何を・なぜ作るか（価値）」から「完了の基準（AC）」までをブレなく定義するためのものです。
本ワークフローは各スキルを呼び出す「ファサード（窓口）」として機能し、各フェーズにおける期待される結果（契約）を厳格に管理します。

## ワークフローの進行ルール

- 以下のフェーズを順番に実行します。
- 各フェーズでは、指定された **ペルソナ（ルールファイル）** を読み込み、その立場になりきって
  **スキル** を実行してください。
- AI
  はフェーズを跨いで先読みしてはなりません。1つのフェーズ（スキルの実行）が完全に終了し、ユーザーから「次のフェーズへ」という承認を得てから、次のフェーズへ移行してください。
- **中断・再開時のルール**: ツールエラーやセッション中断からの復帰時は、必ず `[RECOVERY LOG]`
  において「現在 `/sprint-start` ワークフローの Phase X
  の途中である」と宣言し、文脈を同期してください。
- **マクロタイミングの規約**: Retrospective ライフサイクルの「計画する」は Phase 8
  （`plan-retrospective`）で実行します。続く「実施する」（sprint-end の record-sprint-kpt /
  record-sprint-metrics）と「保管する」（sprint-end の archive-retrospective）は `/sprint-end`
  ワークフローで管理されます。

---

## Phase 1: プロダクトゴールの確認・ピボット (Product Goal Alignment)

スプリントの価値判断基準となるプロダクトゴールを確認し、継続またはピボットを判断します。

- **読み込むペルソナ**:
  - `[po-coach.md](/.agents/rules/po-coach.md)` (POコーチ)
  - `[scrum-master.md](/.agents/rules/scrum-master.md)` (スクラムマスター)
- **実行するスキル**:
  `[assess-goal-continuation](/.agents/skills/bundles/management-bundle/assess-goal-continuation/SKILL.md)`
- **入力（前提条件）**: 永続化されている最新の Product Goal。
- **手続き**:
  1. `assess-goal-continuation` スキルで現在の Product Goal を取得し、PO に提示する。
  2. PO と対話し、プロダクトゴールを継続するかピボットするかを判断する。
  3. 継続の場合はそのまま次のフェーズへ進む。
  4. ピボットの場合は、新しいゴールと変更理由を PO と合意し、pivot する。
  5. Product Goal が未作成の場合は、本スキルではなく
     `[set-product-goal](/.agents/skills/bundles/management-bundle/set-product-goal/SKILL.md)`
     を用いて作成するよう案内する。
- **期待される結果（終了条件）**:
  1. 現在の Product Goal が PO に提示されていること。
  2. 継続またはピボットが確定していること。

> [!IMPORTANT]
> 上記の「期待される結果」を満たすエビデンスを提示し、**「Phase
> 1が完了しました。よろしければ『次のフェーズ（Phase 2）へ進む』とご指示ください」**
> と明確にプロンプトしてください。

<!-- STOP -->

---

## Phase 2: プロダクトバックログリファインメント (Product Backlog Refinement)

POと対話しながら、プロダクトバックログを精査し、PBIの追加・変更・削除を行います。

- **読み込むペルソナ**: `[po-coach.md](/.agents/rules/po-coach.md)` (POコーチ) および
  `[scrum-master.md](/.agents/rules/scrum-master.md)` (スクラムマスター)
- **実行するスキル**:
  `[product-backlog-refinement](/.agents/skills/bundles/management-bundle/product-backlog-refinement/SKILL.md)`
- **入力（前提条件）**: 最新のプロダクトバックログ。
- **手続き**:
  1. `product-backlog-refinement` スキルの Quick-Start Step 1
     に従い、既存PBIを検索して一覧を提示する。
  2. POと対話し、PBIの追加・変更・削除を判断する。
  3. スプリントプランニング（Phase 5）の候補となるPBIにサイズを見積もる。
- **期待される結果（終了条件）**:
  1. プロダクトバックログが最新の優先順位と内容に更新されていること。
  2. スプリントプランニングの候補となるPBIのサイズが見積もられていること。

> [!IMPORTANT]
> 上記の「期待される結果」を満たすエビデンスを提示し、**「Phase
> 2が完了しました。よろしければ『次のフェーズ（Phase 3）へ進む』とご指示ください」**
> と明確にプロンプトしてください。

<!-- STOP -->

---

## Phase 3: 分類階層の改善とPBI配置 (Classification Hierarchy Refinement)

既存のエピック/フィーチャー分類階層を対話的に改善し、PBIを適切なフィーチャーに配置します。

- **読み込むペルソナ**: `[scrum-master.md](/.agents/rules/scrum-master.md)` (スクラムマスター)
- **実行するスキル**:
  `[refine-classification-hierarchy](/.agents/skills/bundles/management-bundle/refine-classification-hierarchy/SKILL.md)`
- **入力（前提条件）**: 既存のエピック/フィーチャー分類階層が存在すること。
- **手続き**: `refine-classification-hierarchy` スキルの Quick-Start に従い、既存階層の表示 →
  対話による再定義 → 親子関係変更 → PBI配置を段階的に行う。
- **期待される結果（終了条件）**:
  1. 既存の分類階層が表示され、エピック/フィーチャーの定義が最新化されていること。
  2. 必要に応じて親子関係の変更が行われていること。
  3. PBIが適切なフィーチャーに配置（または所属解除）されていること。

> [!IMPORTANT]
> 上記の「期待される結果」を満たすエビデンスを提示し、**「Phase
> 3が完了しました。よろしければ『次のフェーズ（Phase 4）へ進む』とご指示ください」**
> と明確にプロンプトしてください。

<!-- STOP -->

---

## Phase 4: スプリント開始宣言 (Sprint Kickoff)

リファインメントで定義されたスプリントゴールをもとに、スプリントを開始します。

- **読み込むペルソナ**: `[scrum-master.md](/.agents/rules/scrum-master.md)` (スクラムマスター)
- **実行するスキル**:
  `[begin-sprint](/.agents/skills/bundles/management-bundle/begin-sprint/SKILL.md)`
- **入力（前提条件）**: Phase 2 でスプリント番号・ゴールが確定済みであること。
- **手続き**:
  1. `begin-sprint` スキルの Quick-Start に従い、スプリントを作成する。
  2. 引き続きゴール文を PO からヒアリングし、スプリントゴールを設定する。
- **期待される結果（終了条件）**:
  1. スプリントが作成されていること。
  2. スプリントゴールが設定されていること。

> [!IMPORTANT]
> 上記の「期待される結果」を満たすエビデンスを提示し、**「Phase
> 4が完了しました。よろしければ『次のフェーズ（Phase 5）へ進む』とご指示ください」**
> と明確にプロンプトしてください。

<!-- STOP -->

---

## Phase 5: スプリントプランニング (Sprint Planning)

リファインメント済みのPBIから今回のスプリントで着手するものを選定し、スプリントバックログを確定します。

- **読み込むペルソナ**: `[scrum-master.md](/.agents/rules/scrum-master.md)` (スクラムマスター)
- **実行するスキル**:
  `[sprint-planning](/.agents/skills/bundles/management-bundle/sprint-planning/SKILL.md)`
- **入力（前提条件）**: Phase 2 でリファインメントされたプロダクトバックログ。
- **手続き**: `sprint-planning` スキルの Quick-Start に従い、スプリントバックログを選定・確定する。
- **期待される結果（終了条件）**:
  1. スプリントバックログが作成され、今回着手するPBIが確定していること。

> [!IMPORTANT]
> 上記の「期待される結果」を満たすエビデンスを提示し、**「Phase
> 5が完了しました。よろしければ『次のフェーズ（Phase 6）へ進む』とご指示ください」**
> と明確にプロンプトしてください。

<!-- STOP -->

---

## Phase 6: 作業分解 (Breakdown Workpackage)

スプリントに確定したPBIをタスク分解し、Work Package（WP）を作成します。
各WPにはACと初期見積りを同時に設定した上で、スプリントに確定します。

- **読み込むペルソナ**:
  - `[scrum-master.md](/.agents/rules/scrum-master.md)` (進行・ファシリテーション)
  - `[tester.md](/.agents/rules/tester.md)` (テスト/品質保証)
  - `[refactor.md](/.agents/rules/refactor.md)` (可読性・保守性・技術負債削減)
- **実行するスキル**:
  `[define-work-package](/.agents/skills/bundles/management-bundle/define-work-package/SKILL.md)`
- **入力（前提条件）**: Phase 5 で確定されたPBI一覧。
- **手続き**:
  1. POと対話しながら、各PBIを1セッションで完了可能なWPにタスク分解する。
  2. `define-work-package` スキルの Quick-Start Step 1
     に従い、WPを作成する。AC項目も同時に指定する。
  3. Step 2 で各WPに計画前effortを見積もる。
  4. 各WPをスプリントに確定する。
  5. スプリントレビュー時にAC達成をどう客観的に証明するか、その方法を定義する。
- **期待される結果（終了条件）**:
  1. 各PBIに対してWPが作成され、ACが設定されていること。
  2. 各WPに初期見積りが記録されていること。
  3. 各WPがスプリントに確定していること。
  4. 各ACに客観的な証明方法が定義されていること。

> [!IMPORTANT]
> 上記の「期待される結果」を満たすエビデンスを提示し、**「Phase
> 6が完了しました。よろしければ『次のフェーズ（Phase 7）へ進む』とご指示ください」**
> と明確にプロンプトしてください。

<!-- STOP -->

---

## Phase 7: スプリントレビュー計画 (Review Planning)

スプリント終了時に PO が各 PBI の AC 達成状況を検証するための検証計画を立案し、Review
エンティティを作成・永続化します。

- **読み込むペルソナ**:
  - `[scrum-master.md](/.agents/rules/scrum-master.md)` (進行・ファシリテーション)
  - `[tester.md](/.agents/rules/tester.md)` (品質検証・客観的エビデンス提示)
- **実行するスキル**:
  `[plan-sprint-review](/.agents/skills/bundles/management-bundle/plan-sprint-review/SKILL.md)`
- **入力（前提条件）**: Phase 6 で定義された全PBIのAC一覧。
- **手続き**: `plan-sprint-review`
  スキルの手順に従い、本スプリントのレビュー検証計画を立案し、Review
  エンティティを作成・永続化する。
- **期待される結果（終了条件）**:
  1. 本スプリントの全 AC に対する検証方法が決定されていること。
  2. レビュー検証計画が作成され、内容が確定していること。

> [!IMPORTANT]
> 上記の「期待される結果」を満たすエビデンスを提示し、**「Phase
> 7（スプリントレビュー計画）が完了しました。よろしければ『次のフェーズ（Phase
> 8）へ進む』とご指示ください」** と明確にプロンプトしてください。

<!-- STOP -->

---

## Phase 8: 振り返りの計画 (Retrospective Planning)

スプリント終了時に KPT とスプリント評価を記録するための、振り返り（Retrospective）を新規作成します。
マクロの呼出しタイミングは**計画する**です。

- **読み込むペルソナ**:
  - `[scrum-master.md](/.agents/rules/scrum-master.md)` (進行・ファシリテーション)
- **実行するスキル**:
  `[plan-retrospective](/.agents/skills/bundles/management-bundle/plan-retrospective/SKILL.md)`
- **入力（前提条件）**:
  対象スプリントの番号が判明しており、対象スプリントの振り返りが未作成であること。
- **手続き**:
  1. `plan-retrospective` スキルの Quick-Start に従い、対象スプリント番号を PO と確認する。
  2. dry-run で作成される振り返りの内容（タイトル・本文）を PO に提示し、承認を得る。
  3. 本実行で振り返りを新規作成する。
- **期待される結果（終了条件）**:
  1. 対象スプリントの振り返り（Retrospective）が作成されていること。
  2. スプリント終了時に `record-sprint-kpt` / `record-sprint-metrics`
     で内容を記録できる状態であること。

> [!IMPORTANT]
> 完了後、**「/sprint-start
> ワークフローがすべて完了しました。スプリント全体の計画・品質基準・振り返りが定義されました。AIのアテンションを最大化しハルシネーションを防ぐため、このスプリントの実作業は新規セッションを立ち上げて
> `/session-start` を呼び出すことを推奨します」** と宣言し、POの次の指示をお待ちください。

<!-- STOP -->
