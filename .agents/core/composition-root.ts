import type { Plan } from "./domain/types.ts";
import type { PlanGateway } from "./domain/plan-gateway.ts";
import { executePlan } from "./domain/plan-executor.ts";
import { PlanGatewayAdapter } from "./gateway/plan-gateway-adapter.ts";
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

export function getPlanGateway(): PlanGateway {
  return gateway;
}

export function executeRawPlan(plan: Plan): ReturnType<typeof executePlan> {
  return executePlan(plan, gateway);
}
