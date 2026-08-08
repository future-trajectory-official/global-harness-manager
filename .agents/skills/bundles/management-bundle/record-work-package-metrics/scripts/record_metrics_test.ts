import { assertEquals, assertStringIncludes, assertThrows } from "@std/assert";
import { join } from "@std/path";
import { getSkillScriptPath, PATHS } from "../../../../../../test/test_helper.ts";
import { wpId } from "../../../../../core/domain/types.ts";
import type { SessionMetrics } from "../../../../../core/domain/types.ts";
import { workPackageUseCase } from "../../../../../core/domain/workpackage-usecase.ts";

/**
 * @description セッションメトリクス記録時に全フィールドを含むPlanが生成されること
 * @verify Planのstep数=2、scopeStep存在、operationが"recordSessionMetrics"
 */
Deno.test("record_metrics - should generate plan with all fields", () => {
  const identifier = wpId("Test WP", "node-id", "42");
  const metrics: SessionMetrics = {
    intentAlignmentRate: 5,
    constraintAdherenceScore: 4,
    contextExtractionQuality: 3,
    workSizeStability: 5,
    comment: "Good session",
  };
  const plan = workPackageUseCase.recordSessionMetrics(identifier, metrics);
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[0].entity, "Scope");
  assertEquals(plan.summary, "Record session metrics for WP: Test WP");
  assertEquals(plan.steps[1].operation, "recordSessionMetrics");
  assertEquals(plan.steps[1].entity, "WorkPackage");
});

/**
 * @description identifier.idが未定義の場合にエラーが発生すること
 * @verify assertThrowsでINVALID_INPUTエラーがスローされること
 */
Deno.test("record_metrics - should throw for missing identifier id", () => {
  const identifier = wpId("Test WP");
  const metrics: SessionMetrics = {
    intentAlignmentRate: 5,
    constraintAdherenceScore: 5,
    contextExtractionQuality: 5,
    workSizeStability: 5,
    comment: "",
  };
  assertThrows(
    () => workPackageUseCase.recordSessionMetrics(identifier, metrics),
    Error,
    "INVALID_INPUT",
  );
});

/**
 * @description 全スコアがMarkdown形式でbodyに正しくフォーマットされること
 * @verify body文字列に全スコア値とコメントが含まれていること
 */
Deno.test("record_metrics - should include body with all scores", () => {
  const identifier = wpId("Test WP", "node-id", "42");
  const metrics: SessionMetrics = {
    intentAlignmentRate: 3,
    constraintAdherenceScore: 4,
    contextExtractionQuality: 2,
    workSizeStability: 5,
    comment: "Needs improvement on context extraction",
  };
  const plan = workPackageUseCase.recordSessionMetrics(identifier, metrics);
  const body = plan.steps[1].params.body;
  assertEquals(typeof body, "string");
  const bodyStr = body as string;
  assertEquals(bodyStr.includes("**Intent Alignment Rate**: 3"), true);
  assertEquals(bodyStr.includes("**Constraint Adherence Score**: 4"), true);
  assertEquals(bodyStr.includes("**Context Extraction Quality**: 2"), true);
  assertEquals(bodyStr.includes("**Work Size Stability**: 5"), true);
  assertEquals(bodyStr.includes("Needs improvement"), true);
});

/**
 * @description commentが空文字でも正しくPlanが生成されること
 * @verify operationが"recordSessionMetrics"であること
 */
Deno.test("record_metrics - should handle empty comment", () => {
  const identifier = wpId("Test WP", "node-id", "42");
  const metrics: SessionMetrics = {
    intentAlignmentRate: 5,
    constraintAdherenceScore: 5,
    contextExtractionQuality: 5,
    workSizeStability: 5,
    comment: "",
  };
  const plan = workPackageUseCase.recordSessionMetrics(identifier, metrics);
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[1].operation, "recordSessionMetrics");
});

const scriptPath = getSkillScriptPath(
  PATHS.BUNDLES.MANAGEMENT,
  "record-work-package-metrics",
  "record_metrics.ts",
);

const validInput = JSON.stringify({
  identifier: { title: "WP サンプル", id: "42", code: "wp-42" },
  intentAlignmentRate: 5,
  constraintAdherenceScore: 4,
  contextExtractionQuality: 3,
  workSizeStability: 5,
  comment: "dry-run 検証",
});

/**
 * モック gh / git を PATH に配置し、record_metrics.ts をサブプロセス実行する。
 * gh が呼び出された場合は望まない行が callLog に残るため、dry-run では
 * 「gh が一切呼ばれず Plan の表示のみで終了すること」を検証できる。
 */
type MockScriptResult = { code: number; stdout: string; stderr: string; callLog: string };

async function withMockGh(
  fn: (result: MockScriptResult) => void | Promise<void>,
): Promise<MockScriptResult> {
  const tempDir = await Deno.makeTempDir();
  try {
    const mockBinDir = join(tempDir, "bin");
    const callLogPath = join(tempDir, "gh_call.log");
    await Deno.mkdir(mockBinDir, { recursive: true });
    const logEscape = callLogPath.replace(/'/g, "'\\''");
    const mockGhContent = `#!/bin/sh
echo "GH_ARGS: $*" >> '${logEscape}'
exit 1
`;
    const mockGitContent = `#!/bin/sh
echo "GIT_ARGS: $*" >> '${logEscape}'
exit 1
`;
    await Deno.writeTextFile(join(mockBinDir, "gh"), mockGhContent);
    await Deno.chmod(join(mockBinDir, "gh"), 0o755);
    await Deno.writeTextFile(join(mockBinDir, "git"), mockGitContent);
    await Deno.chmod(join(mockBinDir, "git"), 0o755);

    const command = new Deno.Command(Deno.execPath(), {
      args: ["run", "-A", scriptPath, "--dry-run"],
      stdin: "piped",
      stdout: "piped",
      stderr: "piped",
      env: {
        ...Deno.env.toObject(),
        PATH: `${mockBinDir}:${Deno.env.get("PATH")}`,
      },
    });
    const child = command.spawn();
    const writer = child.stdin.getWriter();
    await writer.write(new TextEncoder().encode(validInput));
    await writer.close();
    const { code, stdout, stderr } = await child.output();
    const callLog = await Deno.readTextFile(callLogPath).catch(() => "");
    const result = {
      code,
      stdout: new TextDecoder().decode(stdout),
      stderr: new TextDecoder().decode(stderr),
      callLog,
    };
    await fn(result);
    return result;
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
}

Deno.test("record_metrics - should not call gh in dry-run", async () => {
  await withMockGh((result) => {
    assertEquals(result.code, 0, `exit code should be 0. stderr: ${result.stderr}`);
    assertStringIncludes(result.stdout, "recordSessionMetrics");
    assertStringIncludes(result.stdout, "summary");
    assertEquals(result.callLog, "", "dry-run では gh / git を一切呼び出さないこと");
  });
});
