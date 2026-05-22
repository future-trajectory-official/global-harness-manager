import { assertEquals, assertStringIncludes } from "@std/assert";
import { join } from "@std/path";
import { getSkillScriptPath, PATHS } from "./test_helper.ts";

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

    const scriptPath = getSkillScriptPath(
      PATHS.BUNDLES.ONBOARDING,
      "attach-harness-to-project",
      "harness-attach.ts",
    );

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

    const scriptPath = getSkillScriptPath(
      PATHS.BUNDLES.ONBOARDING,
      "attach-harness-to-project",
      "harness-attach.ts",
    );

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

Deno.test("Integration: harness-attach git clone passes GIT_SSH_COMMAND", async () => {
  const tempDir = await Deno.makeTempDir();
  try {
    const managerDir = join(tempDir, "manager");
    const targetProjectDir = join(tempDir, "target_project");
    const mockBinDir = join(tempDir, "bin");

    await Deno.mkdir(join(managerDir, "config"), { recursive: true });
    await Deno.mkdir(mockBinDir, { recursive: true });

    // Identitiesの設定ファイルを作成
    await Deno.writeTextFile(
      join(managerDir, "config/identities.md"),
      `## Test Project
- **Repository**: git@github.com:example/repo.git
- **Local Path**: ${targetProjectDir}
- **Account Name**: TestUser
- **User Email**: test@example.com
`,
    );

    // コールログ書き出し用の一時ファイルパス
    const logFilePath = join(tempDir, "git_call.log");

    // モック git スクリプトの作成（環境変数と引数をファイルにダンプする）
    const mockGitContent = `#!/bin/sh
echo "ARGS: $*" >> ${logFilePath}
echo "GIT_SSH_COMMAND: \${GIT_SSH_COMMAND}" >> ${logFilePath}
exit 0
`;
    const mockGitPath = join(mockBinDir, "git");
    await Deno.writeTextFile(mockGitPath, mockGitContent);
    await Deno.chmod(mockGitPath, 0o755); // 実行権限の付与

    const scriptPath = getSkillScriptPath(
      PATHS.BUNDLES.ONBOARDING,
      "attach-harness-to-project",
      "harness-attach.ts",
    );

    const command = new Deno.Command(Deno.execPath(), {
      args: [
        "run",
        "-A",
        scriptPath,
      ],
      cwd: managerDir,
      env: {
        // PATHの最優先にモックbinを指定し、システムgitではなくモックgitを呼ばせる
        PATH: `${mockBinDir}:${Deno.env.get("PATH")}`,
      },
      stdout: "piped",
      stderr: "piped",
    });

    const { code, stderr } = await command.output();
    const errOutput = new TextDecoder().decode(stderr);

    assertEquals(code, 0, `Script failed with code ${code}\nStderr: ${errOutput}`);

    // モック git の呼び出しログを検証
    const logContent = await Deno.readTextFile(logFilePath);
    assertStringIncludes(logContent, "ARGS: clone");
    assertStringIncludes(logContent, "GIT_SSH_COMMAND: ssh -o StrictHostKeyChecking=accept-new");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});
