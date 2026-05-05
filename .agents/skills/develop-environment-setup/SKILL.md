---
name: develop-environment-setup
description: "タスクごとに独立した作業環境（サンドボックス）を構築し、ホスト環境を保護します。"
---

# develop-environment-setup

このスキルは、実装作業を開始する前に専用の隔離環境（サンドボックス）をセットアップし、安全に作業・検証を行うための能力を提供します。

## 選択可能なモード

作業の特性に応じて、以下の 2 つのモードを選択できます：

1. **Directory モード (`--mode directory`)**
   - **用途**: プロジェクト内部のファイル修正、リファクタリング、ユニットテスト。
   - **内容**: `/tmp/harness-sandboxes/[task-name]` にソースコードを展開。
2. **Container モード (`--mode container`)**
   - **用途**: システム設定の変更、新規ツールのインストール、ワークスペース外へのアクセス。
   - **内容**: Docker コンテナを起動し、その中で作業を実行。

## 実行手順

1. **サンドボックスの作成**
   ```bash
   deno run -A .agents/skills/develop-environment-setup/scripts/manage-sandbox.ts create --name [task-name] --mode [directory|container]
   ```
2. **サンドボックスへの進入**
   - 出力されたパス、またはコンテナ名を確認し、作業を開始してください。
3. **作業の完了と破棄**
   ```bash
   deno run -A .agents/skills/develop-environment-setup/scripts/manage-sandbox.ts destroy --name [task-name]
   ```

## 注意事項

- サンドボックス内での変更は、明示的にマージまたはコミットされるまでメインリポジトリには反映されません。
- コンテナモードを使用する場合は、Docker が起動している必要があります。
