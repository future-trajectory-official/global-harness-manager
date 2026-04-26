---
name: check-harness-configs
description: "[検証] オンボーディングや環境同期に必要な各種設定ファイル群が存在し、記入されているか事前診断するスキル"
---

# check-harness-configs

グローバルハーネスの各スキルが動作するために必要となる設定ファイル（config）を一括検証します。

## 主な機能
- 必須設定ファイル（`identities.txt` 等）の存在および内容の有無をチェック。
- 不備がある場合は異常終了（exit 1）し、後続のワークフローを停止させます。

## 実行方法
// turbo
```bash
bash .agents/skills/check-harness-configs/scripts/check_configs.sh
```

> [!TIP]
> どのファイルが必要かは [config-list.md](references/config-list.md) を、エラー時の修復方法は [remediation-guide.md](references/remediation-guide.md) を参照してください。
