---
name: archive-sprint-review
description: スプリントレビューの結果確認とアーカイブ
tags:
  - trigger: archive-sprint-review, close-review, archive-review, finish-review
  - category: management
---

# archive-sprint-review

スプリント終了時にスプリントレビューの実施報告を確認し、このスプリントを終了しても良いかを判断する。また、スプリントレビューの内容をアーカイブし、今後のプロセスの改善材料とする。

## Quick-Start

### 1. 結果確認

以下のコマンドを実行して、スプリントレビューの実施報告を取得する。
取得したデータを元に、総合判定や各受入条件の判定状況を説明する。

```bash
echo '{}' | deno run -A .agents/skills/bundles/management-bundle/archive-sprint-review/scripts/archive_sprint_review.ts examine
```

### 2. 後続処理の判断

[総合判定と対話パターン](/.agents/skills/bundles/management-bundle/archive-sprint-review/references/reference.md)に基づき、後続処理の判断をPOと合意する。

### 3. アーカイブの事前説明

以下のコマンドを実行してPlanを取得し、[dry-run 出力の解釈](/.agents/skills/bundles/management-bundle/archive-sprint-review/references/reference.md#dry-run-出力の解釈)に従ってPOに説明する。
POの承認が得られたら、次に進む。

```bash
echo '{}' | deno run -A .agents/skills/bundles/management-bundle/archive-sprint-review/scripts/archive_sprint_review.ts archive --dry-run
```

### 4. アーカイブの実行

以下のコマンドを実行して、スプリントレビューをアーカイブする。 実行結果をPOに報告する。

```bash
echo '{}' | deno run -A .agents/skills/bundles/management-bundle/archive-sprint-review/scripts/archive_sprint_review.ts archive
```
