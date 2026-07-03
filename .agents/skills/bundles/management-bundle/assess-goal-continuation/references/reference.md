# assess-goal-continuation 入力JSON形式

## 入力JSON

### 確認フェーズ（pivot省略時）

```json
{
  "scope": {
    "owner": "my-org",
    "repository": "my-repo"
  },
  "title": "Product Goal"
}
```

### 更新フェーズ（pivot入力時）

```json
{
  "scope": {
    "owner": "my-org",
    "repository": "my-repo"
  },
  "title": "Product Goal",
  "pivot": {
    "description": "ガバナンスの自動化へ進化",
    "reason": "手動確認の限界に達したため",
    "code": "42"
  }
}
```

## フィールド説明

| フィールド          | 必須     | 型     | 説明                                               |
| ------------------- | -------- | ------ | -------------------------------------------------- |
| `scope`             | 任意     | object | リポジトリ情報（省略時は自動解決）                 |
| `scope.owner`       | 条件付き | string | GitHubオーナー名（scope指定時必須）                |
| `scope.repository`  | 条件付き | string | リポジトリ名（scope指定時必須）                    |
| `title`             | 必須     | string | ProductGoalのタイトル                              |
| `pivot`             | 任意     | object | ピボット情報（省略時は確認フェーズ）               |
| `pivot.description` | 条件付き | string | 新しいゴールの記述（pivot指定時必須）              |
| `pivot.reason`      | 条件付き | string | 変更理由（pivot指定時必須）                        |
| `pivot.code`        | 条件付き | string | Issue番号（pivot指定時必須。Step 1の出力から取得） |

## 実行例

```bash
# 確認フェーズ dry-run
echo '{"title":"Product Goal"}' | deno run -A .agents/skills/bundles/management-bundle/assess-goal-continuation/scripts/assess_goal_continuation.ts --dry-run

# 確認フェーズ 本実行
echo '{"title":"Product Goal"}' | deno run -A .agents/skills/bundles/management-bundle/assess-goal-continuation/scripts/assess_goal_continuation.ts

# 更新フェーズ dry-run
echo '{"title":"Product Goal","pivot":{"description":"New goal","reason":"Changed","code":"42"}}' | deno run -A .agents/skills/bundles/management-bundle/assess-goal-continuation/scripts/assess_goal_continuation.ts --dry-run

# 更新フェーズ 本実行
echo '{"title":"Product Goal","pivot":{"description":"New goal","reason":"Changed","code":"42"}}' | deno run -A .agents/skills/bundles/management-bundle/assess-goal-continuation/scripts/assess_goal_continuation.ts
```

## スクリプトの動作フロー

### 確認フェーズ（pivot省略時）

1. 入力JSONを標準入力から読み取り、バリデーションを実行
2. `--dry-run`時: search + view のPlanをJSON出力
3. 本実行時: search → view でProductGoalを取得し、内容とcode（Issue番号）を出力

### 更新フェーズ（pivot入力時）

1. 入力JSONを標準入力から読み取り、バリデーションを実行
2. `--dry-run`時: pivot Plan（update + comment）をJSON出力
3. 本実行時: view でnode-idを解決 → pivotを実行 → 結果を出力
