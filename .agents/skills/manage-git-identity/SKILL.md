---
name: manage-git-identity
description: "[認証管理] identities.txt に基づき SSH接続用の鍵ペアを生成・管理し、GitHubにアカウントを登録させる際に使用する"
---

# manage-git-identity

GitHub の複数アカウントを使い分けるための SSH 鍵ペア（Ed25519）を一括生成・管理し、SSH config へのエイリアス登録を行います。

## 主な機能
1. **SSH 鍵の自動生成**: `config/identities.txt` のリストに基づき、未作成のアカウント用 Ed25519 鍵を生成します。
2. **SSH Config の自動構成**: `~/.ssh/config` に GitHub 接続用のエイリアス（例: `github.com-user1`）を自動登録します。
3. **公開鍵のリポート**: GitHub に登録すべき公開鍵の内容と、登録用 URL を対話的に表示します。

## 使用方法
1. `config/identities.txt.example` をコピーして `config/identities.txt` を作成し、`アカウント名,メールアドレス` の形式で記述してください。
2. 以下の実行スクリプトを呼び出してください。

### 実行スクリプト
- `scripts/add-identity.sh`

## 安全性への配慮
- 既に SSH 鍵が存在する場合は上書きせず、スキップします。
- `~/.ssh/config` への追記は、二重登録を防ぐための既存チェックを行います。

## ワークフローのヒント
スクリプト実行後、AI エージェントはユーザーに対し、表示された公開鍵を GitHub の [SSH keys 設定](https://github.com/settings/ssh/new) に追加するよう促す必要があります。ユーザーによる登録完了後、`ssh -T github.com-[アカウント名]` での疎通確認を推奨します。
