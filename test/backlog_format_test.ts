/**
 * プロダクトバックログのフォーマット準拠テスト
 *
 * 【検証の意図】
 * 1. product-backlog.md が product-backlog.md.example（正規テンプレート）の
 *    フィールド定義・構造に準拠していることを確認する。
 * 2. product-backlog-archive.md が product-backlog-archive.md.example の
 *    フィールド定義・構造に準拠していることを確認する。
 * 3. テンプレートと実体の構造乖離を deno task qa で検出し、
 *    フォーマットの一貫性を維持する。
 *
 * 【CI注意】
 * product-backlog.md と product-backlog-archive.md は .gitignore 対象のため、
 * CI環境では存在しない。該当テストはファイル不在時に自動スキップされる。
 */

import { assert, assertStringIncludes } from "@std/assert";

const ROOT = new URL("../", import.meta.url).pathname;

const BACKLOG_PATH = `${ROOT}.agents/management/product-backlog.md`;
const ARCHIVE_PATH = `${ROOT}.agents/management/product-backlog-archive.md`;
const GUIDELINES_PATH = `${ROOT}.agents/management/backlog-guidelines.md`;

function fileExists(path: string): boolean {
  try {
    Deno.statSync(path);
    return true;
  } catch {
    return false;
  }
}

function readFixture(path: string): string {
  return Deno.readTextFileSync(path);
}

function extractH3PbiBlocks(md: string): string[] {
  const lines = md.split("\n");
  const blocks: string[] = [];
  let current: string[] = [];
  let inBlock = false;
  for (const line of lines) {
    if (/^###\s+\[(TODO|WIP|DONE)\]/.test(line)) {
      if (inBlock && current.length > 0) {
        blocks.push(current.join("\n"));
      }
      current = [line];
      inBlock = true;
    } else if (inBlock) {
      if (/^##\s/.test(line) || (line.startsWith("---") && current.length > 1)) {
        blocks.push(current.join("\n"));
        current = [];
        inBlock = false;
      } else {
        current.push(line);
      }
    }
  }
  if (inBlock && current.length > 0) blocks.push(current.join("\n"));
  return blocks;
}

function extractField(block: string, fieldName: string): string | null {
  const escaped = fieldName.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
  const regex = new RegExp(`^- \\*\\*${escaped}\\*\\*:(.*)$`, "m");
  const match = block.match(regex);
  return match ? match[1].trim() : null;
}

function hasH4WpSection(block: string): boolean {
  return /^####\s+WP_\d+:.*$/m.test(block);
}

function hasEffortEstimate(block: string): boolean {
  return /\*\*Effort見積（介入回数）\*\*:\s*\d+回/.test(block);
}

/** PBIブロックの見出し行からPBI名（パス区切りの最後の部分）を抽出する */
function extractPbiName(headingLine: string): string {
  const match = headingLine.match(/\[(?:TODO|WIP|DONE)\]\s+.*\/(.+)$/);
  return match ? match[1].trim() : "";
}

const skipNoBacklog = !fileExists(BACKLOG_PATH);
const skipNoArchive = !fileExists(ARCHIVE_PATH);

Deno.test({
  name: "product-backlog.md: 各PBIに必須フィールドが存在する",
  ignore: skipNoBacklog,
  fn: () => {
    const md = readFixture(BACKLOG_PATH);
    const pbis = extractH3PbiBlocks(md);
    assert(pbis.length > 0, "PBIブロックが1つも見つかりません");

    for (const pbi of pbis) {
      const titleLine = pbi.split("\n")[0].trim();
      assert(extractField(pbi, "見積サイズ") !== null, `${titleLine}: 見積サイズが不足しています`);
      assert(extractField(pbi, "証明方法") !== null, `${titleLine}: 証明方法が不足しています`);
      assert(hasH4WpSection(pbi), `${titleLine}: WP_N:H4セクションが不足しています`);
    }

    console.log(`  ✅ ${pbis.length}件のPBIを検証`);
  },
});

Deno.test({
  name: "product-backlog.md: 各WPにEffort見積が存在する",
  ignore: skipNoBacklog,
  fn: () => {
    const md = readFixture(BACKLOG_PATH);
    const pbis = extractH3PbiBlocks(md);

    for (const pbi of pbis) {
      const titleLine = pbi.split("\n")[0].trim();
      assert(hasEffortEstimate(pbi), `${titleLine}: Effort見積（介入回数）が不足しています`);
    }

    console.log(`  ✅ 全PBIにEffort見積あり`);
  },
});

