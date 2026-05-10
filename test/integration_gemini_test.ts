import { assertEquals, assertStringIncludes } from "@std/assert";
import { dirname as _dirname, join } from "@std/path";
import { fsUtil } from "../.agents/core/fs.ts";
import { getSkillScriptPath, PATHS } from "./test_helper.ts";

Deno.test("Integration: GEMINI.md sync - basic generation (Linux/WSL)", async () => {
  const tempDir = await Deno.makeTempDir();
  try {
    const managerDir = Deno.cwd(); // Use current repo as manager dir
    const mockHome = join(tempDir, "mock_home");
    await Deno.mkdir(mockHome, { recursive: true });

    const scriptPath = join(
      managerDir,
      getSkillScriptPath(PATHS.BUNDLES.ONBOARDING, "publish-harness-rules", "publish-rules.ts"),
    );

    const command = new Deno.Command(Deno.execPath(), {
      args: [
        "run",
        "-A",
        scriptPath,
        "--lang",
        "ja",
        "--os",
        "wsl",
      ],
      env: {
        HOME: mockHome,
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

    const geminiPath = join(mockHome, ".gemini/GEMINI.md");
    assertEquals(await fsUtil.exists(geminiPath), true, "GEMINI.md should be created");

    const content = await Deno.readTextFile(geminiPath);
    assertStringIncludes(content, "日本語");
    assertStringIncludes(content, "WSL環境");
    assertStringIncludes(content, "Safety Guardrails");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("Integration: GEMINI.md sync - not implemented (Windows)", async () => {
  const tempDir = await Deno.makeTempDir();
  try {
    const managerDir = Deno.cwd();
    const mockHome = join(tempDir, "mock_home");
    await Deno.mkdir(mockHome, { recursive: true });

    const scriptPath = join(
      managerDir,
      getSkillScriptPath(PATHS.BUNDLES.ONBOARDING, "publish-harness-rules", "publish-rules.ts"),
    );

    const command = new Deno.Command(Deno.execPath(), {
      args: [
        "run",
        "-A",
        scriptPath,
        "--lang",
        "ja",
        "--os",
        "windows",
      ],
      env: {
        HOME: mockHome,
      },
      stdout: "piped",
      stderr: "piped",
    });

    const { code: _code, stderr } = await command.output();
    const errOutput = new TextDecoder().decode(stderr);

    // Expected to fail with an error message about "Not Implemented"
    assertStringIncludes(errOutput, "Not implemented");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("Integration: GEMINI.md sync - append mode", async () => {
  const tempDir = await Deno.makeTempDir();
  try {
    const managerDir = Deno.cwd();
    const mockHome = join(tempDir, "mock_home");
    const geminiPath = join(mockHome, ".gemini/GEMINI.md");

    await Deno.mkdir(join(mockHome, ".gemini"), { recursive: true });
    await Deno.writeTextFile(geminiPath, "# Existing Context\n\n## Custom Rule\nRule 1");

    const scriptPath = join(
      managerDir,
      getSkillScriptPath(PATHS.BUNDLES.ONBOARDING, "publish-harness-rules", "publish-rules.ts"),
    );

    const command = new Deno.Command(Deno.execPath(), {
      args: [
        "run",
        "-A",
        scriptPath,
        "--lang",
        "ja",
        "--os",
        "wsl",
        "--append",
      ],
      env: {
        HOME: mockHome,
      },
    });

    await command.output();

    const content = await Deno.readTextFile(geminiPath);
    assertStringIncludes(content, "# Existing Context");
    assertStringIncludes(content, "## Custom Rule");
    assertStringIncludes(content, "## Safety Guardrails");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("Integration: GEMINI.md sync - basic generation (Standard Linux)", async () => {
  const tempDir = await Deno.makeTempDir();
  try {
    const managerDir = Deno.cwd();
    const mockHome = join(tempDir, "mock_home");
    await Deno.mkdir(mockHome, { recursive: true });

    const scriptPath = join(
      managerDir,
      getSkillScriptPath(PATHS.BUNDLES.ONBOARDING, "publish-harness-rules", "publish-rules.ts"),
    );

    const command = new Deno.Command(Deno.execPath(), {
      args: [
        "run",
        "-A",
        scriptPath,
        "--lang",
        "ja",
        "--os",
        "linux",
      ],
      env: {
        HOME: mockHome,
      },
    });

    const { code: _code } = await command.output();
    assertEquals(_code, 0);

    const geminiPath = join(mockHome, ".gemini/GEMINI.md");
    const content = await Deno.readTextFile(geminiPath);
    assertStringIncludes(content, "Linux環境");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});
