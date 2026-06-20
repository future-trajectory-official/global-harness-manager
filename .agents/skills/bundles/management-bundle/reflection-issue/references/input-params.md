# 入力パラメータリファレンス

## 必須フィールド

| フィールド        | 型       | 説明               |
| ----------------- | -------- | ------------------ |
| `title`           | string   | Issue タイトル     |
| `milestoneNumber` | integer  | マイルストーン番号 |
| `keep`            | string[] | Keep 項目リスト    |
| `problem`         | string[] | Problem 項目リスト |
| `tryItems`        | string[] | Try 項目リスト     |

## オプショナルフィールド

| フィールド                 | 型        | 説明                                                       |
| -------------------------- | --------- | ---------------------------------------------------------- |
| `body`                     | string    | 追加本文（KPT セクション前に挿入）                         |
| `milestone`                | string    | マイルストーン名（例: "Sprint 12"）                        |
| `referencedSessionNumbers` | integer[] | 参照セッション番号のリスト（Issue 本文に `#N` 形式で表示） |

## 実践的な入力例

スプリント終了時のKPTを基に作成する実践例。

```json
{
  "title": "Sprint 12 KPT 振り返り",
  "milestone": "Sprint 12",
  "milestoneNumber": 12,
  "body": "## スプリント総評\n\n今スプリントはGitHub移行の基盤スキル群を構築し、並行運用の目途が立った。POとの認識合わせの頻度が高かったが、結果として品質の高い成果物になった。",
  "keep": [
    "AC checkpoint 方式で確実に進められた",
    "POとの意思疎通がスムーズだった",
    "deno task qa を毎回実行することで回帰を防止できた"
  ],
  "problem": [
    "見積もり精度にばらつきがある（介入回数の乖離）",
    "設計着手前の既存定義調査が不足していた"
  ],
  "tryItems": [
    "実装前に既存コードベースの調査時間を明示的に確保する",
    "複雑なWPはスパイク（WP_0）を先に実施する"
  ],
  "referencedSessionNumbers": [45, 46, 47]
}
```

## JSON Schema

厳密なバリデーションは `schemas/reflection-issue-payload.schema.json` を参照。
