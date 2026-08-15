import type { EntityType, StepOperation } from "../domain/types.ts";
import type { OperationHandler, PlanGatewayAdapter } from "./plan-gateway-adapter.ts";

export class WorkPackageHandler {
  constructor(private readonly adapter: PlanGatewayAdapter) {}

  register(stepHandlers: Map<EntityType, Map<StepOperation, OperationHandler>>): void {
    const handlers = new Map<StepOperation, OperationHandler>();

    handlers.set("define", async (_op, params) => {
      const parentPbi = String(params.parentPbi ?? "");
      if (!parentPbi) {
        return { operation: "define", success: false, error: "parentPbi is required" };
      }
      const cr = await this.adapter.handleCreateItem({
        title: params.title,
        body: params.body,
        type: "WP",
      });
      if (!cr.success || !cr.itemId) return cr;
      const pr = await this.adapter.handleSetParent(cr.itemId, parentPbi);
      if (!pr.success) return pr;
      if (cr.nodeId && this.adapter.sprintBoardNumber) {
        try {
          await this.adapter.addItemToProject(cr.nodeId, this.adapter.sprintBoardNumber);
        } catch { /* ok */ }
      }
      return cr;
    });

    handlers.set("commit", async (_op, params) => {
      const itemId = String(params.itemId ?? "");
      if (!itemId) {
        return Promise.resolve({
          operation: "commit",
          success: false,
          error: "itemId is required",
        });
      }
      const sprint = String(params.sprint ?? "");
      if (sprint) {
        const mr = await this.adapter.handleSetMilestone(itemId, sprint);
        if (!mr.success) return mr;
      }
      if (this.adapter.sprintBoardNumber) {
        await this.adapter.setBoardStatus(
          itemId,
          this.adapter.sprintBoardNumber,
          String(params.stage ?? "todo"),
        );
      }
      return Promise.resolve({ operation: "commit", success: true, itemId });
    });

    handlers.set("start", async (_op, params) => {
      const itemId = String(params.itemId ?? "");
      if (!itemId) {
        return Promise.resolve({ operation: "start", success: false, error: "itemId is required" });
      }
      const milestoneMissing = await this.requireMilestone(itemId, "start");
      if (milestoneMissing) return milestoneMissing;
      if (this.adapter.sprintBoardNumber) {
        await this.adapter.setBoardStatus(
          itemId,
          this.adapter.sprintBoardNumber,
          String(params.stage ?? "inProgress"),
        );
      }
      return Promise.resolve({ operation: "start", success: true, itemId });
    });

    handlers.set("complete", async (_op, params) => {
      const itemId = String(params.itemId ?? "");
      if (!itemId) {
        return Promise.resolve({
          operation: "complete",
          success: false,
          error: "itemId is required",
        });
      }
      const milestoneMissing = await this.requireMilestone(itemId, "complete");
      if (milestoneMissing) return milestoneMissing;
      if (this.adapter.sprintBoardNumber) {
        await this.adapter.setBoardStatus(
          itemId,
          this.adapter.sprintBoardNumber,
          String(params.stage ?? "done"),
        );
      }
      return Promise.resolve({ operation: "complete", success: true, itemId });
    });

    handlers.set("update", async (_op, params) => {
      return await this.adapter.handleUpdateItem(params);
    });

    handlers.set("archive", async (_op, params) => {
      const itemId = String(params.itemId ?? "");
      if (!itemId) {
        return Promise.resolve({
          operation: "archive",
          success: false,
          error: "itemId is required",
        });
      }
      const viewResult = await this.adapter.runCommand("gh", [
        "issue",
        "view",
        itemId,
        "--json",
        "state,closed",
        ...this.adapter.buildRepoArg(),
      ]);
      if (viewResult.code === 0) {
        try {
          const viewData = JSON.parse(viewResult.stdout) as { state?: string; closed?: boolean };
          if (viewData.state === "CLOSED" || viewData.closed) {
            return Promise.resolve({
              operation: "archive",
              success: false,
              error: `Issue #${itemId} is already closed`,
            });
          }
        } catch { /* ignore */ }
      }
      return await this.adapter.handleCloseItem(params);
    });

    handlers.set("estimateInitialEffort", async (_op, params) => {
      const itemId = String(params.itemId ?? "");
      if (!itemId) {
        return Promise.resolve({
          operation: "estimateInitialEffort",
          success: false,
          error: "itemId is required",
        });
      }
      const effort = params.effortInitial;
      if (effort !== undefined && this.adapter.sprintBoardNumber) {
        try {
          await this.setEffortField(
            itemId,
            this.adapter.sprintBoardNumber,
            "initial_estimate",
            effort,
          );
        } catch { /* ok */ }
      }
      return Promise.resolve({ operation: "estimateInitialEffort", success: true, itemId });
    });

    handlers.set("estimatePlannedEffort", async (_op, params) => {
      const itemId = String(params.itemId ?? "");
      if (!itemId) {
        return Promise.resolve({
          operation: "estimatePlannedEffort",
          success: false,
          error: "itemId is required",
        });
      }
      const effort = params.effortPlanned;
      if (effort !== undefined && this.adapter.sprintBoardNumber) {
        try {
          await this.setEffortField(
            itemId,
            this.adapter.sprintBoardNumber,
            "planned_estimate",
            effort,
          );
        } catch { /* ok */ }
      }
      return Promise.resolve({ operation: "estimatePlannedEffort", success: true, itemId });
    });

    handlers.set("recordActualEffort", async (_op, params) => {
      const itemId = String(params.itemId ?? "");
      if (!itemId) {
        return Promise.resolve({
          operation: "recordActualEffort",
          success: false,
          error: "itemId is required",
        });
      }
      const effort = params.effortActual;
      if (effort !== undefined && this.adapter.sprintBoardNumber) {
        try {
          await this.setEffortField(itemId, this.adapter.sprintBoardNumber, "actual", effort);
        } catch { /* ok */ }
      }
      return Promise.resolve({ operation: "recordActualEffort", success: true, itemId });
    });

    handlers.set("recordAnalysis", async (_op, params) => {
      const itemId = String(params.itemId ?? "");
      if (!itemId) {
        return Promise.resolve({
          operation: "recordAnalysis",
          success: false,
          error: "itemId is required",
        });
      }
      const body = String(params.body ?? "");
      if (!body) {
        return Promise.resolve({
          operation: "recordAnalysis",
          success: false,
          error: "body is required",
        });
      }
      const { PbiEffortAnalysisData } = await import("./pbi-effort-analysis-data.ts");
      const validation = PbiEffortAnalysisData.validate(body);
      if (!validation.valid) {
        return Promise.resolve({
          operation: "recordAnalysis",
          success: false,
          error: validation.error,
        });
      }
      if (!this.adapter.sprintBoardNumber) {
        return Promise.resolve({ operation: "recordAnalysis", success: true, itemId });
      }
      try {
        const nodeResult = await this.adapter.runCommand("gh", [
          "issue",
          "view",
          itemId,
          "--json",
          "id",
          ...this.adapter.buildRepoArg(),
        ]);
        if (nodeResult.code !== 0) {
          return Promise.resolve({ operation: "recordAnalysis", success: true, itemId });
        }
        const nodeData = JSON.parse(nodeResult.stdout) as { id: string };
        let projectItemNodeId: string;
        try {
          ({ projectItemNodeId } = await this.adapter.addItemToProject(
            nodeData.id,
            this.adapter.sprintBoardNumber,
          ));
        } catch {
          const lookupQuery =
            `query($owner:String!,$repo:String!,$num:Int!){repository(owner:$owner,name:$repo){issue(number:$num){projectItems(first:20){nodes{id project{number}}}}}}`;
          const lr = await this.adapter.runCommand("gh", [
            "api",
            "graphql",
            "-f",
            `query=${lookupQuery}`,
            "-f",
            `owner=${this.adapter.scopeOwner}`,
            "-f",
            `repo=${this.adapter.scopeRepository}`,
            "-F",
            `num=${parseInt(itemId, 10)}`,
          ]);
          if (lr.code === 0) {
            const ld = JSON.parse(lr.stdout) as {
              data?: {
                repository?: {
                  issue?: {
                    projectItems?: {
                      nodes: Array<{ id: string; project: { number: number } }>;
                    };
                  };
                };
              };
            };
            const matched = ld?.data?.repository?.issue?.projectItems?.nodes?.find((n) =>
              n.project.number === this.adapter.sprintBoardNumber!
            );
            if (!matched) {
              return Promise.resolve({ operation: "recordAnalysis", success: true, itemId });
            }
            projectItemNodeId = matched.id;
          } else return Promise.resolve({ operation: "recordAnalysis", success: true, itemId });
        }
        const parsed = JSON.parse(body) as Record<string, unknown>;
        const writes: Array<{ field: string; value: string }> = [];
        for (
          const [key, field] of Object.entries({
            planning_variance_review: "harness-variance-review-planning",
            execution_variance_review: "harness-variance-review-execution",
            improvement_suggestions: "harness-improvement-suggestions",
          } as Record<string, string>)
        ) {
          if (parsed[key] !== undefined) {
            writes.push({ field, value: String(parsed[key]) });
          }
        }
        const boardNumber = this.adapter.sprintBoardNumber!;
        await Promise.all(writes.map((w) =>
          this.adapter.setTextFieldValue(
            projectItemNodeId,
            boardNumber,
            w.field,
            w.value,
          )
        ));
      } catch { /* ok */ }
      return Promise.resolve({ operation: "recordAnalysis", success: true, itemId });
    });

    handlers.set("recordSessionMetrics", async (_op, params) => {
      const itemId = String(params.itemId ?? "");
      if (!itemId) {
        return Promise.resolve({
          operation: "recordSessionMetrics",
          success: false,
          error: "itemId is required",
        });
      }
      const metrics = params.metrics as
        | {
          summary?: {
            intentAlignmentScore?: number;
            constraintAdherenceScore?: number;
            contextExtractionScore?: number;
            workSizeStabilityScore?: number;
          };
          intentAlignment?: string;
          constraintAdherence?: string;
          contextExtraction?: string;
          workSizeStability?: string;
        }
        | undefined;
      const fields: Array<[string, string]> = [];
      if (metrics?.summary) {
        const summaryJson = JSON.stringify({
          intent_alignment_score: metrics.summary.intentAlignmentScore ?? 0,
          constraint_adherence_score: metrics.summary.constraintAdherenceScore ?? 0,
          context_extraction_score: metrics.summary.contextExtractionScore ?? 0,
          work_size_stability_score: metrics.summary.workSizeStabilityScore ?? 0,
        });
        fields.push(["harness-metrics-summary", summaryJson]);
      }
      if (metrics?.intentAlignment) {
        fields.push(["harness-metrics-intent-alignment", metrics.intentAlignment]);
      }
      if (metrics?.constraintAdherence) {
        fields.push(["harness-metrics-constraint-adherence", metrics.constraintAdherence]);
      }
      if (metrics?.contextExtraction) {
        fields.push(["harness-metrics-context-extraction", metrics.contextExtraction]);
      }
      if (metrics?.workSizeStability) {
        fields.push(["harness-metrics-work-size-stability", metrics.workSizeStability]);
      }
      if (fields.length > 0 && this.adapter.sprintBoardNumber) {
        const nodeResult = await this.adapter.runCommand("gh", [
          "issue",
          "view",
          itemId,
          "--json",
          "id",
          ...this.adapter.buildRepoArg(),
        ]);
        if (nodeResult.code !== 0) {
          return Promise.resolve({
            operation: "recordSessionMetrics",
            success: false,
            itemId,
            error: nodeResult.stderr,
          });
        }
        let nodeData: { id: string };
        try {
          nodeData = JSON.parse(nodeResult.stdout) as { id: string };
        } catch {
          return Promise.resolve({
            operation: "recordSessionMetrics",
            success: false,
            itemId,
            error: "Failed to parse issue view output",
          });
        }
        let projectItemNodeId: string;
        try {
          ({ projectItemNodeId } = await this.adapter.addItemToProject(
            nodeData.id,
            this.adapter.sprintBoardNumber,
          ));
        } catch {
          const owned = this.adapter.scopeOwner;
          const repod = this.adapter.scopeRepository;
          if (!owned || !repod) {
            return Promise.resolve({
              operation: "recordSessionMetrics",
              success: false,
              itemId,
              error: "scope owner/repository is not resolved",
            });
          }
          const lookup =
            `query($owner:String!,$repo:String!,$num:Int!){repository(owner:$owner,name:$repo){issue(number:$num){projectItems(first:20){nodes{id project{number}}}}}}`;
          const lr = await this.adapter.runCommand("gh", [
            "api",
            "graphql",
            "-f",
            `query=${lookup}`,
            "-f",
            `owner=${owned}`,
            "-f",
            `repo=${repod}`,
            "-F",
            `num=${parseInt(itemId, 10)}`,
          ]);
          if (lr.code !== 0) {
            return Promise.resolve({
              operation: "recordSessionMetrics",
              success: false,
              itemId,
              error: lr.stderr,
            });
          }
          const ld = JSON.parse(lr.stdout) as {
            data?: {
              repository?: {
                issue?: {
                  projectItems?: { nodes: Array<{ id: string; project: { number: number } }> };
                };
              };
            };
          };
          const matched = ld?.data?.repository?.issue?.projectItems?.nodes?.find((n) =>
            n.project.number === this.adapter.sprintBoardNumber!
          );
          if (!matched) {
            return Promise.resolve({
              operation: "recordSessionMetrics",
              success: false,
              itemId,
              error: `WP #${itemId} is not on Sprint Board #${this.adapter.sprintBoardNumber}`,
            });
          }
          projectItemNodeId = matched.id;
        }
        const errors: string[] = [];
        for (const [fieldName, value] of fields) {
          const result = await this.adapter.setTextFieldValue(
            projectItemNodeId,
            this.adapter.sprintBoardNumber,
            fieldName,
            value,
          );
          if (!result.success) {
            errors.push(`${fieldName}: ${result.error ?? "unknown error"}`);
          }
        }
        if (errors.length > 0) {
          return Promise.resolve({
            operation: "recordSessionMetrics",
            success: false,
            itemId,
            error: errors.join("; "),
          });
        }
      }
      if (params.body && this.adapter.sprintBoardNumber) {
        return await this.adapter.handleUpdateItem({ itemId, bodyAppend: params.body });
      }
      return Promise.resolve({ operation: "recordSessionMetrics", success: true, itemId });
    });

    handlers.set("recordKpt", async (_op, params) => {
      const itemId = String(params.itemId ?? "");
      if (!itemId) {
        return Promise.resolve({
          operation: "recordKpt",
          success: false,
          error: "itemId is required",
        });
      }
      const kpt = params.kpt as
        | { keep?: string; problem?: string; try?: string; advise?: string }
        | undefined;
      const fields: Array<[string, string]> = [];
      if (kpt) {
        if (kpt.keep) fields.push(["harness-kpt-keep", kpt.keep]);
        if (kpt.problem) fields.push(["harness-kpt-problem", kpt.problem]);
        if (kpt.try) fields.push(["harness-kpt-try", kpt.try]);
        if (kpt.advise) fields.push(["harness-kpt-advise", kpt.advise]);
      }
      if (fields.length === 0 || !this.adapter.sprintBoardNumber) {
        return Promise.resolve({ operation: "recordKpt", success: true, itemId });
      }
      const nodeResult = await this.adapter.runCommand("gh", [
        "issue",
        "view",
        itemId,
        "--json",
        "id",
        ...this.adapter.buildRepoArg(),
      ]);
      if (nodeResult.code !== 0) {
        return Promise.resolve({
          operation: "recordKpt",
          success: false,
          itemId,
          error: nodeResult.stderr,
        });
      }
      const nodeData = JSON.parse(nodeResult.stdout) as { id: string };
      let projectItemNodeId: string;
      try {
        ({ projectItemNodeId } = await this.adapter.addItemToProject(
          nodeData.id,
          this.adapter.sprintBoardNumber,
        ));
      } catch {
        const owned = this.adapter.scopeOwner;
        const repod = this.adapter.scopeRepository;
        if (!owned || !repod) {
          return Promise.resolve({
            operation: "recordKpt",
            success: false,
            itemId,
            error: "scope owner/repository is not resolved",
          });
        }
        const lookup =
          `query($owner:String!,$repo:String!,$num:Int!){repository(owner:$owner,name:$repo){issue(number:$num){projectItems(first:20){nodes{id project{number}}}}}}`;
        const lr = await this.adapter.runCommand("gh", [
          "api",
          "graphql",
          "-f",
          `query=${lookup}`,
          "-f",
          `owner=${owned}`,
          "-f",
          `repo=${repod}`,
          "-F",
          `num=${parseInt(itemId, 10)}`,
        ]);
        if (lr.code !== 0) {
          return Promise.resolve({
            operation: "recordKpt",
            success: false,
            itemId,
            error: lr.stderr,
          });
        }
        const ld = JSON.parse(lr.stdout) as {
          data?: {
            repository?: {
              issue?: {
                projectItems?: { nodes: Array<{ id: string; project: { number: number } }> };
              };
            };
          };
        };
        const matched = ld?.data?.repository?.issue?.projectItems?.nodes?.find((n) =>
          n.project.number === this.adapter.sprintBoardNumber!
        );
        if (!matched) {
          return Promise.resolve({
            operation: "recordKpt",
            success: false,
            itemId,
            error: `WP #${itemId} is not on Sprint Board #${this.adapter.sprintBoardNumber}`,
          });
        }
        projectItemNodeId = matched.id;
      }
      const errors: string[] = [];
      for (const [fieldName, value] of fields) {
        const result = await this.adapter.setTextFieldValue(
          projectItemNodeId,
          this.adapter.sprintBoardNumber,
          fieldName,
          value,
        );
        if (!result.success) {
          errors.push(`${fieldName}: ${result.error ?? "unknown error"}`);
        }
      }
      if (errors.length > 0) {
        return Promise.resolve({
          operation: "recordKpt",
          success: false,
          itemId,
          error: errors.join("; "),
        });
      }
      return Promise.resolve({ operation: "recordKpt", success: true, itemId });
    });

    handlers.set("assignToProductBacklogItem", async (_op, params) => {
      const itemId = String(params.itemId ?? "");
      const parentPbi = String(params.parentPbi ?? "");
      if (!itemId || !parentPbi) {
        return Promise.resolve({
          operation: "assignToProductBacklogItem",
          success: false,
          error: "itemId and parentPbi are required",
        });
      }
      return await this.adapter.handleSetParent(itemId, parentPbi);
    });

    handlers.set("unassignFromProductBacklogItem", async (_op, params) => {
      const itemId = String(params.itemId ?? "");
      if (!itemId) {
        return Promise.resolve({
          operation: "unassignFromProductBacklogItem",
          success: false,
          error: "itemId is required",
        });
      }
      return await this.adapter.handleRemoveParent(itemId);
    });

    handlers.set("comment", async (_op, params, lastItemId) => {
      return await this.adapter.handleAddComment(params, lastItemId);
    });

    handlers.set("view", async (_op, params) => {
      return await this.adapter.handleFindItem(params);
    });

    handlers.set("search", async (_op, params) => {
      if (params.status && this.adapter.sprintBoardNumber) {
        return await this.adapter.handleProjectSearchItems({
          ...params,
          labelType: "WP",
          boardNumber: this.adapter.sprintBoardNumber,
        });
      }
      return await this.adapter.handleSearchItems({ ...params, labelType: "WP" });
    });

    const existing = stepHandlers.get("WorkPackage") ?? new Map();
    for (const [op, handler] of handlers) existing.set(op, handler);
    stepHandlers.set("WorkPackage", existing);
  }

