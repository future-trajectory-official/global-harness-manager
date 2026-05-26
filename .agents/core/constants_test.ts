import { assertEquals, assertStringIncludes } from "@std/assert";
import {
  getManagementPath,
  getSkillAssetPath,
  getSkillDirPath,
  getSkillScriptPath,
  PATHS,
  PROJECT_ROOT,
} from "./constants.ts";

Deno.test("constants - PROJECT_ROOT should be defined", () => {
  assertStringIncludes(PROJECT_ROOT, "global-harness-manager");
});

Deno.test("constants - PATHS should have complete bundle definitions", () => {
  const bundles = PATHS.BUNDLES;
  assertEquals(bundles.ONBOARDING, "onboarding-bundle");
  assertEquals(bundles.GIT, "git-bundle");
  assertEquals(bundles.META, "meta-bundle");
  assertEquals(bundles.SYSTEM, "system-bundle");
  assertEquals(bundles.DEVELOPMENT, "development-bundle");
  assertEquals(bundles.MANAGEMENT, "management-bundle");
});

Deno.test("constants - PATHS should have correct root paths", () => {
  assertEquals(PATHS.SKILLS_ROOT, ".agents/skills/bundles");
  assertEquals(PATHS.MANAGEMENT, ".agents/management");
  assertEquals(PATHS.SCRIPTS, "scripts");
});

Deno.test("constants - getSkillDirPath should return correct path for all bundles", () => {
  for (const bundle of Object.values(PATHS.BUNDLES)) {
    const path = getSkillDirPath(bundle, "test-skill");
    assertStringIncludes(path, `.agents/skills/bundles/${bundle}/test-skill`);
  }
});

Deno.test("constants - getSkillScriptPath should return correct path", () => {
  const path = getSkillScriptPath("onboarding-bundle", "test-skill", "run.ts");
  assertStringIncludes(path, ".agents/skills/bundles/onboarding-bundle/test-skill/scripts/run.ts");
});

Deno.test("constants - getSkillAssetPath should return correct path (with and without asset name)", () => {
  // 引数なし
  const dirPath = getSkillAssetPath("onboarding-bundle", "test-skill");
  assertStringIncludes(dirPath, ".agents/skills/bundles/onboarding-bundle/test-skill/assets");

  // 引数あり
  const filePath = getSkillAssetPath("onboarding-bundle", "test-skill", "image.png");
  assertStringIncludes(
    filePath,
    ".agents/skills/bundles/onboarding-bundle/test-skill/assets/image.png",
  );
});

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
