---
name: update-backlog
description: PBI の進捗更新、および完了した PBI のアーカイブ化を行う。
tags:
  trigger:
    - update-progress
    - complete-pbi
    - archive-backlog
  category: management
---

# update-backlog

プロダクトバックログの記述を更新し、開発の進捗を正しく反映させます。PBI
が完了した場合は、自動化スクリプトを用いてアーカイブ処理を行います。

## 手順

### 1. 進捗の更新 (WIP)

- タスクの完了（`[x]`）に伴い、バックログを更新します。
- 1つでもタスクが着手されたら、ステータスを `[WIP]` に変更します。

### 2. 完了とアーカイブ (DONE)

PBI の全タスクが完了した場合、自動アーカイブを実行します。

- **実行詳細**:
  実装中に得られた知見やメトリクスを整理し、[automated-archive-logic.md](references/automated-archive-logic.md)
  の仕様に従って以下の Quick-Start コマンドを実行してください。

### Quick-Start (実行コマンド)

```bash
deno run -A .agents/skills/bundles/management-bundle/update-backlog/scripts/manage_backlog.ts --data 'JSON_STRING'
```

### 3. 反映のコミット

- ドキュメント更新完了後、`docs: archive [PBI-ID]` としてコミットを提案します。

> [!IMPORTANT]
> アーカイブは単なる「移動」ではなく、プロジェクトの **「知恵のインデックス化」** です。特に
> `#Decision` や `#Pivot` タグを活用し、将来の判断材料を蓄積してください。詳細な運用ルールは
> [backlog-guidelines.md](../../../../management/backlog-guidelines.md) を参照してください。
