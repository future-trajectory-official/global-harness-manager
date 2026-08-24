# product-backlog-refinement リファレンス

## 業務概要

スプリントプランニングにおいて、POとの対話を通じて今回のスプリントで開発するPBIを選定・確定する。
確定したPBIはスプリントバックログとして管理される。

## 操作一覧

| 操作         | スクリプト             | ユースケース                          |
| ------------ | ---------------------- | ------------------------------------- |
| PBI検索      | `search_pbi.ts`        | 既存PBIの条件検索（読み取り専用）     |
| PBI発案      | `propose_pbi.ts`       | 新規PBIのIdea作成                     |
| サイズ見積り | `estimate_pbi_size.ts` | PBIへのサイズ（XS/S/M/L/XL）設定      |
| PBI更新      | `update_pbi.ts`        | PBIのサマリー・成果物・証明方法を更新 |

---

## search_pbi.ts — PBI検索

既存のPBIを検索する。読み取り専用。結果は後続スクリプトの識別子入力に利用する。

### 入力パラメータ

| パラメータ     | 型       | 必須 | 説明                                                                       |
| -------------- | -------- | ---- | -------------------------------------------------------------------------- |
| `keyword`      | `string` | 任意 | タイトル・本文の全文検索キーワード。**未実装**のため指定するとエラーを返す |
| `sprintNumber` | `number` | 任意 | 所属するスプリント番号でフィルタ                                           |
| `status`       | `string` | 任意 | ステータスでフィルタ（例: `"idea"`, `"todo"`, `"inProgress"`, `"done"`）   |
| `state`        | `string` | 任意 | 状態でフィルタ（`"open"`, `"closed"`, `"all"`）                            |

全フィールド省略可能。省略した条件は絞り込まれない。

### 実行例

```bash
# dry-run
echo '{"sprintNumber": 19}' | deno run -A .agents/skills/bundles/management-bundle/product-backlog-refinement/scripts/search_pbi.ts --dry-run

# 本実行
echo '{"sprintNumber": 19}' | deno run -A .agents/skills/bundles/management-bundle/product-backlog-refinement/scripts/search_pbi.ts
```

---

## propose_pbi.ts — PBI発案

新規PBIをIdea状態で作成する。親Featureに紐付けることも可能。

### 入力パラメータ

| パラメータ      | 型                  | 必須 | 説明                                                               |
| --------------- | ------------------- | ---- | ------------------------------------------------------------------ |
| `title`         | `string`            | 必須 | PBIのタイトル                                                      |
| `summary`       | `string`            | 必須 | PBIの概要説明                                                      |
| `artifacts`     | `Artifacts`         | 任意 | 成果物の分類構造。`{categories: [{name, items: [{description}]}]}` |
| `proofMethod`   | `string`            | 任意 | 証明方法（例: `"E2Eテスト"`, `"コードレビュー"`）                  |
| `parentFeature` | `{title, id, code}` | 任意 | 親Featureの識別子。`id` は必須                                     |

`artifacts` はL2仕様（design-spec.md PBI Body推奨構造）に基づくカテゴリ階層形式である。`string[]`
の簡易リストは受け付けない（`TypeError: statement.artifacts.categories is not iterable`）。

```json
// artifacts の入力形式
{
  "categories": [
    {
      "name": "実装成果物",
      "items": [
        { "description": "SKILL.md + references" },
        { "description": "Domain層修正" }
      ]
    }
  ]
}
```

### 実行例

```bash
# dry-run（artifacts はカテゴリ階層形式）
echo '{"title":"New feature","summary":"Implement user authentication","artifacts":{"categories":[{"name":"成果物","items":[{"description":"UI mockup"},{"description":"API spec"}]}]}}' | deno run -A .agents/skills/bundles/management-bundle/product-backlog-refinement/scripts/propose_pbi.ts --dry-run

# 本実行
echo '{"title":"New feature","summary":"Implement user authentication"}' | deno run -A .agents/skills/bundles/management-bundle/product-backlog-refinement/scripts/propose_pbi.ts
```

---

## estimate_pbi_size.ts — サイズ見積り

既存PBIにサイズ見積り（Tシャツサイズ）を設定する。

### 入力パラメータ

| パラメータ   | 型                  | 必須 | 説明                                                   |
| ------------ | ------------------- | ---- | ------------------------------------------------------ |
| `identifier` | `{title, id, code}` | 必須 | PBIの識別子。`id` は必須                               |
| `size`       | `string`            | 必須 | サイズ。`"XS"`, `"S"`, `"M"`, `"L"`, `"XL"` のいずれか |

### 実行例

```bash
# dry-run（id に node-id、code に Issue番号を指定）
echo '{"identifier":{"title":"PBI title","id":"I_kwDOR5-zI88AAAABMOdNyg","code":"655"},"size":"M"}' | deno run -A .agents/skills/bundles/management-bundle/product-backlog-refinement/scripts/estimate_pbi_size.ts --dry-run

# 本実行
echo '{"identifier":{"title":"PBI title","id":"I_kwDOR5-zI88AAAABMOdNyg","code":"655"},"size":"M"}' | deno run -A .agents/skills/bundles/management-bundle/product-backlog-refinement/scripts/estimate_pbi_size.ts
```

---

## update_pbi.ts — PBI更新

既存PBIのサマリー・成果物・証明方法を更新する。

### 入力パラメータ

| パラメータ    | 型                  | 必須 | 説明                           |
| ------------- | ------------------- | ---- | ------------------------------ |
| `identifier`  | `{title, id, code}` | 必須 | 更新対象PBIの識別子。`id` 必須 |
| `summary`     | `string`            | 必須 | 新しいサマリー                 |
| `artifacts`   | `string[]`          | 任意 | 成果物リスト                   |
| `proofMethod` | `string`            | 任意 | 証明方法                       |
| `reason`      | `{description}`     | 必須 | 変更理由                       |

### 実行例

```bash
# dry-run（id に node-id、code に Issue番号を指定）
echo '{"identifier":{"title":"PBI title","id":"I_kwDOR5-zI88AAAABMOdNyg","code":"655"},"summary":"Updated summary","reason":{"description":"POからの指示により仕様変更"}}' | deno run -A .agents/skills/bundles/management-bundle/product-backlog-refinement/scripts/update_pbi.ts --dry-run

# 本実行
echo '{"identifier":{"title":"PBI title","id":"I_kwDOR5-zI88AAAABMOdNyg","code":"655"},"summary":"Updated summary","reason":{"description":"POからの指示により仕様変更"}}' | deno run -A .agents/skills/bundles/management-bundle/product-backlog-refinement/scripts/update_pbi.ts
```
