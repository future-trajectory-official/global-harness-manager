import { assertEquals, assertInstanceOf } from "@std/assert";
import { featureId, pbiId, Size, sprintId, sprintRef, UNKNOWN_SCOPE, wpId } from "./types.ts";
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
    summary: "Create vision",
    steps: [
      { entity: "Vision", operation: "create", params: { title: "test" } },
    ],
  };
  assertEquals(plan.summary, "Create vision");
  assertEquals(plan.steps.length, 1);
  assertEquals(plan.steps[0].entity, "Vision");
  assertEquals(plan.steps[0].operation, "create");
});

Deno.test("types - Step should support all entity types with valid operations", () => {
  const steps: Step[] = [
    { entity: "Vision", operation: "create", params: {} },
    { entity: "Vision", operation: "update", params: {} },
    { entity: "Vision", operation: "view", params: {} },
    { entity: "Vision", operation: "search", params: {} },
    { entity: "Vision", operation: "comment", params: {} },
    { entity: "ProductGoal", operation: "create", params: {} },
    { entity: "ProductGoal", operation: "update", params: {} },
    { entity: "ProductGoal", operation: "view", params: {} },
    { entity: "ProductGoal", operation: "search", params: {} },
    { entity: "Feature", operation: "create", params: {} },
    { entity: "Feature", operation: "update", params: {} },
    { entity: "Feature", operation: "view", params: {} },
    { entity: "Feature", operation: "search", params: {} },
    { entity: "Epic", operation: "create", params: {} },
    { entity: "Epic", operation: "update", params: {} },
    { entity: "Epic", operation: "view", params: {} },
    { entity: "Epic", operation: "search", params: {} },
    { entity: "ProductBacklogItem", operation: "propose", params: {} },
    { entity: "ProductBacklogItem", operation: "commit", params: {} },
    { entity: "ProductBacklogItem", operation: "start", params: {} },
    { entity: "ProductBacklogItem", operation: "complete", params: {} },
    { entity: "ProductBacklogItem", operation: "archive", params: {} },
    { entity: "ProductBacklogItem", operation: "update", params: {} },
    { entity: "ProductBacklogItem", operation: "view", params: {} },
    { entity: "ProductBacklogItem", operation: "search", params: {} },
    { entity: "WorkPackage", operation: "define", params: {} },
    { entity: "WorkPackage", operation: "commit", params: {} },
    { entity: "WorkPackage", operation: "view", params: {} },
    { entity: "WorkPackage", operation: "search", params: {} },
    { entity: "Sprint", operation: "create", params: {} },
    { entity: "Sprint", operation: "endSprint", params: {} },
    { entity: "Sprint", operation: "setGoal", params: {} },
    { entity: "Sprint", operation: "view", params: {} },
    { entity: "Review", operation: "plan", params: {} },
    { entity: "Review", operation: "update", params: {} },
    { entity: "Review", operation: "report", params: {} },
    { entity: "Review", operation: "view", params: {} },
    { entity: "Review", operation: "search", params: {} },
    { entity: "Retrospective", operation: "plan", params: {} },
    { entity: "Retrospective", operation: "execute", params: {} },
    { entity: "Retrospective", operation: "view", params: {} },
    { entity: "Retrospective", operation: "search", params: {} },
  ];
  assertEquals(steps.length, 42);
  for (const step of steps) {
    assertEquals(typeof step.entity, "string");
    assertEquals(typeof step.operation, "string");
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
    outcomes: { items: [{ title: "Speed", description: "Faster delivery" }] },
    state: "open",
  };
  assertEquals(data.outcomes.items.length, 1);
});

Deno.test("types - sprintId should generate Sprint N format", () => {
  const id = sprintId({ owner: "org", repository: "repo" }, 15);
  assertEquals(id.title.value, "Sprint 15");
  assertEquals(id.id, undefined);
});

Deno.test("types - sprintId should accept id for persisted entities", () => {
  const id = sprintId({ owner: "org", repository: "repo" }, 15, "MI_kwA...");
  assertEquals(id.title.value, "Sprint 15");
  assertEquals(id.id, "MI_kwA...");
});

Deno.test("types - pbiId should generate scope-free identifier with UNKNOWN_SCOPE", () => {
  const id = pbiId("My PBI");
  assertEquals(id.title.value, "My PBI");
  assertEquals(id.scope, UNKNOWN_SCOPE);
  assertEquals(id.id, undefined);
  assertEquals(id.code, undefined);
});

Deno.test("types - pbiId should accept id and code", () => {
  const id = pbiId("My PBI", "node-id-123", "42");
  assertEquals(id.id, "node-id-123");
  assertEquals(id.code, "42");
});

Deno.test("types - wpId should generate scope-free identifier with UNKNOWN_SCOPE", () => {
  const id = wpId("My WP");
  assertEquals(id.title.value, "My WP");
  assertEquals(id.scope, UNKNOWN_SCOPE);
  assertEquals(id.id, undefined);
});

Deno.test("types - wpId should accept id and code", () => {
  const id = wpId("My WP", "node-id-456", "7");
  assertEquals(id.id, "node-id-456");
  assertEquals(id.code, "7");
});

Deno.test("types - sprintRef should generate scope-free Sprint N format", () => {
  const id = sprintRef(18);
  assertEquals(id.title.value, "Sprint 18");
  assertEquals(id.scope, UNKNOWN_SCOPE);
});

Deno.test("types - sprintRef should accept id and code", () => {
  const id = sprintRef(19, "MI_kwA...", "19");
  assertEquals(id.title.value, "Sprint 19");
  assertEquals(id.id, "MI_kwA...");
  assertEquals(id.code, "19");
});

Deno.test("types - featureId should generate scope-free identifier with UNKNOWN_SCOPE", () => {
  const id = featureId("My Feature");
  assertEquals(id.title.value, "My Feature");
  assertEquals(id.scope, UNKNOWN_SCOPE);
});

Deno.test("types - featureId should accept id and code", () => {
  const id = featureId("My Feature", "node-id-789", "99");
  assertEquals(id.id, "node-id-789");
  assertEquals(id.code, "99");
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
