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
が完了した場合は、アーカイブ処理を行います。

## 運用手順

### 1. 進捗の更新 (WIP)

- タスクが完了（`[x]`）するたびに、バックログを更新します。
- 1つでもタスクが完了したら、PBI のステータスを `[WIP]` に変更します。

### 2. 完了とアーカイブ (DONE)

PBI の全タスクが完了した場合、自動アーカイブスクリプトを使用して履歴を記録します。

1. **情報の集約**:
   - その PBI の実装中に得られた「知見・教訓」を整理し、適切な **知見タグ**（`#Troubleshooting`, `#Decision`, `#Pivot` 等）を選定します。
   - 実績メトリクス（かかったターン数、セッション数）を算出します。
2. **スクリプトの実行**:
   - 以下の JSON データを構成し、`.agents/skills/bundles/management-bundle/update-backlog/scripts/manage_backlog.ts` を実行します。

```bash
deno run -A .agents/skills/bundles/management-bundle/update-backlog/scripts/manage_backlog.ts --data '{
  "id": "[Epic/Feature]/PBI-Name",
  "insights": "得られた知見の本文...",
  "tags": ["#Decision", "#Architecture"],
  "metrics": { "turns": 15, "sessions": 1 },
  "outcomes": ["- 成果物1", "- 成果物2"]
}'
```

3. **反映の確認**:
   - スクリプトが表示する diff を確認し、`product-backlog-archive.md` の「## 完了済みアイテム」セクションの直後に正しくカードが挿入されたことを検証します。

### 3. コミットの提案

- ドキュメントの更新が完了したら、単独のコミット（例: `docs: archive [EpicID/FeatureID]/PBI-Name`）をユーザーに提案します。

## ⚠️ 注意事項

- アーカイブは単なる「移動」ではなく、プロジェクトの **「知恵のインデックス化」** です。特に `#Decision` や `#Pivot` タグを活用し、将来の AI が判断の背景を再利用できるようにしてください。
