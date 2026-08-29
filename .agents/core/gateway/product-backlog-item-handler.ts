import type { EntityType, Stage, StepOperation } from "../domain/types.ts";
import type { OperationHandler, PlanGatewayAdapter } from "./plan-gateway-adapter.ts";
import {
  FIELD,
  type FieldRef,
  fieldRef,
  type HarnessFieldConstant,
  statusRef,
} from "./field-registry.ts";

export class ProductBacklogItemHandler {
  constructor(private readonly adapter: PlanGatewayAdapter) {}

  register(stepHandlers: Map<EntityType, Map<StepOperation, OperationHandler>>): void {
    const handlers = new Map<StepOperation, OperationHandler>();

    handlers.set("propose", async (_op, params) => {
      const result = await this.adapter.handleCreateItem({ ...params, type: "PBI" });
      if (!result.success || !result.itemId) return result;
      const parentFeature = String(params.parentFeature ?? "");
      if (parentFeature) {
        const pr = await this.adapter.handleSetParent(result.itemId, parentFeature);
        if (!pr.success) return pr;
      }
      if (result.nodeId && this.adapter.productBacklogBoardNumber) {
        try {
          await this.adapter.addItemToProject(
            result.nodeId,
            this.adapter.productBacklogBoardNumber,
          );
        } catch { /* ok */ }
      }
      return result;
    });

    handlers.set("commit", async (_op, params) => {
      const itemId = String(params.itemId ?? "");
      if (!itemId) return { operation: "commit", success: false, error: "itemId is required" };
      const sprint = String(params.sprint ?? "");
      if (sprint) {
        const mr = await this.adapter.handleSetMilestone(itemId, sprint);
        if (!mr.success) return mr;
      }
      if (this.adapter.productBacklogBoardNumber) {
        await this.adapter.setBoardStatus(
          itemId,
          statusRef("productBacklog"),
          (params.stage as Stage) ?? "todo",
        );
      }
      return { operation: "commit", success: true, itemId };
    });

    handlers.set("start", async (_op, params) => {
      const itemId = String(params.itemId ?? "");
      if (!itemId) return { operation: "start", success: false, error: "itemId is required" };
      if (this.adapter.productBacklogBoardNumber) {
        await this.adapter.setBoardStatus(
          itemId,
          statusRef("productBacklog"),
          (params.stage as Stage) ?? "inProgress",
        );
      }
      return { operation: "start", success: true, itemId };
    });

    handlers.set("complete", async (_op, params) => {
      const itemId = String(params.itemId ?? "");
      if (!itemId) return { operation: "complete", success: false, error: "itemId is required" };
      if (this.adapter.productBacklogBoardNumber) {
        await this.adapter.setBoardStatus(
          itemId,
          statusRef("productBacklog"),
          (params.stage as Stage) ?? "done",
        );
      }
      return { operation: "complete", success: true, itemId };
    });

    handlers.set("update", async (_op, params) => {
      return await this.adapter.handleUpdateItem(params);
    });

    handlers.set("archive", async (_op, params) => {
      const itemId = String(params.itemId ?? "");
      if (!itemId) {
        return { operation: "archive", success: false, error: "itemId is required" };
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
            return {
              operation: "archive",
              success: false,
              error: `Issue #${itemId} is already closed`,
            };
          }
        } catch { /* ignore */ }
      }
      return await this.adapter.handleCloseItem(params);
    });

    handlers.set("estimateSize", async (_op, params) => {
      const itemId = String(params.itemId ?? "");
      if (!itemId) {
        return { operation: "estimateSize", success: false, error: "itemId is required" };
      }
      const sizeVal = String(params.sizeEstimate ?? "");
      if (sizeVal && this.adapter.productBacklogBoardNumber) {
        const nodeResult = await this.adapter.runCommand("gh", [
          "issue",
          "view",
          itemId,
          "--json",
          "id",
          ...this.adapter.buildRepoArg(),
        ]);
        if (nodeResult.code === 0) {
          try {
            const nodeData = JSON.parse(nodeResult.stdout) as { id: string };
            const { projectItemNodeId } = await this.adapter.addItemToProject(
              nodeData.id,
              this.adapter.productBacklogBoardNumber,
            );
            const optionId = await this.adapter.resolveSingleSelectOptionId(
              fieldRef("productBacklog", FIELD.sizeEstimate),
              sizeVal,
            );
            if (optionId) {
              await this.adapter.setSingleSelectFieldValue(
                projectItemNodeId,
                fieldRef("productBacklog", FIELD.sizeEstimate),
                optionId,
              );
            }
          } catch { /* ok */ }
        }
      }
      return { operation: "estimateSize", success: true, itemId };
    });

    handlers.set("confirmSize", async (_op, params) => {
      const itemId = String(params.itemId ?? "");
      if (!itemId) return { operation: "confirmSize", success: false, error: "itemId is required" };
      const sizeActual = String(params.sizeActual ?? "");
      const varianceReason = String(params.sizeVarianceReason ?? "");
      if ((sizeActual || varianceReason) && this.adapter.productBacklogBoardNumber) {
        const nodeResult = await this.adapter.runCommand("gh", [
          "issue",
          "view",
          itemId,
          "--json",
          "id",
          ...this.adapter.buildRepoArg(),
        ]);
        if (nodeResult.code === 0) {
          try {
            const nodeData = JSON.parse(nodeResult.stdout) as { id: string };
            const projectItemNodeId = await this.adapter.resolveProjectItemOnBoard(
              itemId,
              nodeData.id,
              "productBacklog",
            );
            if (!projectItemNodeId) {
              return { operation: "confirmSize", success: true, itemId };
            }
            if (sizeActual) {
              const optionId = await this.adapter.resolveSingleSelectOptionId(
                fieldRef("productBacklog", FIELD.sizeActual),
                sizeActual,
              );
              if (optionId) {
                await this.adapter.setSingleSelectFieldValue(
                  projectItemNodeId,
                  fieldRef("productBacklog", FIELD.sizeActual),
                  optionId,
                );
              }
            }
            if (varianceReason) {
              await this.adapter.setTextFieldValue(
                projectItemNodeId,
                fieldRef("productBacklog", FIELD.varianceReviewSize),
                varianceReason,
              );
            }
          } catch { /* ok */ }
        }
      }
      return { operation: "confirmSize", success: true, itemId };
    });

    handlers.set("analyzeEffort", async (_op, params) => {
      const itemId = String(params.itemId ?? "");
      if (!itemId) {
        return { operation: "analyzeEffort", success: false, error: "itemId is required" };
      }
      let sumInitial = 0;
      let sumPlanned = 0;
      let sumActual = 0;

      if (
        this.adapter.sprintBoardNumber && this.adapter.scopeOwner &&
        this.adapter.scopeRepository
      ) {
        const query =
          `query($owner:String!,$repo:String!,$num:Int!){repository(owner:$owner,name:$repo){issue(number:$num){subIssues(first:100){nodes{... on Issue{number projectItems(first:20){nodes{id project{number} effortField:fieldValueByName(name:"${FIELD.effortSummary}"){... on ProjectV2ItemFieldTextValue{text}}}}}}}}}}`;
        const lr = await this.adapter.runCommand("gh", [
          "api",
          "graphql",
          "-f",
          `query=${query}`,
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
                  subIssues?: {
                    nodes?: Array<{
                      projectItems?: {
                        nodes?: Array<{
                          project: { number: number };
                          effortField?: { text?: string };
                        }>;
                      };
                    }>;
                  };
                };
              };
            };
          };
          const subNodes = ld?.data?.repository?.issue?.subIssues?.nodes ?? [];
          for (const sub of subNodes) {
            const pItem = sub.projectItems?.nodes?.find(
              (n) => n.project.number === this.adapter.sprintBoardNumber!,
            );
            if (pItem?.effortField?.text) {
              try {
                const parsed = JSON.parse(pItem.effortField.text) as {
                  initial_estimate?: number;
                  planned_estimate?: number;
                  actual?: number;
                };
                sumInitial += parsed.initial_estimate ?? 0;
                sumPlanned += parsed.planned_estimate ?? 0;
                sumActual += parsed.actual ?? 0;
              } catch { /* ignore */ }
            }
          }
        }
      }
      return {
        operation: "analyzeEffort",
        success: true,
        itemId,
        output: {
          wp_effort_summary: {
            initial_estimate: sumInitial,
            planned_estimate: sumPlanned,
            actual: sumActual,
          },
        },
      };
    });

    handlers.set("recordAnalysis", async (_op, params) => {
      const itemId = String(params.itemId ?? "");
      if (!itemId) {
        return { operation: "recordAnalysis", success: false, error: "itemId is required" };
      }
      const body = String(params.body ?? "");
      if (!body) {
        return { operation: "recordAnalysis", success: false, error: "body is required" };
      }
      const { PbiEffortAnalysisData } = await import("./pbi-effort-analysis-data.ts");
      const validation = PbiEffortAnalysisData.validate(body);
      if (!validation.valid) {
        return { operation: "recordAnalysis", success: false, error: validation.error };
      }
      if (!this.adapter.productBacklogBoardNumber) {
        return { operation: "recordAnalysis", success: true, itemId };
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
          return { operation: "recordAnalysis", success: true, itemId };
        }
        const nodeData = JSON.parse(nodeResult.stdout) as { id: string };
        const projectItemNodeId = await this.adapter.resolveProjectItemOnBoard(
          itemId,
          nodeData.id,
          "productBacklog",
        );
        if (!projectItemNodeId) {
          return { operation: "recordAnalysis", success: true, itemId };
        }
        const parsed = JSON.parse(body) as Record<string, unknown>;
        const writes: Array<{ field: FieldRef; value: string }> = [];
        if (parsed.wp_effort_summary !== undefined) {
          writes.push({
            field: fieldRef("productBacklog", FIELD.effortSummary),
            value: JSON.stringify(parsed.wp_effort_summary),
          });
        }
        for (
          const [key, field] of Object.entries({
            planning_variance_review: FIELD.varianceReviewPlanning,
            execution_variance_review: FIELD.varianceReviewExecution,
            improvement_suggestions: FIELD.improvementSuggestions,
          } as Record<string, HarnessFieldConstant>)
        ) {
          if (parsed[key] !== undefined) {
            writes.push({ field: fieldRef("productBacklog", field), value: String(parsed[key]) });
          }
        }
        await Promise.all(writes.map((w) =>
          this.adapter.setTextFieldValue(
            projectItemNodeId,
            w.field,
            w.value,
          )
        ));
      } catch { /* ok */ }
      return { operation: "recordAnalysis", success: true, itemId };
    });

    handlers.set("defineAcceptanceCriteria", async (_op, params) => {
      const title = String(params.title ?? "");
      const parentPbi = String(params.parentPbi ?? "");
      if (!title || !parentPbi) {
        return {
          operation: "defineAcceptanceCriteria",
          success: false,
          error: "title and parentPbi are required",
        };
      }
      const cr = await this.adapter.handleCreateItem({ title, body: params.body, type: "WP" });
      if (!cr.success || !cr.itemId) return cr;
      const pr = await this.adapter.handleSetParent(cr.itemId, parentPbi);
      if (!pr.success) return pr;
      return cr;
    });

    handlers.set("comment", async (_op, params) => {
      const itemId = String(params.itemId ?? "");
      const body = String(params.body ?? "");
      if (!itemId || !body) {
        return { operation: "comment", success: false, error: "itemId and body are required" };
      }
      try {
        const viewResult = await this.adapter.runCommand("gh", [
          "issue",
          "view",
          itemId,
          "--json",
          "comments",
          ...this.adapter.buildRepoArg(),
        ]);
        if (viewResult.code === 0) {
          const viewData = JSON.parse(viewResult.stdout) as {
            comments: Array<{ id: string; body: string }>;
          };
          const existing = viewData.comments.find((c) => c.body.startsWith("## History"));
          if (existing) {
            const lines = existing.body.split("\n");
            const existingRows = lines.filter((l) => /^\|\s*\d+\s*\|/.test(l));
            const nextNum = existingRows.length + 1;
            const newRow = body.split("\n").filter((l) => /^\|\s*\d+\s*\|/.test(l))[0];
            if (newRow) {
              const updatedRow = newRow.replace(/^\|\s*\d+\s*\|/, `| ${nextNum} |`);
              const gqlBody = JSON.stringify({
                query:
                  `mutation($id: ID!, $body: String!) { updateIssueComment(input: {id: $id, body: $body}) { issueComment { id } } }`,
                variables: { id: existing.id, body: existing.body + "\n" + updatedRow },
              });
              const tmpFile = `/tmp/opencode/gh_cmt_${Date.now()}.json`;
              await Deno.writeTextFile(tmpFile, gqlBody);
              const gr = await this.adapter.runCommand("gh", [
                "api",
                "graphql",
                "--input",
                tmpFile,
              ]);
              try {
                await Deno.remove(tmpFile);
              } catch { /* ok */ }
              if (gr.code === 0) {
                const grData = JSON.parse(gr.stdout);
                if (!grData.errors) return { operation: "comment", success: true, itemId };
              }
            }
          }
        }
      } catch { /* fallthrough */ }
      return await this.adapter.handleAddComment(params);
    });

    handlers.set("view", async (_op, params) => {
      return await this.adapter.handleFindItem(params);
    });

    handlers.set("search", async (_op, params) => {
      if (params.status && this.adapter.productBacklogBoardNumber) {
        return await this.adapter.handleProjectSearchItems({
          ...params,
          labelType: "PBI",
          boardNumber: this.adapter.productBacklogBoardNumber,
        });
      }
      return await this.adapter.handleSearchItems({ ...params, labelType: "PBI" });
    });

    const existing = stepHandlers.get("ProductBacklogItem") ?? new Map();
    for (const [op, handler] of handlers) existing.set(op, handler);
    stepHandlers.set("ProductBacklogItem", existing);
  }
}
