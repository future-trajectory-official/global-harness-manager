# Environment Specification: Global Harness Foundation

本プロジェクトのホスト環境構築に関する技術的な仕様です。

## 1. スタンドアロンバイナリ (`bin/`)

システム全体の `/usr/bin/` などを汚染しないため、`gh` などのツールはプロジェクトローカルな `bin/`
ディレクトリに配置されます（デフォルト）。

- **利点**: 複数の環境が混在しても干渉せず、バイナリを削除するだけで環境をリセットできます。
- **配布先**: 配布時は `HARNESS_DISTRIBUTE_BIN_DIR=~/.harness/bin`
  を指定して配布先へ配置する。`setup.ts` の `resolveBinDir()` で解決された binDir 一本 （ローカル
  `<root>/bin` または配布先 `~/.harness/bin`）を使用する。 優先順位は
  `GLOBAL_HARNESS_BIN_DIR`（テスト隔離・上書き用）> `HARNESS_DISTRIBUTE_BIN_DIR`（配布先指定用）>
  `<root>/bin`（既定）。
- **位置づけ**: `bin/` はセットアップ時にダウンロード生成される成果物であり、
  配布設計（`.local/design-opencode-integration.md §4`）の配布層（skills / core / agents / commands
  / context / guides）には含まれない。

## 2. `.bashrc` への介入

エージェントが自律的にコマンドを呼び出せるよう、最低限の PATH 設定を `~/.bashrc` に追記します。

- **追記内容**: 解決済み binDir 一本（ローカル `global-harness-manager/bin` または配布先
  `~/.harness/bin`）を PATH に追加。
- **安全性**:
  重複追記を防ぐため、既に記述がある場合はスキップするロジックをスクリプト内に含んでいます。

## 3. グローバルスキルパス

`config/global-skills-path.txt` に記述されたパスは、Antigravity
が追加のスキルやルールを探索するためのエントリポイントとして機能します。

- これにより、複数のプロジェクト間で共通の `SKILL.md` や `rules/` を共有することが可能になります。
