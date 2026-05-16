import { assertEquals, assertStringIncludes } from "@std/assert";
import { 
  PROJECT_ROOT, 
  PATHS, 
  getSkillDirPath, 
  getSkillScriptPath, 
  getSkillAssetPath,
  getManagementPath 
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
  assertStringIncludes(filePath, ".agents/skills/bundles/onboarding-bundle/test-skill/assets/image.png");
});

Deno.test("constants - getManagementPath should return correct path (with and without file name)", () => {
  // 引数なし
  const dirPath = getManagementPath();
  assertStringIncludes(dirPath, ".agents/management");
  
  // 引数あり
  const filePath = getManagementPath("product-backlog.md");
  assertStringIncludes(filePath, ".agents/management/product-backlog.md");
});
