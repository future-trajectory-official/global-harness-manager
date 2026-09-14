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
    summary: {
      intentAlignmentScore: 5,
      constraintAdherenceScore: 4,
      contextExtractionScore: 3,
      workSizeStabilityScore: 5,
    },
    intentAlignment: "Aligned well",
    constraintAdherence: "Followed constraints",
    contextExtraction: "Captured context",
    workSizeStability: "Stable size",
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
    summary: {
      intentAlignmentScore: 5,
      constraintAdherenceScore: 5,
      contextExtractionScore: 5,
      workSizeStabilityScore: 5,
    },
    intentAlignment: "",
    constraintAdherence: "",
    contextExtraction: "",
    workSizeStability: "",
  };
  assertThrows(
    () => workPackageUseCase.recordSessionMetrics(identifier, metrics),
    Error,
    "INVALID_INPUT",
  );
});

/**
 * @description 全スコアがMarkdown形式でbodyに正しくフォーマットされること
 * @verify body文字列に全スコア値とナラティブが含まれていること
 */
Deno.test("record_metrics - should include body with all scores", () => {
  const identifier = wpId("Test WP", "node-id", "42");
  const metrics: SessionMetrics = {
    summary: {
      intentAlignmentScore: 3,
      constraintAdherenceScore: 4,
      contextExtractionScore: 2,
      workSizeStabilityScore: 5,
    },
    intentAlignment: "Aligned moderately",
    constraintAdherence: "Followed constraints",
    contextExtraction: "Needs improvement on context extraction",
    workSizeStability: "Stable size",
  };
  const plan = workPackageUseCase.recordSessionMetrics(identifier, metrics);
  const body = plan.steps[1].params.body;
  assertEquals(typeof body, "string");
  const bodyStr = body as string;
  assertEquals(bodyStr.includes("**Intent Alignment Score**: 3"), true);
  assertEquals(bodyStr.includes("**Constraint Adherence Score**: 4"), true);
  assertEquals(bodyStr.includes("**Context Extraction Score**: 2"), true);
  assertEquals(bodyStr.includes("**Work Size Stability Score**: 5"), true);
  assertEquals(bodyStr.includes("Needs improvement"), true);
});

/**
 * @description ナラティブが空文字でも正しくPlanが生成されること
 * @verify operationが"recordSessionMetrics"であること
 */
Deno.test("record_metrics - should handle empty narratives", () => {
  const identifier = wpId("Test WP", "node-id", "42");
  const metrics: SessionMetrics = {
    summary: {
      intentAlignmentScore: 5,
      constraintAdherenceScore: 5,
      contextExtractionScore: 5,
      workSizeStabilityScore: 5,
    },
    intentAlignment: "",
    constraintAdherence: "",
    contextExtraction: "",
    workSizeStability: "",
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
  intentAlignmentScore: 5,
  constraintAdherenceScore: 4,
  contextExtractionScore: 3,
  workSizeStabilityScore: 5,
  intentAlignment: "dry-run 検証",
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
