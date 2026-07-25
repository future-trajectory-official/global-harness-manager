import type { EntityType, StepOperation } from "../domain/types.ts";
import type { OperationHandler, PlanGatewayAdapter } from "./plan-gateway-adapter.ts";
import { EffortAnalysisData } from "./effort-analysis-data.ts";

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
      if (params.body && this.adapter.sprintBoardNumber) {
        try {
          const body = String(params.body);
          const extract = (heading: string): string | undefined => {
            const re = new RegExp(`### ${heading}\\n\\n([\\s\\S]*?)(?:\\n###|\\n$|$)`);
            const m = body.match(re);
            return m ? m[1].trim() : undefined;
          };
          const nodeResult = await this.adapter.runCommand("gh", [
            "issue",
            "view",
            itemId,
            "--json",
            "id",
            ...this.adapter.buildRepoArg(),
          ]);
          if (nodeResult.code === 0) {
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
            const text = await this.adapter.readTextFieldValue(
              projectItemNodeId,
              this.adapter.sprintBoardNumber,
              "harness-efforts-analysis",
            );
            const data = EffortAnalysisData.fromJson(text ?? "");
            const planning = extract("Planning Review");
            const execution = extract("Execution Review");
            const suggestions = extract("Improvement Suggestions");
            if (planning || execution || suggestions) {
              if (planning) data.mergeAnalysis({ planningReview: planning });
              if (execution) data.mergeAnalysis({ executionReview: execution });
              if (suggestions) data.mergeAnalysis({ improvementSuggestions: suggestions });
              await this.adapter.setTextFieldValue(
                projectItemNodeId,
                this.adapter.sprintBoardNumber,
                "harness-efforts-analysis",
                data.toJson(),
              );
            }
          }
        } catch { /* ok */ }
      }
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
      if (params.body && this.adapter.sprintBoardNumber) {
        try {
          const nodeResult = await this.adapter.runCommand("gh", [
            "issue",
            "view",
            itemId,
            "--json",
            "id",
            ...this.adapter.buildRepoArg(),
          ]);
          if (nodeResult.code === 0) {
            const nodeData = JSON.parse(nodeResult.stdout) as { id: string };
            const { projectItemNodeId } = await this.adapter.addItemToProject(
              nodeData.id,
              this.adapter.sprintBoardNumber,
            );
            await this.adapter.setTextFieldValue(
              projectItemNodeId,
              this.adapter.sprintBoardNumber,
              "harness-metrics",
              String(params.body),
            );
          }
        } catch { /* ok */ }
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
      const body = String(params.body ?? "");
      if (body && this.adapter.sprintBoardNumber) {
        try {
          const nodeResult = await this.adapter.runCommand("gh", [
            "issue",
            "view",
            itemId,
            "--json",
            "id",
            ...this.adapter.buildRepoArg(),
          ]);
          if (nodeResult.code === 0) {
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
                return Promise.resolve({ operation: "recordKpt", success: true, itemId });
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
                return Promise.resolve({ operation: "recordKpt", success: true, itemId });
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
                return Promise.resolve({ operation: "recordKpt", success: true, itemId });
              }
              projectItemNodeId = matched.id;
            }
            await this.adapter.setTextFieldValue(
              projectItemNodeId,
              this.adapter.sprintBoardNumber,
              "harness-keep-problem-try",
              body,
            );
          }
        } catch { /* ok */ }
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

  private async setEffortField(
    itemId: string,
    boardNumber: number,
    key: keyof import("./effort-analysis-data.ts").WpEffortSummary,
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
      "harness-efforts-analysis",
    );
    const data = EffortAnalysisData.fromJson(text ?? "").mergeEffort(key, Number(value));
    await this.adapter.setTextFieldValue(
      projectItemNodeId,
      boardNumber,
      "harness-efforts-analysis",
      data.toJson(),
    );
  }
}
