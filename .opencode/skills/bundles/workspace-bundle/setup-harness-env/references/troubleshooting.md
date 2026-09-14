# Troubleshooting: setup-harness-env

ホスト環境のセットアップで問題が発生した場合は、以下の手順を試してください。

## 1. `gh` コマンドが認識されない

スクリプト実行後でも `gh: command not found` と出る場合：

- **環境変数の反映**: 変更を現在のセッションに反映させる必要があります。
  ```bash
  source ~/.bashrc
  ```
- **PATH の確認**: プロファイルに解決済みbinDirのexport行があるか確認してください。 解決は
  `resolveBinDir()` の優先順位（`GLOBAL_HARNESS_BIN_DIR` > `HARNESS_DISTRIBUTE_BIN_DIR` >
  `<root>/bin`）に従います。
  - ローカル既定: `export PATH="$PATH:/home/{username}/global-harness-manager/bin"`
  - 配布先指定時: `export PATH="$PATH:/home/{username}/.harness/bin"`
  - どちらのbinを見るべきかは、セットアップ実行時に指定した環境変数で判断してください。

## 2. スクリプトの実行権限エラー

`scripts/initialize-harness.sh` が実行できない場合：

- **権限の付与**:
  ```bash
  chmod +x scripts/initialize-harness.sh
  ```

## 3. WSL環境特有の問題

Windows と WSL
のファイルシステムを跨いで作業している場合、パーミッションが正しく解釈されないことがあります。本プロジェクトは常に
WSL 側のディレクトリ（例: `/home/{username}/...`）で実行することを強く推奨します。
