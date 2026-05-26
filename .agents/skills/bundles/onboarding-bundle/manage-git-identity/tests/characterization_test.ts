import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { join } from "https://deno.land/std@0.224.0/path/mod.ts";

Deno.test("manage-git-identity characterization test", async () => {
  const tempDir = await Deno.makeTempDir();
  const mockHome = join(tempDir, "home");
  const mockRepo = join(tempDir, "repo");

  await Deno.mkdir(mockHome, { recursive: true });
  await Deno.mkdir(join(mockRepo, "config"), { recursive: true });

  // ダミーの config/identities.md を作成
  const mockConfigDir = join(tempDir, "config");
  await Deno.mkdir(mockConfigDir, { recursive: true });
  const identitiesContent = `
## Test Project
- **Account Name**: \`testuser\`
- **User Email**: \`test@example.com\`
`;
  await Deno.writeTextFile(join(mockConfigDir, "identities.md"), identitiesContent);

  // 元のスクリプトの絶対パスを取得
  const scriptPath = join(
    Deno.cwd(),
    ".agents/skills/bundles/onboarding-bundle/manage-git-identity/scripts/add-identity.ts",
  );

  // 環境変数をモックしてスクリプトを実行
  const command = new Deno.Command(Deno.execPath(), {
    args: ["run", "-A", scriptPath],
    cwd: tempDir, // ここを CWD にすることで config/identities.md が tempDir 内を探される
    env: {
      HOME: mockHome,
      USERPROFILE: mockHome,
      HARNESS_WORKSPACE_ROOT: tempDir, // findProjectRoot が tempDir をルートとして解決するよう指定
    },
    stdout: "piped",
    stderr: "piped",
  });

  const { code: _code, stdout: _stdout, stderr: _stderr } = await command.output();

  // 結果の検証
  const sshKeyPath = join(mockHome, ".ssh", "id_ed25519_testuser");
  const sshConfigPath = join(mockHome, ".ssh", "config");

  assertEquals(await exists(sshKeyPath), true, "SSH key should be generated");
  assertEquals(await exists(sshConfigPath), true, "SSH config should be updated");

  const configContent = await Deno.readTextFile(sshConfigPath);
  assertEquals(
    configContent.includes("Host github.com-testuser"),
    true,
    "SSH config should contain host alias",
  );

  // クリーンアップ
  await Deno.remove(tempDir, { recursive: true });
});

async function exists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
}
