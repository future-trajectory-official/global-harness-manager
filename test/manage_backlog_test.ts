import { assertEquals, assertStringIncludes } from "@std/assert";
import { extractPbiBlock, transformToArchiveCard, updateContents } from "../.agents/skills/bundles/management-bundle/update-backlog/scripts/manage_backlog.ts";

/**
 * manage_backlog.ts のテスト
 * 
 * 【検証の意図】
 * 1. 抽出ロジック: 複雑なマークダウン構造から、特定の PBI ブロック（### [DONE] ...）を
 *    過不足なく切り出せるかを確認する。
 * 2. 変換ロジック: 抽出した概要や AC、および引数で渡されたタグやメトリクスが
 *    アーカイブ用のテンプレート（インクリメントカード）に正しく埋め込まれるかを確認する。
 * 3. 挿入ロジック: アーカイブファイルの「## 完了済みアイテム」という H2 セクションを
 *    挿入ポイントとして正しく認識できるかを確認する。
 */

// モックデータ: product-backlog.md の構造
const mockBacklog = `
# プロダクトバックログ

## プロダクトゴール
...

## スプリントバックログ

### [DONE] [Epic/Feature]/Target-PBI

- **概要**: このタスクの目的です。
- **受け入れ基準 (AC)**:
  - [x] AC1
  - [x] AC2
- **タスク**:
  - [x] Task1

### [TODO] [Next/Feature]/Other-PBI
...
`;

// モックデータ: product-backlog-archive.md の構造
const mockArchive = `
# プロダクトバックログアーカイブ

<!-- 説明文 -->

## 完了済みアイテム

### [DONE] [Old/Feature]/Old-PBI
- **完了日**: 2026-05-12
...
`;

Deno.test("PBI 抽出ロジックの検証", () => {
  const pbiId = "[Epic/Feature]/Target-PBI";
  const { block } = extractPbiBlock(mockBacklog, pbiId);
  
  assertStringIncludes(block, "AC1", "ACが含まれていること");
  assertStringIncludes(block, "Task1", "タスクリストが含まれていること");
});

Deno.test("アーカイブ形式への変換ロジックの検証", () => {
  const inputJson = {
    id: "[Epic/Feature]/Target-PBI",
    insights: "これはテストでの知見です。",
    tags: ["#Decision", "#Architecture"],
    metrics: { turns: 15, sessions: 1 },
    outcomes: ["- scripts/test.ts の作成"],
  };

  const pbiId = "[Epic/Feature]/Target-PBI";
  const { block } = extractPbiBlock(mockBacklog, pbiId);
  
  const resultCard = transformToArchiveCard(inputJson, block);

  assertStringIncludes(resultCard, "#Decision #Architecture");
  assertStringIncludes(resultCard, "15 ターン / 1 セッション");
  assertStringIncludes(resultCard, "AC2");
});

Deno.test("アーカイブファイルへの挿入位置の検証", () => {
  const newCard = "### [DONE] [New/PBI]";
  // pbiRegex はモックで適当に
  const dummyRegex = /dummy/;
  
  const { newArchive } = updateContents(mockBacklog, mockArchive, dummyRegex, newCard);

  assertStringIncludes(newArchive, "## 完了済みアイテム");
  const lines = newArchive.split("\n");
  const markerIndex = lines.findIndex(l => l.includes("## 完了済みアイテム"));
  assertEquals(lines[markerIndex + 1], newCard, "H2 の直後に新しいカードが挿入されること");
});
