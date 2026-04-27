---
name: attach-harness-to-project
description: "[作業準備] 新しいプロジェクト(Gitリポジトリ)での作業開始前に、そのリポジトリの通信経路を正しいアカウントに強制バインドさせるために使用する"
---

# attach-harness-to-project

既存のリポジトリに対して、管理された Git アイデンティティを装着し、通信経路（Remote URL）を専用の SSH エイリアスに強制書き換えします。

## 主な機能
1. **リモート URL の変換**: `git@github.com-[本人エイリアス]:` 形式への書き換え。
2. **ローカル Git 設定の固定**: プロジェクト内限定の `user.name` / `user.email` 設定。

## 使用方法
以下の引数を与えてスクリプトを呼び出してください。

```bash
deno run -A .agents/skills/attach-harness-to-project/scripts/harness-attach.ts <アカウント名> <プロジェクトディレクトリの絶対パス>
```

> [!TIP]
> SSHエイリアスの詳細な仕組みは [ssh-alias-spec.md](references/ssh-alias-spec.md) を、Git設定の反映仕様については [local-git-config.md](references/local-git-config.md) を参照してください。

## 安全性への配慮
- `identities.txt` に存在しないアカウントは拒否します。
- 既存の正しい設定は保持し、二重書き換えを避けます。
