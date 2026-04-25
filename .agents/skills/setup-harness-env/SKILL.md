---
name: setup-harness-env
description: "[初期構築] ghバイナリのダウンロードや環境変数PATHの設定など、ホスト環境をはじめて構築する際に一度だけ使用する"
---

# setup-harness-env

ホスト環境（WSL/Ubuntu等）において、グローバルハーネスを動作させるための基盤を構築します。

## 主な機能
1. **GitHub CLI (gh) の導入**: `bin/` 配下への配置。
2. **環境変数の設定**: `~/.bashrc` への PATH 追記。
3. **スキルパスの登録**: グローバルスキルの自動構成。

## 使用方法
1. `config/global-skills-path.txt` が存在しない場合は、ユーザーに作成してもらう。
2. `scripts/initialize-harness.sh` を実行。
3. `source ~/.bashrc` をユーザーに実行してもらい、設定を反映。

> [!TIP]
> PATHが通らない等の問題は [troubleshooting.md](references/troubleshooting.md) を、詳細な技術仕様は [environment-specs.md](references/environment-specs.md) を参照してください。

## 安全性への配慮
- `~/.bashrc` への二重登録を防止。
- 既存のバイナリは上書きしません。
