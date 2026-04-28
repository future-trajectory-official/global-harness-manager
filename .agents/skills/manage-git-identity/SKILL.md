---
name: manage-git-identity
description: "[認証管理] identities.txt に基づき SSH接続用の鍵ペアを生成・管理し、GitHubにアカウントを登録させる際に使用する"
---

# manage-git-identity

GitHub の複数アカウントを使い分けるための SSH 鍵ペア（Ed25519）を一括生成・管理し、SSH config
へのエイリアス登録を行います。

## 主な機能

1. **SSH 鍵の自動生成**: `config/identities.txt` に基づき Ed25519 鍵を生成。
2. **SSH Config の自動構成**: `~/.ssh/config` にエイリアス（例: `github.com-user1`）を登録。
3. **公開鍵のリポート**: GitHub 登録用の公開鍵を表示。

## 使用方法

1. `config/identities.txt` を作成（`アカウント名,メールアドレス`）。
2. `deno run -A .agents/skills/manage-git-identity/scripts/add-identity.ts` を実行。

> [!TIP]
> 接続エラーの解決方法は [troubleshooting.md](references/troubleshooting.md) を、SSH設定の詳細は
> [ssh-config-spec.md](references/ssh-config-spec.md) を参照してください。

## 安全性への配慮

- 既存の SSH 鍵は上書きしません。
- `~/.ssh/config` への二重登録を防止します。
