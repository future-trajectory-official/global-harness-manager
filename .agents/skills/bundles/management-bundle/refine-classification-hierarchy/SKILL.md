---
name: refine-classification-hierarchy
description: スプリント開始時に、既存のエピック/フィーチャー分類階層を改善し、PBIを適切なフィーチャーに配置する。
tags:
  - trigger: refine-classification
  - trigger: sprint-start-hierarchy
  - category: management
---

# refine-classification-hierarchy

既存のエピックとフィーチャーの分類階層を対話的に改善し、PBIを適切なフィーチャーに配置する。
スプリント開始時のバックログリファインメントで使用する。

## 制約

- Quick-Start の各 Phase 間でユーザーの回答を待つこと（先読みして次に進まない）
- PBIは必ずしもFeatureに所属する必要はない。所属解除（`unassign-pbi-from-feature`）も許容する

## Quick-Start

### Phase 1: 既存階層の表示

現在の全Epicの分類階層（Epic → Feature）を表示する。引数は不要。

```bash
echo '{"operation":"show-hierarchy"}' | deno run -A .agents/skills/bundles/management-bundle/refine-classification-hierarchy/scripts/refine_classification_hierarchy.ts
```

表示結果をPOに提示し、改善点をヒアリングする。

<!-- STOP -->

### Phase 2: 対話による再定義

表示された階層に対し、POの違和感や変更点をヒアリングする。 質問の仕方は
[references/reference.md](/.agents/skills/bundles/management-bundle/refine-classification-hierarchy/references/reference.md)
を参照すること。

決定した変更内容に応じて、以下のいずれかの操作を実行する：

```bash
# エピックの再定義 (epicNumber: Issue番号)
echo '{"operation":"revise-epic","title":"<タイトル>","epicNumber":"<Issue番号>","description":"<新しい説明>","reason":"<変更理由>"}' | deno run -A .agents/skills/bundles/management-bundle/refine-classification-hierarchy/scripts/refine_classification_hierarchy.ts --dry-run

# フィーチャーの再定義 (featureNumber: Issue番号)
echo '{"operation":"revise-feature","title":"<タイトル>","featureNumber":"<Issue番号>","description":"<新しい説明>","reason":"<変更理由>"}' | deno run -A .agents/skills/bundles/management-bundle/refine-classification-hierarchy/scripts/refine_classification_hierarchy.ts --dry-run
```

dry-runでPlanを確認し、PO承認後に `--dry-run` を外して本実行する。

<!-- STOP -->

### Phase 3: 親子関係の変更

エピックとフィーチャーの親子関係を変更する。

```bash
# FeatureをEpicに所属させる (featureNumber: FeatureのIssue番号, parentEpicNumber: EpicのIssue番号)
echo '{"operation":"assign-feature-to-epic","title":"<Featureタイトル>","featureNumber":"<FeatureのIssue番号>","parentEpicNumber":"<EpicのIssue番号>"}' | deno run -A .agents/skills/bundles/management-bundle/refine-classification-hierarchy/scripts/refine_classification_hierarchy.ts --dry-run

# FeatureのEpic所属を解除する (featureNumber: FeatureのIssue番号)
echo '{"operation":"unassign-feature-from-epic","title":"<Featureタイトル>","featureNumber":"<FeatureのIssue番号>"}' | deno run -A .agents/skills/bundles/management-bundle/refine-classification-hierarchy/scripts/refine_classification_hierarchy.ts --dry-run
```

dry-runでPlanを確認し、PO承認後に本実行する。

<!-- STOP -->

### Phase 4: PBIのFeature配置

PBIをFeatureに紐付ける（または紐付けを解除する）。

```bash
# PBIをFeatureに所属させる (pbiNumber: PBIのIssue番号, parentFeatureNumber: FeatureのIssue番号)
echo '{"operation":"assign-pbi-to-feature","title":"<PBIタイトル>","pbiNumber":"<PBIのIssue番号>","parentFeatureNumber":"<FeatureのIssue番号>"}' | deno run -A .agents/skills/bundles/management-bundle/refine-classification-hierarchy/scripts/refine_classification_hierarchy.ts --dry-run

# PBIのFeature所属を解除する（Feature未所属のPBIも許容）
echo '{"operation":"unassign-pbi-from-feature","title":"<PBIタイトル>","pbiNumber":"<PBIのIssue番号>"}' | deno run -A .agents/skills/bundles/management-bundle/refine-classification-hierarchy/scripts/refine_classification_hierarchy.ts --dry-run
```

dry-runでPlanを確認し、PO承認後に本実行する。

<!-- STOP -->

### Phase 5: 完了報告

完成したPBI/Feature/Epicの構造は、ProjectV2のボードで確認できる旨をPOに伝える。 必要に応じて Phase
1（show-hierarchy）で結果を再表示する。
