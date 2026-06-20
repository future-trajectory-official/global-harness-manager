# 入力パラメータリファレンス

## 必須フィールド

| フィールド        | 型      | 説明                                |
| ----------------- | ------- | ----------------------------------- |
| `title`           | string  | Issue タイトル                      |
| `milestone`       | string  | マイルストーン名（例: "Sprint 12"） |
| `milestoneNumber` | integer | マイルストーン番号                  |

## オプショナルフィールド

| フィールド        | 型       | デフォルト       | 説明                                  |
| ----------------- | -------- | ---------------- | ------------------------------------- |
| `sprintGoal`      | string   | ""               | スプリントゴール                      |
| `reviewDate`      | string   | "TBD"            | レビュー実施日                        |
| `demoEnvironment` | string   | "サンドボックス" | デモ環境                              |
| `achievementRate` | number   | —                | 達成率（0〜100）                      |
| `poFeedback`      | string   | ""               | PO フィードバック                     |
| `approvalDate`    | string   | "TBD"            | 承認日時                              |
| `approvalState`   | string   | "pending"        | 承認状態（approved/rejected/pending） |
| `rejectionReason` | string   | ""               | 差し戻し理由                          |
| `handoffItems`    | string[] | []               | 次スプリントへの申し送り              |

## ネスト構造

### pbiResults（PBI達成状況一覧）

```json
{
  "pbiResults": [
    {
      "pbiId": "PBI-001",
      "pbiTitle": "タイトル",
      "proofMethod": "テスト実証",
      "acResults": [
        {
          "ac": "AC1: ...",
          "proofMethod": "単体テスト",
          "evidence": "テストログ参照",
          "result": "pass"
        }
      ]
    }
  ]
}
```

### edgeCaseValidations（エッジケース検証結果）

```json
{
  "edgeCaseValidations": [
    {
      "description": "エッジケースの説明",
      "result": "pass",
      "notes": "備考"
    }
  ]
}
```

## 実践的な入力例

スプリントレビューでPOと対話しながら完成させる実践例。`approvalState` は `"pending"`
で作成し、PO承認後に `github-pbi-update` で更新する想定。

```json
{
  "title": "Sprint 12 スプリントレビュー",
  "milestone": "Sprint 12",
  "milestoneNumber": 12,
  "sprintGoal": "GitHub Issues/Projects と連携したPBI管理スキル群を構築する",
  "reviewDate": "2026-06-20",
  "demoEnvironment": "サンドボックス (feature/br-12)",
  "achievementRate": 85,
  "pbiResults": [
    {
      "pbiId": "PBI-012",
      "pbiTitle": "移行スクリプト作成",
      "proofMethod": "実機デモ",
      "acResults": [
        {
          "ac": "AC1: 対話モードでPBIを1件作成",
          "proofMethod": "デモ実演",
          "evidence": "スクリーンキャプチャ",
          "result": "pass"
        },
        {
          "ac": "AC2: dry-runモード",
          "proofMethod": "ログ確認",
          "evidence": "dry-run出力",
          "result": "pass"
        }
      ]
    },
    {
      "pbiId": "PBI-013",
      "pbiTitle": "検証スクリプト作成",
      "proofMethod": "テスト実行",
      "acResults": [
        {
          "ac": "AC1: サンプル突合",
          "proofMethod": "自動テスト",
          "evidence": "deno test パス",
          "result": "pass"
        }
      ]
    }
  ],
  "edgeCaseValidations": [
    {
      "description": "空のバックログで移行を実行",
      "result": "pass",
      "notes": "0件のWarningで正常終了"
    },
    { "description": "存在しないラベルでのフィルタ", "result": "pass", "notes": "空リストを返す" }
  ],
  "poFeedback": "移行スクリプトの対話モードは使いやすい。次スプリントで完全移行に進みたい。",
  "approvalDate": "2026-06-20",
  "approvalState": "approved",
  "handoffItems": [
    "WP_4 完全移行: product-backlog.md 削除の事前通知",
    "移行後の運用ドキュメントを README へ追記"
  ]
}
```

## JSON Schema

厳密なバリデーションは `/.github/schemas/review-issue-payload.schema.json` を参照。
