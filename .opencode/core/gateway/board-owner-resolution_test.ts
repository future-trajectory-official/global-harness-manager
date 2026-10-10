import { assert, assertEquals } from "@std/assert";
import type { ExecuteResult } from "../shared/io/command.ts";
import { statusRef } from "./field-registry.ts";
import {
  isUserUnresolved,
  PlanGatewayAdapter,
  projectV2OwnerRoot,
  toOrganizationProjectQuery,
} from "./plan-gateway-adapter.ts";

type Call = { cmd: string; args: string[] };

function recordingRunner(
  calls: Call[],
  respond: (query: string, args: string[]) => ExecuteResult,
): (cmd: string, args: string[]) => Promise<ExecuteResult> {
  return (cmd: string, args: string[]): Promise<ExecuteResult> => {
    calls.push({ cmd, args });
    const query = args.find((a) => a.startsWith("query=")) ?? "";
    return Promise.resolve(respond(query, args));
  };
}

function makeScopedAdapter(
  runner: (cmd: string, args: string[]) => Promise<ExecuteResult>,
): PlanGatewayAdapter {
  const adapter = new PlanGatewayAdapter(runner);
  adapter.setScope("repo-org", "my-repo");
  return adapter;
}

const ok = (stdout: string): ExecuteResult => ({ code: 0, stdout, stderr: "" });

/**
 * ユースケース: owner種別に応じたルートフィールドの構築
 * 検証意図: user種別では user(login:、organization種別では organization(login: を返すこと
 */
Deno.test("projectV2OwnerRoot - builds root field per owner type", () => {
  assertEquals(projectV2OwnerRoot("user"), "user");
  assertEquals(projectV2OwnerRoot("organization"), "organization");
});

/**
 * ユースケース: user版クエリの organization版への書換え
 * 検証意図: user所有想定で失敗した際の逆フォールバック用に全件置換できること
 */
Deno.test("toOrganizationProjectQuery - rewrites user root to organization root", () => {
  assertEquals(
    toOrganizationProjectQuery("{ user(login: $owner) { projectV2(number: 1) { id } } }"),
    "{ organization(login: $owner) { projectV2(number: 1) { id } } }",
  );
});

/**
 * ユースケース: User未解決応答の判定
 * 検証意図: data.user が null の場合に真を返すこと
 */
Deno.test("isUserUnresolved - detects user miss", () => {
  assert(isUserUnresolved(JSON.stringify({ data: { user: null } })));
  assert(!isUserUnresolved(JSON.stringify({ data: { user: { login: "u" } } })));
});

/**
 * ユースケース: ボード所有者(個人)がリポジトリ所有者(Organization)と異なる場合
 * 検証意図: 初回クエリから user(login: ボード所有者) で解決し、リポジトリownerの
 * organization クエリを発行しないこと (AC-1)
 */
Deno.test("addItemToProject - uses configured user board owner first (AC-1)", async () => {
  const calls: Call[] = [];
  const runner = recordingRunner(calls, (query) => {
    const isUserQuery = query.includes("user(login:");
    const isAddMutation = query.includes("addProjectV2ItemById");
    if (isUserQuery) {
      return ok(JSON.stringify({ data: { user: { projectV2: { id: "PVT_u10" } } } }));
    }
    if (isAddMutation) {
      return ok(JSON.stringify({ data: { addProjectV2ItemById: { item: { id: "PVTI_u1" } } } }));
    }
    return ok(JSON.stringify({ data: { organization: null } }));
  });
  const adapter = makeScopedAdapter(runner);
  adapter.setBoardOwner({ owner: "board-user", ownerType: "user" });
  const result = await adapter.addItemToProject("I_issue1", 10);
  assertEquals(result.projectItemNodeId, "PVTI_u1");
  const firstQuery = calls[0].args.find((a) => a.startsWith("query=")) ?? "";
  assert(firstQuery.includes("user(login:"), "first query must use user root");
  assert(
    calls[0].args.some((a) => a === "owner=board-user"),
    "first query must use configured board owner login",
  );
  assert(
    calls.every((c) => !c.args.some((a) => a === "owner=repo-org")),
    "must not fall back to repository owner login",
  );
  assert(
    calls.every((c) => !c.args.some((a) => a.includes("organization(login:"))),
    "must not issue organization query for user-owned board",
  );
});

/**
 * ユースケース: 種別設定が実態と逆の場合
 * 検証意図: user想定→未解決→organizationへ1回のみフォールバックして解決すること
 */
