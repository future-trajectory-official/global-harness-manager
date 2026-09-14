import type { Plan } from "./domain/types.ts";
import type { PlanGateway } from "./domain/plan-gateway.ts";
import { executePlan } from "./domain/plan-executor.ts";
import { PlanGatewayAdapter } from "./gateway/plan-gateway-adapter.ts";
import { ProjectV2FieldRegistry } from "./gateway/project-field-registry.ts";
import { initSprintUseCase } from "./domain/sprint-usecase.ts";
import { initVisionUseCase } from "./domain/vision-usecase.ts";
import { initProductGoalUseCase } from "./domain/product-goal-usecase.ts";
import { initEpicUseCase } from "./domain/epic-usecase.ts";
import { initFeatureUseCase } from "./domain/feature-usecase.ts";
import { initProductBacklogItemUseCase } from "./domain/product-backlog-item-usecase.ts";
import { initWorkPackageUseCase } from "./domain/workpackage-usecase.ts";
import { initReviewUseCase } from "./domain/review-usecase.ts";
import { initRetrospectiveUseCase } from "./domain/retrospective-usecase.ts";

const gateway = new PlanGatewayAdapter();
initSprintUseCase(gateway);
initVisionUseCase(gateway);
initProductGoalUseCase(gateway);
initEpicUseCase(gateway);
initFeatureUseCase(gateway);
initProductBacklogItemUseCase(gateway);
initWorkPackageUseCase(gateway);
initReviewUseCase(gateway);
initRetrospectiveUseCase(gateway);

// Project V2 ボード番号を .harnessrc から読み込んで設定する
try {
  const harnessrcPath = `${import.meta.dirname ?? "."}/../../.github/schemas/.harnessrc`;
  const harnessrcRaw = Deno.readTextFileSync(harnessrcPath);
  const harnessrc = JSON.parse(harnessrcRaw);
  const registry = ProjectV2FieldRegistry.getInstance();
  registry.load({ projects: harnessrc?.projects ?? {}, fields: harnessrc?.fields ?? {} });
  const productBacklog = registry.board("productBacklog");
  const sprintBoard = registry.board("sprintBoard");
  const retrospectiveBoard = registry.board("retrospectiveBoard");
  if (
    productBacklog !== undefined || sprintBoard !== undefined || retrospectiveBoard !== undefined
  ) {
    gateway.setProjectBoardNumbers(productBacklog, sprintBoard, retrospectiveBoard);
  }
} catch {
  // .harnessrc not found or invalid; board numbers remain unconfigured
}

export function getPlanGateway(): PlanGateway {
  return gateway;
}

export function executeRawPlan(plan: Plan): ReturnType<typeof executePlan> {
  return executePlan(plan, gateway);
}
