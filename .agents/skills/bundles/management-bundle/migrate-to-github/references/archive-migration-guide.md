# アーカイブPBI移行ガイド

`product-backlog-archive.md` に記録された完了PBI（Sprint 1〜11）を GitHub Issue
として再現し、Project V2 カスタムフィールドに実績データを設定するためのスクリプトです。

## 用途

- アーカイブ済みPBIの履歴をGitHub上で参照可能にする
- Product Backlogに実績サイズ（size-actual）と乖離理由（variance-text）を記録する
- 既存のIssueが存在する場合はスキップされる（冪等）

> **注**: PBIレベルのeffort値はWP effortの集計値であり、Sprint
> Board上でWP単位で記録するeffortと混在させるべきではないため、アーカイブPBIのeffortデータはSprint
> Boardには書き込みません。

## 前提条件

- `gh` CLI が認証済みであること
- GitHub 認証トークンに以下のスコープが含まれていること

```bash
gh auth refresh -s read:project -s write:project
```

- `.harnessrc` の `projects` フィールドが対象環境の Project V2 番号と一致していること

```bash
# 正しいProject番号の確認方法
gh project list --owner <organization> --format json
```

## 使い方

### 1. 事前確認（dry-run）

マイグレーション計画を確認します。実際の作成や書き込みは行われません。

```bash
deno run -A .agents/skills/bundles/management-bundle/migrate-to-github/scripts/migrate-archive-to-github.ts --dry-run
```

出力例:

```
Found 55 archived PBI(s):

  PBI: Sprint-11-Review-Verification
    Title: Sprint-11-Review-Verification
    Sprint: Sprint 11
    Size: estimate=M / actual=XS
    Effort: initial=1 / planed=1 / actual=1
    Action: Create independent PBI
    Project V2 fields to set (Product Backlog):
      harness-size-actual: XS
      harness-variance-text: Sprint 11 全PBIの受入基準...
```

### 2. 本実行

```bash
deno run -A .agents/skills/bundles/management-bundle/migrate-to-github/scripts/migrate-archive-to-github.ts --migrate --repo <owner/repo>
```

### 3. dry-run付き本実行計画確認

作成されるIssue情報も含めて確認したい場合:

```bash
deno run -A .agents/skills/bundles/management-bundle/migrate-to-github/scripts/migrate-archive-to-github.ts --migrate --repo <owner/repo> --dry-run
```

## オプション一覧

| フラグ                | 説明                                                              |
| --------------------- | ----------------------------------------------------------------- |
| `--dry-run`           | 処理内容を表示のみ（実際の作成・書き込みは行わない）              |
| `--migrate`           | マイグレーションを実行（Issue作成＋Project V2フィールド設定）     |
| `--repo <owner/repo>` | 対象リポジトリ（`--migrate` 時に必須）                            |
| `--backlog <path>`    | アーカイブファイルのパス（省略時は `product-backlog-archive.md`） |
| `--help`              | ヘルプを表示                                                      |

## 動作の流れ

1. `product-backlog-archive.md` をパースし、全完了PBIエントリを抽出
2. 各エントリについて: a. 同一タイトルの既存Issue（`type:PBI` ラベル）を検索 b.
   存在しない場合のみ新規Issueを作成（`type:PBI`、完了状態でclose） c.
   Epic/Feature構造がある場合は階層も作成 d. 該当Sprintのマイルストーンを設定 e. Product
   Backlogに追加し、size-actual、variance-text を設定 ※ アーカイブPBIはSprint
   Boardには追加しません。effortデータは参照用としてIssue Bodyにのみ含まれます。

## 注意事項

- **冪等性**: 何度実行しても同じ結果になります（既存Issueはスキップ）
- **GitHub API レート制限**:
  55件の処理で約500リクエスト消費します。制限に達した場合は1時間後に再実行してください
- **Project番号**: `.harnessrc` の `projects.productBacklog` / `sprintBoard`
  は環境に応じて変更してください
- **重複Issue**:
  中断後・エラー後の再実行で同じPBIが複数作成されることはありません（タイトル一致で既存検出）
