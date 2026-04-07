---
name: publish-harness-skills
description: ワークスペース内のスキルをグローバルディレクトリへ同期・公開します。
---

# publish-harness-skills

このスキルは、プロジェクトの `.agents/skills/` ディレクトリ配下にあるローカルスキルを、`config/global-skills-path.txt` で定義されたグローバルディレクトリへ同期します。

## 主な機能
- `config/publish-targets.txt` にリストされたスキルのみを公開対象とします。
- 各スキルディレクトリの `.gitignore` を尊重し、不要なファイル（`bin/`, `tmp/` 等）を除外します。
- 公開先ディレクトリに同名のスキルが存在する場合、一度削除してからコピーすることで不整合を防ぎます。

## 使用方法
1. `config/publish-targets.txt` に公開したいスキルのディレクトリ名を記入します。
2. このスキルのスクリプト `scripts/publish.sh` を実行します。

## 前提条件
- `config/global-skills-path.txt` が設定されていること。
- `rsync` がシステムにインストールされていること（推奨。ない場合は `cp` などの代替手段を検討してください）。
