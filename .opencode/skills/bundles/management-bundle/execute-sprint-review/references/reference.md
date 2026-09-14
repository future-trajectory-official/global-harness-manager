# execute-sprint-review 入力JSON形式

## 入力JSON

```json
{
  "scope": {
    "owner": "my-org",
    "repository": "my-repo"
  },
  "sprintNumber": 17,
  "overallResult": {
    "judgment": "pass",
    "reason": "All ACs satisfied"
  },
  "acGroups": [
    {
      "pbiNumber": 1,
      "wpNumber": 3,
      "acJudgments": [
        {
          "number": "2",
          "judgment": "pass",
          "description": "dry-run mode verified"
        }
      ]
    }
  ]
}
```

## フィールド説明

| フィールド                  | 必須     | 型     | 説明                                             |
| --------------------------- | -------- | ------ | ------------------------------------------------ |
| `scope`                     | 任意     | object | リポジトリ情報（省略時は自動解決）               |
| `scope.owner`               | 条件付き | string | GitHubオーナー名（scope指定時必須）              |
| `scope.repository`          | 条件付き | string | リポジトリ名（scope指定時必須）                  |
| `sprintNumber`              | 必須     | number | レビュー対象のスプリント番号（正の整数）         |
| `overallResult`             | 必須     | object | 全体判定結果                                     |
| `overallResult.judgment`    | 必須     | string | `"pass"` / `"conditional"` / `"fail"` のいずれか |
| `overallResult.reason`      | 任意     | string | 全体判定の理由                                   |
| `acGroups`                  | 必須     | array  | PBI/WPごとのAC判定結果の配列                     |
| `acGroups[].pbiNumber`      | 必須     | number | PBI番号                                          |
| `acGroups[].wpNumber`       | 必須     | number | WP番号                                           |
| `acGroups[].acJudgments`    | 必須     | array  | AC判定結果の配列                                 |
| `acJudgments[].number`      | 必須     | string | AC番号                                           |
| `acJudgments[].judgment`    | 必須     | string | `"pass"` / `"fail"` / `"conditional"` のいずれか |
| `acJudgments[].description` | 任意     | string | ACの説明または補足                               |

## 実行例

```bash
# dry-run
echo '{"sprintNumber":17,"overallResult":{"judgment":"pass","reason":"OK"},"acGroups":[{"pbiNumber":1,"wpNumber":3,"acJudgments":[{"number":"2","judgment":"pass"}]}]}' | deno run -A .agents/skills/bundles/management-bundle/execute-sprint-review/scripts/execute_sprint_review.ts --dry-run

# 本実行
echo '{"sprintNumber":17,"overallResult":{"judgment":"pass","reason":"OK"},"acGroups":[{"pbiNumber":1,"wpNumber":3,"acJudgments":[{"number":"2","judgment":"pass"}]}]}' | deno run -A .agents/skills/bundles/management-bundle/execute-sprint-review/scripts/execute_sprint_review.ts
```

## スクリプトの動作フロー

1. 入力JSONを標準入力から読み取り、バリデーションを実行
2. `--dry-run` フラグがある場合:
   - search → view → report → update の各StepをPlanとしてJSON出力
   - 実際のgh CLI操作は一切行わない
3. `--dry-run` フラグがない場合:
   - Review Issueをラベル `type:Review` で検索（search）
   - 該当スプリントのReview Issueを特定
   - Issue詳細を取得（find）
   - 全体判定とAC事後結果をIssue本文に追記、コメントを追加（report）
