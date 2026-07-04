# revise-sprint-review リファレンス

## このスキルがやること

- 対象スプリントの Review Issue を `examine` サブコマンドで取得する
- 取得した Review 本文を AI が内部で保持し、PO には AC を 1 つずつ提示して確認する
- スプリントゴールおよび PBI Body を対比軸に、Review の AC が意味的にカバーできているかを PO
  と確定する
- 確定した変更点を `revise` サブコマンドで Review Issue に一括反映する

## このスキルがやらないこと

- バックログの自動パースや差分の自動検出（PO が確定した変更点を入力 JSON として受け取る）
- AC 合否判定の実行（`execute-sprint-review`）
- レビューの完了処理（`archive-sprint-review`）

---

## `examine` サブコマンド

### 用途

対象の Review Issue を検索・取得し、現在の本文を PO と確認するための読み取り専用コマンド。

### 入力 JSON

```json
{
  "sprintNumber": 17
}
```

または、Issue 番号が既知の場合：

```json
{
  "code": "42"
}
```

### 実行例

```bash
echo '{"sprintNumber": 17}' | deno run -A .agents/skills/bundles/management-bundle/revise-sprint-review/scripts/revise_sprint_review.ts examine
```

### 出力例

```json
{
  "sprintNumber": 17,
  "reviewTitle": "Sprint 17 Review",
  "issueNumber": 42,
  "body": "## 凡例\n..."
}
```

---

## PO 対話フロー（AC 1 つずつの意味確認）

### 対話の進め方

1. **文脈を取得する**
   - スプリントゴールと各 PBI Body を確認材料として保持する（ワークフロー文脈、または
     `.agents/management/product-backlog.md` 等から取得）
   - 将来的には `plan-sprint-review` 実行時にこれらを Review Issue 本文内に埋め込む（WP_b で対応）

2. **Review の AC を 1 つずつ確認する**
   - 対象の AC を PO に提示する
   - 「この AC は『スプリントゴール / PBI Body のどの部分』を検証するか」を説明する
   - PO と認識のずれやカバレッジ不足がないか確認する
   - 不要になった AC、追加が必要な AC、変更が必要な AC をメモする

3. **追加 AC が発生した場合**
   - 追加 AC は「スプリント中追加検証計画」セクションに追記される
   - 追加 WP の番号は命名規則に従い、アルファベット suffix（例: `WP_a`）を使用する

### 変更点確定後のサマリー提示

対話が終了したら、以下の形式で PO に変更点サマリーを提示し、最終確認を得る：

```markdown
## 変更点サマリー

### 削除 AC

- AC_1: 削除理由

### 追加 AC

- PBI 1 / WP_a / AC_1: 追加ACの説明

### 変更理由（全体）

スプリント中の仕様変更により...
```

---

## `revise` サブコマンド

### 入力 JSON の形式

```json
{
  "sprintNumber": 17,
  "changeReason": "スプリント中の仕様変更により AC2 が不要になり、新規 WP_a の AC を追加",
  "removed": {
    "items": [
      { "number": "2", "description": "旧ACの説明" }
    ]
  },
  "addedGroups": [
    {
      "pbiNumber": 1,
      "pbiTitle": "[Sprint17/WorkflowMigration]/Replace-workflows-with-new-skills",
      "wpNumber": 1,
      "wpTitle": "revise-sprint-review スキル新設",
      "acJudgments": [
        { "number": "1", "description": "新規ACの説明" }
      ]
    }
  ]
}
```

### 各フィールドの説明

