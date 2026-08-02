import { assertEquals, assertThrows } from "@std/assert";
import { pbiId, wpId } from "../../../../../core/domain/types.ts";
import type {
  AcceptanceCriterias,
  WorkPackageStatement,
} from "../../../../../core/domain/types.ts";
import { workPackageUseCase } from "../../../../../core/domain/workpackage-usecase.ts";

function makeStatement(
  acItems: Array<{ number: string; description: string }>,
): WorkPackageStatement {
  const acceptanceCriteria: AcceptanceCriterias = {
    items: acItems.map((ac) => ({
      number: ac.number,
      description: ac.description,
      judgment: "unchecked" as const,
    })),
  };
  return { acceptanceCriteria };
}

Deno.test("define_wp - should generate define plan", () => {
  const identifier = wpId("My WP");
  const statement = makeStatement([{ number: "1", description: "Do something" }]);
  const parentPbi = pbiId("Parent PBI", "node-id", "42");
  const plan = workPackageUseCase.define(identifier, statement, parentPbi);
  assertEquals(plan.summary, "Define WP: My WP");
  assertEquals(plan.steps[1].entity, "WorkPackage");
  assertEquals(plan.steps[1].operation, "define");
});

Deno.test("define_wp - should include parentPbi in params", () => {
  const identifier = wpId("My WP");
  const statement = makeStatement([{ number: "1", description: "Do something" }]);
  const parentPbi = pbiId("Parent PBI", "node-id-pbi", "42");
  const plan = workPackageUseCase.define(identifier, statement, parentPbi);
  assertEquals(plan.steps[1].params.parentPbi, "42");
});

Deno.test("define_wp - should throw for empty title", () => {
  const identifier = wpId("");
  const statement = makeStatement([{ number: "1", description: "Do something" }]);
  const parentPbi = pbiId("Parent PBI", "node-id", "42");
  assertThrows(
    () => workPackageUseCase.define(identifier, statement, parentPbi),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("define_wp - should throw for empty acItems", () => {
  const identifier = wpId("My WP");
  const statement = makeStatement([]);
  const parentPbi = pbiId("Parent PBI", "node-id", "42");
  assertThrows(
    () => workPackageUseCase.define(identifier, statement, parentPbi),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("define_wp - should throw for parentPbi without id", () => {
  const identifier = wpId("My WP");
  const statement = makeStatement([{ number: "1", description: "Do something" }]);
  const parentPbi = pbiId("Parent PBI");
  assertThrows(
    () => workPackageUseCase.define(identifier, statement, parentPbi),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("define_wp - should handle multiple acItems", () => {
  const identifier = wpId("My WP");
  const statement = makeStatement([
    { number: "1", description: "First AC" },
    { number: "2", description: "Second AC" },
  ]);
  const parentPbi = pbiId("Parent PBI", "node-id", "42");
  const plan = workPackageUseCase.define(identifier, statement, parentPbi);
  assertEquals(
    plan.steps[1].params.body,
    "## Acceptance Criteria\n\n- [ ] AC1: First AC\n- [ ] AC2: Second AC",
  );
});
