---
name: design-classification-hierarchy
description: キックオフ時に、プロダクトゴールに基づいたエピックとフィーチャーの分類階層を対話的に設計する。
tags:
  - trigger: design-classification
  - trigger: kickoff-epic-feature
  - category: management
---

# design-classification-hierarchy

プロダクトゴールに基づき、エピックとフィーチャーの分類階層をゼロから設計し、GitHub
Issueとして永続化する。

## スキルの事前条件

POがプロダクトゴールを確定していること。

## スクリプトの前提条件（対話で確定する値）

- Phase 1: なし（プロダクトゴールは既存）
- Phase 2: エピックのタイトル・説明文
- Phase 3: フィーチャーのタイトル・説明文・親エピックの識別情報
- Phase 4: 表示対象のエピック識別情報

## 事後条件

エピックとフィーチャーがGitHub
Issueとして作成され、親子関係が構築されている。完成した分類階層をPOが確認・合意している。

## Quick-Start

### Phase 1: エピック候補の洗い出し

プロダクトゴールに基づき、必要なエピックの候補をPOとの対話で洗い出す。

1. **プロダクトゴールの確認**: 現在のプロダクトゴールをPOに提示し、確認する。
2. **エピック候補の探索**:
   「このゴールを達成するには、どのような分類（分野）が必要ですか？」と問いかけ、エピック候補を列挙する。
3. **優先順位の決定**: 候補の中から、今回 design-classification-hierarchy
   で構造化するエピックをPOに決定してもらう。

<!-- STOP -->

### Phase 2: エピックの定義

対話で決定したエピックをGitHub Issueとして定義する。

1. **エピック情報の確定**:
   POからエピックのタイトルと説明文（そのエピックがカバーする範囲）をヒアリングする。
2. **スクリプトの実行（dry-run）**: 確定した情報で dry-run を実行し、作成されるPlanをPOに提示する。
   ```bash
   echo '{"operation":"define-epic","title":"エピックのタイトル","description":"エピックの説明"}' | deno run -A .agents/skills/bundles/management-bundle/design-classification-hierarchy/scripts/design_classification_hierarchy.ts --dry-run
   ```
3. **PO承認**: Planの内容をPOが確認し、承認する。
4. **本実行**: PO承認後、本実行を行いエピックを作成する。
   ```bash
   echo '{"operation":"define-epic","title":"エピックのタイトル","description":"エピックの説明"}' | deno run -A .agents/skills/bundles/management-bundle/design-classification-hierarchy/scripts/design_classification_hierarchy.ts
   ```
5. **識別情報の記録**: 作成されたエピックのIssue番号を記録する（後続Phaseで使用）。

<!-- STOP -->

### Phase 3: フィーチャーの定義とエピックへの紐づけ

対話で決定したフィーチャーを作成し、Phase 2で定義したエピックに紐づける。

1. **フィーチャー情報の確定**:
   「このエピックに含まれるべき具体的な機能分野は何ですか？」と問いかけ、フィーチャーのタイトルと説明文をPOからヒアリングする。
2. **スクリプトの実行（dry-run）**: エピックのIssue番号を親として指定し、dry-runを実行する。
   ```bash
   echo '{"operation":"define-feature","title":"フィーチャーのタイトル","description":"フィーチャーの説明","parentEpicTitle":"親エピックのタイトル","parentEpicId":"<Phase2で記録したIssue番号>"}' | deno run -A .agents/skills/bundles/management-bundle/design-classification-hierarchy/scripts/design_classification_hierarchy.ts --dry-run
   ```
3. **PO承認**: Planの内容をPOが確認し、承認する。
4. **本実行**: PO承認後、本実行を行いフィーチャーを作成・紐づけする。
5. **以降のフィーチャー**: 必要なフィーチャー数だけ上記を繰り返す。

<!-- STOP -->

### Phase 4: 分類階層の表示とPO合意

完成したエピックとフィーチャーの親子関係を表示し、POの最終合意を得る。

1. **階層の表示**: エピックのIssue番号を指定し、分類階層を表示する。
   ```bash
   echo '{"operation":"show-hierarchy","title":"エピックのタイトル","epicId":"<Issue番号>","epicNumber":"<Issue番号>"}' | deno run -A .agents/skills/bundles/management-bundle/design-classification-hierarchy/scripts/design_classification_hierarchy.ts
   ```
2. **PO確認**: 表示されたエピック→フィーチャーの構造をPOに提示し、過不足や分類の妥当性を確認する。
3. **合意取得**: 必要に応じて修正（再定義・紐づけ変更）を行い、POの最終合意を得る。

<!-- STOP -->
