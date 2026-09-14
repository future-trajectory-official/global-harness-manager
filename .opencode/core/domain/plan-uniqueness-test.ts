import { assertEquals } from "@std/assert";
import { identify } from "./types.ts";
import type {
  EntityScope,
  EpicStatement,
  FeatureStatement,
  GoalStatement,
  Outcomes,
  Step,
  VisionStatement,
} from "./types.ts";
import { visionUseCase } from "./vision-usecase.ts";
import { productGoalUseCase } from "./product-goal-usecase.ts";
import { reviewUseCase } from "./review-usecase.ts";
import { sprintUseCase } from "./sprint-usecase.ts";
import { epicUseCase } from "./epic-usecase.ts";
import { featureUseCase } from "./feature-usecase.ts";
import { productBacklogItemUseCase } from "./product-backlog-item-usecase.ts";
import { workPackageUseCase } from "./workpackage-usecase.ts";
import { retrospectiveUseCase } from "./retrospective-usecase.ts";

function makeScope(): EntityScope {
  return { owner: "test-org", repository: "test-repo" };
}

interface PlanEntry {
  usecase: string;
  method: string;
  plan: { readonly steps: readonly Step[] };
}

function collectPlans(): PlanEntry[] {
  const scope = makeScope();
  const plans: PlanEntry[] = [];

  // vision
  plans.push({
    usecase: "vision",
    method: "find",
    plan: visionUseCase.find(identify(scope, "Vision of test-repo")),
  });
  plans.push({
    usecase: "vision",
    method: "find(id)",
    plan: visionUseCase.find(identify(scope, "Vision of test-repo", "node-id", "42")),
  });
  const visionStmt: VisionStatement = {
    targetAudience: "test",
    value: "test",
    differentiator: "test",
  };
  const visionOutcomes: Outcomes = { items: [{ title: "outcome1", description: "desc" }] };
  plans.push({
    usecase: "vision",
    method: "establish",
    plan: visionUseCase.establish(
      identify(scope, "Vision of test-repo"),
      visionStmt,
      visionOutcomes,
    ),
  });

  // productGoal
  plans.push({
    usecase: "productGoal",
    method: "find",
    plan: productGoalUseCase.find(identify(scope, "Product Goal of test-repo", "pending", "42")),
  });
  const goalStmt: GoalStatement = { description: "test goal" };
  plans.push({
    usecase: "productGoal",
    method: "set",
    plan: productGoalUseCase.set(identify(scope, "Product Goal of test-repo"), goalStmt),
  });

  // review
  plans.push({
    usecase: "review",
    method: "search",
    plan: reviewUseCase.search({ describe: () => ({ summary: "Review search", steps: [] }) }),
  });
  plans.push({
    usecase: "review",
    method: "find",
    plan: reviewUseCase.find(identify(scope, "Sprint 1 Review", "pending", "42")),
  });
  plans.push({
    usecase: "review",
    method: "archive",
    plan: reviewUseCase.archive(identify(scope, "Sprint 1 Review", "node-id", "42")),
  });

  // sprint
  plans.push({
    usecase: "sprint",
    method: "find",
    plan: sprintUseCase.find(identify(scope, "Sprint 1", "milestone-id", "42")),
  });
  plans.push({
    usecase: "sprint",
    method: "start",
    plan: sprintUseCase.start(identify(scope, "Sprint 1")),
  });
  plans.push({
    usecase: "sprint",
    method: "end",
    plan: sprintUseCase.end(identify(scope, "Sprint 1", "milestone-id", "42")),
  });
  plans.push({
    usecase: "sprint",
    method: "setGoal",
    plan: sprintUseCase.setGoal(identify(scope, "Sprint 1", "milestone-id", "42"), goalStmt),
  });

  // epic
  plans.push({
    usecase: "epic",
    method: "find",
    plan: epicUseCase.find(identify(scope, "Epic 1", "pending", "42")),
  });
  const epicStmt: EpicStatement = { description: "test epic" };
  plans.push({
    usecase: "epic",
    method: "define",
    plan: epicUseCase.define(identify(scope, "Epic 1"), epicStmt),
  });

  // feature
  plans.push({
    usecase: "feature",
    method: "find",
    plan: featureUseCase.find(identify(scope, "Feature 1", "pending", "42")),
  });
  const featureStmt: FeatureStatement = { description: "test feature" };
  plans.push({
    usecase: "feature",
    method: "define",
    plan: featureUseCase.define(identify(scope, "Feature 1"), featureStmt),
  });

  // pbi
  plans.push({
    usecase: "pbi",
    method: "find",
    plan: productBacklogItemUseCase.find(identify(scope, "PBI 1", "pending", "42")),
  });

  // workpackage
  plans.push({
    usecase: "workPackage",
    method: "find",
    plan: workPackageUseCase.find(identify(scope, "WP 1", "pending", "42")),
  });

  // retrospective
  plans.push({
    usecase: "retrospective",
    method: "find",
    plan: retrospectiveUseCase.find(identify(scope, "Sprint 18 Retrospective", "pending", "42")),
  });

  return plans;
}

