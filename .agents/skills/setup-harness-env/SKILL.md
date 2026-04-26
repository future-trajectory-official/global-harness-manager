---
name: setup-harness-env
description: "[初期構築] Deno/ghのダウンロードやPATHの設定など、ホスト環境を構築する。環境別ルーティング対応"
---

# setup-harness-env

ホスト環境において、グローバルハーネスを動作させるための基盤（Deno, gh のインストールおよび環境変数設定）を構築します。

## Agent Instructions (エージェントへの指示)
// turbo-all
あなた（Antigravity）は、ユーザーのOS環境に応じて以下の適切なスクリプトを選択して実行してください。**決して自ら OS ごとの分岐コマンドを組み立ててはいけません。以下のスクリプトを呼び出すだけです。**

1. `config/global-skills-path.txt` が存在しない場合は、`global-skills-path.txt.example` をコピーして作成するようユーザーに促してください。
2. 自身のコンテキスト（実行環境）から OS を判定し、以下のスクリプトを `run_command` で実行してください：
   - **Linux / WSL 環境の場合**: `bash scripts/install-linux.sh`
   - **Windows (Native PowerShell) 環境の場合**: `powershell -ExecutionPolicy Bypass -File scripts\install-windows.ps1`
   - **macOS 環境の場合**: `bash scripts/install-mac.sh`
3. 実行後、ユーザーに対して「ターミナルを再起動するか、\`source ~/.bashrc\` (またはプロファイル) を再読込してください」と伝えてください。

> [!TIP]
> PATHが通らない等の問題は [troubleshooting.md](references/troubleshooting.md) を、詳細な技術仕様は [environment-specs.md](references/environment-specs.md) を参照してください。

## 安全性への配慮
- 各スクリプトは二重登録を防止しており、既存のバイナリは上書きしません。
- Windows 環境の PATH 更新はユーザー空間 (`User`) に対してのみ行います。
