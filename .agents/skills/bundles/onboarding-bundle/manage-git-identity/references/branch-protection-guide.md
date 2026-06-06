# Branch Protection & Merge Method 設定ガイド

本ガイドは、リポジトリに対するマージ方式の制限と main ブランチの保護を `gh api` 経由で CLI
から設定する手順を説明します。

> **注意**: 以下のコマンド内の `{owner}` および `{repo}` は `gh api`
> がカレントディレクトリのGitリモートから自動的に補完するプレースホルダです。
> 対象リポジトリのディレクトリでコマンドを実行してください。

## 用語の整理

| 用語                                     | 対象範囲                 | 役割                                                    |
| ---------------------------------------- | ------------------------ | ------------------------------------------------------- |
| **リポジトリ設定 (Repository Settings)** | 全ブランチ               | マージ方式（Merge commit / Squash / Rebase）の許可/禁止 |
| **Branch Protection**                    | 特定ブランチ（例: main） | 直接push禁止、PR必須、ステータスチェック等              |

両者は別物です。マージ方式の制限はリポジトリ設定で行い、直接pushの禁止は Branch Protection
で行います。

---

## 1. 事前確認

### 1-1. リポジトリ設定の確認

現在のマージ方式の設定を確認します。

```bash
gh api repos/{owner}/{repo} \
  --jq '{allow_merge_commit, allow_squash_merge, allow_rebase_merge}'
```

**出力例（未設定時）**:

```json
{
  "allow_merge_commit": true,
  "allow_squash_merge": true,
  "allow_rebase_merge": true
}
```

### 1-2. Branch Protection の確認

main ブランチの保護状態を確認します。

```bash
gh api repos/{owner}/{repo}/branches/main/protection \
  --jq '{required_pull_request_reviews, enforce_admins}' 2>/dev/null \
  || echo "Branch protection は未設定です"
```

**出力例（未設定時）**:

```
Branch protection は未設定です
```

---

## 2. 設定1: マージ方式の制限（リポジトリ設定）

マージ方式を **Merge commit のみ許可** に制限します。

```bash
gh api -X PATCH repos/{owner}/{repo} \
  -F allow_merge_commit=true \
  -F allow_squash_merge=false \
  -F allow_rebase_merge=false
```

### 各フラグの意味

| フラグ               | 設定値  | 説明                                                                                                                                      |
| -------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `allow_merge_commit` | `true`  | マージコミット (`--no-ff`) を許可します。複数のコミットをグループ化し、ブランチの履歴をそのまま残します。                                 |
| `allow_squash_merge` | `false` | スカッシュマージを禁止します。スカッシュマージが許可されていると、AIが誤って複数のコミットを1つにまとめて履歴を消失するリスクがあります。 |
| `allow_rebase_merge` | `false` | リベースマージを禁止します。リベースマージでは個別のコミットが main に直接適用されるため、コミットのグループ化情報が失われます。          |

### 注意点

- **影響範囲**: リポジトリ設定は全ブランチに適用されます。本プロジェクトは GitHub Flow（main
  単一ブランチ運用）のため、実質的な影響は main ブランチのみです。
- **既存PR**:
  設定変更は既存のオープン中のPRには影響しません。設定変更後に作成されるPRから適用されます。

---

## 3. 設定2: main ブランチの直接push禁止（Branch Protection）

main ブランチへの直接pushを禁止し、すべての変更を Pull Request 経由にするよう強制します。

```bash
gh api -X PUT repos/{owner}/{repo}/branches/main/protection \
  --input - <<'JSON'
{
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true
  },
  "enforce_admins": true,
  "required_status_checks": null,
  "restrictions": null
}
JSON
```

### 各パラメータの意味

| パラメータ                                                      | 値     | 説明                                                                                                                                                                                                     |
| --------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `required_pull_request_reviews.required_approving_review_count` | `1`    | マージに最低1件の承認レビューを必須にします。これにより、main への直接pushが物理的に禁止され、すべての変更がPR経由になります。                                                                           |
| `required_pull_request_reviews.dismiss_stale_reviews`           | `true` | 新しいコミットがpushされた場合、既存の承認レビューを却下します。古い承認が残ったままの状態でのマージを防ぎます。                                                                                         |
| `enforce_admins`                                                | `true` | リポジトリ管理者も上記ルールの適用対象とします。`false` にすると管理者だけ直接push可能になり、ガードレールの意味が薄れます。ただし緊急時の回避手段が失われるため、チームの運用に応じて判断してください。 |
| `required_status_checks`                                        | `null` | CIステータスチェックの必須化は行いません（現時点では任意）。必要に応じて後日追加できます。                                                                                                               |
| `restrictions`                                                  | `null` | push可能ユーザー/チームの制限は行いません（全コラボレーターがPRを作成可能）。                                                                                                                            |

### `enforce_admins` のトレードオフ

- **`true`（推奨）**: 管理者も含めて全員がPR必須となり、ガバナンスが徹底されます。
- **`false`**:
  管理者は直接push可能なため、緊急時のホットフィックスを高速に行えますが、ガードレールをバイパスできてしまいます。
- **推奨**: CIとレビュープロセスが確立している本プロジェクトでは `true` を推奨します。

---

## 4. 設定後の動作確認

### 4-1. リポジトリ設定の確認

```bash
gh api repos/{owner}/{repo} \
  --jq '{allow_merge_commit, allow_squash_merge, allow_rebase_merge}'
```

**期待される出力**:

```json
{
  "allow_merge_commit": true,
  "allow_squash_merge": false,
  "allow_rebase_merge": false
}
```

### 4-2. Branch Protection の確認

```bash
gh api repos/{owner}/{repo}/branches/main/protection \
  --jq '{required_pull_request_reviews: .required_pull_request_reviews.required_approving_review_count, enforce_admins: .enforce_admins.enabled}'
```

**期待される出力**:

```json
{
  "required_pull_request_reviews": 1,
  "enforce_admins": true
}
```

### 4-3. 直接pushの動作確認（オプション）

```bash
# main ブランチに直接コミットを試みる（エラーになることを確認）
git checkout main
echo "# test" | git commit --allow-empty -m "test: direct push check"
git push origin main 2>&1 || echo "✅ 直接pushは正しくブロックされました"
# 確認後、コミットは削除
git reset --hard HEAD~1
```
