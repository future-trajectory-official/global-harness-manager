import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { join } from "jsr:@std/path@1.0.8";

const SCRIPT_PATH = join(
  Deno.cwd(),
  ".agents/skills/bundles/development-bundle/develop-environment-setup/scripts/manage-sandbox.ts",
);

/**
 * manage-sandbox create --mode directory - サンドボックスがディレクトリモードで
 * 正しく作成されることを検証する。指定したベース配下にタスク名のディレクトリが
 * 作成され、isDirectory が true となることを確認する。
 */
Deno.test("manage-sandbox create --mode directory", async () => {
  const taskName = `test-task-${Date.now()}`;
  const sandboxBase = await Deno.makeTempDir();

  const command = new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "-A",
      SCRIPT_PATH,
      "create",
      "--name",
      taskName,
      "--mode",
      "directory",
      "--base",
      sandboxBase,
    ],
    stdout: "piped",
    stderr: "piped",
  });

  const { code, stdout, stderr } = await command.output();
  const output = new TextDecoder().decode(stdout);
  const errorOutput = new TextDecoder().decode(stderr);

  console.log(output);
  console.log(errorOutput);

  assertEquals(code, 0, "Command should succeed");

  const sandboxPath = join(sandboxBase, taskName);
  const stat = await Deno.stat(sandboxPath);
  assertEquals(stat.isDirectory, true, "Sandbox directory should be created");

  // クリーンアップ
  await Deno.remove(sandboxBase, { recursive: true });
});

/**
 * manage-sandbox create --mode container - サンドボックスがコンテナモードで
 * 正しく作成されることを検証する。Docker コンテナが起動し、docker ps で
 * コンテナ名が確認できることをチェックする。
 */
Deno.test("manage-sandbox create --mode container", async () => {
  const taskName = `test-container-${Date.now()}`;
  const containerName = `harness-sandbox-${taskName}`;

  const command = new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "-A",
      SCRIPT_PATH,
      "create",
      "--name",
      taskName,
      "--mode",
      "container",
    ],
  });

  const { code } = await command.output();
  assertEquals(code, 0, "Command should succeed");

  // docker ps でコンテナが存在するか確認
  const dockerPs = new Deno.Command("docker", {
    args: ["ps", "--filter", `name=${containerName}`, "--format", "{{.Names}}"],
  });
  const { stdout } = await dockerPs.output();
  const output = new TextDecoder().decode(stdout).trim();
  assertEquals(output, containerName, "Container should be running");

  // クリーンアップ
  const destroyCmd = new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "-A",
      SCRIPT_PATH,
      "destroy",
      "--name",
      taskName,
    ],
  });
  await destroyCmd.output();
});
