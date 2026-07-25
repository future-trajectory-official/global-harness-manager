import { assertEquals, assertThrows } from "@std/assert";
import { sprintRef, wpId } from "../../../../../core/domain/types.ts";
import { workPackageUseCase } from "../../../../../core/domain/workpackage-usecase.ts";

const validWp = wpId("Implement login UI", "42", "42");
const sprint19 = sprintRef(19);

Deno.test("commit_wp - should generate commit plan", () => {
  const plan = workPackageUseCase.commit(validWp, sprint19);
  assertEquals(plan.summary, "Commit WP Implement login UI to Sprint 19");
  assertEquals(plan.steps[1].entity, "WorkPackage");
  assertEquals(plan.steps[1].operation, "commit");
});

Deno.test("commit_wp - should throw for empty title", () => {
  assertThrows(
    () => workPackageUseCase.commit(wpId(""), sprint19),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("commit_wp - should throw for undefined id", () => {
  assertThrows(
    () => workPackageUseCase.commit(wpId("Implement login UI", undefined, "42"), sprint19),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("commit_wp - should throw for undefined sprint number", () => {
  assertThrows(
    () => workPackageUseCase.commit(validWp, sprintRef(undefined as unknown as number)),
    Error,
    "INVALID_INPUT",
  );
});
