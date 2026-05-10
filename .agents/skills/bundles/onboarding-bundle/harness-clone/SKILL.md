---
name: harness-clone
description: 新しいリポジトリをクローンし、即座に適切なアカウントへバインド（harness-attach）する一連のオンボーディングフロー。
tags:
  trigger:
    - clone-repository
    - start-new-project
    - setup-project
  category: onboarding
---

# 🚀 harness-clone

既存のリポジトリをローカルに取得し、この開発マネージャー（Global Harness Manager）の管理下に置くための標準的なオンボーディングスキルです。

## 🎯 スキルの目的

- `git clone` によるソースコードの取得。
- クローン直後の `attach-harness-to-project` スキルの実行漏れを防止。
- 正しい SSH 鍵や Git Identity が適用された状態で作業を開始することを保証。

## 🔄 実施フロー

// turbo

1. **リポジトリのクローン**
   - ユーザーから提供された URL をもとに、指定のディレクトリへ `git clone` を実行します。
   ```bash
   git clone [repository-url] [target-directory]
   ```

2. **ディレクトリの移動**
   - クローンしたリポジトリのルートへ移動します。

3. **Harness Attach の実行**
   - クローンしたリポジトリ内で、直ちに `attach-harness-to-project` スキル（または `harness-attach` コマンド）を実行します。
   - これにより、リポジトリの Git 設定が正しいアカウントにバインドされます。

4. **初期バックログの確認**
   - リポジトリ内に `.agents/management/product-backlog.md` が存在するか確認し、作業準備が整ったことをユーザーに報告します。

## ⚠️ 注意事項

- クローン後の `harness-attach` は **必須ステップ** です。これを怠ると、不適切なアカウント名でコミットされるなどのトラブルの原因となります。
- すでにクローン済みのプロジェクトを管理下におきたい場合は、直接 `attach-harness-to-project` スキルを使用してください。
