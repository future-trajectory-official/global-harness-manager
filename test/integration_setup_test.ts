import { assertEquals, assertStringIncludes } from "@std/assert";
import { fromFileUrl, join } from "@std/path";
import { fsUtil } from "../.agents/core/fs.ts";

Deno.test("Integration: setup-harness-env", async () => {
  const tempHome = await Deno.makeTempDir();
  let originalConfigExisted = false;
  let originalConfigContent = "";
  let configPath = "";
  try {
    // 1. Prepare mock HOME environment
    const mockBashrc = join(tempHome, ".bashrc");
    await Deno.writeTextFile(mockBashrc, "# initial bashrc\n");

    const scriptPath =
      new URL("../.agents/skills/setup-harness-env/scripts/setup.ts", import.meta.url)
        .pathname;

    const harnessRoot = fromFileUrl(new URL("..", import.meta.url));

    // CI環境などで config ファイルが存在しない場合に備え、.example からコピーしてテスト環境を構築する
    const configExamplePath = join(harnessRoot, "config", "global-skills-path.txt.example");
    configPath = join(harnessRoot, "config", "global-skills-path.txt");
    if (await fsUtil.exists(configPath)) {
      originalConfigExisted = true;
      originalConfigContent = await Deno.readTextFile(configPath);
    }
    await Deno.copyFile(configExamplePath, configPath);

    const tempBinDir = join(tempHome, "bin");
    await Deno.mkdir(tempBinDir, { recursive: true });
    const ghPath = join(tempBinDir, Deno.build.os === "windows" ? "gh.exe" : "gh");
    const realGhPath = join(harnessRoot, "bin", Deno.build.os === "windows" ? "gh.exe" : "gh");
    const realGhExistedInitially = await fsUtil.exists(realGhPath);

    // CI環境の場合、ダウンロードエラー回避のためシステム gh をコピーする
    if (Deno.env.get("CI") === "true") {
      try {
        const whichCmd = new Deno.Command(Deno.build.os === "windows" ? "where" : "which", {
          args: ["gh"],
        });
        const { code, stdout } = await whichCmd.output();
        if (code === 0) {
          const systemGh = new TextDecoder().decode(stdout).trim().split("\n")[0];
          await Deno.copyFile(systemGh, ghPath);
          if (Deno.build.os !== "windows") await Deno.chmod(ghPath, 0o755);
        }
      } catch (_e) {
        // 無視して通常のダウンロードフローに任せる
      }
    }

    // We must pass the correct environment variables to override HOME/USERPROFILE
    const command = new Deno.Command(Deno.execPath(), {
      args: [
        "run",
        "-A",
        scriptPath,
      ],
      env: {
        HOME: tempHome,
        USERPROFILE: tempHome,
        GLOBAL_HARNESS_BIN_DIR: tempBinDir,
      },
      stdout: "piped",
      stderr: "piped",
    });

    const { code, stdout, stderr } = await command.output();
    const output = new TextDecoder().decode(stdout);
    const errOutput = new TextDecoder().decode(stderr);

    if (code !== 0) {
      console.log("--- STDOUT ---");
      console.log(output);
      console.log("--- STDERR ---");
      console.log(errOutput);
    }

    assertEquals(
      code,
      0,
      `Script failed with code ${code}\nStderr: ${errOutput}\nStdout: ${output}`,
    );

    // Verify bashrc was updated (if not windows, windows uses powershell to check Path)
    if (Deno.build.os !== "windows") {
      const bashrcContent = await Deno.readTextFile(mockBashrc);
      try {
        assertStringIncludes(bashrcContent, "global-harness-manager");
        assertStringIncludes(bashrcContent, "export PATH=");
      } catch (e) {
        console.log("--- .bashrc Content ---");
        console.log(bashrcContent);
        throw e;
      }
    }

    // Verify skills.txt was created (Always check, even in CI)
    const skillsFilePath = join(tempHome, ".gemini", "antigravity", "skills.txt");
    assertEquals(await fsUtil.exists(skillsFilePath), true, "skills.txt should be created");

    const skillsContent = await Deno.readTextFile(skillsFilePath);
    assertStringIncludes(skillsContent, "global-skills");

    // Verify bin/ was NOT polluted in the real project root
    if (!realGhExistedInitially) {
      const binExists = await fsUtil.exists(realGhPath);
      assertEquals(
        binExists,
        false,
        `Side effect detected: ${realGhPath} should not exist in the project root after test.`,
      );
    }
  } finally {
    if (originalConfigExisted) {
      await Deno.writeTextFile(configPath, originalConfigContent);
    } else {
      await Deno.remove(configPath).catch(() => {});
    }
    await Deno.remove(tempHome, { recursive: true });
  }
});
