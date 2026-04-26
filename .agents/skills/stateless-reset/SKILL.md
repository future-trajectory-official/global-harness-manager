---
name: stateless-reset
description: 過去のAIの記憶やナレッジデータを一時フォルダへ退避させ、ステートレスな実行環境をリセット（構築）するスキル。
---

# stateless-reset

以前のセッションやチャット履歴、学習済みのナレッジを OS の一時ディレクトリに退避させることで、過去の文脈を引き継がない「ステートレス」な状態を構築します。

## 手順

// turbo
1. **リセットの実行**
   - 以下のスクリプトを実行し、エージェントの内部記憶フォルダ（`brain/`, `knowledge/`, `conversations/`）を退避させます。
   ```bash
   bash .agents/skills/stateless-reset/scripts/reset_stateless.sh
   ```

> [!TIP]
> 退避対象のデータの詳細は [data-types-spec.md](references/data-types-spec.md) を、Windows 等の他環境向けコマンドは [cross-platform-commands.md](references/cross-platform-commands.md) を参照してください。

※ 注意: 物理的な削除ではなく移動を行うため、OS による自動クリーンアップまではデータが保持されます。
