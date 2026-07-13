# 対話ガイドライン

## Phase 1: 階層表示後の確認質問

表示されたエピックとフィーチャーの構造に対し、以下の観点でPOに問いかける：

- **過不足**: 「このEpicの分類で、カバーできていない機能領域はありますか？」
- **粒度**: 「Featureの粒度は適切ですか？ 統合すべきもの、分割すべきものはありますか？」
- **命名**: 「タイトルや説明に違和感はありますか？」

## Phase 2: 再定義時の質問

- 「このEpic/Featureの説明文（スコープ）をどのように変更しますか？」
- 「変更理由を教えてください（変更履歴に記録します）」

## Phase 3: 親子関係変更時の質問

- 「このFeatureは別のEpicに所属させるべきですか？ それとも独立させますか？」
- 「どのEpicに所属させますか？（EpicのIssue番号を確認）」

## Phase 4: PBI配置時の質問

- 「このPBIはどのFeatureに属しますか？（Feature未所属も許容します）」
- 「このPBIのFeature所属を解除しますか？」

# JSON入力スキーマ

## 共通

全Operationで共通のトップレベル構造：

```typescript
interface RefineHierarchyInput {
  operation: Operation;
  title?: string;
  description?: string;
  epicId?: string;
  epicNumber?: string;
  featureId?: string;
  featureNumber?: string;
  pbiId?: string;
  pbiNumber?: string;
  parentEpicId?: string;
  parentFeatureId?: string;
  reason?: string;
  scope?: { owner: string; repository: string };
}
```

`scope` 省略時は自動解決（git remote → gh auth → owner/repository）。

## Operation別 必須パラメータ

| Operation                    | 必須パラメータ                                | 備考                         |
| ---------------------------- | --------------------------------------------- | ---------------------------- |
| `show-hierarchy`             | `title`, `epicId`(または`epicNumber`)         | —                            |
| `revise-epic`                | `title`, `epicId`, `description`, `reason`    | `reason`省略時はデフォルト値 |
| `revise-feature`             | `title`, `featureId`, `description`, `reason` | `reason`省略時はデフォルト値 |
| `assign-feature-to-epic`     | `title`, `featureId`, `parentEpicId`          | —                            |
| `unassign-feature-from-epic` | `title`, `featureId`                          | —                            |
| `assign-pbi-to-feature`      | `title`, `pbiId`, `parentFeatureId`           | —                            |
| `unassign-pbi-from-feature`  | `title`, `pbiId`                              | —                            |

## JSON例

### show-hierarchy

```json
{
  "operation": "show-hierarchy",
  "title": "認証基盤",
  "epicId": "42"
}
```

### revise-epic

```json
{
  "operation": "revise-epic",
  "title": "認証基盤",
  "epicId": "42",
  "description": "ユーザー認証と認可に関する全機能を管理する。対象: パスワード認証、多要素認証、OAuth連携",
  "reason": "スコープを明確化。OAuth連携を追加"
}
```

### revise-feature

```json
{
  "operation": "revise-feature",
  "title": "パスワード管理",
  "featureId": "45",
  "description": "パスワードの変更・リセット・ポリシー管理",
  "reason": "パスワードポリシー管理を本Featureに統合"
}
```

### assign-feature-to-epic

```json
{
  "operation": "assign-feature-to-epic",
  "title": "OAuth連携",
  "featureId": "48",
  "parentEpicId": "42"
}
```

### unassign-feature-from-epic

```json
{
  "operation": "unassign-feature-from-epic",
  "title": "OAuth連携",
  "featureId": "48"
}
```

### assign-pbi-to-feature

```json
{
  "operation": "assign-pbi-to-feature",
  "title": "パスワード変更画面の実装",
  "pbiId": "50",
  "parentFeatureId": "45"
}
```

### unassign-pbi-from-feature

```json
{
  "operation": "unassign-pbi-from-feature",
  "title": "パスワード変更画面の実装",
  "pbiId": "50"
}
```

# 実行例

## dry-run

```bash
echo '{"operation":"revise-epic","title":"認証基盤","epicId":"42","description":"ユーザー認証と認可に関する全機能","reason":"スコープ明確化"}' | deno run -A .agents/skills/bundles/management-bundle/refine-classification-hierarchy/scripts/refine_classification_hierarchy.ts --dry-run
```

出力例:

```json
{
  "summary": "Revise epic: 認証基盤",
  "steps": [
    {
      "entity": "Scope",
      "operation": "resolve",
      "params": { "owner": "unknown", "repository": "unknown" }
    },
    {
      "entity": "Epic",
      "operation": "update",
      "params": { "itemId": "42", "title": "認証基盤", "body": "..." }
    },
    { "entity": "Epic", "operation": "comment", "params": { "body": "..." } }
  ]
}
```

## 本実行

`--dry-run` を外して実行する。

```bash
echo '{"operation":"assign-pbi-to-feature","title":"パスワード変更画面の実装","pbiId":"50","parentFeatureId":"45"}' | deno run -A .agents/skills/bundles/management-bundle/refine-classification-hierarchy/scripts/refine_classification_hierarchy.ts
```