Deno.test("addItemToProject - falls back to organization when user misses", async () => {
  const calls: Call[] = [];
  const runner = recordingRunner(calls, (query) => {
    if (query.includes("addProjectV2ItemById")) {
      return ok(JSON.stringify({ data: { addProjectV2ItemById: { item: { id: "PVTI_o1" } } } }));
    }
    if (query.includes("user(login:")) {
      return ok(JSON.stringify({ data: { user: null } }));
    }
    return ok(JSON.stringify({ data: { organization: { projectV2: { id: "PVT_o10" } } } }));
  });
  const adapter = makeScopedAdapter(runner);
  adapter.setBoardOwner({ owner: "both-exist", ownerType: "user" });
  const result = await adapter.addItemToProject("I_issue1", 10);
  assertEquals(result.projectItemNodeId, "PVTI_o1");
  assert(
    calls.some((c) => c.args.some((a) => a.includes("organization(login:"))),
    "fallback organization query must be issued",
  );
});

/**
 * ユースケース: PBI作成時に個人所有ボードへ自動登録されること (WP #828 AC-2)
 * 検証意図: propose 経路が設定ボード所有者の user クエリで登録を完遂すること
 */
Deno.test("propose - auto-registers PBI to user-owned board (AC-2)", async () => {
  const calls: Call[] = [];
  const runner = recordingRunner(calls, (query, args) => {
    const isAddMutation = query.includes("addProjectV2ItemById");
    const isUserQuery = query.includes("user(login:");
    const isIssueCreate = args[0] === "issue" && args[1] === "create";
    const isNodeView = args.includes("--json") && args.includes("id");
    if (isIssueCreate) {
      return ok("https://github.com/repo-org/my-repo/issues/999");
    }
    if (isNodeView) {
      return ok(JSON.stringify({ id: "I_pbi999" }));
    }
    if (isAddMutation) {
      return ok(JSON.stringify({ data: { addProjectV2ItemById: { item: { id: "PVTI_pbi1" } } } }));
    }
    if (isUserQuery) {
      return ok(JSON.stringify({ data: { user: { projectV2: { id: "PVT_u10" } } } }));
    }
    return ok(JSON.stringify({ data: { organization: null } }));
  });
  const adapter = makeScopedAdapter(runner);
  adapter.setProjectBoardNumbers(10, 11, 12);
  adapter.setBoardOwner({ owner: "board-user", ownerType: "user" });
  const plan = {
    steps: [{
      entity: "ProductBacklogItem",
      operation: "propose",
      params: { title: "新PBI", body: "本文" },
    }],
  };
  const result = await adapter.execute(plan as never);
  const step = result.getStep("ProductBacklogItem", "propose");
  assert(step?.success, `propose must succeed: ${step?.error}`);
  assert(
    calls.some((c) => c.args.some((a) => a.includes("user(login:"))),
    "board registration must use user query",
  );
  const projectQuery = calls.find((c) =>
    c.args.some((a) => a.startsWith("query=") && a.includes("projectV2(number:"))
  );
  assert(projectQuery, "project ID query must be issued");
  assert(
    projectQuery?.args.some((a) => a === "number=10"),
    "registration must target productBacklog board number",
  );
  const mutation = calls.find((c) => c.args.some((a) => a.includes("addProjectV2ItemById")));
  assert(mutation, "board registration mutation must be issued");
  assert(
    mutation?.args.some((a) => a === "project=PVT_u10"),
    "mutation must reference resolved user board project",
  );
  assert(
    mutation?.args.some((a) => a === "content=I_pbi999"),
    "mutation must reference created PBI node",
  );
});

/**
 * ユースケース: 単一選択肢解決が個人所有ボードで行われること
 * 検証意図: resolveSingleSelectOptionId が user クエリで選択肢IDを返すこと
 */
Deno.test("resolveSingleSelectOptionId - uses user board owner (AC-1)", async () => {
  const calls: Call[] = [];
  const runner = recordingRunner(calls, (query) => {
    const isUserQuery = query.includes("user(login:");
    if (isUserQuery) {
      return ok(
        JSON.stringify({
          data: { user: { projectV2: { field: { options: [{ id: "OPT1", name: "Todo" }] } } } },
        }),
      );
    }
    return ok(JSON.stringify({ data: { organization: null } }));
  });
  const adapter = makeScopedAdapter(runner);
  adapter.setProjectBoardNumbers(10, 11, 12);
  adapter.setBoardOwner({ owner: "board-user", ownerType: "user" });
  const optionId = await adapter.resolveSingleSelectOptionId(statusRef("sprintBoard"), "Todo");
  assertEquals(optionId, "OPT1");
  assert(
    calls.some((c) => c.args.some((a) => a.includes("user(login:"))),
    "field options must resolve via user query",
  );
});

