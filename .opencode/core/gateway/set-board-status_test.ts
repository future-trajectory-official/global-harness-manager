import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import type { ExecuteResult } from "../shared/io/command.ts";
import type { Stage } from "../domain/types.ts";
import { statusRef } from "./field-registry.ts";
import { PlanGatewayAdapter } from "./plan-gateway-adapter.ts";

type Call = { cmd: string; args: string[] };
type Runner = (cmd: string, args: string[]) => Promise<ExecuteResult>;

const ok = (stdout: string): ExecuteResult => ({ code: 0, stdout, stderr: "" });

/**
 * Status 設定に必要な GraphQL / CLI 応答を返すスタブ。
 * boardOwner は user 所有を想定し、runProjectV2Query の user→organization 別名化を通す。
 */
function statusRunner(calls: Call[]): Runner {
  return (_cmd, args) => {
    calls.push({ cmd: _cmd, args });
    const query = args.find((a) => a.startsWith("query=")) ?? "";
    if (args[0] === "issue" && args[1] === "view") {
      return Promise.resolve(ok(JSON.stringify({ id: "I_issue1" })));
    }
    if (args[0] === "project" && args[1] === "item-edit") {
      return Promise.resolve(ok(""));
    }
    if (query.includes("addProjectV2ItemById")) {
      return Promise.resolve(
        ok(JSON.stringify({ data: { addProjectV2ItemById: { item: { id: "PVTI_1" } } } })),
      );
    }
    if (query.includes("field(name: $field)")) {
      return Promise.resolve(ok(JSON.stringify({
        data: {
          user: {
            projectV2: {
              field: {
                options: [
                  { id: "opt-todo", name: "Todo" },
                  { id: "opt-inprogress", name: "In Progress" },
                  { id: "opt-done", name: "Done" },
                ],
              },
            },
          },
        },
      })));
    }
    if (query.includes("$fieldName")) {
      return Promise.resolve(
        ok(JSON.stringify({
          data: { user: { projectV2: { field: { id: "PVTSSF_status" } } } },
        })),
      );
    }
    if (query.includes("projectV2(number: $number) { id }")) {
      return Promise.resolve(
        ok(JSON.stringify({ data: { user: { projectV2: { id: "PVT_10" } } } })),
      );
    }
    return Promise.resolve(ok(JSON.stringify({ data: {} })));
  };
}

function makeAdapter(runner: Runner): PlanGatewayAdapter {
  const adapter = new PlanGatewayAdapter(runner);
  adapter.setScope("my-org", "my-repo");
  adapter.setProjectBoardNumbers(10);
  adapter.setBoardOwner({ owner: "board-user", ownerType: "user" });
  return adapter;
}

function itemEditOptionId(calls: Call[]): string | undefined {
  const call = calls.find((c) => c.args[0] === "project" && c.args[1] === "item-edit");
  if (!call) return undefined;
  return call.args[call.args.indexOf("--single-select-option-id") + 1];
}

/**
 * ユースケース: Idea（発案）の PBI は Status 未設定（null）で表現する
 * 検証意図: stage="idea" では gh を一切呼ばず、Status を書き換えないこと
 */
Deno.test("setBoardStatus - idea skips all board writes (null status)", async () => {
  const calls: Call[] = [];
  const adapter = makeAdapter(statusRunner(calls));

  await adapter.setBoardStatus("42", statusRef("productBacklog"), "idea");

  assertEquals(calls, [], "idea must not issue any gh command (no Status write, no board add)");
});

/**
 * ユースケース: Todo / InProgress / Done の Status 反映
 * 検証意図: 各 stage が Project V2 の対応ラベルへ解決され、option ID が設定されること
 */
Deno.test("setBoardStatus - maps todo/inProgress/done to Project V2 labels", async () => {
  const cases: Array<{ stage: Stage; optionId: string }> = [
    { stage: "todo", optionId: "opt-todo" },
    { stage: "inProgress", optionId: "opt-inprogress" },
    { stage: "done", optionId: "opt-done" },
  ];

  for (const { stage, optionId } of cases) {
    const calls: Call[] = [];
    const adapter = makeAdapter(statusRunner(calls));

    await adapter.setBoardStatus("42", statusRef("productBacklog"), stage);

    assertEquals(itemEditOptionId(calls), optionId, `stage "${stage}" should map to ${optionId}`);
  }
});

/**
 * ユースケース: 未知の stage が渡された場合
 * 検証意図: 既存どおり警告のみで gh を呼ばないこと（Idea の no-op と区別できること）
 */
Deno.test("setBoardStatus - unknown stage warns without gh calls", async () => {
  const calls: Call[] = [];
  const adapter = makeAdapter(statusRunner(calls));
  const warnings: string[] = [];
  const originalWarn = console.warn;
  console.warn = (...values: unknown[]) => warnings.push(values.map(String).join(" "));
  try {
    await adapter.setBoardStatus("42", statusRef("productBacklog"), "backlog" as unknown as Stage);
  } finally {
    console.warn = originalWarn;
  }

  assertEquals(calls, [], "unknown stage must not issue gh commands");
  assert(warnings.some((w) => w.includes('Unknown stage "backlog"')), "unknown stage should warn");
  assertStringIncludes(warnings.join("\n"), "status update skipped");
  assert(
    !warnings.some((w) => w.includes('"Idea"')),
    "idea must not be treated as an unknown/invalid option",
  );
});
