---
name: setup-harness-env
description: "[初期構築] ghバイナリのダウンロードや環境変数PATHの設定など、ホスト環境をはじめて構築する際に一度だけ使用する"
---

# setup-harness-env

ホスト環境（WSL/Ubuntu等）において、グローバルハーネスを動作させるための基盤を構築します。

## 主な機能
1. **GitHub CLI (gh) の導入**: スタンドアロンバイナリを `bin/` に配置します。
2. **環境変数の設定**: `~/.bashrc` に PATH を追記し、ターミナルから `gh` を利用可能にします。
3. **スキルパスの登録**: Antigravity が認識するグローバルスキルディレクトリの自動構成。

## 使用方法
1. `config/global-skills-path.txt.example` をコピーして `config/global-skills-path.txt` を作成し、管理したいスキルディレクトリを記述してください。
2. 以下の実行スクリプトを呼び出してください。

### 実行スクリプト
- `scripts/initialize-harness.sh`

## 安全性への配慮
- `~/.bashrc` への追記は、二重登録を防ぐための既存チェックを行います。
- `bin/gh` が既に存在する場合は、ダウンロードをスキップします。

## 次のステップ
初期化が完了したら、`manage-git-identity` スキルを使用して、GitHub アカウントの SSH 鍵登録を行ってください。
