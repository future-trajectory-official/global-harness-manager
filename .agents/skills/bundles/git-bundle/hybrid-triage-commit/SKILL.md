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

1. 現在のワーキングツリーの状態を確認します。
   ```bash
   git status
   ```
2. 進行状況をWIPコミットとして安全にセーブします。
   ```bash
   git commit -am "[wip] savepoint"
   ```
   - ※新規追加ファイルがある場合は、先に `git add` を行ってからコミットしてください。

### B. 【triage モード】歴史の編纂（プッシュ・PR作成直前）

すべての実装、検証、リファクタリングが完了したタイミングで実行し、雑多なWIP履歴を美しいアトミックコミットへと事後的に再構築します。

1. **WIP履歴をステージングに戻す**: ベースブランチ（通常は
   `origin/main`）を指定して、現在のWIP履歴を安全にリセットし、すべての変更をステージング状態に戻します。
   ```bash
   git reset --soft origin/main
   ```
2. **変更の全体像の俯瞰**: ステージングされている全ファイルの diff
   を表示し、どのファイルがどの論理的役割（機能追加、リファクタリング、テスト等）を持っているかを論理的に分類・分析します。
   ```bash
   git diff --cached --stat
   ```
3. **アトミックコミットの順次構築**:
   論理的にまとめるべきファイルのみをステージングに残し、残りを一時的にステージングから外して、アトミックコミット（Conventional
   Commits 準拠）を作成します。
   - 特定ファイルのみコミットする場合：
     ```bash
     # 一旦すべてアンステージ
     git reset
     # 関連するファイルのみステージング
     git add path/to/file
     # アトミックコミットの作成
     git commit -m "feat: xxx"
     ```
   - これをすべての変更ファイルが美しく整理・コミットされるまで繰り返します。

## 2. 詳細仕様 (Sidecar Reference)

具体的なトリアージの決定木や、コミットメッセージの分類規格については、以下のサイドカーリファレンスを参照してください。

- **[トリアージプロセス詳細](file://.agents/skills/bundles/git-bundle/hybrid-triage-commit/references/hybrid-triage-commit-process.md)**
