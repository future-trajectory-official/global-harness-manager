---
name: migrate-to-github
description: バックログの既存PBIを、AIとユーザーの対話を交えながら1件ずつGitHub Issueへ移行する。PBIは親Issue、WPは子Issue（sub-issue）として作成され、完了済みPBIはclose状態で作成されます。
tags:
  trigger:
    - migrate-to-github
    - migrate-pbi
    - github-migration
  category: management
  constraints: none
---

# migrate-to-github

[`product-backlog.md`](/.agents/management/product-backlog.md)
に記載されたPBIを、対話的に1件ずつGitHub Issueへ移行します。

## 前提条件

- `gh` CLIが認証済みであること
- 移行先リポジトリの `owner/repo` が判明していること

## Quick-Start

1. [移行手順](/.agents/skills/bundles/management-bundle/migrate-to-github/references/migration-procedure.md)のStep
   1〜3で移行対象のPBIとリポジトリを確定する。
2. 以下のコマンドを実行する。引数には1で確定したJSONをstdinで渡す。

```bash
echo '{"pbiId":"[Epic/Feature]/PBI-Name","repo":"owner/repo"}' | deno run -A .agents/skills/bundles/management-bundle/migrate-to-github/scripts/migrate-to-github.ts --stdin
```

> 事前確認には `--dry-run`
> を付与する。詳細は[移行手順](/.agents/skills/bundles/management-bundle/migrate-to-github/references/migration-procedure.md)参照。

## オプション一覧

| フラグ               | エイリアス | 説明                                                   |
| -------------------- | ---------- | ------------------------------------------------------ |
| `--list`             | `-l`       | 全PBIを一覧表示                                        |
| `--stdin`            | `-s`       | stdinからJSON入力を受け付ける                          |
| `--dry-run`          | `-d`       | 作成内容を表示のみ（実際の作成は行わない）             |
| `--backlog <path>`   |            | backlogファイルのパス（省略時は `product-backlog.md`） |
| `--harnessrc <path>` |            | `.harnessrc` 設定ファイルのパス                        |
| `--help`             | `-h`       | ヘルプを表示                                           |

## 関連スクリプト

### アーカイブPBI一括移行

`product-backlog-archive.md` に記録された全完了PBIを一括でGitHub Issue化し、Project
V2に実績データを設定します。

詳細:
[アーカイブ移行ガイド](/.agents/skills/bundles/management-bundle/migrate-to-github/references/archive-migration-guide.md)|