Deno.test({
  name: "product-backlog-archive.md: 各カードに必須フィールドが存在する",
  ignore: skipNoArchive,
  fn: () => {
    const md = readFixture(ARCHIVE_PATH);
    const cards = extractH3PbiBlocks(md);
    assert(cards.length > 0, "アーカイブカードが1つも見つかりません");

    const REQUIRED_FIELDS = [
      "完了日",
      "スプリント",
      "見積サイズ",
      "実感サイズ",
      "成果物",
      "Effort実績 (介入回数)",
      "予実差分析",
      "カテゴリ",
    ];

    for (const card of cards) {
      const titleLine = card.split("\n")[0].trim();
      for (const field of REQUIRED_FIELDS) {
        assert(
          extractField(card, field) !== null,
          `${titleLine}: 必須フィールド「${field}」が不足しています`,
        );
      }
    }

    console.log(`  ✅ ${cards.length}件のアーカイブカードを検証`);
  },
});

Deno.test({
  name: "product-backlog-archive.md: Effort実績サブフィールド名が正しい",
  ignore: skipNoArchive,
  fn: () => {
    const md = readFixture(ARCHIVE_PATH);
    const cards = extractH3PbiBlocks(md);

    for (const card of cards) {
      const titleLine = card.split("\n")[0].trim();
      const hasOldNames = /初期見積もり合計/.test(card) || /実績介入回数合計/.test(card) ||
        /予実分析と知見/.test(card);
      assert(!hasOldNames, `${titleLine}: 旧フィールド名が残っています`);

      const hasNewNames = /計画前見積合計/.test(card) && /計画後見積合計/.test(card) &&
        /完了時実績合計/.test(card) && /予実差分析/.test(card);
      assert(hasNewNames, `${titleLine}: Effort実績サブフィールド名が不正です`);
    }

    console.log(`  ✅ 全カードのサブフィールド名を確認`);
  },
});

Deno.test({
  name: "product-backlog.md: 実データが欠落・改変されていない",
  ignore: skipNoBacklog,
  fn: () => {
    const md = readFixture(BACKLOG_PATH);
    const pbis = extractH3PbiBlocks(md);
    const expected = pbis.map((b) => extractPbiName(b.split("\n")[0])).filter(Boolean);

    assert(expected.length > 0, "PBIブロックが1つも抽出できません");
    for (const name of expected) {
      assertStringIncludes(md, name, `PBI「${name}」が見つかりません`);
    }

    console.log(`  ✅ ${expected.length}件のPBIのデータが維持されている`);
  },
});

Deno.test({
  name: "product-backlog-archive.md: 実データが欠落・改変されていない",
  ignore: skipNoArchive,
  fn: () => {
    const md = readFixture(ARCHIVE_PATH);
    const cards = extractH3PbiBlocks(md);
    const expected = cards.map((b) => extractPbiName(b.split("\n")[0])).filter(Boolean);

    assert(expected.length > 0, "アーカイブカードが1つも抽出できません");
    for (const name of expected) {
      assertStringIncludes(md, name, `エントリ「${name}」が見つかりません`);
    }

    console.log(`  ✅ 全${expected.length}エントリのデータが維持されている`);
  },
});

/**
 * backlog_format_test — backlog-guidelines.md のPBIフォーマット記述が
 * product-backlog.md.example（正規テンプレート）と整合していることを検証する。
 * ドキュメント間のフォーマット乖離を防止する。
 */
Deno.test("backlog-guidelines.md: PBIフォーマット記述が .example と整合している", () => {
  const guidelines = readFixture(GUIDELINES_PATH);

  assertStringIncludes(guidelines, "見積サイズ", "backlog-guidelines.md に見積サイズの記述が必要");
  assertStringIncludes(guidelines, "証明方法", "backlog-guidelines.md に証明方法の記述が必要");
  assertStringIncludes(
    guidelines,
    "Effort見積（介入回数）",
    "backlog-guidelines.md にEffort見積の記述が必要",
  );
  assertStringIncludes(
    guidelines,
    "product-backlog.md.example",
    "正規テンプレートとして .example を参照する記述が必要",
  );

  console.log(`  ✅ backlog-guidelines.md のフォーマット記述は .example と整合`);
});
