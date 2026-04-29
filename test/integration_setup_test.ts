import { assertEquals, assertStringIncludes } from "@std/assert";
import { join } from "@std/path";
import { fsUtil } from "../.agents/core/fs.ts";

Deno.test("Integration: setup-harness-env", async () => {
  const tempHome = await Deno.makeTempDir();
  try {
    // 1. Prepare mock HOME environment
    const mockBashrc = join(tempHome, ".bashrc");
    await Deno.writeTextFile(mockBashrc, "# initial bashrc\n");

    const scriptPath =
      new URL("../.agents/skills/setup-harness-env/scripts/setup.ts", import.meta.url)
        .pathname;

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
      },
      stdout: "piped",
      stderr: "piped",
    });

    const { code, stdout, stderr } = await command.output();
    const output = new TextDecoder().decode(stdout);
    const errOutput = new TextDecoder().decode(stderr);

    assertEquals(
      code,
      0,
      `Script failed with code ${code}\nStderr: ${errOutput}\nStdout: ${output}`,
    );

    // Verify bashrc was updated (if not windows, windows uses powershell to check Path)
    if (Deno.build.os !== "windows") {
      const bashrcContent = await Deno.readTextFile(mockBashrc);
      assertStringIncludes(bashrcContent, "global-harness-manager");
      assertStringIncludes(bashrcContent, "export PATH=");
    }

    // Verify skills.txt was created
    const skillsFilePath = join(tempHome, ".gemini", "antigravity", "skills.txt");
    assertEquals(await fsUtil.exists(skillsFilePath), true, "skills.txt should be created");

    const skillsContent = await Deno.readTextFile(skillsFilePath);
    assertStringIncludes(skillsContent, "global-skills");
  } finally {
    await Deno.remove(tempHome, { recursive: true });
  }
});
