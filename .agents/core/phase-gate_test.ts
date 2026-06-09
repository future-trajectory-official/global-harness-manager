import { assertEquals, assertInstanceOf, assertStringIncludes } from "@std/assert";
import { assertExists } from "@std/assert";
import { dirname, fromFileUrl, join } from "@std/path";

// phase-gate.ts はこれから実装するため、型のみ先行定義
// テスト実行時には実際の実装に置き換わる
const __dirname = dirname(fromFileUrl(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..", "..");

// --- AC-1: SKILL.md リンク抽出 ---

/**
 * extractLinksFromSkillMd - SKILL.md から `[text](path)` 形式のリンクを正しく抽出できることを検証する。
 * 基本的なリンク、複数リンク、テキスト内のリンクがすべて取得されることを確認する。
 */
Deno.test("extractLinksFromSkillMd - should extract [text](path) links from SKILL.md content", async () => {
  const { extractLinksFromSkillMd } = await import("./phase-gate.ts");
  const content = [
    "# Test Skill",
    "",
    "参照: [guide](references/guide.md)",
    "詳細: [template](assets/template.md)",
    "複数: [doc1](references/doc1.md) と [doc2](references/doc2.md)",
  ].join("\n");

  const links = extractLinksFromSkillMd(content);
  assertEquals(links.length, 4);
  assertStringIncludes(links[0], "references/guide.md");
  assertStringIncludes(links[1], "assets/template.md");
});

/**
 * extractLinksFromSkillMd - URL（http://, https://）が除外されることを検証する。
 * 外部URLはガードレールの対象外であるため、抽出結果に含まれないことを確認する。
 */
Deno.test("extractLinksFromSkillMd - should exclude URL links", async () => {
  const { extractLinksFromSkillMd } = await import("./phase-gate.ts");
  const content = [
    "# Test Skill",
    "",
    "参照: [guide](references/guide.md)",
    "外部: [deno](https://deno.land)",
    "API: [api](http://example.com/api)",
  ].join("\n");

  const links = extractLinksFromSkillMd(content);
  assertEquals(links.length, 1);
  assertEquals(links[0], "references/guide.md");
});

/**
 * extractLinksFromSkillMd - アンカーのみのリンク（#section）が除外されることを検証する。
 * 同一ファイル内のアンカー参照はファイル読了の対象外であることを確認する。
 */
Deno.test("extractLinksFromSkillMd - should exclude anchor-only links", async () => {
  const { extractLinksFromSkillMd } = await import("./phase-gate.ts");
  const content = [
    "# Test Skill",
    "",
    "参照: [guide](references/guide.md)",
    "見出し: [section](#section-name)",
  ].join("\n");

  const links = extractLinksFromSkillMd(content);
  assertEquals(links.length, 1);
  assertEquals(links[0], "references/guide.md");
});

/**
 * extractLinksFromSkillMd - 画像リンク `![alt](path)` が除外されることを検証する。
 * 画像リソースはテキスト読了の対象外であることを確認する。
 */
Deno.test("extractLinksFromSkillMd - should exclude image links", async () => {
  const { extractLinksFromSkillMd } = await import("./phase-gate.ts");
  const content = [
    "# Test Skill",
    "",
    "![screenshot](assets/screenshot.png)",
    "参照: [guide](references/guide.md)",
    "![icon](assets/icon.svg)",
  ].join("\n");

  const links = extractLinksFromSkillMd(content);
  assertEquals(links.length, 1);
  assertEquals(links[0], "references/guide.md");
});

/**
 * extractLinksFromSkillMd - SKILL.md 内にリンクがない場合、空配列を返すことを検証する。
 * リンクがないスキルはガードレールを通過可能であることを確認する。
 */
Deno.test("extractLinksFromSkillMd - should return empty array when no links exist", async () => {
  const { extractLinksFromSkillMd } = await import("./phase-gate.ts");
  const content = "# Just a title\n\nSome text without links.";

  const links = extractLinksFromSkillMd(content);
  assertEquals(links.length, 0);
});

// --- AC-2: 参照パス解決 ---

/**
 * resolveReferencePath - 相対パスがスキルディレクトリ基準で解決されることを検証する。
 */
Deno.test("resolveReferencePath - should resolve relative path from skill directory", async () => {
  const { resolveReferencePath } = await import("./phase-gate.ts");
  const skillDir = join(
    PROJECT_ROOT,
    ".agents",
    "skills",
    "bundles",
    "management-bundle",
    "session-planning",
  );
  const result = resolveReferencePath("./references/guide.md", skillDir, PROJECT_ROOT);
  assertEquals(result, join(skillDir, "references", "guide.md"));
});

/**
 * resolveReferencePath - 絶対パス（/.agents/...）がプロジェクトルート基準で解決されることを検証する。
 */
Deno.test("resolveReferencePath - should resolve absolute path from project root", async () => {
  const { resolveReferencePath } = await import("./phase-gate.ts");
  const skillDir = join(PROJECT_ROOT, ".agents", "skills", "bundles", "some-bundle", "some-skill");
  const result = resolveReferencePath(
    "/.agents/management/product-backlog.md",
    skillDir,
    PROJECT_ROOT,
  );
  assertEquals(result, join(PROJECT_ROOT, ".agents", "management", "product-backlog.md"));
});

/**
 * resolveReferencePath - パスにアンカーが含まれる場合、アンカーを除去してファイルパスを返すことを検証する。
 */
Deno.test("resolveReferencePath - should strip anchor from path", async () => {
  const { resolveReferencePath } = await import("./phase-gate.ts");
  const skillDir = join(PROJECT_ROOT, ".agents", "skills", "bundles", "some-bundle", "some-skill");
  const result = resolveReferencePath("./references/guide.md#section-1", skillDir, PROJECT_ROOT);
  assertEquals(result, join(skillDir, "references", "guide.md"));
});

/**
 * resolveReferencePath - ./ なしの相対パスも正しく解決されることを検証する。
 */
Deno.test("resolveReferencePath - should resolve relative path without ./ prefix", async () => {
  const { resolveReferencePath } = await import("./phase-gate.ts");
  const skillDir = join(
    PROJECT_ROOT,
    ".agents",
    "skills",
    "bundles",
    "management-bundle",
    "session-planning",
  );
  const result = resolveReferencePath("references/guide.md", skillDir, PROJECT_ROOT);
  assertEquals(result, join(skillDir, "references", "guide.md"));
});

// --- AC-3: 読了状態検証 ---

/**
 * checkReadStatus - 未読ファイルがある場合、その一覧を返すことを検証する。
 */
Deno.test("checkReadStatus - should return unread files when some files are not in read log", async () => {
  const { checkReadStatus } = await import("./phase-gate.ts");
  const allFiles = [
    join(PROJECT_ROOT, ".agents", "core", "phase-gate.ts"),
    join(PROJECT_ROOT, ".agents", "core", "logger.ts"),
    join(PROJECT_ROOT, ".agents", "management", "backlog-guidelines.md"),
  ];
  const readLog: Record<string, string[]> = {
    "some-skill": [
      join(PROJECT_ROOT, ".agents", "core", "phase-gate.ts"),
    ],
  };

  const unread = checkReadStatus(allFiles, readLog, "some-skill");
  assertEquals(unread.length, 2);
  assertStringIncludes(unread[0], "logger.ts");
  assertStringIncludes(unread[1], "backlog-guidelines.md");
});

/**
 * checkReadStatus - 全ファイルが読了済みの場合、空配列を返すことを検証する。
 */
Deno.test("checkReadStatus - should return empty array when all files are read", async () => {
  const { checkReadStatus } = await import("./phase-gate.ts");
  const allFiles = [
    join(PROJECT_ROOT, ".agents", "core", "phase-gate.ts"),
  ];
  const readLog: Record<string, string[]> = {
    "some-skill": [
      join(PROJECT_ROOT, ".agents", "core", "phase-gate.ts"),
    ],
  };

  const unread = checkReadStatus(allFiles, readLog, "some-skill");
  assertEquals(unread.length, 0);
});

/**
 * checkReadStatus - readLog に対象スキルのエントリがない場合、全ファイルを未読扱いすることを検証する。
 */
Deno.test("checkReadStatus - should treat all files as unread when skill has no read log entry", async () => {
  const { checkReadStatus } = await import("./phase-gate.ts");
  const allFiles = [
    join(PROJECT_ROOT, ".agents", "core", "phase-gate.ts"),
    join(PROJECT_ROOT, ".agents", "core", "logger.ts"),
  ];
  const readLog: Record<string, string[]> = {};

  const unread = checkReadStatus(allFiles, readLog, "some-skill");
  assertEquals(unread.length, 2);
});

/**
 * checkReadStatus - readLog が空オブジェクトの場合、全ファイルを未読扱いすることを検証する。
 */
Deno.test("checkReadStatus - should treat all files as unread when readLog is empty", async () => {
  const { checkReadStatus } = await import("./phase-gate.ts");
  const allFiles = [
    join(PROJECT_ROOT, ".agents", "core", "phase-gate.ts"),
  ];
  const readLog: Record<string, string[]> = {};

  const unread = checkReadStatus(allFiles, readLog, "some-skill");
  assertEquals(unread.length, 1);
});

/**
 * checkReadStatus - リンクがない（allFiles が空）の場合、空配列を返すことを検証する。
 */
Deno.test("checkReadStatus - should return empty array when no files are referenced", async () => {
  const { checkReadStatus } = await import("./phase-gate.ts");
  const allFiles: string[] = [];
  const readLog: Record<string, string[]> = {};

  const unread = checkReadStatus(allFiles, readLog, "some-skill");
  assertEquals(unread.length, 0);
});

// --- AC-4: エラーハンドリング ---

/**
 * resolveSkillDir - 存在しないスキル名の場合、null を返すことを検証する。
 */
Deno.test("resolveSkillDir - should return null for non-existent skill name", async () => {
  const { resolveSkillDir } = await import("./phase-gate.ts");
  const result = await resolveSkillDir("non-existent-skill-name-xyz");
  assertEquals(result, null);
});

/**
 * resolveSkillDir - 存在するスキル名の場合、そのディレクトリパスを返すことを検証する。
 */
Deno.test("resolveSkillDir - should return skill directory for existing skill", async () => {
  const { resolveSkillDir } = await import("./phase-gate.ts");
  const result = await resolveSkillDir("session-planning");
  assertExists(result);
  assertStringIncludes(result, "session-planning");
});

// --- AC-5: CLI統合 ---

/**
 * parseCliArgs - --step 引数を正しくパースできることを検証する。
 */
Deno.test("parseCliArgs - should parse --step argument", async () => {
  const { parseCliArgs } = await import("./phase-gate.ts");
  const args = ["--step", "session-planning"];
  const result = parseCliArgs(args);
  assertEquals(result.step, "session-planning");
});

/**
 * parseCliArgs - --step が未指定の場合、エラーをスローすることを検証する。
 */
Deno.test("parseCliArgs - should throw error when --step is missing", async () => {
  const { parseCliArgs } = await import("./phase-gate.ts");
  const args: string[] = [];
  try {
    parseCliArgs(args);
    throw new Error("Should have thrown");
  } catch (e) {
    assertInstanceOf(e, Error);
    assertStringIncludes((e as Error).message, "--step");
  }
});