/**
 * ユースケース: フィールド値設定の解決連鎖が個人所有ボードで行われること
 * 検証意図: setSingleSelectFieldValue (fieldId・projectId解決を含む) が user クエリで完遂すること
 */
Deno.test("setSingleSelectFieldValue - resolves ids via user board owner (AC-1)", async () => {
  const calls: Call[] = [];
  const runner = recordingRunner(calls, (query, args) => {
    const isUserQuery = query.includes("user(login:");
    const isItemEdit = args[0] === "project" && args[1] === "item-edit";
    const isFieldQuery = query.includes("field(name:");
    if (isItemEdit) {
      return ok(JSON.stringify({}));
    }
    if (isUserQuery && isFieldQuery) {
      return ok(JSON.stringify({ data: { user: { projectV2: { field: { id: "F1" } } } } }));
    }
    if (isUserQuery) {
      return ok(JSON.stringify({ data: { user: { projectV2: { id: "PVT_u11" } } } }));
    }
    return ok(JSON.stringify({ data: { organization: null } }));
  });
  const adapter = makeScopedAdapter(runner);
  adapter.setProjectBoardNumbers(10, 11, 12);
  adapter.setBoardOwner({ owner: "board-user", ownerType: "user" });
  const result = await adapter.setSingleSelectFieldValue(
    "PVTI_x",
    statusRef("sprintBoard"),
    "OPT1",
  );
  assert(result.success, `field value set must succeed: ${result.error}`);
  assert(
    calls.some((c) => c.args.some((a) => a.includes("user(login:"))),
    "field/project id resolution must use user query",
  );
});

/**
 * ユースケース: ボード内検索が個人所有ボードで行われること
 * 検証意図: handleProjectSearchItems (#fetchProjectItems) が user クエリで項目を返すこと
 */
Deno.test("handleProjectSearchItems - searches user-owned board (AC-1)", async () => {
  const calls: Call[] = [];
  const runner = recordingRunner(calls, (query) => {
    const isUserQuery = query.includes("user(login:");
    if (isUserQuery) {
      return ok(JSON.stringify({
        data: {
          user: {
            projectV2: {
              items: {
                pageInfo: { hasNextPage: false, endCursor: null },
                nodes: [{
                  content: { number: 1, title: "T" },
                  fieldValueByName: { name: "Todo" },
                }],
              },
            },
          },
        },
      }));
    }
    return ok(JSON.stringify({ data: { organization: null } }));
  });
  const adapter = makeScopedAdapter(runner);
  adapter.setProjectBoardNumbers(10, 11, 12);
  adapter.setBoardOwner({ owner: "board-user", ownerType: "user" });
  const result = await adapter.handleProjectSearchItems({
    status: "Todo",
    labelType: "WP",
    boardNumber: 11,
  });
  assert(result.success, `search must succeed: ${result.error}`);
  assertEquals(result.output, [{ number: 1, title: "T" }]);
  assert(
    calls.some((c) => c.args.some((a) => a.includes("user(login:"))),
    "item fetch must use user query",
  );
});

/**
 * ユースケース: ボード所有者未設定の既存動作
 * 検証意図: 従来どおりリポジトリownerの organization クエリから開始すること (回帰)
 */
Deno.test("addItemToProject - defaults to scope owner organization (regression)", async () => {
  const calls: Call[] = [];
  const runner = recordingRunner(calls, (query) => {
    if (query.includes("addProjectV2ItemById")) {
      return ok(JSON.stringify({ data: { addProjectV2ItemById: { item: { id: "PVTI_o1" } } } }));
    }
    return ok(JSON.stringify({ data: { organization: { projectV2: { id: "PVT_o10" } } } }));
  });
  const adapter = makeScopedAdapter(runner);
  const result = await adapter.addItemToProject("I_issue1", 10);
  assertEquals(result.projectItemNodeId, "PVTI_o1");
  const firstQuery = calls[0].args.find((a) => a.startsWith("query=")) ?? "";
  assert(firstQuery.includes("organization(login:"), "default must stay organization-first");
});
