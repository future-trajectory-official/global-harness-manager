# plan-sprint-review リファレンス

## スプリントレビュー計画の立案手順

スプリントレビューは、以下の流れで運用される：

1. **計画（本スキル）**: レビューの枠組みを作成し、どのスプリントを対象とするかを記録する
2. **実施（`execute-sprint-review`）**: 各PBIのAC達成状況を確認し、合否を記録する
3. **完了（`archive-sprint-review`）**: レビュー結果を確定し、クローズする

本スキルは「1. 計画」フェーズに該当する。

### このスキルがやること

- レビュー対象スプリントの確定と永続化
- レビュー記録の枠組み（後続のスキルがAC判定を追記するための入れ物）を作成する

### このスキルがやらないこと

- PBIやWPのACに対する合否判定の記録（`execute-sprint-review`）
- レビューの完了処理（`archive-sprint-review`）

## 入力 JSON の形式

```json
{
  "sprintNumber": 17,
  "reviewTitle": "Sprint 17 Review"
}
```

### 各フィールドの説明

| フィールド     | 必須 | 説明                                                                                          |
| -------------- | ---- | --------------------------------------------------------------------------------------------- |
| `sprintNumber` | 必須 | レビューを実施するスプリントの番号（例: 17 → Sprint 17 のレビューを計画する）                 |
| `reviewTitle`  | 任意 | レビュー計画の名称。省略時は "Sprint {n} Review" となる。カスタム名称を付けたい場合に指定する |

## 実行例

```bash
# Sprint 17 のレビュー計画を立案する
echo '{"sprintNumber": 17}' | deno run -A .agents/skills/bundles/management-bundle/plan-sprint-review/scripts/plan_sprint_review.ts --dry-run
```

### dry-run 出力例

```json
{
  "summary": "Plan review: Sprint 17 Review",
  "steps": [
    {
      "entity": "Review",
      "operation": "plan",
      "params": {
        "title": "Sprint 17 Review",
        "body": "## Sprint Review\n\n- **Sprint**: Sprint 17"
      }
    },
    {
      "entity": "Review",
      "operation": "update",
      "params": {
        "itemId": null,
        "body": "Review planned for Sprint 17"
      }
    }
  ]
}
```

## スプリントレビュー記録の内容

レビュー計画の立案後、レビュー記録は以下のような構成で管理される：

### 初期状態（計画立案直後）

- タイトルに "Sprint {n} Review" と対象スプリントが明記される
- 本文にスプリント番号が記録される

### レビュー実施後（`execute-sprint-review` により追記される情報）

- **凡例**: 各ACの判定結果の見方（✅合格 / ⚠️条件付き / ❌不合格 / ➖論理削除 / ❔未確認）
- **実施環境**: レビューを実施した環境（サンドボックス等）
- **総合判定**: スプリント全体として合格／条件付き合格／不合格
- **判定理由**: POからのフィードバックコメント
- **計画時確認項目**: スプリント開始時に計画されたPBI/WPごとのAC判定結果
- **計画後確認項目**: スプリント中に追加・変更されたPBI/WPごとのAC判定結果

## エラーハンドリング

- `sprintNumber` が指定されていない、またはスプリント番号として不正 →
  エラーが返され、処理は中断される
- システム的な接続障害 → エラーが報告され、処理は中断される