Deno.test("plan-uniqueness: 全UseCaseの全Planに (entity, operation) の重複がない", () => {
  const plans = collectPlans();
  for (const entry of plans) {
    const seen = new Set<string>();
    for (const step of entry.plan.steps) {
      const key = `${step.entity}:${step.operation}`;
      assertEquals(
        seen.has(key),
        false,
        `Duplicate (entity, operation) '${key}' in ${entry.usecase}.${entry.method}`,
      );
      seen.add(key);
    }
  }
});

Deno.test("plan-uniqueness: getStep が正しい StepResult を返す", async () => {
  const { PlanGatewayAdapter } = await import("../gateway/plan-gateway-adapter.ts");

  const gateway = new PlanGatewayAdapter(() =>
    Promise.resolve({
      code: 0,
      stdout: JSON.stringify({ number: 1, title: "test" }),
      stderr: "",
    })
  );

  const plan = visionUseCase.find(identify(makeScope(), "Vision of test-repo"));
  const result = await gateway.execute(plan);

  const searchStep = result.getStep("Vision", "search");
  assertEquals(searchStep?.success, true);
  assertEquals(searchStep?.output, { number: 1, title: "test" });

  const nonExistentStep = result.getStep("Vision", "nonexistent");
  assertEquals(nonExistentStep, undefined);
});

Deno.test("plan-uniqueness: スキルスクリプトの実行フローと互換性がある", async () => {
  const { PlanGatewayAdapter } = await import("../gateway/plan-gateway-adapter.ts");
  const scope = makeScope();
  const cmdQueue: Array<{ cmd: string; args: string[] }> = [];
  const gateway = new PlanGatewayAdapter((cmd, args) => {
    cmdQueue.push({ cmd, args });
    const argStr = args.join(" ");
    if (argStr === "remote get-url origin") {
      return Promise.resolve({
        code: 0,
        stdout: "git@github.com:test-org/test-repo.git",
        stderr: "",
      });
    }
    if (argStr.startsWith("auth")) {
      return Promise.resolve({ code: 0, stdout: "Logged in to github.com", stderr: "" });
    }
    if (argStr === "repo view --json owner,name") {
      return Promise.resolve({
        code: 0,
        stdout: JSON.stringify({ owner: { login: "test-org" }, name: "test-repo" }),
        stderr: "",
      });
    }
    if (argStr.startsWith("issue list")) {
      return Promise.resolve({
        code: 0,
        stdout: JSON.stringify([{ number: 1, title: "Vision of test-repo" }]),
        stderr: "",
      });
    }
    if (argStr.startsWith("issue view")) {
      return Promise.resolve({
        code: 0,
        stdout: JSON.stringify({
          number: 1,
          title: "Vision of test-repo",
          body: "body",
          comments: [],
        }),
        stderr: "",
      });
    }
    return Promise.resolve({ code: 0, stdout: "{}", stderr: "" });
  });

  // assess_alignment.ts 相当: Vision検索 → 結果取得
  const searchPlan = visionUseCase.find(identify(scope, "Vision of test-repo"));
  const searchResult = await gateway.execute(searchPlan);
  const searchOutput = searchResult.getStep("Vision", "search")?.output as
    | Array<{ number: number }>
    | undefined;
  assertEquals(searchOutput?.[0]?.number, 1);

  // 後続処理: Vision詳細取得
  const viewResult = await gateway.execute(
    visionUseCase.find(identify(scope, "Vision of test-repo", "node-id", "1")),
  );
  const viewOutput = viewResult.getStep("Vision", "view")?.output as
    | Record<string, unknown>
    | undefined;
  assertEquals(viewOutput?.number, 1);
  assertEquals(viewOutput?.title, "Vision of test-repo");
});
