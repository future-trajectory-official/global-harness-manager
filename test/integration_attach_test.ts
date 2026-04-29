import { assertEquals, assertStringIncludes } from "@std/assert";
import { join } from "@std/path";
import { fsUtil } from "../.agents/core/fs.ts";

Deno.test("Integration: harness-attach dry-run", async () => {
  const tempDir = await Deno.makeTempDir();
  try {
    const managerDir = join(tempDir, "manager");
    const targetProjectDir = join(tempDir, "target_project");

    await Deno.mkdir(join(managerDir, "config"), { recursive: true });

    await Deno.writeTextFile(
      join(managerDir, "config/identities.md"),
      `## Test Project
- **Repository**: git@github.com:example/repo.git
- **Local Path**: ${targetProjectDir}
- **Account Name**: TestUser
- **User Email**: test@example.com
`,
    );

    const scriptPath = new URL(
      "../.agents/skills/attach-harness-to-project/scripts/harness-attach.ts",
      import.meta.url,
    )
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
    assertStringIncludes(output, "Test Project");
    assertStringIncludes(output, "DRY RUN MODE");
    // Ensure it printed the mock command actions
    assertStringIncludes(output, "ターゲットパスが存在しません");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("Integration: harness-attach actual execution on existing repo", async () => {
  const tempDir = await Deno.makeTempDir();
  try {
    const managerDir = join(tempDir, "manager");
    const targetProjectDir = join(tempDir, "target_project");

    await Deno.mkdir(join(managerDir, "config"), { recursive: true });

    await Deno.writeTextFile(
      join(managerDir, "config/identities.md"),
      `## Test Project
- **Repository**: git@github.com:example/repo.git
- **Local Path**: ${targetProjectDir}
- **Account Name**: TestUser
- **User Email**: test@example.com
`,
    );

    // Initialize a dummy git repository
    await Deno.mkdir(targetProjectDir, { recursive: true });
    const initCmd = new Deno.Command("git", {
      args: ["init"],
      cwd: targetProjectDir,
    });
    await initCmd.output();

    // Add a remote
    const remoteCmd = new Deno.Command("git", {
      args: ["remote", "add", "origin", "git@github.com:example/repo.git"],
      cwd: targetProjectDir,
    });
    await remoteCmd.output();

    const scriptPath = new URL(
      "../.agents/skills/attach-harness-to-project/scripts/harness-attach.ts",
      import.meta.url,
    )
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

    // Verify git config was set
    const configCmd = new Deno.Command("git", {
      args: ["config", "user.name"],
      cwd: targetProjectDir,
    });
    const configOutput = await configCmd.output();
    const userName = new TextDecoder().decode(configOutput.stdout).trim();
    assertEquals(userName, "TestUser");

    const emailCmd = new Deno.Command("git", {
      args: ["config", "user.email"],
      cwd: targetProjectDir,
    });
    const emailOutput = await emailCmd.output();
    const userEmail = new TextDecoder().decode(emailOutput.stdout).trim();
    assertEquals(userEmail, "test@example.com");

    const remoteUrlCmd = new Deno.Command("git", {
      args: ["remote", "get-url", "origin"],
      cwd: targetProjectDir,
    });
    const remoteUrlOutput = await remoteUrlCmd.output();
    const remoteUrl = new TextDecoder().decode(remoteUrlOutput.stdout).trim();
    assertEquals(remoteUrl, "git@github.com-TestUser:example/repo.git");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});
