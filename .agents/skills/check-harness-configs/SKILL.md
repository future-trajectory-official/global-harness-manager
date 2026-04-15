---
name: check-harness-configs
description: "[検証] オンボーディングや環境同期に必要な各種設定ファイル群が存在し、記入されているか事前診断するスキル"
---

# check-harness-configs

グローバルハーネスの各スキルが動作するために必要となる設定ファイル（config）がすべて揃っているかを一括して検証します。

## 主な機能
- 必須設定ファイル（`identities.txt`, `global-skills-path.txt` 等）の存在チェックを行います。
- 万が一不足や未記入（空ファイル）がある場合は、警告を出力して異常終了（exit 1）します。

## 実行方法
以下のスクリプトを呼び出してください。
- `scripts/check_configs.sh`
