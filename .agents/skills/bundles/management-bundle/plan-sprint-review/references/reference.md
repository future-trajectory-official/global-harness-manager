# plan-sprint-review リファレンス

## 入力 JSON の形式

```json
{
  "scope": {
    "owner": "my-org",
    "repository": "my-repo"
  },
  "sprintNumber": 17,
  "reviewTitle": "Sprint 17 Review"
}
```

### 各フィールドの説明

| フィールド     | 型                                      | 必須 | デフォルト                                    | 説明                                                                                                               |
| -------------- | --------------------------------------- | ---- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `scope`        | `{ owner: string, repository: string }` | 任意 | ConfigGateway が自動解決（`.harnessrc` 参照） | GitHub 上の owner/repository                                                                                       |
| `sprintNumber` | `number`                                | 必須 | —                                             | レビュー対象のスプリント番号（1以上の整数）。`sprintId()` により "Sprint {n}" 形式の SprintIdentifier に変換される |
| `reviewTitle`  | `string`                                | 任意 | `"Sprint {sprintNumber} Review"`              | GitHub Issue のタイトル                                                                                            |

## 出力（Plan 構造）

`ReviewUseCase.plan()` は以下の2ステップから成る Plan を返す：

### Step 1: Issue 作成（`operation: "plan"`）

- **エンティティ**: Review
- **操作**: GitHub Issue を新規作成
- **ラベル**: `type:Review`（Gateway 層の `handleCreateItem` が自動付与）
- **マイルストーン**: `params.sprint` があれば設定
- **本文**: `formatReviewBody()` により生成。以下を含む：
  ```markdown
  ## Sprint Review

  - **Sprint**: Sprint {n}
  ```

### Step 2: コメント追記（`operation: "update"`）

- **エンティティ**: Review
- **操作**: 前Stepで作成された Issue にコメントを追記
- **本文**: `"Review planned for {sprint.title.value}"`

## Review Issue の構造（L2設計仕様より）

作成される Issue は以下の構造を持つ：

- **Title**: "Sprint {n} Review"（またはカスタムタイトル）
- **Label**: `type:Review`
- **Milestone**: 該当スプリントの Milestone
- **Body（初期状態）**: `formatReviewBody()` による最小構成
- **Body（レビュー実施後、report時に拡充）**:
  - 凡例（✅合格 / ⚠️条件付き / ❌不合格 / ➖論理削除 / ❔未確認）
  - 実施環境
  - 総合判定
  - 判定理由（POフィードバック）
  - 計画時確認項目（PBI/WP/AC単位）
  - 計画後確認項目
- **Comment**: 変更履歴（History テーブル）

カスタムフィールドは不要（レビュー結果は Body の Markdown で管理）。

## 3層アーキテクチャ上の位置づけ

```
ワークフロー（例: sprint-start）
  └── plan-sprint-review（Skill層）
        └── ReviewUseCase.plan()（Domain層）
              └── PlanGatewayAdapter.execute()（Gateway層）
                    └── gh issue create（GitHub CLI）
```

- **Skill層**: 本スキルスクリプト。stdin から入力を受け取り、UseCase を呼び出し、dry-run 分岐を行う
- **Domain層**: `ReviewUseCase.plan()`。バリデーション（空タイトルチェック）と Plan
  生成。外部依存なし
- **Gateway層**: `PlanGatewayAdapter`。Plan の各 Step を gh CLI にルーティング（Review ハンドラは
  WP_1 で実装済み）
