# Technical Spec: SSH Host Aliasing

本プロジェクトがリモートURLを `github.com-[アカウント名]` に変換する理由とその仕組みです。

## 1. 複数の SSH 鍵の使い分け

通常、`ssh git@github.com` と実行すると、SSHクライアントはデフォルトの鍵（`~/.ssh/id_rsa`
等）を使用します。しかし、複数のGitHubアカウントを使い分ける場合、これでは「正しい鍵」を特定できません。

## 2. エイリアスによる解決

`~/.ssh/config` に以下のような設定を自動生成します。

```ssh
Host github.com-username
    HostName github.com
    IdentityFile ~/.ssh/id_ed25519_username
```

この状態で、リポジトリの Remote URL を以下のように書き換えます。

- **Before**: `git@github.com:username/repo.git`
- **After**: `git@github.com-username:username/repo.git`

## 3. 強制的なバインド

このエイリアスを Remote URL
に設定することで、Gitコマンドが実行される際に、**常に指定したアカウント専用の鍵が物理的に選択される**ことを保証します。
これにより、誤って別のアカウントの権限で Push しようとして Permission Denied
になったり、逆に意図しないアカウントで Push してしまったりする事故を防ぎます。