  private async requireMilestone(
    itemId: string,
    operation: "start" | "complete",
  ): Promise<{ operation: string; success: false; itemId: string; error: string } | null> {
    const view = await this.adapter.getSprintMilestone(itemId);
    if (!view.success) {
      return {
        operation,
        success: false,
        itemId,
        error: view.error ?? "failed to resolve item",
      };
    }
    if (!view.milestone) {
      return {
        operation,
        success: false,
        itemId,
        error:
          `WP #${itemId} is not linked to a Sprint milestone: 先に commit 操作で milestone(Sprint) を設定してください`,
      };
    }
    return null;
  }

  private async setEffortField(
    itemId: string,
    boardNumber: number,
    key: string,
    value: unknown,
  ): Promise<void> {
    const nodeResult = await this.adapter.runCommand("gh", [
      "issue",
      "view",
      itemId,
      "--json",
      "id",
      ...this.adapter.buildRepoArg(),
    ]);
    if (nodeResult.code !== 0) return;
    const nodeData = JSON.parse(nodeResult.stdout) as { id: string };
    let projectItemNodeId: string;
    try {
      ({ projectItemNodeId } = await this.adapter.addItemToProject(nodeData.id, boardNumber));
    } catch {
      const owned = this.adapter.scopeOwner;
      const repod = this.adapter.scopeRepository;
      if (!owned || !repod) return;
      const lookup =
        `query($owner:String!,$repo:String!,$num:Int!){repository(owner:$owner,name:$repo){issue(number:$num){projectItems(first:20){nodes{id project{number}}}}}}`;
      const lr = await this.adapter.runCommand("gh", [
        "api",
        "graphql",
        "-f",
        `query=${lookup}`,
        "-f",
        `owner=${owned}`,
        "-f",
        `repo=${repod}`,
        "-F",
        `num=${parseInt(itemId, 10)}`,
      ]);
      if (lr.code !== 0) return;
      const ld = JSON.parse(lr.stdout) as {
        data?: {
          repository?: {
            issue?: {
              projectItems?: { nodes: Array<{ id: string; project: { number: number } }> };
            };
          };
        };
      };
      const matched = ld?.data?.repository?.issue?.projectItems?.nodes?.find((n) =>
        n.project.number === boardNumber
      );
      if (!matched) return;
      projectItemNodeId = matched.id;
    }
    const text = await this.adapter.readTextFieldValue(
      projectItemNodeId,
      boardNumber,
      "harness-effort-summary",
    );
    let data: Record<string, number> = {};
    try {
      data = JSON.parse(text ?? "{}") as Record<string, number>;
    } catch { /* use empty */ }
    data[key] = Number(value);
    await this.adapter.setTextFieldValue(
      projectItemNodeId,
      boardNumber,
      "harness-effort-summary",
      JSON.stringify(data),
    );
  }
}
