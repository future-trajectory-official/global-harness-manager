# 予実差分析データモデル

## 概要

本ドキュメントは、セッションメトリクス記録における予実差分析のデータモデルを定義する。

## アーキテクチャ決定

- **Issue（ラベル）**: `type:*` のみ管理。`status:*` / `size:*` はProject V2に移行
- **Issue（コメント）**: variance commentは全廃。effortデータはProject V2のみ保持
- **Project V2**: カスタムフィールドで全ての定量・定性データを管理

## 属性一覧

### Sprint Board ボード（WPレベル）

| 属性                     | 型     | ロール                               | 更新タイミング                   |
| ------------------------ | ------ | ------------------------------------ | -------------------------------- |
| `harness-effort-initial` | Number | 計画前見積（想定介入回数）           | WP作成時                         |
| `harness-effort-planed`  | Number | 計画後見積（PO合意後の想定介入回数） | セッション計画完了時             |
| `harness-effort-actual`  | Number | 完了時実績（実際の介入回数）         | セッション終了・メトリクス記録時 |
| `harness-variance-text`  | Text   | 予実差の定性理由                     | WP完了時・乖離発生時             |

## 更新フロー

### セッション終了・メトリクス記録時

1. `harness-effort-actual` を設定（実際の介入回数）
2. 乖離がある場合は `harness-variance-text` に理由を記述
