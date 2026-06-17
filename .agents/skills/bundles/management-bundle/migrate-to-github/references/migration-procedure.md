# 移行手順

本ドキュメントは `migrate-to-github` スキルの詳細手順を定義します。 Quick-Startからは Step 1〜3
の手順が参照されます。

---

## 移行の全体像

本PBI（Parallel-Run-and-Migration）では、ローカルMarkdown管理からGitHub
Issues/Projects単体運用への移行を以下のフェーズで進めます。

### 移行フェーズ一覧

| Phase        | WP   | 内容                             | 状態      |
| ------------ | ---- | -------------------------------- | --------- |
| 設計         | WP_0 | 移行設計・運用フローの検討       | ✅ 完了   |
| ツール       | WP_2 | Interactive移行スクリプト作成    | ✅ 完了   |
| ドキュメント | WP_1 | 運用手順書・移行ガイド作成       | 🔄 進行中 |
| 検証         | WP_3 | 移行データ検証                   | ⬜ 未着手 |
| 完了         | WP_4 | 完全移行（ローカルファイル削除） | ⬜ 未着手 |

### セッション系・スプリント系の移行の流れ

| ワークフロー     | 移行前（ローカル）                                                    | 移行後（GitHub）                      |
| ---------------- | --------------------------------------------------------------------- | ------------------------------------- |
| `/sprint-start`  | [`product-backlog.md`](/.agents/management/product-backlog.md) の編集 | Milestone作成 + PBI Issue 作成/紐付け |
| `/session-start` | task.md + implementation_plan.md の作成                               | PBI Issue の AC 更新 + WP子Issue操作  |
| `/session-end`   | task.md の完了報告                                                    | GitHub Issue の Status 更新           |
| `/sprint-end`    | product-backlog-archive.md への移動                                   | PBI Issue Close + Project V2 更新     |

### 並行運用時の判断基準

移行完了までは、**ローカルMarkdown管理を主（Source of
Truth）**、GitHubのIssue/Projectを従として運用します。

1. **新規PBIの作成**: まず [`product-backlog.md`](/.agents/management/product-backlog.md)
   に追記し、その後に `migrate-to-github` スキルでGitHubへ移行する。
2. **既存PBIの更新**: ローカルの [`product-backlog.md`](/.agents/management/product-backlog.md)
   を編集し、必要に応じてGitHubのIssueを更新する。
3. **移行順序**: WP_1（本ドキュメント）→ WP_3（検証）→ WP_4（完全移行）の順で進行する。

---

## Step 1: 移行対象の全PBIを一覧表示する

以下のコマンドで全PBIをJSON形式で取得する。

```bash
deno run -A .agents/skills/bundles/management-bundle/migrate-to-github/scripts/migrate-to-github.ts --list --dry-run
```

出力JSONの `id`
フィールドが移行時に使用するPBI識別子です。`status`（TODO/WIP/DONE）、`size`、`wpList`
の有無も確認すること。DONEのPBIは移行後close状態になります。

## Step 2: POと対話し移行するPBIを確定する

`--list` の出力を基に、POに以下の情報を提示し移行の可否を確認する。

- PBIのID、Status、Size、WP数
- WPごとのEffort見積とAC一覧
- DONEのPBI → 移行後クローズされる説明を付記
- 未完了WPを含むPBI → open状態を維持する説明を付記

### POの応答とAIの行動

| POの応答            | AIの行動                         |
| ------------------- | -------------------------------- |
| `yes` / `はい`      | 次のStepに進む                   |
| `skip` / `スキップ` | 次のPBIを提示する                |
| `stop` / `終了`     | 移行を終了し結果を報告           |
| （修正指示）        | 指示に従い情報を修正してから移行 |

## Step 3: dry-runで事前確認する

確定したPBIのIDとリポジトリでdry-runを実行し、POの最終確認を得る。

```bash
echo '{"pbiId":"<id>","repo":"<owner/repo>"}' | deno run -A .../migrate-to-github.ts --stdin --dry-run
```

出力例:

```
[DRY-RUN] Would create PBI Issue:
  Title: [Epic/Feature]/PBI-Name
  Labels: type:PBI, status:wip
  With 2 child WP Issue(s):
    - WP_1: タスクA (Effort: 2回)
      ACs: AC1 ... | AC2 ...
```

## Step 4: 実行する

```bash
echo '{"pbiId":"<id>","repo":"<owner/repo>"}' | deno run -A .../migrate-to-github.ts --stdin
```

## Step 5: 結果を報告する

作成されたIssue番号とURLをPOに報告する。POが終了を宣言するまでStep 2〜5を繰り返す。

```
作成完了:
  PBI: https://github.com/owner/repo/issues/N
  WP_1: https://github.com/owner/repo/issues/N-1
  WP_2: https://github.com/owner/repo/issues/N-2
```

## 参考: 発話テンプレート

### PBI提示

```markdown
次のPBIの移行を提案します：

ID: [Epic/Feature]/PBI-Name Status: TODO Size: M WPs: 3件（完了: 1件）

Work Packages: WP_1: タスクA (Effort: 2回) - [ ] AC1: ... WP_2: タスクB (Effort: 1回) ✅ - [x] AC1:
...

このPBIを移行しますか？ (yes/skip/stop)
```

### 実行結果報告

```
PBI Issue #42 を作成しました。
  https://github.com/owner/repo/issues/42

  WP_1 → #43  (open)
  WP_2 → #44  (closed: 完了済み)

次に進みますか？ (yes/stop)
```
