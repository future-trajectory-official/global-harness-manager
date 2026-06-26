import { assertEquals, assertInstanceOf } from "@std/assert";
import { Size } from "./types.ts";
import type {
  AcceptanceCriteria,
  BoardOutput,
  ChangeReason,
  ConfigContent,
  EffortRecord,
  EntityScope,
  EpicIdentifier,
  EpicSearchCondition,
  ExecutionResult,
  Identifier,
  KeepProblemTryAdvice,
  List,
  OverallReviewResult,
  Plan,
  ProcessAnalysis,
  ProductBacklogItemIdentifier,
  ProductBacklogItemSearchCondition,
  RetrospectiveIdentifier,
  ReviewIdentifier,
  SearchCondition,
  SessionMetrics,
  SizeVariance,
  SprintIdentifier,
  SprintMetrics,
  Step,
  StepResult,
  Title,
  VisionData,
  VisionStatement,
  WorkPackageIdentifier,
  WorkPackageSearchCondition,
} from "./types.ts";

Deno.test("types - Title should have readonly value property", () => {
  const title: Title = { value: "Sprint 15" };
  assertEquals(title.value, "Sprint 15");
});

Deno.test("types - EntityScope should have owner and repository", () => {
  const scope: EntityScope = { owner: "my-org", repository: "my-repo" };
  assertEquals(scope.owner, "my-org");
  assertEquals(scope.repository, "my-repo");
});

Deno.test("types - Identifier should have scope, title, and describe method", () => {
  const identifier: Identifier = {
    scope: { owner: "org", repository: "repo" },
    title: { value: "Test Epic" },
    describe: () => ({ summary: "test", steps: [] }),
  };
  assertEquals(identifier.title.value, "Test Epic");
  const plan = identifier.describe();
  assertEquals(plan.summary, "test");
});

Deno.test("types - SearchCondition should have describe method", () => {
  const condition: SearchCondition = {
    describe: () => ({ summary: "search", steps: [] }),
  };
  const plan = condition.describe();
  assertEquals(plan.summary, "search");
});

Deno.test("types - List should have readonly items and totalCount", () => {
  const list: List<number> = { items: [1, 2, 3], totalCount: 3 };
  assertEquals(list.items.length, 3);
  assertEquals(list.totalCount, 3);
});

Deno.test("types - Plan should have summary and steps", () => {
  const plan: Plan = {
    summary: "Create item",
    steps: [
      { operation: "createItem", params: { title: "test", type: "PBI" } },
    ],
  };
  assertEquals(plan.summary, "Create item");
  assertEquals(plan.steps.length, 1);
  assertEquals(plan.steps[0].operation, "createItem");
});

Deno.test("types - Step should support all operation types", () => {
  const operations = [
    "createItem",
    "updateItem",
    "closeItem",
    "findItem",
    "searchItems",
    "createTimebox",
    "updateTimebox",
    "closeTimebox",
    "readConfig",
    "writeConfig",
  ] as const;
  for (const op of operations) {
    const step: Step = { operation: op, params: {} };
    assertEquals(step.operation, op);
  }
});

Deno.test("types - ExecutionResult should have stepResults", () => {
  const result: ExecutionResult = {
    stepResults: [
      { operation: "createItem", success: true, itemId: "123" },
    ],
  };
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
});

Deno.test("types - StepResult should support error case", () => {
  const result: StepResult = {
    operation: "createItem",
    success: false,
    error: "Network error",
  };
  assertEquals(result.success, false);
  assertEquals(result.error, "Network error");
});

Deno.test("types - ChangeReason should have description", () => {
  const reason: ChangeReason = { description: "Scope changed" };
  assertEquals(reason.description, "Scope changed");
});

Deno.test("types - VisionStatement should have all fields", () => {
  const stmt: VisionStatement = {
    targetAudience: "developers",
    value: "productivity",
    differentiator: "AI collaboration",
  };
  assertEquals(stmt.targetAudience, "developers");
  assertEquals(stmt.value, "productivity");
  assertEquals(stmt.differentiator, "AI collaboration");
});

Deno.test("types - VisionData should contain statement and outcomes", () => {
  const data: VisionData = {
    statement: { targetAudience: "dev", value: "speed", differentiator: "AI" },
    outcomes: { items: [{ description: "Faster delivery" }] },
  };
  assertEquals(data.outcomes.items.length, 1);
});

Deno.test("types - SprintIdentifier should extend Identifier", () => {
  const id: SprintIdentifier = {
    scope: { owner: "org", repository: "repo" },
    title: { value: "Sprint 15" },
    describe: () => ({ summary: "get sprint", steps: [] }),
  };
  assertEquals(id.title.value, "Sprint 15");
});

Deno.test("types - EpicIdentifier should be an Identifier", () => {
  const id: EpicIdentifier = {
    scope: { owner: "org", repository: "repo" },
    title: { value: "Auth" },
    describe: () => ({ summary: "get epic", steps: [] }),
  };
  assertInstanceOf(id, Object);
});

Deno.test("types - EpicSearchCondition should extend SearchCondition", () => {
  const cond: EpicSearchCondition = {
    keyword: "auth",
    describe: () => ({ summary: "search epics", steps: [] }),
  };
  assertEquals(cond.keyword, "auth");
});

Deno.test("types - AcceptanceCriteria should have all fields", () => {
  const ac: AcceptanceCriteria = {
    number: "AC1",
    description: "Do something",
    judgment: "unchecked",
  };
  assertEquals(ac.number, "AC1");
  assertEquals(ac.judgment, "unchecked");
});

