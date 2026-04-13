---
name: publish-harness-rules
description: ワークスペース内のルールを定義に基づき、指定の他プロジェクトへ同期・コピーします。
---

# publish-harness-rules

このスキルは、`global-harness-manager` で管理されている共有のプロンプト・ルールファイル（`.agents/rules/*.md`）を、`config/publish-rules-targets.md` に定義された別のターゲットプロジェクトへと同期します。コピーされたルールは対象プロジェクトにてローカルな制御下に置かれるため、対象プロジェクトの Git リポジトリへの誤混入を防ぐよう `.gitignore` に自動登録されます。

## 機能
- `config/publish-rules-targets.md` に記載されたターゲットプロジェクトおよびターゲットルールのリストを解釈し、ファイルの配布を行います。
- コピー先のプロジェクトに `.agents/rules` 用のディレクトリが存在しない場合は、一連のディレクトリレイアウトを自動生成します。
- 配布したルールが対象先の Git 管理下に入らないよう、ターゲットの `.agents/rules/.gitignore` ファイルに対して配布ファイル名を動的に追記します（既存登録の重複回避機構付き）。

## 前提要件
- スクリプトが存在する親環境において、配備対象となる共通ルールが `.agents/rules/` に存在していること。
- 事前に `config/publish-rules-targets.md.example` を `publish-rules-targets.md` にリネームまたはコピーし、配布先プロジェクトとルールのリストアップが完了していること。

## 実行方法
対象のリストアップ後、当該スキルのディレクトリ内にある `scripts/publish_rules.sh` を実行します。

```bash
# プロジェクトのルートから実行する例
bash .agents/skills/publish-harness-rules/scripts/publish_rules.sh
```
