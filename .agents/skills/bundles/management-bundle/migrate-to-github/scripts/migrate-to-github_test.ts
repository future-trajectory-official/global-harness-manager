import { assertEquals, assertExists, assertStringIncludes } from "@std/assert";
import { dirname, fromFileUrl, join, resolve } from "@std/path";

const PROJECT_ROOT = resolve(dirname(fromFileUrl(import.meta.url)), "../../../../../..");
const SCRIPT_PATH = join(
  ".agents/skills/bundles/management-bundle/migrate-to-github/scripts/migrate-to-github.ts",
);

const mockBacklog = `# プロダクトバックログ

## Sprint 12

### [WIP] [TestEpic/TestFeature]/Active-PBI

- **概要**: アクティブなPBIのテスト
- **見積サイズ**: M
- **証明方法**: テスト

#### WP_1: タスクA

- **Effort見積（介入回数）**: 2回
- [ ] AC1: タスクAの条件1
- [ ] AC2: タスクAの条件2

### [DONE] [TestEpic/TestFeature]/Completed-PBI

- **概要**: 完了済みPBIのテスト
- **見積サイズ**: S
- **証明方法**: 確認済み

#### WP_1: タスクB

- **Effort見積（介入回数）**: 1回
- [x] AC1: 完了条件
`;

Deno.test("migrate-to-github --list --dry-run should parse backlog and list PBIs", async () => {
  const tmpFile = await Deno.makeTempFile({ suffix: ".md" });
  try {
    await Deno.writeTextFile(tmpFile, mockBacklog);

    const cmd = new Deno.Command(Deno.execPath(), {
      args: [
        "run",
        "-A",
        SCRIPT_PATH,
        "--list",
        "--dry-run",
        "--backlog",
        tmpFile,
      ],
      cwd: PROJECT_ROOT,
    });
    const { code, stdout } = await cmd.output();
    const output = new TextDecoder().decode(stdout);

    assertEquals(code, 0);
    assertStringIncludes(output, "[TestEpic/TestFeature]/Active-PBI");
    assertStringIncludes(output, "[TestEpic/TestFeature]/Completed-PBI");
    assertStringIncludes(output, '"status": "WIP"');
    assertStringIncludes(output, '"status": "DONE"');
  } finally {
    await Deno.remove(tmpFile);
  }
});

Deno.test("migrate-to-github --migrate --dry-run should show migration plan with variance", async () => {
  const tmpFile = await Deno.makeTempFile({ suffix: ".md" });
  try {
    await Deno.writeTextFile(tmpFile, mockBacklog);

    const cmd = new Deno.Command(Deno.execPath(), {
      args: [
        "run",
        "-A",
        SCRIPT_PATH,
        "--migrate",
        "[TestEpic/TestFeature]/Active-PBI",
        "--repo",
        "test-owner/test-repo",
        "--dry-run",
        "--backlog",
        tmpFile,
      ],
      cwd: PROJECT_ROOT,
    });
    const { code, stdout } = await cmd.output();
    const output = new TextDecoder().decode(stdout);

    assertEquals(code, 0);
    assertStringIncludes(output, "[DRY-RUN] Would create PBI Issue:");
    assertStringIncludes(output, "Epic: TestEpic");
    assertStringIncludes(output, "Feature: TestFeature");
    assertStringIncludes(output, "Title: Active-PBI");
    assertStringIncludes(output, "Labels: type:PBI, status:WIP");
    assertStringIncludes(output, "child WP Issue(s):");
    assertStringIncludes(output, "WP_1: タスクA");
    assertStringIncludes(output, "Effort: initial=2");
    assertStringIncludes(output, "Variance: init→planed");
    assertStringIncludes(output, "AC1: タスクAの条件1");
  } finally {
    await Deno.remove(tmpFile);
  }
});

Deno.test("migrate-to-github --migrate --dry-run should show variance for DONE WP", async () => {
  const tmpFile = await Deno.makeTempFile({ suffix: ".md" });
  try {
    await Deno.writeTextFile(tmpFile, mockBacklog);

    const cmd = new Deno.Command(Deno.execPath(), {
      args: [
        "run",
        "-A",
        SCRIPT_PATH,
        "--migrate",
        "[TestEpic/TestFeature]/Completed-PBI",
        "--repo",
        "test-owner/test-repo",
        "--dry-run",
        "--backlog",
        tmpFile,
      ],
      cwd: PROJECT_ROOT,
    });
    const { code, stdout } = await cmd.output();
    const output = new TextDecoder().decode(stdout);

    assertEquals(code, 0);
    assertStringIncludes(output, "Labels: type:PBI, status:DONE");
    assertStringIncludes(output, "WP_1: タスクB");
    assertStringIncludes(output, "(done)");
    assertStringIncludes(output, "Effort: initial=1");
    assertStringIncludes(output, "Variance: init→planed");
    assertStringIncludes(output, "AC1: 完了条件");
  } finally {
    await Deno.remove(tmpFile);
  }
});

