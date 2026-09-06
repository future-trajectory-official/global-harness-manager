import { assertEquals, assertStringIncludes } from "@std/assert";
import { join } from "@std/path";
import { fsUtil } from "../.agents/core/shared/io/fs.ts";
import { getSkillDirPath, getSkillScriptPath, PATHS } from "./test_helper.ts";

/**
 * Integration: --platform 引数 - 引数なし実行の後方互換を検証する。
 * ユースケース: PO が従来どおり `--lang ja --os linux` のみでスクリプトを実行する。
 * 検証意図: デフォルトが antigravity で、~/.gemini/GEMINI.md は生成され ~/.config/opencode/ は生成されない。
 */
Deno.test("Integration: --platform default is antigravity (backward compatible)", async () => {
  const tempDir = await Deno.makeTempDir();
  try {
    const mockHome = join(tempDir, "mock_home");
    await Deno.mkdir(mockHome, { recursive: true });

    const scriptPath = getSkillScriptPath(
      PATHS.BUNDLES.ONBOARDING,
      "publish-harness-rules",
      "publish-rules.ts",
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

    const opencodeDir = join(mockHome, ".config/opencode");
    assertEquals(
      await fsUtil.exists(opencodeDir),
      false,
      "default platform must not create ~/.config/opencode/",
    );
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

/**
 * Integration: --platform 引数 - antigravity 明示指定の挙動を検証する。
 * ユースケース: PO が `--platform antigravity` を明示して実行する。
 * 検証意図: 引数なし（デフォルト）と成果物が一致すること。exit 0 かつ ~/.gemini/GEMINI.md が生成され、~/.config/opencode/ は生成されず、さらにデフォルト実行と GEMINI.md の内容が完全一致する（後方互換の最強保証）。
 */
Deno.test("Integration: --platform antigravity explicit produces same artifacts as default", async () => {
  const tempDir = await Deno.makeTempDir();
  try {
    const scriptPath = getSkillScriptPath(
      PATHS.BUNDLES.ONBOARDING,
      "publish-harness-rules",
      "publish-rules.ts",
    );

    const runPlatform = async (mockHome: string, explicit: boolean) => {
      await Deno.mkdir(mockHome, { recursive: true });
      const args = ["run", "-A", scriptPath, "--lang", "ja", "--os", "linux"];
      if (explicit) {
        args.push("--platform", "antigravity");
      }
      const command = new Deno.Command(Deno.execPath(), {
        args,
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
    };

    const defaultHome = join(tempDir, "home_default");
    const explicitHome = join(tempDir, "home_explicit");
    await runPlatform(defaultHome, false);
    await runPlatform(explicitHome, true);

    const defaultGemini = join(defaultHome, ".gemini/GEMINI.md");
    const explicitGemini = join(explicitHome, ".gemini/GEMINI.md");
    assertEquals(await fsUtil.exists(explicitGemini), true, "GEMINI.md should be created");

    for (const home of [defaultHome, explicitHome]) {
      const opencodeDir = join(home, ".config/opencode");
      assertEquals(
        await fsUtil.exists(opencodeDir),
        false,
        "antigravity platform must not create ~/.config/opencode/",
      );
    }

    assertEquals(
      await Deno.readTextFile(defaultGemini),
      await Deno.readTextFile(explicitGemini),
      "explicit antigravity must produce byte-identical GEMINI.md as default",
    );
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

// 無効値テーブル（誤綴り "zzz" と空文字 ""）で同一検証を回す。
// メッセージは PLATFORM_CONFIGS のキーから導出される単一情報源の許容列挙と
// 完全一致寄り（`Invalid --platform "<値>". Expected: ...`）で照合する。
for (const invalidValue of ["zzz", ""]) {
  /**
   * Integration: --platform 引数 - 無効値（テーブル駆動: "zzz" / 空文字 ""）の検証を検証する。
   * ユースケース: PO が誤った綴り（例: zzz）や空文字で `--platform` を指定してしまう。
   * 検証意図: 非0終了となり、combined に `Invalid --platform "<値>". Expected: antigravity | opencode`（単一情報源由来の完全メッセージ）を含むこと。
   */
  Deno.test(
    "Integration: --platform invalid value " + JSON.stringify(invalidValue) +
      " exits non-zero and lists allowed values",
    async () => {
      const tempDir = await Deno.makeTempDir();
      try {
        const mockHome = join(tempDir, "mock_home");
        await Deno.mkdir(mockHome, { recursive: true });

        const scriptPath = getSkillScriptPath(
          PATHS.BUNDLES.ONBOARDING,
          "publish-harness-rules",
          "publish-rules.ts",
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
            "--platform",
            invalidValue,
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
          code !== 0,
          true,
          `invalid --platform ${
            JSON.stringify(invalidValue)
          } must exit non-zero\nStdout: ${output}\nStderr: ${errOutput}`,
        );
        const combined = errOutput + output;
        assertStringIncludes(
          combined,
          `Invalid --platform "${invalidValue}". Expected: antigravity | opencode`,
          "error output should contain the full expected message with allowed values",
        );
      } finally {
        await Deno.remove(tempDir, { recursive: true });
      }
    },
  );
}

/**
 * Integration: --platform 引数 - opencode 指定時の出力先とテンプレート切替を検証する。
 * ユースケース: PO が OpenCode 向けに `--platform opencode --lang ja --os linux` で実行する。
 * 検証意図: ~/.config/opencode/AGENTS.md が生成され ~/.gemini/GEMINI.md は生成されない。内容が AGENTS.md.template 由来（プレースホルダ解消・日本語/Linux記述・`## Safety Guardrails` あり・GEMINI 固有の `& Context Sync` なし）であることを内容照合で担保する。
 */
Deno.test("Integration: --platform opencode writes AGENTS.md from AGENTS.md.template", async () => {
  const tempDir = await Deno.makeTempDir();
  try {
    const mockHome = join(tempDir, "mock_home");
    await Deno.mkdir(mockHome, { recursive: true });

    const scriptPath = getSkillScriptPath(
      PATHS.BUNDLES.ONBOARDING,
      "publish-harness-rules",
      "publish-rules.ts",
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
        "--platform",
        "opencode",
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

    // a) ~/.config/opencode/AGENTS.md が生成される
    const agentsPath = join(mockHome, ".config/opencode/AGENTS.md");
    assertEquals(await fsUtil.exists(agentsPath), true, "AGENTS.md should be created");

    // b) ~/.gemini/GEMINI.md は生成されない
    const geminiPath = join(mockHome, ".gemini/GEMINI.md");
    assertEquals(
      await fsUtil.exists(geminiPath),
      false,
      "opencode platform must not create ~/.gemini/GEMINI.md",
    );

    // c) 内容が AGENTS.md.template 由来である検証
    const content = await Deno.readTextFile(agentsPath);
    assertEquals(
      content.includes("{{LANGUAGE_DESCRIPTION}}"),
      false,
      "language placeholder must be replaced",
    );
    assertEquals(
      content.includes("{{ENVIRONMENT_DESCRIPTION}}"),
      false,
      "environment placeholder must be replaced",
    );
    assertStringIncludes(
      content,
      "チャット内の応答やプログレスメッセージ、成果物のプラン、タスク、ウォークスルーを日本語で表示する。",
    );
    assertStringIncludes(content, "本プロジェクトは標準的な **Linux環境** で運用されています。");
    assertStringIncludes(content, "## Safety Guardrails");
    assertEquals(
      content.includes("& Context Sync"),
      false,
      "AGENTS.md must come from AGENTS.md.template, not GEMINI.md.template",
    );
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

/**
 * Integration: --platform 引数 - opencode + 言語/環境差し込み（英語）を検証する。
 * ユースケース: PO が `--platform opencode --lang en --os linux` で実行し、英語圏向けグローバルプロンプトを生成する。
 * 検証意図: プラットフォーム非依存の lang/osEnv 差し込みロジックが opencode テンプレートでも機能し、AGENTS.md に英語の言語記述（"Display chat responses"）と英語の環境記述（"standard **Linux environment**"）がプレースホルダ残留なく差し込まれていること（AC-2 からの回帰ガード）。
 */
Deno.test("Integration: --platform opencode applies en lang and linux os descriptions", async () => {
  const tempDir = await Deno.makeTempDir();
  try {
    const mockHome = join(tempDir, "mock_home");
    await Deno.mkdir(mockHome, { recursive: true });

    const scriptPath = getSkillScriptPath(
      PATHS.BUNDLES.ONBOARDING,
      "publish-harness-rules",
      "publish-rules.ts",
    );

    const command = new Deno.Command(Deno.execPath(), {
      args: [
        "run",
        "-A",
        scriptPath,
        "--platform",
        "opencode",
        "--lang",
        "en",
        "--os",
        "linux",
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

    const agentsPath = join(mockHome, ".config/opencode/AGENTS.md");
    assertEquals(await fsUtil.exists(agentsPath), true, "AGENTS.md should be created");

    const content = await Deno.readTextFile(agentsPath);
    assertEquals(
      content.includes("{{LANGUAGE_DESCRIPTION}}"),
      false,
      "language placeholder must be replaced",
    );
    assertEquals(
      content.includes("{{ENVIRONMENT_DESCRIPTION}}"),
      false,
      "environment placeholder must be replaced",
    );
    assertStringIncludes(content, "Display chat responses", "English language description");
    assertStringIncludes(
      content,
      "standard **Linux environment**",
      "English environment description",
    );
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

/**
 * Integration: --platform 引数 - opencode + append モードの安全セクション追記を完全一致で検証する。
 * ユースケース: PO の ~/.config/opencode/AGENTS.md にSafety Guardrailsを含まない既存カスタム記述があり、`--platform opencode --append --lang ja --os linux` でハーネスの安全セクションのみ後付けする。
 * 検証意図: 追記後の全文が `既存内容 + "\n\n" + 抽出部` と完全一致すること（\n\n区切り・抽出部は実装の追記様式そのもの）。抽出部はテスト内で AGENTS.md.template を読み、プレースホルダを ja/linux 記述へ置換後、行頭アンカー（^ と m フラグ）の正規表現で `## Safety Guardrails` 開始見出し行からファイル末尾までを抽出して導出。見出し行欠落や空白差の混入なく、AC-2時の無追記欠陥解消と抽出正規表現強化の回帰を担保する。
 */
Deno.test("Integration: --platform opencode append adds AGENTS.md template safety section", async () => {
  const tempDir = await Deno.makeTempDir();
  try {
    const mockHome = join(tempDir, "mock_home");
    const opencodeDir = join(mockHome, ".config/opencode");
    const agentsPath = join(opencodeDir, "AGENTS.md");
    const existingContent = "# Existing\n\ncustom content\n";

    await Deno.mkdir(opencodeDir, { recursive: true });
    await Deno.writeTextFile(agentsPath, existingContent);

    const scriptPath = getSkillScriptPath(
      PATHS.BUNDLES.ONBOARDING,
      "publish-harness-rules",
      "publish-rules.ts",
    );

    const command = new Deno.Command(Deno.execPath(), {
      args: [
        "run",
        "-A",
        scriptPath,
        "--platform",
        "opencode",
        "--append",
        "--lang",
        "ja",
        "--os",
        "linux",
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

    const content = await Deno.readTextFile(agentsPath);

    // テンプレート由来の期待追記部をテスト内で再構築する:
    // AGENTS.md.template を読み、プレースホルダを ja/linux 記述へ置換後、
    // 行頭アンカーの正規表現で安全セクション（開始見出し行を含む）を抽出する。
    const templatePath = join(
      getSkillDirPath(PATHS.BUNDLES.ONBOARDING, "publish-harness-rules"),
      "references",
      "AGENTS.md.template",
    );
    const templateContent = await Deno.readTextFile(templatePath);
    const resolvedTemplate = templateContent
      .replace(
        "{{LANGUAGE_DESCRIPTION}}",
        "チャット内の応答やプログレスメッセージ、成果物のプラン、タスク、ウォークスルーを日本語で表示する。",
      )
      .replace(
        "{{ENVIRONMENT_DESCRIPTION}}",
        "本プロジェクトは標準的な **Linux環境** で運用されています。",
      );
    const safetySectionMatch = resolvedTemplate.match(/^## Safety Guardrails[\s\S]*/m);
    assertEquals(
      safetySectionMatch !== null,
      true,
      "template must contain a line-anchored safety guardrails heading",
    );

    // 追記後の全文は 既存内容 + "\n\n" + 抽出部 と完全一致（実装の追記様式そのもの）
    const expected = existingContent + "\n\n" + safetySectionMatch![0];
    assertEquals(
      content,
      expected,
      "appended AGENTS.md must be exactly existing content + blank line + AGENTS template safety section",
    );

    // 抽出部は AGENTS.md.template 由来（GEMINI テンプレート固有の `& Context Sync` を含まない）
    assertEquals(
      content.includes("& Context Sync"),
      false,
      "appended section must come from AGENTS.md.template, not GEMINI.md.template",
    );
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

/**
 * Integration: --platform 引数 - opencode + dry-run モードでファイルが生成されないことを検証する。
 * ユースケース: PO が `--platform opencode --dry-run --lang ja --os linux` で実書き込みを伴わない予行確認を行う。
 * 検証意図: exit 0 となり、かつ ~/.config/opencode/AGENTS.md が生成されないこと（dry-run の無副作用保証）。
 */
Deno.test("Integration: --platform opencode dry-run does not create AGENTS.md", async () => {
  const tempDir = await Deno.makeTempDir();
  try {
    const mockHome = join(tempDir, "mock_home");
    await Deno.mkdir(mockHome, { recursive: true });

    const scriptPath = getSkillScriptPath(
      PATHS.BUNDLES.ONBOARDING,
      "publish-harness-rules",
      "publish-rules.ts",
    );

    const command = new Deno.Command(Deno.execPath(), {
      args: [
        "run",
        "-A",
        scriptPath,
        "--platform",
        "opencode",
        "--dry-run",
        "--lang",
        "ja",
        "--os",
        "linux",
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

    const agentsPath = join(mockHome, ".config/opencode/AGENTS.md");
    assertEquals(
      await fsUtil.exists(agentsPath),
      false,
      "dry-run must not create ~/.config/opencode/AGENTS.md",
    );
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

/**
 * Integration: --platform 引数 - lang/os 未指定（プリセット無し）はグローバルプロンプト同期をスキップすることを検証する。
 * ユースケース: PO が `--platform opencode` のみを実行する（--lang/--os 無し、config/global-settings.md は未作成）。
 * 検証意図: exit 0、mockHome 配下にファイルは一切生成されず（.gemini も .config も無し）、同期スキップ時は "Selected platform" ログも出力されないこと。
 */
Deno.test("Integration: --platform alone (no lang/os) skips sync without artifacts or log", async () => {
  const tempDir = await Deno.makeTempDir();
  try {
    const mockHome = join(tempDir, "mock_home");
    await Deno.mkdir(mockHome, { recursive: true });

    // プリセット設定の読み取り元（子プロセス cwd 基準の config/global-settings.md）を
    // 隔離するため、カレントディレクトリを空の一時ワークスペースへ向ける
    const mockWorkspace = join(tempDir, "empty_workspace");
    await Deno.mkdir(mockWorkspace, { recursive: true });

    const scriptPath = getSkillScriptPath(
      PATHS.BUNDLES.ONBOARDING,
      "publish-harness-rules",
      "publish-rules.ts",
    );

    const command = new Deno.Command(Deno.execPath(), {
      args: [
        "run",
        "-A",
        scriptPath,
        "--platform",
        "opencode",
      ],
      cwd: mockWorkspace,
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

    // mockHome 配下にファイル・ディレクトリは一切生成されない（.gemini も .config も無し）
    assertEquals(
      await fsUtil.exists(join(mockHome, ".gemini")),
      false,
      "skipped sync must not create ~/.gemini/",
    );
    assertEquals(
      await fsUtil.exists(join(mockHome, ".config")),
      false,
      "skipped sync must not create ~/.config/",
    );
    const entries: string[] = [];
    for await (const entry of Deno.readDir(mockHome)) {
      entries.push(entry.name);
    }
    // .cache は HOME を向けた Deno 子プロセス自体が作るランタイムキャッシュであり
    // スクリプト成果物ではないため除外して「一切生成なし」を検証する
    const scriptArtifacts = entries.filter((name) => name !== ".cache");
    assertEquals(
      scriptArtifacts,
      [],
      `mockHome must not contain script artifacts when sync is skipped, got: ${
        scriptArtifacts.join(", ")
      }`,
    );

    // 同期スキップ時は "Selected platform" ログも出力されない（否定アサーション）
    assertEquals(
      output.includes("Selected platform"),
      false,
      `"Selected platform" log must not appear when sync is skipped\nStdout: ${output}`,
    );
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});
