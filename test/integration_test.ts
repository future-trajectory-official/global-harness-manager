import { assertEquals, assertStringIncludes } from "@std/assert";
import { join } from "@std/path";
import { fsUtil } from "../.agents/core/shared/io/fs.ts";
import { getSkillScriptPath, PATHS } from "./test_helper.ts";

/**
 * Integration: publish-skills dry-run — dry-run モードでスキル公開が正しくシミュレーションされることを検証する。
 * 実際のコピーなしに、出力が期待通りであることを確認する。
 */
Deno.test("Integration: publish-skills dry-run", async () => {
  const tempDir = await Deno.makeTempDir();
  try {
    const projectDir = join(tempDir, "project");
    const globalDir = join(tempDir, "global");

    const testBundle = "test-bundle";
    const testSkill = "test-skill";

    await Deno.mkdir(join(projectDir, "config"), { recursive: true });
    await Deno.mkdir(join(projectDir, PATHS.SKILLS_ROOT, testBundle, testSkill), {
      recursive: true,
    });

    await Deno.writeTextFile(
      join(projectDir, "config/publish-targets.md"),
      `## ${testBundle}\n\n### ${testSkill}\n`,
    );
    await Deno.writeTextFile(
      join(projectDir, "config/global-skills-path.txt"),
      globalDir,
    );
    await Deno.writeTextFile(
      join(projectDir, PATHS.SKILLS_ROOT, testBundle, testSkill, "SKILL.md"),
      "test skill content",
    );

    const scriptPath = getSkillScriptPath(
      PATHS.BUNDLES.ONBOARDING,
      "publish-harness-skills",
      "publish-skills.ts",
    );

    const command = new Deno.Command(Deno.execPath(), {
      args: [
        "run",
        "-A",
        scriptPath,
        "--dry-run",
      ],
      cwd: projectDir,
      stdout: "piped",
      stderr: "piped",
    });

    const { code, stdout, stderr } = await command.output();
    const output = new TextDecoder().decode(stdout);
    const errOutput = new TextDecoder().decode(stderr);

    assertEquals(code, 0, `Script failed with code ${code}\nStderr: ${errOutput}`);
    assertStringIncludes(output, "Found 1 skills to publish");
    assertStringIncludes(output, "[DRY-RUN] Copy directory");

    // dry-run なのでファイルは作成されていないはず
    const targetFile = join(globalDir, "bundles", testBundle, testSkill, "SKILL.md");
    assertEquals(await fsUtil.exists(targetFile), false);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

/**
 * Integration: publish-skills actual sync — 実際のスキル同期が正しく実行されることを検証する。
 * グローバルディレクトリにスキルがコピーされ、内容が正しいことを確認する。
 */
Deno.test("Integration: publish-skills actual sync", async () => {
  const tempDir = await Deno.makeTempDir();
  try {
    const projectDir = join(tempDir, "project");
    const globalDir = join(tempDir, "global");

    const testBundle = "test-bundle";
    const testSkill = "test-skill";

    await Deno.mkdir(join(projectDir, "config"), { recursive: true });
    await Deno.mkdir(join(projectDir, PATHS.SKILLS_ROOT, testBundle, testSkill), {
      recursive: true,
    });

    await Deno.writeTextFile(
      join(projectDir, "config/publish-targets.md"),
      `## ${testBundle}\n\n### ${testSkill}\n`,
    );
    await Deno.writeTextFile(
      join(projectDir, "config/global-skills-path.txt"),
      globalDir,
    );
    await Deno.writeTextFile(
      join(projectDir, PATHS.SKILLS_ROOT, testBundle, testSkill, "SKILL.md"),
      "test skill content",
    );

    const scriptPath = getSkillScriptPath(
      PATHS.BUNDLES.ONBOARDING,
      "publish-harness-skills",
      "publish-skills.ts",
    );

    const command = new Deno.Command(Deno.execPath(), {
      args: [
        "run",
        "-A",
        scriptPath,
      ],
      cwd: projectDir,
      stdout: "piped",
      stderr: "piped",
    });

    const { code, stderr } = await command.output();
    const errOutput = new TextDecoder().decode(stderr);

    assertEquals(code, 0, `Script failed with code ${code}\nStderr: ${errOutput}`);

    // ファイルが作成されていることを確認
    const targetFile = join(globalDir, "bundles", testBundle, testSkill, "SKILL.md");
    assertEquals(await fsUtil.exists(targetFile), true);
    assertEquals(await Deno.readTextFile(targetFile), "test skill content");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});
