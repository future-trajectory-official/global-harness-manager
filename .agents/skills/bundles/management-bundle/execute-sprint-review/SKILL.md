---
name: execute-sprint-review
description: スプリントレビューの検証を実行し、結果をReview Issueに報告する
tags:
  - trigger: execute-sprint-review
  - trigger: run-review
  - trigger: perform-review
  - trigger: verify-sprint
  - category: management
---

# execute-sprint-review

スプリント終了時に、POと協働して各PBIのAC達成状況を検証し、その結果をReview Issueに記録する。
本スキルは `plan-sprint-review` で作成された検証台帳をもとに、以下のフローを実行する：

1. Review Issueを取得し全AC一覧を把握
2. ACごとに検証を実行（テスト・スキル実行・ワークフロー実演・PO確認）
3. 結果をReview Issueに報告（合格/条件付き合格/不合格）

## Quick-Start

### Step 1: Review Issueを取得し、全AC一覧をPOに提示する

`execute-sprint-review` スクリプトで該当sprintのReview Issueを検索・取得し、
全AC一覧と各ACの検証方法をPOと共有する。検証スコープを合意する。

### Step 2: POと対話しながら各ACを検証する

ACごとにPOと以下の手段を組み合わせて検証を実行する：

- **自動テスト**: `deno test` / `deno task qa`
- **スキル実行**: 該当スキルのdry-runや本実行
- **ワークフロー実演**: PO指示に基づくワークフローの段階的実行
- **実機確認**: POによる目視確認や手動操作
- **コードレビュー**: 実装とACの整合性確認

各ACの合否とエビデンスを記録する。

<!-- STOP -->

### Step 3: 判定結果をJSONにまとめ、dry-runで確認 → PO承認 → 本実行

```bash
# dry-run
echo '<JSON>' | deno run -A .agents/skills/bundles/management-bundle/execute-sprint-review/scripts/execute_sprint_review.ts --dry-run

# 本実行（PO承認後）
echo '<JSON>' | deno run -A .agents/skills/bundles/management-bundle/execute-sprint-review/scripts/execute_sprint_review.ts
```

## 詳細手順

### Phase 1: 準備（Review Issueの取得）

1. sprint番号からReview Issueを検索する
2. Issue詳細を取得し、全AC一覧と各ACの検証方法（verificationPlan）を表示する
3. POと検証スコープを合意する（全ACを検証するか、一部のみとするか）

### Phase 2: ACごとの検証

ACごとに以下を実施する：

1. **AC内容の確認**: POとACの内容を再確認する
2. **検証の実行**: 以下の手段を組み合わせて検証する
   - `deno test` / `deno task qa` の実行結果確認
   - 該当スキルのdry-runや本実行による動作確認
   - POの指示に基づくワークフローの段階的実行
   - POによる目視確認や手動操作
   - 実装とACの整合性をコードレベルで確認
3. **エビデンスの収集**: テスト結果・実行ログ・スキル出力・PO確認の記録を残す
4. **POとの合否確認**: POに検証結果とエビデンスを提示し、合否を確定する

### Phase 3: POによる実機動作確認

1. AIが実施した検証結果をPOに報告する
2. PO自身が実機で動作確認を実施する（コマンド実行・画面確認等）
3. AIはPOの確認に立ち会い、必要に応じて補足説明する
4. POが納得したACのみ合格と判定する

### Phase 4: 総合判定と報告

1. 全ACの判定結果をPOに提示し、Overall Result（pass/conditional/fail）を確定する
2. 結果を以下のJSON形式に整形する：

```json
{
  "sprintNumber": 17,
  "overallResult": {
    "judgment": "pass",
    "reason": "全ACの検証が完了し、合格を確認"
  },
  "acGroups": [
    {
      "pbiNumber": 1,
      "wpNumber": 3,
      "acJudgments": [
        {
          "number": "2",
          "judgment": "pass",
          "description": "dry-runモードが正常動作"
        }
      ]
    }
  ]
}
```

3. dry-runでPlanを確認し、POの承認を得る
4. 本実行でReview Issueを更新する

## 入力JSON形式

入力JSONの詳細な形式と各フィールドの説明は
[references/reference.md](/.agents/skills/bundles/management-bundle/execute-sprint-review/references/reference.md)
を参照すること。
