import { assertEquals, assertThrows } from "@std/assert";
import { wpId } from "../../../../../core/domain/types.ts";
import type { KeepProblemTryAdvice } from "../../../../../core/domain/types.ts";
import { workPackageUseCase } from "../../../../../core/domain/workpackage-usecase.ts";

/**
 * @description KPT記録時に全フィールド（keep/problem/try/advise）を含むPlanが生成されること
 * @verify Planのstep数=2、scopeStep存在、operationが"recordKpt"
 */
Deno.test("record_kpt - should generate plan with all fields", () => {
  const identifier = wpId("Test WP", "node-id", "42");
  const kpt: KeepProblemTryAdvice = {
    keep: "Good communication",
    problem: "Scope was unclear",
    try: "Define scope earlier",
    advise: "Consider using checklists",
  };
  const plan = workPackageUseCase.recordKpt(identifier, kpt);
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[0].entity, "Scope");
  assertEquals(plan.summary, "Record KPT for WP: Test WP");
  assertEquals(plan.steps[1].operation, "recordKpt");
  assertEquals(plan.steps[1].entity, "WorkPackage");
});

/**
 * @description identifier.idが未定義の場合にエラーが発生すること
 * @verify assertThrowsでINVALID_INPUTエラーがスローされること
 */
Deno.test("record_kpt - should throw for missing identifier id", () => {
  const identifier = wpId("Test WP");
  const kpt: KeepProblemTryAdvice = {
    keep: "Good",
    problem: "Bad",
    try: "Fix",
    advise: "",
  };
  assertThrows(
    () => workPackageUseCase.recordKpt(identifier, kpt),
    Error,
    "INVALID_INPUT",
  );
});

/**
 * @description adviseが空文字でも正しくPlanが生成されること
 * @verify operationが"recordKpt"であること
 */
Deno.test("record_kpt - should handle empty advise", () => {
  const identifier = wpId("Test WP", "node-id", "42");
  const kpt: KeepProblemTryAdvice = {
    keep: "Keep",
    problem: "Problem",
    try: "Try",
    advise: "",
  };
  const plan = workPackageUseCase.recordKpt(identifier, kpt);
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[1].operation, "recordKpt");
});

/**
 * @description KPTデータがJSON形式でbodyに正しくシリアライズされること
 * @verify bodyをJSON.parseした結果が入力値と一致すること
 */
Deno.test("record_kpt - should include body in plan params", () => {
  const identifier = wpId("Test WP", "node-id", "42");
  const kpt: KeepProblemTryAdvice = {
    keep: "Keep item",
    problem: "Problem item",
    try: "Try item",
    advise: "Advise item",
  };
  const plan = workPackageUseCase.recordKpt(identifier, kpt);
  const body = plan.steps[1].params.body;
  assertEquals(typeof body, "string");
  const parsed = JSON.parse(body as string);
  assertEquals(parsed.keep, "Keep item");
  assertEquals(parsed.problem, "Problem item");
  assertEquals(parsed.try, "Try item");
  assertEquals(parsed.advise, "Advise item");
});
