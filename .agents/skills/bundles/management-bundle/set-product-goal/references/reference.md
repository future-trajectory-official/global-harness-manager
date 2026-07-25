# set-product-goal 入力JSON形式

## 入力JSON

```json
{
  "scope": {
    "owner": "my-org",
    "repository": "my-repo"
  },
  "title": "Product Goal",
  "description": "ガバナンスを進化させ、POの確認負荷を最小化する"
}
```

## フィールド説明

| フィールド         | 必須     | 型     | 説明                                |
| ------------------ | -------- | ------ | ----------------------------------- |
| `scope`            | 任意     | object | リポジトリ情報（省略時は自動解決）  |
| `scope.owner`      | 条件付き | string | GitHubオーナー名（scope指定時必須） |
| `scope.repository` | 条件付き | string | リポジトリ名（scope指定時必須）     |
| `title`            | 必須     | string | プロダクトゴールのタイトル          |
| `description`      | 必須     | string | ゴールの記述（アウトカムで表現）    |

## 実行例

```bash
# dry-run
echo '{"title":"Product Goal","description":"ガバナンスの進化"}' | deno run -A .agents/skills/bundles/management-bundle/set-product-goal/scripts/set_product_goal.ts --dry-run

# 本実行
echo '{"title":"Product Goal","description":"ガバナンスの進化"}' | deno run -A .agents/skills/bundles/management-bundle/set-product-goal/scripts/set_product_goal.ts
```

## スクリプトの動作フロー

1. 入力JSONを標準入力から読み取り、バリデーションを実行
2. `--dry-run` フラグがある場合:
   - Plan（create + comment の2 Step）をJSON出力
   - 実際の操作は一切行わない
3. `--dry-run` フラグがない場合:
   - Gateway経由でPlanを実行（重複チェック付き）
   - 実行結果をJSON出力
