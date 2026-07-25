import { assertEquals, assertStringIncludes } from "@std/assert";
import { dirname, fromFileUrl, join, resolve } from "@std/path";

const PROJECT_ROOT = resolve(dirname(fromFileUrl(import.meta.url)), "../../../../../..");
const SCRIPT_PATH = join(
  ".agents/skills/bundles/management-bundle/migrate-to-github/scripts/migrate-archive-to-github.ts",
);

const mockArchive = `# プロダクトバックログアーカイブ

---

## 完了済みアイテム

### [DONE] Sprint-11-Review-Verification

- **完了日**: 2026-06-13
- **スプリント**: Sprint 11
- **見積サイズ**: M
- **実感サイズ**: XS
- **Effort実績 (介入回数)**:
  - 計画前見積合計: 1回
  - 計画後見積合計: 1回
  - 完了時実績合計: 1回
- **予実差分析**: 全PBI合格確認
- **カテゴリ**: \\\`#Decision\\\`

### [DONE] [TestEpic/TestFeature]/Completed-PBI

- **完了日**: 2026-06-12
- **スプリント**: Sprint 10
- **見積サイズ**: S
- **実感サイズ**: S
- **Effort実績 (介入回数)**:
  - 計画前見積合計: 2回
  - 計画後見積合計: 3回
  - 完了時実績合計: 4回
- **予実差分析**: 想定より多め
- **カテゴリ**: \\\`#Architecture\\\`
`;

/**
 * ユースケース: archiveのパースとdry-run出力が正しく表示されること
 * 検証意図: --dry-run モードでパース結果がJSONとして出力されることを確認する
 */
Deno.test("migrate-archive-to-github --dry-run should parse archive and show plan", async () => {
  const tmpFile = await Deno.makeTempFile({ suffix: ".md" });
  try {
    await Deno.writeTextFile(tmpFile, mockArchive);

    const cmd = new Deno.Command(Deno.execPath(), {
      args: [
        "run",
        "-A",
        SCRIPT_PATH,
        "--dry-run",
        "--backlog",
        tmpFile,
      ],
      cwd: PROJECT_ROOT,
    });
    const { code, stdout } = await cmd.output();
    const output = new TextDecoder().decode(stdout);

    assertEquals(code, 0);
    assertStringIncludes(output, "Sprint-11-Review-Verification");
    assertStringIncludes(output, "[TestEpic/TestFeature]/Completed-PBI");
    assertStringIncludes(output, "Sprint 11");
    assertStringIncludes(output, "Sprint 10");
    assertStringIncludes(output, "Effort: initial=1 / planed=1 / actual=1");
    assertStringIncludes(output, "Effort: initial=2 / planed=3 / actual=4");
    assertStringIncludes(output, "harness-size-actual: XS");
    assertStringIncludes(output, "harness-size-actual: S");
  } finally {
    await Deno.remove(tmpFile);
  }
});

/**
 * ユースケース: --repo フラグが未指定の場合にエラー出力されること
 * 検証意図: 必須引数のバリデーションが機能していることを確認する
 */
Deno.test("migrate-archive-to-github --migrate without --repo should error", async () => {
  const cmd = new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "-A",
      SCRIPT_PATH,
      "--migrate",
    ],
    cwd: PROJECT_ROOT,
  });
  const { stderr } = await cmd.output();
  const errOutput = new TextDecoder().decode(stderr);

  assertStringIncludes(errOutput, "--repo is required");
});

/**
 * ユースケース: --help フラグで使用方法が表示されること
 * 検証意図: ヘルプ表示が正しく機能することを確認する
 */
const mockArchiveWithMalformed = `# プロダクトバックログアーカイブ

---

## 完了済みアイテム

### [DONE] Valid-PBI

- **完了日**: 2026-06-13
- **スプリント**: Sprint 11
- **見積サイズ**: S
- **実感サイズ**: S
- **Effort実績 (介入回数)**:
  - 計画前見積合計: 1回
  - 計画後見積合計: 1回
  - 完了時実績合計: 1回
- **予実差分析**: 正常
- **カテゴリ**: \\\`#Test\\\`

### [DONE] Malformed-No-Effort

- **完了日**: 2026-06-12
- **スプリント**: Sprint 10
- **見積サイズ**: M
- **実感サイズ**: L
- **予実差分析**: Effortフィールド欠落
- **カテゴリ**: \\\`#Test\\\`

### [DONE] Malformed-Empty-Fields

- **完了日**: 2026-06-11
`;

/**
 * ユースケース: フォーマット不正エントリ（Effortデータ欠落）が警告表示されても処理が継続すること
 * 検証意図: effortフィールド欠落などの異常系エントリがスクリプトのクラッシュを引き起こさず、正常エントリと共に安全に処理されることを確認する
 */
Deno.test("migrate-archive-to-github --dry-run should handle entries with missing effort data", async () => {
  const tmpFile = await Deno.makeTempFile({ suffix: ".md" });
  try {
    await Deno.writeTextFile(tmpFile, mockArchiveWithMalformed);

    const cmd = new Deno.Command(Deno.execPath(), {
      args: [
        "run",
        "-A",
        SCRIPT_PATH,
        "--dry-run",
        "--backlog",
        tmpFile,
      ],
      cwd: PROJECT_ROOT,
    });
    const { code, stdout } = await cmd.output();
    const output = new TextDecoder().decode(stdout);

    assertEquals(code, 0);
    assertStringIncludes(output, "Valid-PBI");
    assertStringIncludes(output, "Found 3 archived PBI(s)");
    assertStringIncludes(output, "Effort: initial=1 / planed=1 / actual=1");
    assertStringIncludes(output, "Effort: initial=0 / planed=0 / actual=0");
  } finally {
    await Deno.remove(tmpFile);
  }
});

Deno.test("migrate-archive-to-github --help should display usage", async () => {
  const cmd = new Deno.Command(Deno.execPath(), {
    args: ["run", "-A", SCRIPT_PATH, "--help"],
    cwd: PROJECT_ROOT,
  });
  const { code, stdout } = await cmd.output();
  const output = new TextDecoder().decode(stdout);

  assertEquals(code, 0);
  assertStringIncludes(output, "Usage:");
  assertStringIncludes(output, "--dry-run");
  assertStringIncludes(output, "--backlog");
});
