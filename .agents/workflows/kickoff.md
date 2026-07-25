---
description: プロジェクトの立ち上げ（キックオフ）を、情熱の検証から技術選定まで段階的に行い、開発開始の合意を形成するワークフロー。
---

# Kickoff Workflow (`/kickoff`)

このワークフローは、新規プロジェクトの立ち上げ、または既存プロジェクトの大幅なピボット時に使用します。
各フェーズでは、目的の検証から技術選定までを「異なる専門家（ペルソナ）」と共に行うことで、死角のない堅牢なスタート地点を構築します。

## ワークフローの進行ルール

- 以下のフェーズを順番に実行します。
- 各フェーズでは、指定された **ペルソナ（ルールファイル）** を読み込み、その立場になりきって
  **スキル** を実行してください。
- AI
  はフェーズを跨いで先読みしてはなりません。1つのフェーズ（スキルの実行）が完全に終了し、ユーザーから「次のフェーズへ」という承認を得てから、次のフェーズへ移行してください。

---

## Phase 0: 構想と情熱の検証 (Context Gathering)

まずは、ビジネス的な価値だけでなく、ユーザー自身の「やりたい」という情熱と覚悟を検証します。

- **読み込むペルソナ**: `[investor.md](/.agents/rules/investor.md)` (エンジェル投資家)
- **実行するスキル**: `gather-project-context`
- **終了条件**: ユーザーが情熱と覚悟を示し、`project-context.md`
  を作成する（またはプロジェクト化の保留を決断する）こと。

<!-- STOP -->

## Phase 1: ビジョンの策定 (Vision Crafting)

プロジェクトの「北極星」となる価値とターゲットを言語化します。

- **読み込むペルソナ**: `[po-coach.md](/.agents/rules/po-coach.md)` (POコーチ)
- **実行するスキル**: `craft-vision`
- **終了条件**: ユーザーがステートメントに合意し、`[VISION.md](/.agents/management/VISION.md)`
  が生成されること。

<!-- STOP -->

## Phase 2: プロダクトゴールの定義 (Goal Setting)

ビジョンを、計測可能な具体的な最初のゴールへと落とし込みます。

- **読み込むペルソナ**: `[po-coach.md](/.agents/rules/po-coach.md)` (POコーチ)
- **実行するスキル**: `define-product-goal`
- **終了条件**: `[product-backlog.md](/.agents/management/product-backlog.md)`（ゴールセクション）と
  `[epic-master.md](/.agents/management/epic-master.md)` の骨格が生成されること。

<!-- STOP -->

## Phase 3: 技術スタックの選定 (Tech Stack Selection)

ゴールを実現するための技術基盤を、トレードオフを比較しながら選定します。

- **読み込むペルソナ**: `[technical-advisor.md](/.agents/rules/technical-advisor.md)` (技術顧問)
- **実行するスキル**: `select-tech-stack`
- **終了条件**: ユーザーが技術的負債やコストを理解した上で選定を行い、`tech-stack-decision.md`
  が生成されること。

<!-- STOP -->

## Phase 4: アライメントの最終検証 (Alignment Confirmation)

全フェーズの成果物に矛盾がないか検証し、最終的な開始の決断を行います。

- **読み込むペルソナ**: `[devils-advocate.md](/.agents/rules/devils-advocate.md)` (悪魔の代弁者)
  ※ユーザーが「座談会モード」を希望した場合は、これまでの全ペルソナ（投資家、POコーチ、技術顧問）を総動員すること。
- **実行するスキル**: `confirm-kickoff-alignment`
- **終了条件**: ユーザーが最終的な「Go」を出し、Antigravity
  のアーティファクト機能（Walkthrough）でキックオフ完了サマリーが提示されること。

<!-- STOP -->
