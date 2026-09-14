import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import {
  getSkillAssetPath,
  getSkillDirPath,
  getSkillScriptPath,
  PATHS,
  PROJECT_ROOT,
} from "./constants.ts";

/**
 * constants - PROJECT_ROOT がチェックアウト先ディレクトリ名に依存せず解決されることを検証する。
 * 構造的要求（絶対パスであり直下に .opencode を持つ）で判定し、サンドボックス内の実行にも耐える。
 */
Deno.test("constants - PROJECT_ROOT should be defined", () => {
  assert(
    PROJECT_ROOT.startsWith("/") || /^[A-Za-z]:[\\/]/.test(PROJECT_ROOT),
    `PROJECT_ROOT must be absolute: ${PROJECT_ROOT}`,
  );
});

/**
 * constants - PROJECT_ROOT の直下に .opencode が存在する（構造的不変条件）。
 * 存在しない場合は解決先の誤りを明示メッセージで報告する。
 */
Deno.test("constants - PROJECT_ROOT contains the .opencode directory", async () => {
  const opencodeDir = `${PROJECT_ROOT.replace(/[/\\]+$/, "")}/.opencode`;
  let isDirectory = false;
  try {
    isDirectory = (await Deno.stat(opencodeDir)).isDirectory;
  } catch {
    isDirectory = false;
  }
  assert(
    isDirectory,
    `PROJECT_ROOT (${PROJECT_ROOT}) must resolve to a directory containing .opencode`,
  );
});

/**
 * constants - PATHS.BUNDLES に全バンドル定義が網羅されていることを検証する。
 * オンボーディング、Git、メタ、開発、管理の5バンドルが全て定義されていることを確認する。
 * （SYSTEM は実体バンドルが存在しないため廃止済み）
 */
Deno.test("constants - PATHS should have complete bundle definitions", () => {
  const bundles = PATHS.BUNDLES;
  assertEquals(bundles.ONBOARDING, "workspace-bundle");
  assertEquals(bundles.GIT, "git-bundle");
  assertEquals(bundles.META, "meta-bundle");
  assertEquals(bundles.DEVELOPMENT, "development-bundle");
  assertEquals(bundles.MANAGEMENT, "management-bundle");
});

/**
 * constants - PATHS オブジェクトのルートパス定義が正しいことを検証する。
 * SKILLS_ROOT, SCRIPTS の各パスが期待値を満たすことを確認する。
 */
Deno.test("constants - PATHS should have correct root paths", () => {
  assertEquals(PATHS.SKILLS_ROOT, ".opencode/skills/bundles");
  assertEquals(PATHS.SCRIPTS, "scripts");
});

/**
 * constants - getSkillDirPath が全バンドルに対して正しいパスを返すことを検証する。
 * 各バンドル名とスキル名を結合したパスが生成されることを確認する。
 */
Deno.test("constants - getSkillDirPath should return correct path for all bundles", () => {
  for (const bundle of Object.values(PATHS.BUNDLES)) {
    const path = getSkillDirPath(bundle, "test-skill");
    assertStringIncludes(path, `.opencode/skills/bundles/${bundle}/test-skill`);
  }
});

/**
 * constants - getSkillScriptPath がスキルスクリプトへの正しいパスを返すことを検証する。
 * バンドル・スキル・スクリプト名を連結したパスが生成されることを確認する。
 */
Deno.test("constants - getSkillScriptPath should return correct path", () => {
  const path = getSkillScriptPath("workspace-bundle", "test-skill", "run.ts");
  assertStringIncludes(path, ".opencode/skills/bundles/workspace-bundle/test-skill/scripts/run.ts");
});

/**
 * constants - getSkillAssetPath がアセットディレクトリおよび個別アセットファイルへの
 * パスを正しく返すことを検証する。引数あり・なしの両方を確認する。
 */
Deno.test("constants - getSkillAssetPath should return correct path (with and without asset name)", () => {
  // 引数なし
  const dirPath = getSkillAssetPath("workspace-bundle", "test-skill");
  assertStringIncludes(dirPath, ".opencode/skills/bundles/workspace-bundle/test-skill/assets");

  // 引数あり
  const filePath = getSkillAssetPath("workspace-bundle", "test-skill", "image.png");
  assertStringIncludes(
    filePath,
    ".opencode/skills/bundles/workspace-bundle/test-skill/assets/image.png",
  );
});

// findProjectRoot のテストケース (POから求められた多角的な検証ケース)
import { findProjectRoot } from "./constants.ts";

/**
 * constants - findProjectRoot: 環境変数 HARNESS_WORKSPACE_ROOT が最優先されることを検証する。
 * 環境変数が設定されている場合、カレントディレクトリや importMetaUrl よりも優先して
 * その値をルートパスとして採用することを確認する。
 */
Deno.test("constants - findProjectRoot: 1. 環境変数 HARNESS_WORKSPACE_ROOT が設定されている場合は最優先する", () => {
  const root = findProjectRoot({
    envGetter: (
      key: string,
    ) => (key === "HARNESS_WORKSPACE_ROOT" ? "/global/harness/workspace" : undefined),
    cwdGetter: () => "/other/dir",
    statSync: () => {
      throw new Error("should not stat");
    },
    importMetaUrl: "file:///some/path/.opencode/core/shared/types/constants.ts",
  });
  assertEquals(root, "/global/harness/workspace");
});

/**
 * constants - findProjectRoot: カレントディレクトリ直下の .opencode を検出することを検証する。
 * 環境変数が未設定で、cwd 直下に .opencode ディレクトリが存在する場合、
 * その cwd をプロジェクトルートとして採用することを確認する。
 */
Deno.test("constants - findProjectRoot: 2. カレントディレクトリ直下に .opencode がある場合はそれを優先する", () => {
  const root = findProjectRoot({
    envGetter: () => undefined,
    cwdGetter: () => "/my/current/project",
    statSync: (path: string) => {
      if (path === "/my/current/project/.opencode") {
        return { isDirectory: true };
      }
      throw new Error("not found");
    },
    importMetaUrl: "file:///some/other/path/.opencode/core/shared/types/constants.ts",
  });
  assertEquals(root, "/my/current/project");
});

/**
 * constants - findProjectRoot: 環境変数も cwd の .opencode も存在しない場合、
 * importMetaUrl からフォールバック解決されることを検証する。
 * .opencode/core/shared/types/constants.ts のパスから4階層上のディレクトリをルートとみなすことを確認する。
 */
Deno.test("constants - findProjectRoot: 3. カレントディレクトリ直下に .opencode がない、環境変数もない場合は importMetaUrl からフォールバックする", () => {
  const root = findProjectRoot({
    envGetter: () => undefined,
    cwdGetter: () => "/other/dir",
    statSync: () => {
      throw new Deno.errors.NotFound("not found");
    },
    importMetaUrl: "file:///absolute/path/to/harness/.opencode/core/shared/types/constants.ts",
  });
  // constants.ts は .opencode/core/shared/types/ 配下にあるため、4階層上は /absolute/path/to/harness となる
  assertEquals(root, "/absolute/path/to/harness");
});