| フィールド                                | 必須                    | 説明                                                                                   |
| ----------------------------------------- | ----------------------- | -------------------------------------------------------------------------------------- |
| `sprintNumber`                            | `code` 未指定時         | レビュー対象のスプリント番号。`code` とのどちらか一方が必須                            |
| `code`                                    | `sprintNumber` 未指定時 | Review Issue の番号。既知の場合はこちらを優先                                          |
| `changeReason`                            | 必須                    | 変更の理由。空文字は不可                                                               |
| `removed`                                 | 任意                    | 論理削除（➖）する既存 AC の一覧                                                       |
| `removed.items[].number`                  | 必須                    | 削除対象 AC の番号                                                                     |
| `removed.items[].description`             | 必須                    | 削除対象 AC の説明（Issue 本文置換用）                                                 |
| `addedGroups`                             | 任意                    | 「スプリント中追加検証計画」セクションに追記する AC 群                                 |
| `addedGroups[].pbiNumber`                 | 必須                    | 追加 AC の属する PBI 番号                                                              |
| `addedGroups[].pbiTitle`                  | 任意                    | PBI タイトル（表示用）                                                                 |
| `addedGroups[].wpNumber`                  | 必須                    | 追加 AC の属する WP 番号。途中追加の WP はアルファベット suffix（例: `"a"`）を使用する |
| `addedGroups[].wpTitle`                   | 任意                    | WP タイトル（表示用）                                                                  |
| `addedGroups[].acJudgments[].number`      | 必須                    | 追加 AC の番号                                                                         |
| `addedGroups[].acJudgments[].description` | 必須                    | 追加 AC の説明                                                                         |

### 実行例

```bash
# dry-run
echo '{"sprintNumber":17,"changeReason":"仕様変更","removed":{"items":[{"number":"2","description":"旧AC"}]}}' | deno run -A .agents/skills/bundles/management-bundle/revise-sprint-review/scripts/revise_sprint_review.ts revise --dry-run

# 本実行
echo '{"sprintNumber":17,"changeReason":"仕様変更","removed":{"items":[{"number":"2","description":"旧AC"}]}}' | deno run -A .agents/skills/bundles/management-bundle/revise-sprint-review/scripts/revise_sprint_review.ts revise
```

### dry-run 出力の解釈

`--dry-run` 時は `ReviewUseCase.revise` が生成した Plan が JSON で出力される。実際の `gh issue edit`
は実行されない。

```json
{
  "summary": "Revise review: Sprint 17 Review",
  "steps": [
    {
      "entity": "Review",
      "operation": "revise",
      "params": {
        "itemId": "42",
        "removed": { ... },
        "addedGroups": [ ... ]
      }
    }
  ]
}
```

PO は `itemId`、`removed`、`addedGroups` の内容を確認し、承認する。

---

## エラーハンドリング

| エラー                                                   | 原因                                       | 対処                                         |
| -------------------------------------------------------- | ------------------------------------------ | -------------------------------------------- |
| `INVALID_INPUT: either sprintNumber or code is required` | `sprintNumber` と `code` の両方が未指定    | 対象 Review Issue を特定できる情報を入力する |
| `INVALID_INPUT: sprintNumber must be a positive integer` | `sprintNumber` が 1 未満または小数         | 正の整数を指定する                           |
| `INVALID_INPUT: code must be a string`                   | `code` が数値等                            | 文字列で指定する                             |
| `INVALID_INPUT: changeReason is required`                | `changeReason` が未指定                    | 変更理由を入力する                           |
| `INVALID_INPUT: changeReason must not be empty`          | `changeReason` が空文字                    | 具体的な変更理由を入力する                   |
| `No Review Issue found for Sprint N`                     | 該当スプリントの Review Issue が存在しない | `plan-sprint-review` で事前に作成する        |

---

## 巻き戻し手順

本実行後に Issue 本文が意図と異なる場合は、以下のいずれかで巻き戻す：

1. `gh issue view <number> --json body` で実行前の内容を確認できる場合は、取得済みの本文を
   `gh issue edit <number> --body-file` で復元する
2. 実行前の本文が取得できない場合は、GitHub Web UI の Issue 編集履歴から復元する
3. 巻き戻し後、再度 `revise --dry-run` で確認してから本実行する

---

## 注意事項

- `removed` に存在しない AC 番号を指定しても、Gateway
  側はマッチしない置換を行うだけでエラーにはならない。dry-run 時に PO が内容を確認することで防ぐ。
- `addedGroups`
  は「スプリント中追加検証計画」セクションを上書きする。既存の追加検証計画を維持したい場合は、入力
  JSON に既存の `addedGroups` も含める。
