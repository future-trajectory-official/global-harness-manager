import { assertEquals, assertStringIncludes } from "@std/assert";
import { join } from "@std/path";
import { fsUtil } from "../.agents/core/fs.ts";

Deno.test("Integration: publish-skills dry-run", async () => {
  const tempDir = await Deno.makeTempDir();
  try {
    const projectDir = join(tempDir, "project");
    const globalDir = join(tempDir, "global");

    await Deno.mkdir(join(projectDir, "config"), { recursive: true });
    await Deno.mkdir(join(projectDir, ".agents/skills/test-skill"), { recursive: true });

    await Deno.writeTextFile(
      join(projectDir, "config/publish-targets.md"),
      "## test-skill\n",
    );
    await Deno.writeTextFile(
      join(projectDir, "config/global-skills-path.txt"),
      globalDir,
    );
    await Deno.writeTextFile(
      join(projectDir, ".agents/skills/test-skill/SKILL.md"),
      "test skill content",
    );

    const scriptPath =
      new URL("../.agents/skills/publish-harness-skills/scripts/publish-skills.ts", import.meta.url)
        .pathname;

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
    const targetFile = join(globalDir, "test-skill/SKILL.md");
    assertEquals(await fsUtil.exists(targetFile), false);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("Integration: publish-skills actual sync", async () => {
  const tempDir = await Deno.makeTempDir();
  try {
    const projectDir = join(tempDir, "project");
    const globalDir = join(tempDir, "global");

    await Deno.mkdir(join(projectDir, "config"), { recursive: true });
    await Deno.mkdir(join(projectDir, ".agents/skills/test-skill"), { recursive: true });

    await Deno.writeTextFile(
      join(projectDir, "config/publish-targets.md"),
      "## test-skill\n",
    );
    await Deno.writeTextFile(
      join(projectDir, "config/global-skills-path.txt"),
      globalDir,
    );
    await Deno.writeTextFile(
      join(projectDir, ".agents/skills/test-skill/SKILL.md"),
      "test skill content",
    );

    const scriptPath =
      new URL("../.agents/skills/publish-harness-skills/scripts/publish-skills.ts", import.meta.url)
        .pathname;

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
    const targetFile = join(globalDir, "test-skill/SKILL.md");
    assertEquals(await fsUtil.exists(targetFile), true);
    assertEquals(await Deno.readTextFile(targetFile), "test skill content");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});
