---
name: archive-backlog
description: 完了したPBIのアーカイブカード生成およびアーカイブファイルの更新を行う。
tags:
  trigger:
    - archive-backlog
    - sprint-end
  category: management
---

# archive-backlog

スプリント終了時に実行し、完了したPBIのアーカイブ処理を行います。
本スキルはバックログの更新（`update-backlog`）とは異なり、アーカイブ専用です。

## 手順

### 1. アーカイブ対象PBIの特定

- スプリント内の全 `[DONE]` PBI を特定します。

### 2. AIによる予実差分析

- 各PBIについて、セッション履歴から以下の情報をJSON形式に構成します。
- 詳細なJSONスキーマは
  [automated-archive-logic.md](/.agents/skills/bundles/management-bundle/archive-backlog/references/automated-archive-logic.md)
  を参照してください。

### 3. アーカイブの実行

以下のコマンドでアーカイブを実行します。

```bash
deno run -A .agents/skills/bundles/management-bundle/archive-backlog/scripts/archive_backlog.ts --data 'JSON_STRING'
```

### 4. 反映のコミット

- アーカイブ完了後、`docs: archive [PBI-ID]` としてコミットを提案します。

> [!IMPORTANT]
> アーカイブは単なる「移動」ではなく、プロジェクトの **「知恵のインデックス化」** です。特に
> `#Decision` や `#Pivot` タグを活用し、将来の判断材料を蓄積してください。詳細な運用ルールは
> [backlog-guidelines.md](/guides/backlog-guidelines.md) を参照してください。
