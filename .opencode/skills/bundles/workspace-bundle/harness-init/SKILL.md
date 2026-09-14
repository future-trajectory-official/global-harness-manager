---
name: harness-init
description: "[リポジトリ作成] config/identities.md に定義されたプロジェクトのGitHubリポジトリを新規作成する。"
tags:
  trigger:
    - create-repository
    - new-project
    - repo-init
  category: onboarding
  constraints: requires-gh-auth
---

# harness-init

`config/identities.md` に定義されたアカウント情報を読み取り、 GitHub上に新規リポジトリを作成します。

## 前提条件

- `gh auth login` が完了していること
- `gh ssh-key add` によりSSH公開鍵がGitHubに登録されていること
- `config/identities.md` に Repository / Account Name / Visibility が正しく記述されていること

## 責務

本スキルは以下の操作のみを行います：

1. `config/identities.md` をパースし、各プロジェクトの情報を取得する
2. GitHub上に同名リポジトリが存在しないことを確認する
3. `gh repo create <owner>/<repo> --<visibility> --add-readme` を実行し、リポジトリを作成する

**本スキルが行わないこと**:

- ローカルへのリポジトリのクローン
- Git設定（user.name / user.email）の適用

## 使用方法

```bash
deno run -A .agents/skills/bundles/workspace-bundle/harness-init/scripts/harness-init.ts [--dry-run]
```

### オプション

| オプション  | 説明                                                           |
| ----------- | -------------------------------------------------------------- |
| `--dry-run` | 実際のリポジトリ作成を行わず、実行計画のみを標準出力に表示する |

## 安全性への配慮

- 同名リポジトリがGitHub上に既に存在する場合、上書きせずエラーメッセージを表示して安全終了する
- `--dry-run` モードではいかなるGitHub操作も実行されない
