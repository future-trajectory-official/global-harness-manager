# Technical Specification: SSH Configuration & Aliases

`manage-git-identity` スキルが採用している SSH 設定の技術的な詳細です。

## 1. SSH エイリアス方式

複数の GitHub アカウントを同一マシンで使い分けるため、`~/.ssh/config`
に「ホストエイリアス」を設定しています。

### 設定例

```text
Host github.com-user1
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_ed25519_user1
    IdentitiesOnly yes
```

### なぜこの方式なのか？

- `git clone git@github.com:...` とすると、SSH
  クライアントはデフォルトの鍵（通常は最初に登録されたもの）を送信してしまい、意図しないアカウントで認証されることがあります。
- エイリアス（`github.com-user1`）をホスト名として指定することで、特定のアカウント専用の鍵（`IdentityFile`）を強制的に使用させることができます。

## 2. Ed25519 鍵の採用理由

本スキルでは、RSA ではなく Ed25519 アルゴリズムで鍵を生成します。

- **セキュリティ**: 現在、最も安全で効率的とされるアルゴリズムです。
- **パフォーマンス**: 生成が非常に高速で、鍵のサイズが小さいため、config の管理も容易です。
- **推奨設定**: GitHub および多くのモダンなサーバーで推奨されています。

## 3. `IdentitiesOnly yes` の重要性

この設定がないと、SSH クライアントはエージェントが持っている全ての鍵を順番に試そうとします。GitHub
のログイン試行回数制限に引っかかるのを防ぐため、このオプションは必須です。
