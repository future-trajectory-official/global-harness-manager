# revise-sprint-review リファレンス

## このスキルがやること

- 対象スプリントの Review Issue を `examine` サブコマンドで取得する
- 現在の Review Issue 本文と `product-backlog.md` を比較し、差分候補を抽出する
- PO と PBI → WP → AC の階層で対話し、削除 AC / 追加 AC / 変更理由を確定する
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

## PO 対話フロー（PBI → WP → AC）

### 対話の進め方

1. **PBI 単位で変更の有無を確認する**
   - 「PBI `[番号] タイトル` に変更はありますか？」
   - 変更がなければ次の PBI へ

2. **WP 単位で変更内容を確認する**
   - 「WP_`N`: `タイトル` で削除・追加する AC はありますか？」
   - 追加 WP（スプリント中追加）が発生した場合は、`addedGroups` に含める

3. **AC 単位で変更理由を確認する**
   - 削除 AC：「なぜこの AC は不要になりましたか？」
   - 追加 AC：「この AC の検証方法は何ですか？」
   - 各変更に対する理由を `changeReason` または個別のメモに記録する

### 変更点確定後のサマリー提示

対話が終了したら、以下の形式で PO に変更点サマリーを提示し、最終確認を得る：

```markdown
## 変更点サマリー

### 削除 AC

- AC_1: 削除理由

### 追加 AC

- PBI 1 / WP_2 / AC_3: 追加ACの説明

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

| フィールド                                | 必須                    | 説明                                                        |
| ----------------------------------------- | ----------------------- | ----------------------------------------------------------- |
| `sprintNumber`                            | `code` 未指定時         | レビュー対象のスプリント番号。`code` とのどちらか一方が必須 |
| `code`                                    | `sprintNumber` 未指定時 | Review Issue の番号。既知の場合はこちらを優先               |
| `changeReason`                            | 必須                    | 変更の理由。空文字は不可                                    |
| `removed`                                 | 任意                    | 論理削除（➖）する既存 AC の一覧                            |
| `removed.items[].number`                  | 必須                    | 削除対象 AC の番号                                          |
| `removed.items[].description`             | 必須                    | 削除対象 AC の説明（Issue 本文置換用）                      |
| `addedGroups`                             | 任意                    | 「スプリント中追加検証計画」セクションに追記する AC 群      |
| `addedGroups[].pbiNumber`                 | 必須                    | 追加 AC の属する PBI 番号                                   |
| `addedGroups[].pbiTitle`                  | 任意                    | PBI タイトル（表示用）                                      |
| `addedGroups[].wpNumber`                  | 必須                    | 追加 AC の属する WP 番号                                    |
| `addedGroups[].wpTitle`                   | 任意                    | WP タイトル（表示用）                                       |
| `addedGroups[].acJudgments[].number`      | 必須                    | 追加 AC の番号                                              |
| `addedGroups[].acJudgments[].description` | 必須                    | 追加 AC の説明                                              |

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
