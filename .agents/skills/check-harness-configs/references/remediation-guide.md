# Remediation Guide: Fixing Config Issues

`scripts/check_configs.sh` が失敗した場合、以下の手順で設定を修復してください。

## 1. ファイルが存在しない場合 (Missing File)
各設定ファイルには `.example` という拡張子のテンプレートが用意されています。

- **対処法**: テンプレートをコピーして実体を作成してください。
  ```bash
  cp config/identities.txt.example config/identities.txt
  cp config/global-skills-path.txt.example config/global-skills-path.txt
  ```

## 2. ファイルが空の場合 (Empty File)
ファイルは存在しても、中身が空（0バイト）の場合はエラーとなります。

- **対処法**: ファイルを開き、自身の環境に合わせた適切な値を記述してください。
  - アカウント名、メールアドレス、あるいはディレクトリの絶対パスなど。

## 3. 再チェックの実施
修正が完了したら、再度チェックコマンドを実行して、すべての項目が `[OK]` になることを確認してください。
```bash
bash .agents/skills/check-harness-configs/scripts/check_configs.sh
```