Deno.test("types - AcceptanceCriteria should support all judgment values", () => {
  const judgments: AcceptanceCriteria["judgment"][] = [
    "unchecked",
    "pass",
    "conditional",
    "fail",
    "removed",
  ];
  for (const judgment of judgments) {
    const ac: AcceptanceCriteria = {
      number: "AC1",
      description: "test",
      judgment,
    };
    assertEquals(ac.judgment, judgment);
  }
});

Deno.test("types - OverallReviewResult should support all judgment values", () => {
  const pass: OverallReviewResult = { judgment: "pass", reason: "All good" };
  assertEquals(pass.judgment, "pass");
  const fail: OverallReviewResult = { judgment: "fail", reason: "Issues" };
  assertEquals(fail.judgment, "fail");
  const conditional: OverallReviewResult = {
    judgment: "conditional",
    reason: "Minor",
  };
  assertEquals(conditional.judgment, "conditional");
});

Deno.test("types - SessionMetrics should have numeric fields 1-5", () => {
  const metrics: SessionMetrics = {
    intentAlignmentRate: 4,
    constraintAdherenceScore: 5,
    contextExtractionQuality: 3,
    workSizeStability: 4,
    comment: "Good session",
  };
  assertEquals(metrics.intentAlignmentRate, 4);
  assertEquals(metrics.comment, "Good session");
});

Deno.test("types - KeepProblemTryAdvice should have all fields", () => {
  const kpta: KeepProblemTryAdvice = {
    keep: "Good communication",
    problem: "Too slow",
    try: "Speed up",
    advise: "Focus on priority",
  };
  assertEquals(kpta.keep, "Good communication");
  assertEquals(kpta.problem, "Too slow");
});

Deno.test("types - SprintMetrics should extend Metrics", () => {
  const sm: SprintMetrics = {
    goalAchievementRate: 90,
    estimationAccuracy: 80,
    qualityIntegrity: 85,
    collaborationDiscipline: 95,
    velocity: 10,
  };
  assertEquals(sm.velocity, 10);
});

Deno.test("types - EffortRecord should have numeric fields", () => {
  const er: EffortRecord = {
    initialEstimate: 1,
    plannedEstimate: 2,
    actual: 3,
  };
  assertEquals(er.initialEstimate, 1);
  assertEquals(er.plannedEstimate, 2);
  assertEquals(er.actual, 3);
});

Deno.test("types - SizeVariance should accept optional fields", () => {
  const sv: SizeVariance = {
    estimate: Size.M,
    actual: Size.S,
    varianceReason: "Overestimated",
  };
  assertEquals(sv.varianceReason, "Overestimated");
  assertEquals(sv.estimate?.toString(), "M");
  assertEquals(sv.actual?.toWeight(), 2);
});

Deno.test("types - ProcessAnalysis should have all review fields", () => {
  const pa: ProcessAnalysis = {
    planningReview: "Good plan",
    executionReview: "Smooth execution",
    improvementSuggestions: "Add more tests",
  };
  assertEquals(pa.planningReview, "Good plan");
});

Deno.test("types - BoardOutput should have id and name", () => {
  const board: BoardOutput = { id: 10, name: "Product Backlog" };
  assertEquals(board.id, 10);
  assertEquals(board.name, "Product Backlog");
});

Deno.test("types - ConfigContent should have source and content", () => {
  const config: ConfigContent = { source: ".harnessrc", content: "{}" };
  assertEquals(config.source, ".harnessrc");
  assertEquals(config.content, "{}");
});

Deno.test("types - ProductBacklogItemIdentifier should be an Identifier", () => {
  const id: ProductBacklogItemIdentifier = {
    scope: { owner: "org", repository: "repo" },
    title: { value: "PBI-1" },
    describe: () => ({ summary: "get pbi", steps: [] }),
  };
  assertEquals(id.title.value, "PBI-1");
});

Deno.test("types - WorkPackageIdentifier should be an Identifier", () => {
  const id: WorkPackageIdentifier = {
    scope: { owner: "org", repository: "repo" },
    title: { value: "WP-1" },
    describe: () => ({ summary: "get wp", steps: [] }),
  };
  assertEquals(id.title.value, "WP-1");
});

Deno.test("types - ReviewIdentifier should be an Identifier", () => {
  const id: ReviewIdentifier = {
    scope: { owner: "org", repository: "repo" },
    title: { value: "Sprint Review 15" },
    describe: () => ({ summary: "get review", steps: [] }),
  };
  assertEquals(id.title.value, "Sprint Review 15");
});

Deno.test("types - RetrospectiveIdentifier should be an Identifier", () => {
  const id: RetrospectiveIdentifier = {
    scope: { owner: "org", repository: "repo" },
    title: { value: "Retro 15" },
    describe: () => ({ summary: "get retro", steps: [] }),
  };
  assertEquals(id.title.value, "Retro 15");
});

Deno.test("types - ProductBacklogItemSearchCondition should have optional fields", () => {
  const cond: ProductBacklogItemSearchCondition = {
    keyword: "auth",
    sprintNumber: 15,
    status: "Done",
    describe: () => ({ summary: "search pbi", steps: [] }),
  };
  assertEquals(cond.sprintNumber, 15);
  assertEquals(cond.status, "Done");
});

Deno.test("types - WorkPackageSearchCondition should have parentPbi", () => {
  const parentPbi: ProductBacklogItemIdentifier = {
    scope: { owner: "org", repository: "repo" },
    title: { value: "PBI-1" },
    describe: () => ({ summary: "get", steps: [] }),
  };
  const cond: WorkPackageSearchCondition = {
    keyword: "test",
    parentPbi,
    describe: () => ({ summary: "search wp", steps: [] }),
  };
  assertEquals(cond.parentPbi?.title.value, "PBI-1");
});
