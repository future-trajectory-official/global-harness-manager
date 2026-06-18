# 予実差分析データモデル

## 概要

本ドキュメントは、ベロシティ記録における予実差分析のデータモデルを定義する。

## アーキテクチャ決定

- **Issue（ラベル）**: `type:*` のみ管理。`status:*` / `size:*` はProject V2に移行
- **Issue（コメント）**: variance commentは全廃。effortデータはProject V2のみ保持
- **Project V2**: カスタムフィールドで全ての定量・定性データを管理

## 属性一覧

### Product Backlog ボード（PBIレベル）

| 属性                    | 型                          | ロール                              | 更新タイミング              |
| ----------------------- | --------------------------- | ----------------------------------- | --------------------------- |
| `harness-size-estimate` | Single select (XS/S/M/L/XL) | スプリント計画時のTシャツサイズ見積 | PBI作成時・スプリント計画時 |
| `harness-size-actual`   | Single select (XS/S/M/L/XL) | 完了時の実績Tシャツサイズ           | PBI完了時・PO承認時         |
| `harness-variance-text` | Text                        | 予実差の定性理由                    | PBI完了時・乖離発生時       |

## 更新フロー

### PBI完了時

1. `harness-size-actual` を設定
2. 乖離がある場合は `harness-variance-text` に理由を記述
