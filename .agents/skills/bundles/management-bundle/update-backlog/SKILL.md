---
name: update-backlog
description: PBI およびWPの進捗更新（ステータス変更・編集）を行う。
tags:
  trigger:
    - update-progress
    - complete-wp
    - complete-pbi
  category: management
---

# update-backlog

プロダクトバックログの記述を更新し、開発の進捗を正しく反映させます。

## 重要

- **PO承認必須**: ステータス変更（`[WIP]` → `[DONE]` 等）は必ずPOの明示的承認を得てから実行すること
- **追跡対象外ファイル**: `.gitignore` 対象のファイル（例:
  `.agents/management/product-backlog.md`）は**コミットしない**。ローカルで編集するのみ

## 手順

### 1. WP 進捗の更新

- ワークパッケージ（WP）の受入基準（AC）の完了状況を確認し、チェックボックスを完了（`[x]`）にします。
- 完了していないACが残っている場合は、ユーザーに報告し、指示を待ちます。
- WP内の全てのACが完了の場合、WPが完了したと判断します。

### 2. PBI 進捗の更新

- PBI内の全てのWPが完了している場合、**POに完了報告**し、承認を得てからPBIのステータスを`[WIP]`から`[DONE]`に変更する。
- PBI内に未完了のWPが残っている場合は、残りのWPの数とそれぞれのWPの要約をユーザーに報告する。
- **PBIのステータスを`[DONE]`に変更する前に、必ずPOの明示的承認を得ること。**
