---
name: conclude-sprint
description: スプリントを終了する。
tags:
  - trigger: conclude-sprint
  - trigger: end-sprint
  - trigger: close-sprint
  - category: management
---

# conclude-sprint

スプリントを終了する。

## スキルの事前条件

当該スプリントのアーカイブ・ベロシティ記録・メトリクス評価・レトロスペクティブ・スキル最適化・ステートレスリセットが全て完了し、POがスプリント終了を最終承認していること。

## スクリプトの前提条件（対話で確定する値）

- スプリント番号: AIとPOの対話により確定
- 識別情報: 省略時は自動検出

## 事後条件

対象のスプリントが終了状態になる。

## Quick-Start

### Phase 1: スプリント終了

以下の手順でスプリントを終了する。

1. **対象スプリントの確認**: POに対象スプリント番号と影響を確認し、最終承認を得る。
2. **スクリプトの実行（dry-run）**: 確定したスプリント番号を入力として dry-run を実行し、終了される
   Plan を PO に提示する。
   ```bash
   echo '{"sprintNumber": N}' | deno run -A .agents/skills/bundles/management-bundle/conclude-sprint/scripts/conclude_sprint.ts --dry-run
   ```
3. **PO承認**: Plan の内容を PO が確認し、承認する。
4. **本実行**: PO承認後、本実行を行いスプリントを終了する。
   ```bash
   echo '{"sprintNumber": N}' | deno run -A .agents/skills/bundles/management-bundle/conclude-sprint/scripts/conclude_sprint.ts
   ```

<!-- STOP -->
