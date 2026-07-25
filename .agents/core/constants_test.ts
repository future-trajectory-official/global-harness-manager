import { assertEquals, assertStringIncludes } from "@std/assert";
import {
  getManagementPath,
  getSkillAssetPath,
  getSkillDirPath,
  getSkillScriptPath,
  PATHS,
  PROJECT_ROOT,
} from "./constants.ts";

/**
 * constants - PROJECT_ROOT が正しく定義されていることを検証する。
 * プロジェクト名 "global-harness-manager" がパスに含まれていることを確認する。
 */
Deno.test("constants - PROJECT_ROOT should be defined", () => {
  assertStringIncludes(PROJECT_ROOT, "global-harness-manager");
});

/**
 * constants - PATHS.BUNDLES に全バンドル定義が網羅されていることを検証する。
 * オンボーディング、Git、メタ、システム、開発、管理の6バンドルが全て定義されていることを確認する。
 */
Deno.test("constants - PATHS should have complete bundle definitions", () => {
  const bundles = PATHS.BUNDLES;
  assertEquals(bundles.ONBOARDING, "workspace-bundle");
  assertEquals(bundles.GIT, "git-bundle");
  assertEquals(bundles.META, "meta-bundle");
  assertEquals(bundles.SYSTEM, "system-bundle");
  assertEquals(bundles.DEVELOPMENT, "development-bundle");
  assertEquals(bundles.MANAGEMENT, "management-bundle");
});

/**
 * constants - PATHS オブジェクトのルートパス定義が正しいことを検証する。
 * SKILLS_ROOT, MANAGEMENT, SCRIPTS の各パスが期待値を満たすことを確認する。
 */
Deno.test("constants - PATHS should have correct root paths", () => {
  assertEquals(PATHS.SKILLS_ROOT, ".agents/skills/bundles");
  assertEquals(PATHS.MANAGEMENT, ".agents/management");
  assertEquals(PATHS.SCRIPTS, "scripts");
});

/**
 * constants - getSkillDirPath が全バンドルに対して正しいパスを返すことを検証する。
 * 各バンドル名とスキル名を結合したパスが生成されることを確認する。
 */
Deno.test("constants - getSkillDirPath should return correct path for all bundles", () => {
  for (const bundle of Object.values(PATHS.BUNDLES)) {
    const path = getSkillDirPath(bundle, "test-skill");
    assertStringIncludes(path, `.agents/skills/bundles/${bundle}/test-skill`);
  }
});

/**
 * constants - getSkillScriptPath がスキルスクリプトへの正しいパスを返すことを検証する。
 * バンドル・スキル・スクリプト名を連結したパスが生成されることを確認する。
 */
Deno.test("constants - getSkillScriptPath should return correct path", () => {
  const path = getSkillScriptPath("workspace-bundle", "test-skill", "run.ts");
  assertStringIncludes(path, ".agents/skills/bundles/workspace-bundle/test-skill/scripts/run.ts");
});

/**
 * constants - getSkillAssetPath がアセットディレクトリおよび個別アセットファイルへの
 * パスを正しく返すことを検証する。引数あり・なしの両方を確認する。
 */
Deno.test("constants - getSkillAssetPath should return correct path (with and without asset name)", () => {
  // 引数なし
  const dirPath = getSkillAssetPath("workspace-bundle", "test-skill");
  assertStringIncludes(dirPath, ".agents/skills/bundles/workspace-bundle/test-skill/assets");

  // 引数あり
  const filePath = getSkillAssetPath("workspace-bundle", "test-skill", "image.png");
  assertStringIncludes(
    filePath,
    ".agents/skills/bundles/workspace-bundle/test-skill/assets/image.png",
  );
});

/**
 * constants - getManagementPath が管理ディレクトリおよび個別管理ファイルへの
 * パスを正しく返すことを検証する。引数あり・なしの両方を確認する。
 */
Deno.test("constants - getManagementPath should return correct path (with and without file name)", () => {
  // 引数なし
  const dirPath = getManagementPath();
  assertStringIncludes(dirPath, ".agents/management");

  // 引数あり
  const filePath = getManagementPath("product-backlog.md");
  assertStringIncludes(filePath, ".agents/management/product-backlog.md");
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
    importMetaUrl: "file:///some/path/.agents/core/constants.ts",
  });
  assertEquals(root, "/global/harness/workspace");
});

/**
 * constants - findProjectRoot: カレントディレクトリ直下の .agents を検出することを検証する。
 * 環境変数が未設定で、cwd 直下に .agents ディレクトリが存在する場合、
 * その cwd をプロジェクトルートとして採用することを確認する。
 */
Deno.test("constants - findProjectRoot: 2. カレントディレクトリ直下に .agents がある場合はそれを優先する", () => {
  const root = findProjectRoot({
    envGetter: () => undefined,
    cwdGetter: () => "/my/current/project",
    statSync: (path: string) => {
      if (path === "/my/current/project/.agents") {
        return { isDirectory: true };
      }
      throw new Error("not found");
    },
    importMetaUrl: "file:///some/other/path/.agents/core/constants.ts",
  });
  assertEquals(root, "/my/current/project");
});

/**
 * constants - findProjectRoot: 環境変数も cwd の .agents も存在しない場合、
 * importMetaUrl からフォールバック解決されることを検証する。
 * .agents/core/constants.ts のパスから2階層上のディレクトリをルートとみなすことを確認する。
 */
Deno.test("constants - findProjectRoot: 3. カレントディレクトリ直下に .agents がない、環境変数もない場合は importMetaUrl からフォールバックする", () => {
  const root = findProjectRoot({
    envGetter: () => undefined,
    cwdGetter: () => "/other/dir",
    statSync: () => {
      throw new Deno.errors.NotFound("not found");
    },
    importMetaUrl: "file:///absolute/path/to/harness/.agents/core/constants.ts",
  });
  // constants.ts は .agents/core/ 配下にあるため、2階層上は /absolute/path/to/harness となる
  assertEquals(root, "/absolute/path/to/harness");
});
