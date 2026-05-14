---
name: reconfirm-context
description: グローバルコンテキストの再確認。エージェントが自身の役割やスキルをYAMLメタデータのみから抽出し、自己認識を同期する。サーバーエラーやツールエラーからの復帰時にも必須。
tags:
  trigger:
    - context-lost
    - role-confusion
    - session-recovery
    - server-error
    - tool-error
  category: meta
  constraints: none
---

# reconfirm-context

チャットの履歴が長くなった際や、ツールのエラー・サーバーエラーから復帰した直後、自身の役割（Rules）や利用可能なツール（Skills）を正しく認識できなくなっている場合に、「現在の自己像」をリフレッシュし、[RECOVERY
LOG] による文脈同期の基盤を作ります。

## 手順

// turbo-all

1. **メタデータの抽出実行**
   - 以下のコマンドを実行し、メタデータを抽出するスクリプトを実行します。
   ```bash
   deno run -A .agents/skills/bundles/meta-bundle/reconfirm-context/scripts/reconfirm.ts
   ```

2. **自己認識の同期**
   - 出力された Role（役割）と Capability（スキル）を読み込み、現在の振る舞いを再宣言してください。

> [!TIP]
> スキル探索の詳細な仕組みは [indexing-logic.md](references/indexing-logic.md) を参照してください。

※ 注意: このスキルは情報の「発見」ではなく「再定義・再認識」を目的としています。
