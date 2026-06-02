---
name: hybrid-triage-commit
description: 開発・リファクタリング中のWIP一時コミットと、完了後のアトミックコミット再構築（ポストトリアージ）を制御するスキル
tags:
  trigger:
    - save-wip
    - triage-commit
    - git-commit
  category: git
  constraints: requires-git-repo
---

# hybrid-triage-commit

本スキルは、認知負荷を下げつつ「芸術的に美しいアトミックコミット」を維持するためのハイブリッド・トリアージ戦略を制御します。
本スキルには `wip` と `triage` の2つの実行モードがあります。

## 1. Quick-Start & モード別詳細手順

本スキルには、開発の局面に合わせた 2 つの実行モードがあります。

### A. 【wip モード】進行状況の自動セーブ（開発中）

マイルストーンの達成、テストの通過、またはファイル書き換えの成功時など、こまめに実行して作業のセーブポイントを作ります。

`git-triage.ts` スクリプト（wipモード）を実行します。

```bash
deno run -A .agents/skills/bundles/git-bundle/hybrid-triage-commit/scripts/git-triage.ts wip
```

### B. 【triage モード】歴史の編纂（プッシュ・PR作成直前）

すべての実装、検証、リファクタリングが完了したタイミングで実行し、雑多なWIP履歴を美しいアトミックコミットへと事後的に再構築します。

`git-triage.ts` スクリプト（triageモード）を実行します。

```bash
deno run -A .agents/skills/bundles/git-bundle/hybrid-triage-commit/scripts/git-triage.ts triage
```

スクリプトは以下の処理を対話的にガイドします。

1. ベースブランチ（`origin/main`）を自動検出し、WIP履歴をステージング状態にリセット
2. 全変更ファイルを一覧表示
3. コミット対象ファイルの選択を促す（番号入力/全選択/中断）
4. Conventional Commits 形式でのコミットメッセージ入力を促す
5. **論理的境界バリデーション**: 異なる論理役割（例: `feat` と
   `docs`）のファイル混在を検出し、警告を表示
6. 承認後、アトミックコミットを作成
7. 未コミットのファイルが残っている場合は次のコミット作成に戻る

### C. 【非対話環境での代替手順】手動トリアージ

CIやCLI専用環境など、`git-triage.ts`
の対話的プロンプトが動作しない場合は、以下の手動手順でアトミックコミットを再構築します。

1. **WIP履歴のリセット**: `git reset --soft origin/main`（または適切なベースブランチ）
2. **全変更の確認**: `git status --short` で未コミットの全変更ファイルを一覧表示
3. **論理グループへの分割**:
   - 変更内容を確認し、`feat`（機能追加）、`fix`（修正）、`chore`（雑務）、`docs`（ドキュメント）、`refactor`（リファクタリング）、`test`（テスト）などの論理単位に分類
   - 各グループごとに `git add <ファイル>` でステージングし、`git commit -m "type: メッセージ"`
     でコミット
4. **Conventional Commits の遵守**: コミットメッセージは `type(scope): 説明` の形式に従う
5. **最終確認**: `git log --oneline` で履歴の論理性を確認

```bash
# 実例：3つの論理コミットに分割する場合
git reset --soft origin/main
git status --short
# グループ1: rename操作
git add path/to/rename/files
git commit -m "feat: rename X to Y"
# グループ2: トリガー更新
git add path/to/trigger/files
git commit -m "chore: update trigger tags"
# グループ3: 参照修正
git add path/to/reference/files
git commit -m "docs: update references"
```

## 2. 詳細仕様 (Sidecar Reference)

具体的なトリアージの決定木や、コミットメッセージの分類規格については、以下のサイドカーリファレンスを参照してください。

- **[トリアージプロセス詳細](/.agents/skills/bundles/git-bundle/hybrid-triage-commit/references/hybrid-triage-commit-process.md)**