Deno.test("migrate-to-github --list --dry-run should work with explicit backlog path", async () => {
  const tmpFile = await Deno.makeTempFile({ suffix: ".md" });
  try {
    await Deno.writeTextFile(tmpFile, mockBacklog);

    const cmd = new Deno.Command(Deno.execPath(), {
      args: [
        "run",
        "-A",
        SCRIPT_PATH,
        "--list",
        "--dry-run",
        "--backlog",
        tmpFile,
      ],
      cwd: PROJECT_ROOT,
    });
    const { code, stdout } = await cmd.output();
    const output = new TextDecoder().decode(stdout);

    assertEquals(code, 0);
    assertStringIncludes(output, "Active-PBI");
    assertStringIncludes(output, "Completed-PBI");
  } finally {
    await Deno.remove(tmpFile);
  }
});

Deno.test("migrate-to-github --help should display usage", async () => {
  const cmd = new Deno.Command(Deno.execPath(), {
    args: ["run", "-A", SCRIPT_PATH, "--help"],
    cwd: PROJECT_ROOT,
  });
  const { code, stdout } = await cmd.output();
  const output = new TextDecoder().decode(stdout);

  assertEquals(code, 0);
  assertStringIncludes(output, "Usage:");
  assertStringIncludes(output, "--stdin");
  assertStringIncludes(output, "--dry-run");
});

Deno.test("migrate-to-github --migrate without --repo should error", async () => {
  const cmd = new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "-A",
      SCRIPT_PATH,
      "--migrate",
      "[Test]/PBI",
    ],
    cwd: PROJECT_ROOT,
  });
  const { stderr } = await cmd.output();
  const errOutput = new TextDecoder().decode(stderr);

  assertStringIncludes(errOutput, "--repo is required");
});

Deno.test("migrate-to-github --stdin should accept JSON from stdin", async () => {
  const tmpFile = await Deno.makeTempFile({ suffix: ".md" });
  try {
    await Deno.writeTextFile(tmpFile, mockBacklog);

    const cmd = new Deno.Command(Deno.execPath(), {
      args: [
        "run",
        "-A",
        SCRIPT_PATH,
        "--stdin",
        "--dry-run",
        "--backlog",
        tmpFile,
      ],
      stdin: "piped",
      stdout: "piped",
      cwd: PROJECT_ROOT,
    });
    const proc = cmd.spawn();
    const writer = proc.stdin.getWriter();
    await writer.write(
      new TextEncoder().encode(
        JSON.stringify({
          pbiId: "[TestEpic/TestFeature]/Active-PBI",
          repo: "test-owner/test-repo",
        }),
      ),
    );
    await writer.close();
    const { code, stdout } = await proc.output();
    const output = new TextDecoder().decode(stdout);

    assertEquals(code, 0);
    assertStringIncludes(output, "[DRY-RUN] Would create PBI Issue:");
    assertStringIncludes(output, "Epic: TestEpic");
    assertStringIncludes(output, "Feature: TestFeature");
    assertStringIncludes(output, "Title: Active-PBI");
  } finally {
    await Deno.remove(tmpFile);
  }
});

Deno.test("variance-analysis-schema.json should be valid JSON and contain required fields", async () => {
  const schemaPath = join(PROJECT_ROOT, ".github/schemas/variance-analysis-schema.json");
  const content = await Deno.readTextFile(schemaPath);
  const schema = JSON.parse(content);

  assertExists(schema.$schema);
  assertEquals(schema.title, "WP Variance Analysis");
  assertExists(schema.properties.schema);
  assertEquals(schema.properties.schema.enum[0], "variance-analysis/v1");
  assertExists(schema.properties.wpName);
  assertExists(schema.properties.effortInitial);
  assertExists(schema.properties.effortPlaned);
  assertExists(schema.properties.effortActual);
  assertExists(schema.properties.varianceInitialToPlaned);
  assertExists(schema.properties.variancePlanedToActual);
  assertExists(schema.properties.varianceTotal);
  assertExists(schema.properties.varianceReason);
  assertExists(schema.properties.status);
  assertExists(schema.properties.recordedAt);
});

Deno.test("migrate-to-github without args should show help", async () => {
  const cmd = new Deno.Command(Deno.execPath(), {
    args: ["run", "-A", SCRIPT_PATH],
    cwd: PROJECT_ROOT,
  });
  const { code, stdout } = await cmd.output();
  const output = new TextDecoder().decode(stdout);

  assertEquals(code, 0);
  assertStringIncludes(output, "Usage:");
});
