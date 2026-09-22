import type { Plan } from "./domain/types.ts";
import type { PlanGateway } from "./domain/plan-gateway.ts";
import { executePlan } from "./domain/plan-executor.ts";
import { PlanGatewayAdapter } from "./gateway/plan-gateway-adapter.ts";
import { ProjectV2FieldRegistry } from "./gateway/project-field-registry.ts";
import { loadHarnessRcConfig, resolveHarnessRcPath } from "./shared/account/harnessrc-resolver.ts";
import { type AccountContext, resolveAccountContext } from "./shared/account/account-context.ts";
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

// Project V2 ボード番号を .harnessrc から読み込んで設定する。
// グローバル配布（~/.harness）では本ファイルの相対パスで .harnessrc を解決できないため、
// 複数候補（環境変数 → cwd起点 → リポジトリルート）から探索して読み込む（plan.md 設計判断3）。
try {
  const harnessrc = loadHarnessRcConfig(resolveHarnessRcPath());
  if (harnessrc) {
    const registry = ProjectV2FieldRegistry.getInstance();
    registry.load({ projects: harnessrc.projects, fields: harnessrc.fields });
    const productBacklog = registry.board("productBacklog");
    const sprintBoard = registry.board("sprintBoard");
    const retrospectiveBoard = registry.board("retrospectiveBoard");
    if (
      productBacklog !== undefined || sprintBoard !== undefined ||
      retrospectiveBoard !== undefined
    ) {
      gateway.setProjectBoardNumbers(productBacklog, sprintBoard, retrospectiveBoard);
    }
  }
} catch {
  // .harnessrc not found or invalid; board numbers remain unconfigured
}

// 呼出元リポジトリのアカウントを特定し、アカウント別設定を選択する（WP-2 AC3）。
// 本WPの所掌は解決・検証・誘導と公開API（getAccountContext）までとし、
// 解決結果の適用（消費）は WP-3 以降の申送りとする。
// import 時点のサブプロセス起動を避けるため、初回アクセス時に解決する（遅延・メモ化）。
// dry-run 不変条件（gh/git を呼び出さない）を保つためである。
// メモ化により同一プロセス内の `gh auth switch` 変更は再解決されない点に注意。
let accountContext: AccountContext | null | undefined = undefined;

export function getPlanGateway(): PlanGateway {
  return gateway;
}

/**
 * 解決済みのアカウント別設定を返す。初回呼出時に解決し、以降は再利用する。
 * 解決失敗時は null を返し、動作継続する（ボード番号読込と同一方針）。
 *
 * @returns アカウント別設定、または null
 */
export function getAccountContext(): AccountContext | null {
  if (accountContext === undefined) {
    try {
      accountContext = resolveAccountContext();
      if (accountContext.guidance) {
        console.error(`[harness] ${accountContext.guidance}`);
      }
    } catch {
      // アカウント解決失敗時も動作継続する（fail-open）。無音にしないため最小ログを残す。
      console.error(
        "[harness] アカウント別設定の解決に失敗しました。未設定のまま動作を継続します。",
      );
      accountContext = null;
    }
  }
  return accountContext;
}

export function executeRawPlan(plan: Plan): ReturnType<typeof executePlan> {
  return executePlan(plan, gateway);
}
