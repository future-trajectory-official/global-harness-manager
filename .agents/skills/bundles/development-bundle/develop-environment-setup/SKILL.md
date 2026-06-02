---
name: develop-environment-setup
description: "Work Packageごとに独立した作業環境（サンドボックス）を構築し、ホスト環境を保護します。"
tags:
  trigger:
    - setup-sandbox
    - prepare-workspace
    - safety-isolation
  category: development
  constraints: requires-docker-for-container-mode
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

// turbo-all

1. **サンドボックスの作成とクリーンアップ**
   不整合を防ぐため、新しい作業を開始する前には既存の同名サンドボックスを破棄（クリーンアップ）してから作成することを推奨します。
   ```bash
   # 既存の破棄（任意）
   deno run -A .agents/skills/bundles/development-bundle/develop-environment-setup/scripts/manage-sandbox.ts destroy --name [task-name]

   # 新規作成
   deno run -A .agents/skills/bundles/development-bundle/develop-environment-setup/scripts/manage-sandbox.ts create --name [task-name] --mode [directory|container]
   ```

2. **サンドボックスへの進入と動作確認**
   出力されたパス、またはコンテナ名を確認して環境に進入し、必要なランタイム（python, deno
   等）のバージョンを確認してください。

3. **作業の完了と破棄**
   作業が完了し、成果物をメインリポジトリへ反映（マージ/コミット）した後は、環境をクリーンに保つためにサンドボックスを破棄してください。
   ```bash
   deno run -A .agents/skills/bundles/development-bundle/develop-environment-setup/scripts/manage-sandbox.ts destroy --name [task-name]
   ```

## 【重要】安全性と分離の原則

- **ホスト環境の保護**: システム設定の変更や新規ツールのインストールを伴う作業は、必ず **Container
  モード** を使用してください。
- **使い捨て原則**: サンドボックスはWork
  Packageごとに使い捨て、常にクリーンな状態から作業を開始してください。
- **データの永続化**:
  サンドボックス内での変更は、明示的にメインリポジトリへ反映させない限り、破棄時に消失します。
