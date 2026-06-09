# Troubleshooting: manage-git-identity

GitHub との SSH 接続で問題が発生した場合は、以下のチェックリストを確認してください。

## 1. Permission denied (publickey) エラー

このエラーは、GitHub が提示された SSH 鍵を認識できない場合に発生します。

- **公開鍵の登録確認**:
  - `scripts/add-identity.sh` で表示された公開鍵（`*.pub`）が、正しく
    [GitHub の SSH 設定](https://github.com/settings/ssh/new) に追加されているか確認してください。
- **正しいエイリアスの使用**:
  - `git clone` や `ssh -T` を行う際は、通常の `github.com` ではなく、設定したエイリアス（例:
    `github.com-myuser`）を使用する必要があります。
- **ssh-agent の確認**:
  ```bash
  eval "$(ssh-agent -s)"
  ssh-add ~/.ssh/id_ed25519_myuser
  ```

## 2. 接続確認コマンド

特定のアカウントで正しく接続できているかテストするには、以下のコマンドを実行します。

```bash
# アカウント名が 'myuser' の場合
ssh -T github.com-myuser
```

「Hi [ユーザー名]! You've successfully authenticated...」と表示されれば成功です。

## 3. SSH Config の競合

`~/.ssh/config`
を手動で編集した場合、構文エラーや重複設定によって正しく動作しなくなることがあります。
詳細な仕様については `ssh-config-spec.md` を参照してください。
