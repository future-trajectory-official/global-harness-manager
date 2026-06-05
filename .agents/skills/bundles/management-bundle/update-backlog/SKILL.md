---
name: update-backlog
description: PBI の進捗更新（ステータス変更・編集）を行う。
tags:
  trigger:
    - update-progress
    - complete-pbi
  category: management
---

# update-backlog

プロダクトバックログの記述を更新し、開発の進捗を正しく反映させます。

## 手順

### 1. 進捗の更新 (WIP)

- タスクの完了（`[x]`）に伴い、バックログを更新します。
- 1つでもタスクが着手されたら、ステータスを `[WIP]` に変更します。

### 2. 反映のコミット

- ドキュメント更新完了後、`docs: update [PBI-ID]` としてコミットを提案します。
