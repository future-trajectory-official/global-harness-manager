import { assertEquals, assertStringIncludes } from "@std/assert";
import { join } from "@std/path";
import { fsUtil } from "../.agents/core/fs.ts";

Deno.test("Integration: publish-rules dry-run", async () => {
  const tempDir = await Deno.makeTempDir();
  try {
    const managerDir = join(tempDir, "manager");
    const targetProjectDir = join(tempDir, "target_project");

    // Manager setup
    await Deno.mkdir(join(managerDir, "config"), { recursive: true });
    await Deno.mkdir(join(managerDir, ".agents/rules"), { recursive: true });

    await Deno.writeTextFile(
      join(managerDir, "config/publish-rules-targets.md"),
      `## Target Projects\n### ${targetProjectDir}\n\n## Target Rules\n### test-rule\n`,
    );
    await Deno.writeTextFile(
      join(managerDir, ".agents/rules/test-rule.md"),
      "test rule content",
    );

    // Target setup (to pass safety check, it might need some files, or we use --force)
    // The verifyTarget.checkSafety might check for `.git` or something.
    // Let's create .git to make it look like a project.
    await Deno.mkdir(join(targetProjectDir, ".git"), { recursive: true });

    const scriptPath =
      new URL("../.agents/skills/publish-harness-rules/scripts/publish-rules.ts", import.meta.url)
        .pathname;

    const command = new Deno.Command(Deno.execPath(), {
      args: [
        "run",
        "-A",
        scriptPath,
        "--dry-run",
      ],
      cwd: managerDir,
      stdout: "piped",
      stderr: "piped",
    });

    const { code, stdout, stderr } = await command.output();
    const output = new TextDecoder().decode(stdout);
    const errOutput = new TextDecoder().decode(stderr);

    assertEquals(code, 0, `Script failed with code ${code}\nStderr: ${errOutput}`);
    assertStringIncludes(output, "Found 1 targets and 1 rules");
    assertStringIncludes(output, "[DRY-RUN] Write to file");

    const targetFile = join(targetProjectDir, ".agents/rules/test-rule.md");
    assertEquals(await fsUtil.exists(targetFile), false);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("Integration: publish-rules actual sync", async () => {
  const tempDir = await Deno.makeTempDir();
  try {
    const managerDir = join(tempDir, "manager");
    const targetProjectDir = join(tempDir, "target_project");

    await Deno.mkdir(join(managerDir, "config"), { recursive: true });
    await Deno.mkdir(join(managerDir, ".agents/rules"), { recursive: true });

    await Deno.writeTextFile(
      join(managerDir, "config/publish-rules-targets.md"),
      `## Target Projects\n### ${targetProjectDir}\n\n## Target Rules\n### test-rule\n`,
    );
    await Deno.writeTextFile(
      join(managerDir, ".agents/rules/test-rule.md"),
      "test rule content",
    );

    await Deno.mkdir(join(targetProjectDir, ".git"), { recursive: true });

    const scriptPath =
      new URL("../.agents/skills/publish-harness-rules/scripts/publish-rules.ts", import.meta.url)
        .pathname;

    const command = new Deno.Command(Deno.execPath(), {
      args: [
        "run",
        "-A",
        scriptPath,
      ],
      cwd: managerDir,
      stdout: "piped",
      stderr: "piped",
    });

    const { code, stderr } = await command.output();
    const errOutput = new TextDecoder().decode(stderr);

    assertEquals(code, 0, `Script failed with code ${code}\nStderr: ${errOutput}`);

    const targetFile = join(targetProjectDir, ".agents/rules/test-rule.md");
    assertEquals(await fsUtil.exists(targetFile), true);
    assertEquals(await Deno.readTextFile(targetFile), "test rule content");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});
