import { assertEquals, assertStringIncludes } from "@std/assert";
import { fromFileUrl, join } from "@std/path";
import { fsUtil } from "../core/shared/io/fs.ts";
import { getSkillScriptPath, PATHS } from "./test_helper.ts";

/**
 * Integration: setup-harness-env — 環境セットアップスクリプトが正しく動作することを検証する。
 * モックHOME環境下で Deno/gh のダウンロード判定やシェル設定が期待通り行われることを確認する。
 */
Deno.test({
  name: "Integration: setup-harness-env",
  ignore: !Deno.env.get("CI"),
  fn: async () => {
    const tempHome = await Deno.makeTempDir();
    try {
      // 1. Prepare mock HOME environment
      const mockBashrc = join(tempHome, ".bashrc");
      await Deno.writeTextFile(mockBashrc, "# initial bashrc\n");

      const scriptPath = getSkillScriptPath(
        PATHS.BUNDLES.ONBOARDING,
        "setup-harness-env",
        "setup.ts",
      );

      const harnessRoot = fromFileUrl(new URL("../..", import.meta.url));

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

      // setup.ts は skills.txt（~/.gemini/antigravity/skills.txt）を作成しない。
      // 旧Antigravity登録ブロックは WP #839 で撤去されたため、非作成をアサーションする。
      const skillsFilePath = join(tempHome, ".gemini", "antigravity", "skills.txt");
      assertEquals(await fsUtil.exists(skillsFilePath), false, "skills.txt should not be created");

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
      await Deno.remove(tempHome, { recursive: true });
    }
  },
});
