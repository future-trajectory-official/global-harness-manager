---
name: begin-sprint
description: スプリントの枠組みを作成し、ゴールを設定する。
tags:
  - trigger: begin-sprint
  - trigger: start-sprint
  - category: management
---

# begin-sprint

スプリントの枠組みを作成し、ゴールを設定する。

## スキルの事前条件

POが新しいスプリントを開始する意思決定をしていること。

## スクリプトの前提条件（対話で確定する値）

- Phase 1: スプリント番号 — POとの対話により確定
- Phase 2: スプリント番号 + ゴール文 + Phase 1 の実行結果から抽出したスプリントの識別情報

## 事後条件

新たなスプリントの枠組みが作成され、ゴールが設定されている。

## Quick-Start

### Phase 1: スプリント開始

以下の手順でスプリントの枠組みを作成する。

1. **最新状態の確認（GitHub実体）**: まず `read-project-state` で最新スプリントの状態を確認する。
   ローカルファイル推測ではなく、マイルストーン実体（Source of Truth）を参照すること。
   ```bash
   # 完了済みスプリントの一覧を確認（CLOSED一覧の最上位が最新 → 次の番号はその次）
   echo '{"entityType":"Sprint","operation":"search","params":{"state":"closed"}}' | deno run -A .agents/skills/bundles/management-bundle/read-project-state/scripts/read_project_state.ts
   # 進行中のスプリントがあればこちらで確認（OPENの最新）
   echo '{"entityType":"Sprint","operation":"find","params":{}}' | deno run -A .agents/skills/bundles/management-bundle/read-project-state/scripts/read_project_state.ts
   ```
2. **スプリント番号の確定**: 上記の確認結果（最新CLOSEDスプリントの次番号）をPOに提示し、確定する。
3. **スクリプトの実行（dry-run）**: 確定したスプリント番号を入力として dry-run を実行し、作成される
   Plan を PO に提示する。
   ```bash
   echo '{"sprintNumber": N}' | deno run -A .agents/skills/bundles/management-bundle/begin-sprint/scripts/begin_sprint.ts --dry-run
   ```
4. **PO承認**: Plan の内容を PO が確認し、承認する。
5. **本実行**: PO承認後、本実行を行いスプリントを作成する。
   ```bash
   echo '{"sprintNumber": N}' | deno run -A .agents/skills/bundles/management-bundle/begin-sprint/scripts/begin_sprint.ts
   ```

<!-- STOP -->

### Phase 2: スプリントゴール設定

以下の手順でスプリントゴールを設定する。 Phase 1
の本実行結果から、作成されたスプリントを特定するための識別情報を抽出し、入力に含めること。

1. **識別情報の抽出**: Phase 1 の実行結果から、作成されたスプリントの識別情報を抽出する。
2. **ゴールのヒアリング**:
   POから今回のスプリントゴールをヒアリングする。「今回は何を達成したいですか？」
   「このスプリントの価値は何ですか？」等の質問で具体化する。
3. **スクリプトの実行（dry-run）**: スプリント番号とゴール文を入力として dry-run
   を実行し、POに提示する。
   ```bash
   echo '{"sprintNumber": N, "goal": "スプリントゴール文"}' | deno run -A .agents/skills/bundles/management-bundle/begin-sprint/scripts/begin_sprint.ts --dry-run
   ```
4. **PO承認**: ゴール文と作成される Plan を PO が確認し、承認する。
5. **本実行**: PO承認後、本実行を行いゴールを設定する。
   ```bash
   echo '{"sprintNumber": N, "goal": "スプリントゴール文"}' | deno run -A .agents/skills/bundles/management-bundle/begin-sprint/scripts/begin_sprint.ts
   ```

<!-- STOP -->
