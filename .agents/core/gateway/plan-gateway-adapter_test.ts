import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import type { ExecuteResult } from "../shared/io/command.ts";
import { PlanGatewayAdapter } from "./plan-gateway-adapter.ts";
import type { Plan } from "../domain/types.ts";

function mockRunner() {
  const calls: { cmd: string; args: string[] }[] = [];
  const runner = (cmd: string, args: string[]): Promise<ExecuteResult> => {
    calls.push({ cmd, args });
    return Promise.resolve({ code: 0, stdout: "", stderr: "" });
  };
  return { runner, calls };
}

function fixedRunner(stdout: string) {
  return (_cmd: string, _args: string[]): Promise<ExecuteResult> => {
    return Promise.resolve({ code: 0, stdout, stderr: "" });
  };
}

const OWNER = "my-org";
const REPO = "my-repo";

function makeAdapter(
  runner: ReturnType<typeof mockRunner>["runner"] = mockRunner().runner,
): PlanGatewayAdapter {
  const adapter = new PlanGatewayAdapter(runner);
  adapter.setScope(OWNER, REPO);
  return adapter;
}

/** ラップなしのPlanGatewayAdapter。Scope.resolveの直接テスト用。 */
function makeRawAdapter(
  runner: ReturnType<typeof mockRunner>["runner"] = mockRunner().runner,
): PlanGatewayAdapter {
  return new PlanGatewayAdapter(runner);
}

/**
 * Scope.resolve - 既知scopeが params に含まれる場合、そのままキャッシュされ gh が呼ばれないことを検証する。
 */
Deno.test("Scope.resolve - should store known scope without calling gh", async () => {
  const { runner, calls } = mockRunner();
  const adapter = makeRawAdapter(runner);
  const plan: Plan = {
    summary: "test",
    steps: [
      { entity: "Scope", operation: "resolve", params: { owner: "my-org", repository: "my-repo" } },
      { entity: "Vision", operation: "search", params: { labelType: "Vision" } },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 2);
  assertEquals(result.stepResults[0].success, true);
  // Scope.resolve with known scope should NOT trigger gh commands
  // Only the Vision.search step should trigger a gh call
  assertEquals(calls.length, 1);
  assertEquals(calls[0].cmd, "gh");
  assertStringIncludes(calls[0].args.join(" "), "--repo my-org/my-repo");
});

/**
 * Scope.resolve - unknown scope が params に含まれる場合、git remote + gh で解決されることを検証する。
 */
Deno.test("Scope.resolve - should resolve unknown scope via git + gh", async () => {
  let callCount = 0;
  const runner = (_cmd: string, _args: string[]): Promise<ExecuteResult> => {
    callCount++;
    if (callCount === 1) {
      return Promise.resolve({ code: 0, stdout: "git@github.com:my-org/my-repo.git", stderr: "" });
    }
    if (callCount === 2) {
      return Promise.resolve({ code: 0, stdout: "Logged in to gh as my-user ", stderr: "" });
    }
    if (callCount === 3) {
      return Promise.resolve({
        code: 0,
        stdout: JSON.stringify({ owner: { login: "my-org" }, name: "my-repo" }),
        stderr: "",
      });
    }
    if (callCount === 4) {
      return Promise.resolve({ code: 0, stdout: JSON.stringify([]), stderr: "" });
    }
    return Promise.resolve({ code: 0, stdout: "", stderr: "" });
  };
  const adapter = makeRawAdapter(runner);
  const plan: Plan = {
    summary: "test",
    steps: [
      {
        entity: "Scope",
        operation: "resolve",
        params: { owner: "unknown", repository: "unknown" },
      },
      { entity: "Vision", operation: "search", params: { labelType: "Vision" } },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 2);
  assertEquals(result.stepResults[0].success, true);
  // Verify the chain: git remote → gh auth status → gh repo view → [Vision search]
  assertEquals(callCount, 4);
});

/**
 * PlanGateway - execute が空の Plan.steps に対して空の ExecutionResult を返すことを検証する。
 * AC6: steps が空の場合、stepResults: [] を返しエラーにしない。
 */
Deno.test("PlanGateway - should return empty stepResults for empty plan steps", async () => {
  const adapter = makeAdapter();
  const plan: Plan = { summary: "empty", steps: [] };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults, []);
});

/**
 * PlanGateway - 未知の operation が success=false を返すことを検証する。
 * 未定義の operation は StepResult.success = false で error に operation 名を格納する。
 */
Deno.test("PlanGateway - should return error for unknown operation", async () => {
  const { runner } = mockRunner();
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "unknown operation",
    steps: [{ entity: "Vision", operation: "unknownOp" as never, params: {} }],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, false);
  assertEquals(result.stepResults[0].error, "No handler registered for Vision:unknownOp");
});

/**
 * PlanGateway - Vision create で title, body が正しく gh CLI 引数にマッピングされることを検証する。
 */
Deno.test("Vision create - should map full params to gh issue create args", async () => {
  const { runner, calls } = mockRunner();
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "test",
    steps: [
      {
        entity: "Vision",
        operation: "create",
        params: { title: "Test Vision", body: "body text" },
      },
    ],
  };
  await adapter.execute(plan);
  assertEquals(calls.length, 2);
  // call[0]: duplicate check search
  assertEquals(calls[0].cmd, "gh");
  assertStringIncludes(calls[0].args.join(" "), "issue list");
  assertStringIncludes(calls[0].args.join(" "), "--label type:Vision");
  // call[1]: actual create
  assertEquals(calls[1].cmd, "gh");
  assertEquals(calls[1].args[0], "issue");
  assertEquals(calls[1].args[1], "create");
  assertStringIncludes(calls[1].args.join(" "), "--title Test Vision");
  assertStringIncludes(calls[1].args.join(" "), "--body body text");
  assertStringIncludes(calls[1].args.join(" "), "--label type:Vision");
  assertStringIncludes(calls[1].args.join(" "), `--repo ${OWNER}/${REPO}`);
});

/**
 * PlanGateway - Vision create で空の title/body が空文字のまま渡されることを検証する。
 */
Deno.test("Vision create - should pass empty title and body as empty strings", async () => {
  const { runner, calls } = mockRunner();
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "test",
    steps: [
      { entity: "Vision", operation: "create", params: { title: "", body: "" } },
    ],
  };
  await adapter.execute(plan);
  assertEquals(calls.length, 2);
  // call[0]: duplicate check search (returns empty list)
  assertEquals(calls[0].cmd, "gh");
  assertStringIncludes(calls[0].args.join(" "), "issue list");
  // call[1]: actual create
  assertStringIncludes(calls[1].args.join(" "), "--title ");
  assertStringIncludes(calls[1].args.join(" "), "--body ");
});

/**
 * PlanGateway - Vision view で itemId が正しく gh issue view 引数にマッピングされ、
 * 出力が正しくパースされることを検証する。
 */
Deno.test("Vision view - should map itemId to gh issue view args", async () => {
  const expectedOutput = JSON.stringify({
    number: 42,
    title: "Found Vision",
    body: "body",
    labels: [{ name: "type:Vision" }],
    id: "node-abc",
  });
  const findAdapter = makeAdapter(fixedRunner(expectedOutput));
  const plan: Plan = {
    summary: "test",
    steps: [
      { entity: "Vision", operation: "view", params: { itemId: "42" } },
    ],
  };
  const result = await findAdapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
  assertEquals(result.stepResults[0].itemId, "42");
});

/**
 * PlanGateway - Vision view が itemId なしでエラーを返すことを検証する。
 */
Deno.test("Vision view - should fail without itemId", async () => {
  const { runner } = mockRunner();
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "test",
    steps: [
      { entity: "Vision", operation: "view", params: {} },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "itemId is required");
});

/**
 * PlanGateway - Vision comment で itemId と body が正しく gh issue comment 引数にマッピングされることを検証する。
 */
Deno.test("Vision comment - should map itemId and body to gh issue comment args", async () => {
  const { runner, calls } = mockRunner();
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "test",
    steps: [
      { entity: "Vision", operation: "comment", params: { itemId: "42", body: "comment text" } },
    ],
  };
  await adapter.execute(plan);
  assertEquals(calls.length, 1);
  assertEquals(calls[0].cmd, "gh");
  assertEquals(calls[0].args[0], "issue");
  assertEquals(calls[0].args[1], "comment");
  assertEquals(calls[0].args[2], "42");
  assertStringIncludes(calls[0].args.join(" "), "--body comment text");
});

/**
 * PlanGateway - Vision create + comment で create の結果から itemId が継承されることを検証する。
 * Step 連鎖: create で生成された itemId が comment で暗黙的に使用される。
 */
Deno.test("Vision create+comment - should inherit itemId from previous create step", async () => {
  let callCount = 0;
  const chainedRunner = (_cmd: string, _args: string[]): Promise<ExecuteResult> => {
    callCount++;
    // call 1: duplicate check search (returns empty - no existing Vision)
    if (callCount === 1) {
      return Promise.resolve({ code: 0, stdout: "[]", stderr: "" });
    }
    // call 2: handleCreateItem → gh issue create
    if (callCount === 2) {
      return Promise.resolve({
        code: 0,
        stdout: `https://github.com/${OWNER}/${REPO}/issues/99`,
        stderr: "",
      });
    }
    // call 3: nodeId fetch inside handleCreateItem
    if (callCount === 3) {
      return Promise.resolve({ code: 0, stdout: JSON.stringify({ id: "node-99" }), stderr: "" });
    }
    // call 4: handleAddComment
    return Promise.resolve({ code: 0, stdout: "", stderr: "" });
  };
  const adapter = makeAdapter(chainedRunner);
  const plan: Plan = {
    summary: "create then comment",
    steps: [
      { entity: "Vision", operation: "create", params: { title: "V", body: "b" } },
      { entity: "Vision", operation: "comment", params: { body: "comment" } },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 2);
  assertEquals(result.stepResults[0].success, true);
  assertEquals(result.stepResults[0].itemId, "99");
  assertEquals(result.stepResults[1].success, true);
  assertEquals(result.stepResults[1].itemId, "99");
});

/**
 * PlanGateway - Vision comment がコンテキストなしでエラーを返すことを検証する。
 * itemId も lastItemId もない場合、エラーメッセージを返す。
 */
Deno.test("Vision comment - should fail without any context", async () => {
  const { runner } = mockRunner();
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "test",
    steps: [
      { entity: "Vision", operation: "comment", params: { body: "orphan comment" } },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "No target issue specified");
});

/**
 * PlanGateway - Vision search で labelType が正しく gh issue list 引数にマッピングされ、
 * パースされた結果が返ることを検証する。
 */
Deno.test("Vision search - should map labelType to gh issue list args", async () => {
  const expectedOutput = JSON.stringify([
    { number: 42, title: "Existing Vision", labels: [{ name: "type:Vision" }] },
  ]);
  const searchAdapter = makeAdapter(fixedRunner(expectedOutput));
  const plan: Plan = {
    summary: "test",
    steps: [
      { entity: "Vision", operation: "search", params: { labelType: "Vision" } },
    ],
  };
  const result = await searchAdapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
  const output = result.stepResults[0].output as Array<Record<string, unknown>>;
  assertEquals(output.length, 1);
  assertEquals(output[0].number, 42);
});

/**
 * PlanGateway - Vision search が labelType なしでエラーを返すことを検証する。
 */
Deno.test("Vision search - should fail without labelType", async () => {
  const { runner } = mockRunner();
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "test",
    steps: [
      { entity: "Vision", operation: "search", params: {} },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "type is required");
});

/**
 * Assess-Alignment WP_1: AC-1
 * Vision update - title only. params.title のみ指定 → gh issue edit --title が呼ばれる。
 */
Deno.test("Vision update - title only should call gh issue edit with --title", async () => {
  const { runner, calls } = mockRunner();
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "update title only",
    steps: [
      { entity: "Vision", operation: "update", params: { itemId: "42", title: "New Title" } },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
  assertEquals(calls.length, 1);
  assertEquals(calls[0].cmd, "gh");
  assertEquals(calls[0].args[0], "issue");
  assertEquals(calls[0].args[1], "edit");
  assertEquals(calls[0].args[2], "42");
  assertStringIncludes(calls[0].args.join(" "), "--title New Title");
});

/**
 * Assess-Alignment WP_1: AC-2
 * Vision update - bodyAppend only. 既存 Body を取得し追記した上で gh issue edit --body が呼ばれる。
 */
Deno.test("Vision update - bodyAppend only should fetch body then edit with appended body", async () => {
  let callCount = 0;
  const chainedRunner = (_cmd: string, _args: string[]): Promise<ExecuteResult> => {
    callCount++;
    if (callCount === 1) {
      return Promise.resolve({
        code: 0,
        stdout: JSON.stringify({ body: "Existing body content" }),
        stderr: "",
      });
    }
    return Promise.resolve({ code: 0, stdout: "", stderr: "" });
  };
  const adapter = makeAdapter(chainedRunner);
  const plan: Plan = {
    summary: "append body",
    steps: [
      {
        entity: "Vision",
        operation: "update",
        params: { itemId: "42", bodyAppend: "Appended text" },
      },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
  assertEquals(callCount, 2);
  // 2回目の呼出が gh issue edit --body のはず
  // モックでは全呼出が同じrunnerを通るので、
  // 少なくとも2回Callされたことと成功を確認
});

/**
 * Assess-Alignment WP_1: AC-3
 * Vision update - title + bodyAppend. 両方指定 → 正しくマージされる。
 */
Deno.test("Vision update - title and bodyAppend should set both", async () => {
  let callCount = 0;
  const chainedRunner = (_cmd: string, _args: string[]): Promise<ExecuteResult> => {
    callCount++;
    if (callCount === 1) {
      return Promise.resolve({
        code: 0,
        stdout: JSON.stringify({ body: "Existing" }),
        stderr: "",
      });
    }
    return Promise.resolve({ code: 0, stdout: "", stderr: "" });
  };
  const adapter = makeAdapter(chainedRunner);
  const plan: Plan = {
    summary: "title and append",
    steps: [
      {
        entity: "Vision",
        operation: "update",
        params: { itemId: "42", title: "New Title", bodyAppend: "Appended" },
      },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
  assertEquals(callCount, 2);
});

// ======== Review Operation Tests ========

Deno.test("Review plan - milestone string should map to gh issue create --milestone", async () => {
  const { runner, calls } = mockRunner();
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "test",
    steps: [
      {
        entity: "Review",
        operation: "plan",
        params: { title: "Sprint 15 Review", body: "body", sprint: "15" },
      },
    ],
  };
  await adapter.execute(plan);
  assert(calls.length >= 1);
  assertStringIncludes(calls[0].args.join(" "), "issue create");
  assertStringIncludes(calls[0].args.join(" "), "--milestone 15");
  assertStringIncludes(calls[0].args.join(" "), "--label type:Review");
});

Deno.test("Review plan - milestone SprintIdentifier should map to --milestone", async () => {
  const { runner, calls } = mockRunner();
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "test",
    steps: [
      {
        entity: "Review",
        operation: "plan",
        params: {
          title: "Sprint 15 Review",
          body: "body",
          sprint: { title: { value: "Sprint 15" } },
        },
      },
    ],
  };
  await adapter.execute(plan);
  assert(calls.length >= 1);
  assertStringIncludes(calls[0].args.join(" "), "--milestone Sprint 15");
});

Deno.test("Review plan - should work without milestone", async () => {
  const { runner, calls } = mockRunner();
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "test",
    steps: [
      {
        entity: "Review",
        operation: "plan",
        params: { title: "Review", body: "body" },
      },
    ],
  };
  await adapter.execute(plan);
  assert(calls.length >= 1);
  assertStringIncludes(calls[0].args.join(" "), "issue create");
  assertStringIncludes(calls[0].args.join(" "), "--label type:Review");
});

Deno.test("Review report - should call gh issue edit", async () => {
  const runner = fixedRunner(JSON.stringify({ body: "existing body" }));
  const calls: { cmd: string; args: string[] }[] = [];
  const trackingRunner = (cmd: string, args: string[]): Promise<ExecuteResult> => {
    calls.push({ cmd, args });
    return runner(cmd, args);
  };
  const adapter = makeAdapter(trackingRunner);
  const plan: Plan = {
    summary: "test",
    steps: [
      {
        entity: "Review",
        operation: "report",
        params: { itemId: "42", body: "report body" },
      },
    ],
  };
  await adapter.execute(plan);
  assertEquals(calls.length, 2);
  assertEquals(calls[0].cmd, "gh");
  assertEquals(calls[0].args[0], "issue");
  assertEquals(calls[0].args[1], "view");
  assertEquals(calls[1].cmd, "gh");
  assertEquals(calls[1].args[0], "issue");
  assertEquals(calls[1].args[1], "edit");
  assertEquals(calls[1].args[2], "42");
  assertStringIncludes(calls[1].args.join(" "), "--body");
});

Deno.test("Review archive - should call gh issue close", async () => {
  const { runner, calls } = mockRunner();
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "test",
    steps: [
      {
        entity: "Review",
        operation: "archive",
        params: { itemId: "42" },
      },
    ],
  };
  await adapter.execute(plan);
  assertEquals(calls.length, 1);
  assertEquals(calls[0].cmd, "gh");
  assertEquals(calls[0].args[0], "issue");
  assertEquals(calls[0].args[1], "close");
  assertEquals(calls[0].args[2], "42");
});

Deno.test("Review archive - should fail without itemId", async () => {
  const { runner } = mockRunner();
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "test",
    steps: [
      { entity: "Review", operation: "archive", params: {} },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "itemId is required");
});

Deno.test("Review view - should call gh issue view", async () => {
  const expected = JSON.stringify({
    number: 42,
    title: "Review",
    body: "body",
    labels: [{ name: "type:Review" }],
    id: "node-abc",
  });
  const adapter = makeAdapter(fixedRunner(expected));
  const plan: Plan = {
    summary: "test",
    steps: [
      { entity: "Review", operation: "view", params: { itemId: "42" } },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults[0].success, true);
  assertEquals(result.stepResults[0].itemId, "42");
});

Deno.test("Review search - should call gh issue list", async () => {
  const expected = JSON.stringify([
    { number: 42, title: "Existing Review", labels: [{ name: "type:Review" }] },
  ]);
  const adapter = makeAdapter(fixedRunner(expected));
  const plan: Plan = {
    summary: "test",
    steps: [
      { entity: "Review", operation: "search", params: { labelType: "Review" } },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults[0].success, true);
  const output = result.stepResults[0].output as Array<Record<string, unknown>>;
  assertEquals(output.length, 1);
  assertEquals(output[0].number, 42);
});

Deno.test("Review update with title - should call gh issue edit", async () => {
  const runner = fixedRunner(JSON.stringify({ body: "existing body" }));
  const calls: { cmd: string; args: string[] }[] = [];
  const trackingRunner = (cmd: string, args: string[]): Promise<ExecuteResult> => {
    calls.push({ cmd, args });
    return runner(cmd, args);
  };
  const adapter = makeAdapter(trackingRunner);
  const plan: Plan = {
    summary: "test",
    steps: [
      {
        entity: "Review",
        operation: "update",
        params: { itemId: "42", title: "Updated Title", body: "Updated body" },
      },
    ],
  };
  await adapter.execute(plan);
  assertEquals(calls.length, 2);
  assertEquals(calls[0].cmd, "gh");
  assertEquals(calls[0].args[0], "issue");
  assertEquals(calls[0].args[1], "view");
  assertEquals(calls[1].cmd, "gh");
  assertEquals(calls[1].args[0], "issue");
  assertEquals(calls[1].args[1], "edit");
  assertEquals(calls[1].args[2], "42");
  assertStringIncludes(calls[1].args.join(" "), "--title Updated Title");
  assertStringIncludes(calls[1].args.join(" "), "--body");
});

Deno.test("Review update without title - should add comment", async () => {
  const { runner, calls } = mockRunner();
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "test",
    steps: [
      {
        entity: "Review",
        operation: "update",
        params: { itemId: "42", body: "comment text" },
      },
    ],
  };
  await adapter.execute(plan);
  assertEquals(calls.length, 1);
  assertEquals(calls[0].cmd, "gh");
  assertEquals(calls[0].args[0], "issue");
  assertEquals(calls[0].args[1], "comment");
  assertEquals(calls[0].args[2], "42");
  assertStringIncludes(calls[0].args.join(" "), "--body comment text");
});

Deno.test("Review plan+update - should inherit itemId for comment", async () => {
  let callCount = 0;
  const chainedRunner = (_cmd: string, _args: string[]): Promise<ExecuteResult> => {
    callCount++;
    if (callCount === 1) {
      return Promise.resolve({
        code: 0,
        stdout: `https://github.com/${OWNER}/${REPO}/issues/99`,
        stderr: "",
      });
    }
    if (callCount === 2) {
      return Promise.resolve({ code: 0, stdout: JSON.stringify({ id: "node-99" }), stderr: "" });
    }
    return Promise.resolve({ code: 0, stdout: "", stderr: "" });
  };
  const adapter = makeAdapter(chainedRunner);
  const plan: Plan = {
    summary: "plan then comment",
    steps: [
      { entity: "Review", operation: "plan", params: { title: "Sprint Review", body: "body" } },
      { entity: "Review", operation: "update", params: { body: "comment" } },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 2);
  assertEquals(result.stepResults[0].success, true);
  assertEquals(result.stepResults[0].itemId, "99");
  assertEquals(result.stepResults[1].success, true);
  assertEquals(result.stepResults[1].itemId, "99");
});

Deno.test("Review - should return error for unknown operation", async () => {
  const { runner } = mockRunner();
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "unknown op",
    steps: [
      { entity: "Review", operation: "unknownOp" as never, params: {} },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "No handler registered");
});

// ======== ProductGoal Operation Tests ========

/**
 * ProductGoal create - 重複チェック（search）→ create の順でgh CLIが呼ばれることを検証する。
 * 正常系: 既存ProductGoalがない場合、gh issue list で空リストが返り、続けて gh issue create が実行される。
 */
Deno.test("ProductGoal create - should check duplicate then create", async () => {
  const { runner, calls } = mockRunner();
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "test",
    steps: [
      {
        entity: "ProductGoal",
        operation: "create",
        params: { title: "Product Goal", body: "body text" },
      },
    ],
  };
  await adapter.execute(plan);
  assertEquals(calls.length, 2);
  assertEquals(calls[0].cmd, "gh");
  assertStringIncludes(calls[0].args.join(" "), "issue list");
  assertStringIncludes(calls[0].args.join(" "), "--label type:ProductGoal");
  assertEquals(calls[1].cmd, "gh");
  assertEquals(calls[1].args[0], "issue");
  assertEquals(calls[1].args[1], "create");
  assertStringIncludes(calls[1].args.join(" "), "--title Product Goal");
  assertStringIncludes(calls[1].args.join(" "), "--label type:ProductGoal");
});

/**
 * ProductGoal create - 既存ProductGoalが存在する場合にエラーが返ることを検証する。
 * 異常系: searchで既存Issueがヒットした場合、success=false とエラーメッセージを返し create は実行されない。
 */
Deno.test("ProductGoal create with existing - should return error", async () => {
  const runner = (_cmd: string, _args: string[]): Promise<ExecuteResult> => {
    return Promise.resolve({
      code: 0,
      stdout: JSON.stringify([{ number: 1, title: "Existing", labels: [] }]),
      stderr: "",
    });
  };
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "test",
    steps: [
      {
        entity: "ProductGoal",
        operation: "create",
        params: { title: "Dupe", body: "body" },
      },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "already exists");
  assertStringIncludes(result.stepResults[0].error ?? "", "Issue #1");
});

/**
 * ProductGoal view - 指定されたIssue番号の詳細を gh issue view で取得できることを検証する。
 * 正常系: itemId を引数に gh issue view --json が呼ばれ、パースされた結果が返る。
 */
Deno.test("ProductGoal view - should call gh issue view", async () => {
  const expectedOutput = JSON.stringify({
    number: 42,
    title: "Product Goal",
    body: "body",
    labels: [{ name: "type:ProductGoal" }],
    id: "node-abc",
  });
  const adapter = makeAdapter(fixedRunner(expectedOutput));
  const plan: Plan = {
    summary: "test",
    steps: [
      { entity: "ProductGoal", operation: "view", params: { itemId: "42" } },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
  assertEquals(result.stepResults[0].itemId, "42");
});

/**
 * ProductGoal view - itemId が未指定の場合にエラーが返ることを検証する。
 * 異常系: params に itemId がない場合、success=false と error メッセージを返す。
 */
Deno.test("ProductGoal view - should fail without itemId", async () => {
  const { runner } = mockRunner();
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "test",
    steps: [
      { entity: "ProductGoal", operation: "view", params: {} },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "itemId is required");
});

/**
 * ProductGoal comment - 指定されたIssueにコメントを追加する gh issue comment が呼ばれることを検証する。
 * 正常系: itemId と body が正しくgh CLI引数にマッピングされる。
 */
Deno.test("ProductGoal comment - should map itemId and body to gh issue comment args", async () => {
  const { runner, calls } = mockRunner();
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "test",
    steps: [
      {
        entity: "ProductGoal",
        operation: "comment",
        params: { itemId: "42", body: "comment text" },
      },
    ],
  };
  await adapter.execute(plan);
  assertEquals(calls.length, 1);
  assertEquals(calls[0].cmd, "gh");
  assertEquals(calls[0].args[0], "issue");
  assertEquals(calls[0].args[1], "comment");
  assertEquals(calls[0].args[2], "42");
  assertStringIncludes(calls[0].args.join(" "), "--body comment text");
});

/**
 * ProductGoal create+comment - create で生成された itemId が後続の comment に暗黙的に継承されることを検証する。
 * Step連鎖: 前Stepの作成結果（itemId=99）が次Stepの lastItemId として渡され、commentが正しく動作する。
 */
Deno.test("ProductGoal create+comment - should inherit itemId from previous create step", async () => {
  let callCount = 0;
  const chainedRunner = (_cmd: string, _args: string[]): Promise<ExecuteResult> => {
    callCount++;
    if (callCount === 1) {
      return Promise.resolve({ code: 0, stdout: "[]", stderr: "" });
    }
    if (callCount === 2) {
      return Promise.resolve({
        code: 0,
        stdout: `https://github.com/${OWNER}/${REPO}/issues/99`,
        stderr: "",
      });
    }
    if (callCount === 3) {
      return Promise.resolve({ code: 0, stdout: JSON.stringify({ id: "node-99" }), stderr: "" });
    }
    return Promise.resolve({ code: 0, stdout: "", stderr: "" });
  };
  const adapter = makeAdapter(chainedRunner);
  const plan: Plan = {
    summary: "create then comment",
    steps: [
      { entity: "ProductGoal", operation: "create", params: { title: "PG", body: "b" } },
      { entity: "ProductGoal", operation: "comment", params: { body: "comment" } },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 2);
  assertEquals(result.stepResults[0].success, true);
  assertEquals(result.stepResults[0].itemId, "99");
  assertEquals(result.stepResults[1].success, true);
  assertEquals(result.stepResults[1].itemId, "99");
});

/**
 * ProductGoal comment - itemId も直前のコンテキストもない場合にエラーが返ることを検証する。
 * 異常系: create が先行せず、paramsにも itemId がない孤立したcomment操作は失敗する。
 */
Deno.test("ProductGoal comment - should fail without any context", async () => {
  const { runner } = mockRunner();
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "test",
    steps: [
      { entity: "ProductGoal", operation: "comment", params: { body: "orphan comment" } },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "No target issue specified");
});

/**
 * ProductGoal search - labelType を指定して gh issue list で検索できることを検証する。
 * 正常系: --label type:ProductGoal でフィルタされ、結果が正しくパースされる。
 */
Deno.test("ProductGoal search - should map labelType to gh issue list args", async () => {
  const expectedOutput = JSON.stringify([
    { number: 42, title: "Existing ProductGoal", labels: [{ name: "type:ProductGoal" }] },
  ]);
  const adapter = makeAdapter(fixedRunner(expectedOutput));
  const plan: Plan = {
    summary: "test",
    steps: [
      { entity: "ProductGoal", operation: "search", params: { labelType: "ProductGoal" } },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
  const output = result.stepResults[0].output as Array<Record<string, unknown>>;
  assertEquals(output.length, 1);
  assertEquals(output[0].number, 42);
});

/**
 * ProductGoal search - labelType が未指定の場合にエラーが返ることを検証する。
 * 異常系: params に type/labelType がない場合、success=false とエラーメッセージを返す。
 */
Deno.test("ProductGoal search - should fail without labelType", async () => {
  const { runner } = mockRunner();
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "test",
    steps: [
      { entity: "ProductGoal", operation: "search", params: {} },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "type is required");
});

/**
 * ProductGoal update - pivot操作で gh issue edit --title が呼ばれることを検証する。
 * 正常系: ProductGoalUseCase.pivot が生成する update Step が正しくルーティングされる。
 */
Deno.test("ProductGoal update - should map pivot operation to gh issue edit", async () => {
  const { runner, calls } = mockRunner();
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "pivot",
    steps: [
      { entity: "ProductGoal", operation: "update", params: { itemId: "42", title: "New Title" } },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
  assertEquals(calls.length, 1);
  assertEquals(calls[0].cmd, "gh");
  assertEquals(calls[0].args[0], "issue");
  assertEquals(calls[0].args[1], "edit");
  assertEquals(calls[0].args[2], "42");
  assertStringIncludes(calls[0].args.join(" "), "--title New Title");
});

/**
 * ProductGoal update - bodyAppend が既存本文を取得し追記する2段階の処理になることを検証する。
 * 正常系: bodyAppend 指定時は gh issue view → gh issue edit --body の順で2回ghが呼ばれる。
 */
Deno.test("ProductGoal update - bodyAppend should fetch body then edit", async () => {
  let callCount = 0;
  const chainedRunner = (_cmd: string, _args: string[]): Promise<ExecuteResult> => {
    callCount++;
    if (callCount === 1) {
      return Promise.resolve({
        code: 0,
        stdout: JSON.stringify({ body: "Existing body content" }),
        stderr: "",
      });
    }
    return Promise.resolve({ code: 0, stdout: "", stderr: "" });
  };
  const adapter = makeAdapter(chainedRunner);
  const plan: Plan = {
    summary: "append body",
    steps: [
      {
        entity: "ProductGoal",
        operation: "update",
        params: { itemId: "42", bodyAppend: "Appended text" },
      },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
  assertEquals(callCount, 2);
});

/**
 * ProductGoal - 未登録の操作に対してエラーが返ることを検証する。
 * 異常系: StepOperation に存在しない操作は success=false となる。
 */
Deno.test("ProductGoal - should return error for unknown operation", async () => {
  const { runner } = mockRunner();
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "unknown op",
    steps: [
      { entity: "ProductGoal", operation: "unknownOp" as never, params: {} },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "No handler registered");
});

// ======== Sprint Additional Tests (Review Findings) ========

/**
 * Sprint create - 空titleでエラーを返すことを検証する。
 */
Deno.test("Sprint create - should fail without title", async () => {
  const { runner } = mockRunner();
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "start sprint",
    steps: [
      { entity: "Sprint", operation: "create", params: { title: "", description: "desc" } },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "title is required");
});

// ======== Sprint search (findLatestOpen) Tests ========

/**
 * Sprint search - gh api milestones?state=open が呼ばれ、最新マイルストーンのitemIdが返ることを検証する。
 */
Deno.test("Sprint search - should call gh api milestones and return latest itemId", async () => {
  const milestones = [
    { number: 17, title: "Sprint 18", state: "open" },
    { number: 15, title: "Sprint 17", state: "open" },
  ];
  const adapter = makeAdapter(fixedRunner(JSON.stringify(milestones)));
  const plan: Plan = {
    summary: "find latest sprint",
    steps: [
      { entity: "Sprint", operation: "search", params: { state: "open" } },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
});

// ======== ProductBacklogItem Handler Tests ========

Deno.test("ProductBacklogItem propose - should create issue with type:PBI label", async () => {
  let callCount = 0;
  const calls: { cmd: string; args: string[] }[] = [];
  const chainedRunner = (_cmd: string, _args: string[]): Promise<ExecuteResult> => {
    callCount++;
    calls.push({ cmd: _cmd, args: _args });
    if (callCount === 1) {
      return Promise.resolve({
        code: 0,
        stdout: "https://github.com/my-org/my-repo/issues/50",
        stderr: "",
      });
    }
    return Promise.resolve({ code: 0, stdout: JSON.stringify({ id: "node-pbi-50" }), stderr: "" });
  };
  const adapter = makeAdapter(chainedRunner);
  const plan: Plan = {
    summary: "propose PBI",
    steps: [
      {
        entity: "ProductBacklogItem",
        operation: "propose",
        params: { title: "Test PBI", body: "## Summary\nTest" },
      },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
  assertEquals(calls.length, 2);
  assertStringIncludes(calls[0].args.join(" "), "issue create");
  assertStringIncludes(calls[0].args.join(" "), `--title Test PBI`);
  assertStringIncludes(calls[0].args.join(" "), `--label type:PBI`);
  assertStringIncludes(calls[0].args.join(" "), `--repo ${OWNER}/${REPO}`);
});

Deno.test("ProductBacklogItem propose - with parentFeature should create parent-child relationship", async () => {
  let callCount = 0;
  const responses: Record<number, ExecuteResult> = {
    1: { code: 0, stdout: "https://github.com/my-org/my-repo/issues/50", stderr: "" },
    2: { code: 0, stdout: JSON.stringify({ id: "node-pbi-50" }), stderr: "" },
    3: { code: 0, stdout: JSON.stringify({ id: "node-feature-10" }), stderr: "" },
    4: { code: 0, stdout: JSON.stringify({ id: "node-pbi-50" }), stderr: "" },
    5: {
      code: 0,
      stdout: JSON.stringify({ data: { addSubIssue: { issue: { id: "node-feature-10" } } } }),
      stderr: "",
    },
  };
  const chainedRunner = (_cmd: string, _args: string[]): Promise<ExecuteResult> => {
    callCount++;
    return Promise.resolve(responses[callCount] ?? { code: 0, stdout: "", stderr: "" });
  };
  const adapter = makeAdapter(chainedRunner);
  const plan: Plan = {
    summary: "propose with feature",
    steps: [
      {
        entity: "ProductBacklogItem",
        operation: "propose",
        params: { title: "With Feature", body: "body", parentFeature: "10" },
      },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
  // create + view nodeId + view parent(json:id) + view item(json:id) + graphql
  assertEquals(callCount, 5);
});

Deno.test("ProductBacklogItem commit - should set milestone", async () => {
  const { runner, calls } = mockRunner();
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "commit PBI",
    steps: [
      {
        entity: "ProductBacklogItem",
        operation: "commit",
        params: { itemId: "42", sprint: "Sprint 19" },
      },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
  assertEquals(calls.length, 1);
  assertStringIncludes(calls[0].args.join(" "), "issue edit 42");
  assertStringIncludes(calls[0].args.join(" "), "--milestone Sprint 19");
});

Deno.test("ProductBacklogItem commit - should fail without itemId", async () => {
  const adapter = makeAdapter();
  const plan: Plan = {
    summary: "commit without id",
    steps: [
      {
        entity: "ProductBacklogItem",
        operation: "commit",
        params: { sprint: "Sprint 19" },
      },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "itemId is required");
});

Deno.test("ProductBacklogItem estimateSize - should succeed with valid itemId", async () => {
  const adapter = makeAdapter();
  const plan: Plan = {
    summary: "estimate size",
    steps: [
      {
        entity: "ProductBacklogItem",
        operation: "estimateSize",
        params: { itemId: "42", sizeEstimate: "M" },
      },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
});

Deno.test("ProductBacklogItem estimateSize - should fail without itemId", async () => {
  const adapter = makeAdapter();
  const plan: Plan = {
    summary: "estimate size no id",
    steps: [
      {
        entity: "ProductBacklogItem",
        operation: "estimateSize",
        params: { sizeEstimate: "M" },
      },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "itemId is required");
});

Deno.test("ProductBacklogItem start - should succeed with valid itemId", async () => {
  const adapter = makeAdapter();
  const plan: Plan = {
    summary: "start PBI",
    steps: [
      {
        entity: "ProductBacklogItem",
        operation: "start",
        params: { itemId: "42" },
      },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
});

Deno.test("ProductBacklogItem complete - should succeed with valid itemId", async () => {
  const adapter = makeAdapter();
  const plan: Plan = {
    summary: "complete PBI",
    steps: [
      {
        entity: "ProductBacklogItem",
        operation: "complete",
        params: { itemId: "42" },
      },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
});

Deno.test("ProductBacklogItem archive - should close the issue", async () => {
  const { runner, calls } = mockRunner();
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "archive PBI",
    steps: [
      {
        entity: "ProductBacklogItem",
        operation: "archive",
        params: { itemId: "42" },
      },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
  assertEquals(calls.length, 1);
  assertStringIncludes(calls[0].args.join(" "), "issue close 42");
});

Deno.test("ProductBacklogItem view - should return issue details with parent/milestone", async () => {
  let callCount = 0;
  const calls: { cmd: string; args: string[] }[] = [];
  const adapter = makeAdapter((cmd, args) => {
    callCount++;
    calls.push({ cmd, args });
    if (callCount === 1) {
      return Promise.resolve({
        code: 0,
        stdout: JSON.stringify({
          number: 42,
          title: "Test PBI",
          body: "body",
          labels: [{ name: "type:PBI" }],
          id: "node-abc",
        }),
        stderr: "",
      });
    }
    return Promise.resolve({
      code: 0,
      stdout: JSON.stringify({
        data: {
          repository: {
            issue: {
              parent: { number: 10, title: "Feature", id: "node-feat" },
              milestone: { number: 25, title: "Sprint 25" },
              subIssues: { nodes: [{ number: 11, title: "Child WP", id: "node-wp" }] },
            },
          },
        },
      }),
      stderr: "",
    });
  });
  const plan: Plan = {
    summary: "view PBI",
    steps: [
      {
        entity: "ProductBacklogItem",
        operation: "view",
        params: { itemId: "42" },
      },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
  assertEquals(calls.length, 2);
  assertStringIncludes(calls[0].args.join(" "), "issue view 42");
  assertStringIncludes(calls[1].args.join(" "), "api graphql");
  const output = result.stepResults[0].output as Record<string, unknown>;
  const parent = output.parent as Record<string, unknown>;
  assertEquals(parent.code as string, "10");
  assertEquals((parent.title as Record<string, unknown>).value, "Feature");
  const children = output.children as Array<Record<string, unknown>>;
  assertEquals(children.length, 1);
  assertEquals(children[0].code as string, "11");
});

// ======== Missing validation tests (review fix) ========

Deno.test("ProductBacklogItem start - should fail without itemId", async () => {
  const adapter = makeAdapter();
  const plan: Plan = {
    summary: "start without itemId",
    steps: [{ entity: "ProductBacklogItem", operation: "start", params: {} }],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "itemId is required");
});

Deno.test("ProductBacklogItem complete - should fail without itemId", async () => {
  const adapter = makeAdapter();
  const plan: Plan = {
    summary: "complete without itemId",
    steps: [{ entity: "ProductBacklogItem", operation: "complete", params: {} }],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "itemId is required");
});

Deno.test("ProductBacklogItem archive - should fail without itemId", async () => {
  const adapter = makeAdapter();
  const plan: Plan = {
    summary: "archive without itemId",
    steps: [{ entity: "ProductBacklogItem", operation: "archive", params: {} }],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "itemId is required");
});

Deno.test("ProductBacklogItem view - should fail without itemId", async () => {
  const adapter = makeAdapter();
  const plan: Plan = {
    summary: "view without itemId",
    steps: [{ entity: "ProductBacklogItem", operation: "view", params: {} }],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "itemId is required");
});

Deno.test("WorkPackage start - should fail without itemId", async () => {
  const adapter = makeAdapter();
  const plan: Plan = {
    summary: "WP start without itemId",
    steps: [{ entity: "WorkPackage", operation: "start", params: {} }],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "itemId is required");
});

Deno.test("WorkPackage complete - should fail without itemId", async () => {
  const adapter = makeAdapter();
  const plan: Plan = {
    summary: "WP complete without itemId",
    steps: [{ entity: "WorkPackage", operation: "complete", params: {} }],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "itemId is required");
});

Deno.test("WorkPackage archive - should fail without itemId", async () => {
  const adapter = makeAdapter();
  const plan: Plan = {
    summary: "WP archive without itemId",
    steps: [{ entity: "WorkPackage", operation: "archive", params: {} }],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "itemId is required");
});

Deno.test("WorkPackage commit - should fail without itemId", async () => {
  const adapter = makeAdapter();
  const plan: Plan = {
    summary: "WP commit without itemId",
    steps: [{ entity: "WorkPackage", operation: "commit", params: { sprint: "Sprint 19" } }],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "itemId is required");
});

// ======== Error Handling Tests (AC-8, AC-9) ========

Deno.test("ProductBacklogItem propose - should handle network error (AC-8)", async () => {
  const errorRunner = (_cmd: string, _args: string[]): Promise<ExecuteResult> => {
    return Promise.resolve({ code: 1, stdout: "", stderr: "connection refused" });
  };
  const adapter = makeAdapter(errorRunner);
  const plan: Plan = {
    summary: "propose PBI with network error",
    steps: [
      {
        entity: "ProductBacklogItem",
        operation: "propose",
        params: { title: "Test", body: "body" },
      },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, false);
  assertEquals(result.stepResults[0].error, "connection refused");
});

Deno.test("ProductBacklogItem commit - should handle gh api error (AC-8)", async () => {
  const errorRunner = (_cmd: string, _args: string[]): Promise<ExecuteResult> => {
    return Promise.resolve({ code: 1, stdout: "", stderr: "rate limit exceeded" });
  };
  const adapter = makeAdapter(errorRunner);
  const plan: Plan = {
    summary: "commit with api error",
    steps: [
      {
        entity: "ProductBacklogItem",
        operation: "commit",
        params: { itemId: "42", sprint: "Sprint 19" },
      },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "rate limit exceeded");
});

Deno.test("WorkPackage define - should handle network error during create (AC-8)", async () => {
  const errorRunner = (_cmd: string, _args: string[]): Promise<ExecuteResult> => {
    return Promise.resolve({ code: 1, stdout: "", stderr: "connection timeout" });
  };
  const adapter = makeAdapter(errorRunner);
  const plan: Plan = {
    summary: "define WP with network error",
    steps: [
      {
        entity: "WorkPackage",
        operation: "define",
        params: { title: "WP_1", parentPbi: "42", body: "body" },
      },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, false);
});

Deno.test("ProductBacklogItem view - should handle nonexistent resource (AC-9)", async () => {
  const errorRunner = (_cmd: string, _args: string[]): Promise<ExecuteResult> => {
    return Promise.resolve({ code: 1, stdout: "", stderr: "GraphQL: Not Found" });
  };
  const adapter = makeAdapter(errorRunner);
  const plan: Plan = {
    summary: "view nonexistent PBI",
    steps: [
      {
        entity: "ProductBacklogItem",
        operation: "view",
        params: { itemId: "99999" },
      },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "Not Found");
});

Deno.test("WorkPackage start - should handle nonexistent resource (AC-9)", async () => {
  const adapter = makeAdapter();
  const plan: Plan = {
    summary: "start WP without itemId",
    steps: [
      {
        entity: "WorkPackage",
        operation: "start",
        params: {},
      },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "itemId is required");
});

Deno.test("ProductBacklogItem search - should search by PBI label", async () => {
  const calls: { cmd: string; args: string[] }[] = [];
  const adapter = makeAdapter((cmd, args) => {
    calls.push({ cmd, args });
    return Promise.resolve({ code: 0, stdout: JSON.stringify([]), stderr: "" });
  });
  const plan: Plan = {
    summary: "search PBI",
    steps: [
      {
        entity: "ProductBacklogItem",
        operation: "search",
        params: {},
      },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
  assertStringIncludes(calls[0].args.join(" "), "issue list");
  assertStringIncludes(calls[0].args.join(" "), "--label type:PBI");
});

Deno.test("ProductBacklogItem recordAnalysis - should succeed with valid params", async () => {
  const adapter = makeAdapter();
  const plan: Plan = {
    summary: "record analysis",
    steps: [
      {
        entity: "ProductBacklogItem",
        operation: "recordAnalysis",
        params: { itemId: "42", body: "## Process Analysis\nreview text" },
      },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
});

Deno.test("ProductBacklogItem defineAcceptanceCriteria - should create WP issue with AC body and set parent", async () => {
  let callCount = 0;
  const responses: Record<number, ExecuteResult> = {
    1: { code: 0, stdout: "https://github.com/my-org/my-repo/issues/51", stderr: "" },
    2: { code: 0, stdout: JSON.stringify({ id: "node-wp-51" }), stderr: "" },
    3: { code: 0, stdout: JSON.stringify({ id: "node-pbi-42" }), stderr: "" },
    4: { code: 0, stdout: JSON.stringify({ id: "node-wp-51" }), stderr: "" },
    5: {
      code: 0,
      stdout: JSON.stringify({ data: { addSubIssue: { issue: { id: "node-pbi-42" } } } }),
      stderr: "",
    },
  };
  const chainedRunner = (_cmd: string, _args: string[]): Promise<ExecuteResult> => {
    callCount++;
    return Promise.resolve(responses[callCount] ?? { code: 0, stdout: "", stderr: "" });
  };
  const adapter = makeAdapter(chainedRunner);
  const plan: Plan = {
    summary: "define AC",
    steps: [
      {
        entity: "ProductBacklogItem",
        operation: "defineAcceptanceCriteria",
        params: { title: "WP_1: Gateway handlers", parentPbi: "42", body: "- [ ] AC1: test" },
      },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
  // create + view nodeId + view parent + view item + graphql
  assertEquals(callCount, 5);
});

Deno.test("ProductBacklogItem defineAcceptanceCriteria - should fail without title", async () => {
  const adapter = makeAdapter();
  const plan: Plan = {
    summary: "define AC without title",
    steps: [
      {
        entity: "ProductBacklogItem",
        operation: "defineAcceptanceCriteria",
        params: { parentPbi: "42", body: "body" },
      },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, false);
});

// ======== WorkPackage Handler Tests ========

Deno.test("WorkPackage define - should create issue with type:WP label and set parent", async () => {
  let callCount = 0;
  const calls: { cmd: string; args: string[] }[] = [];
  const chainedRunner = (_cmd: string, _args: string[]): Promise<ExecuteResult> => {
    callCount++;
    calls.push({ cmd: _cmd, args: _args });
    if (callCount === 1) {
      return Promise.resolve({
        code: 0,
        stdout: "https://github.com/my-org/my-repo/issues/51",
        stderr: "",
      });
    }
    if (callCount === 2) {
      return Promise.resolve({ code: 0, stdout: JSON.stringify({ id: "node-wp-51" }), stderr: "" });
    }
    if (callCount === 3) {
      return Promise.resolve({
        code: 0,
        stdout: JSON.stringify({ id: "node-pbi-42" }),
        stderr: "",
      });
    }
    if (callCount === 4) {
      return Promise.resolve({ code: 0, stdout: JSON.stringify({ id: "node-wp-51" }), stderr: "" });
    }
    return Promise.resolve({
      code: 0,
      stdout: JSON.stringify({ data: { addSubIssue: { issue: { id: "node-pbi-42" } } } }),
      stderr: "",
    });
  };
  const adapter = makeAdapter(chainedRunner);
  const plan: Plan = {
    summary: "define WP",
    steps: [
      {
        entity: "WorkPackage",
        operation: "define",
        params: { title: "WP_1: Gateway handlers", parentPbi: "42", body: "## AC\n- AC1: test" },
      },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
  assertStringIncludes(calls[0].args.join(" "), "issue create");
  assertStringIncludes(calls[0].args.join(" "), "--label type:WP");
});

Deno.test("WorkPackage define - should fail without parentPbi", async () => {
  const adapter = makeAdapter();
  const plan: Plan = {
    summary: "define WP no parent",
    steps: [
      {
        entity: "WorkPackage",
        operation: "define",
        params: { title: "WP_1", body: "body" },
      },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "parentPbi is required");
});

Deno.test("WorkPackage commit - should set milestone", async () => {
  const { runner, calls } = mockRunner();
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "commit WP",
    steps: [
      {
        entity: "WorkPackage",
        operation: "commit",
        params: { itemId: "51", sprint: "Sprint 19" },
      },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
  assertStringIncludes(calls[0].args.join(" "), "issue edit 51");
  assertStringIncludes(calls[0].args.join(" "), "--milestone Sprint 19");
});

Deno.test("WorkPackage start - should succeed with valid itemId", async () => {
  const adapter = makeAdapter();
  const plan: Plan = {
    summary: "start WP",
    steps: [
      {
        entity: "WorkPackage",
        operation: "start",
        params: { itemId: "51" },
      },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
});

Deno.test("WorkPackage complete - should succeed with valid itemId", async () => {
  const adapter = makeAdapter();
  const plan: Plan = {
    summary: "complete WP",
    steps: [
      {
        entity: "WorkPackage",
        operation: "complete",
        params: { itemId: "51" },
      },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
});

Deno.test("WorkPackage archive - should close the issue", async () => {
  const { runner, calls } = mockRunner();
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "archive WP",
    steps: [
      {
        entity: "WorkPackage",
        operation: "archive",
        params: { itemId: "51" },
      },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
  assertStringIncludes(calls[0].args.join(" "), "issue close 51");
});

Deno.test("WorkPackage estimateInitialEffort - should succeed with valid params", async () => {
  const adapter = makeAdapter();
  const plan: Plan = {
    summary: "estimate initial effort",
    steps: [
      {
        entity: "WorkPackage",
        operation: "estimateInitialEffort",
        params: { itemId: "51", effortInitial: 3 },
      },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
});

Deno.test("WorkPackage estimateInitialEffort - should fail without itemId", async () => {
  const adapter = makeAdapter();
  const plan: Plan = {
    summary: "estimate initial effort no id",
    steps: [
      {
        entity: "WorkPackage",
        operation: "estimateInitialEffort",
        params: { effortInitial: 3 },
      },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "itemId is required");
});

Deno.test("WorkPackage view - should return issue details", async () => {
  const expectedOutput = JSON.stringify({
    number: 51,
    title: "WP_1",
    body: "body",
    labels: [{ name: "type:WP" }],
    id: "node-wp-51",
  });
  const calls: { cmd: string; args: string[] }[] = [];
  const adapter = makeAdapter((cmd, args) => {
    calls.push({ cmd, args });
    return Promise.resolve({ code: 0, stdout: expectedOutput, stderr: "" });
  });
  const plan: Plan = {
    summary: "view WP",
    steps: [
      {
        entity: "WorkPackage",
        operation: "view",
        params: { itemId: "51" },
      },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
  assertStringIncludes(calls[0].args.join(" "), "issue view 51");
});

Deno.test("WorkPackage search - should search by WP label", async () => {
  const calls: { cmd: string; args: string[] }[] = [];
  const adapter = makeAdapter((cmd, args) => {
    calls.push({ cmd, args });
    return Promise.resolve({ code: 0, stdout: JSON.stringify([]), stderr: "" });
  });
  const plan: Plan = {
    summary: "search WP",
    steps: [
      {
        entity: "WorkPackage",
        operation: "search",
        params: {},
      },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
  assertStringIncludes(calls[0].args.join(" "), "issue list");
  assertStringIncludes(calls[0].args.join(" "), "--label type:WP");
});

/**
 * Sprint search - 空リストの場合にエラーを返すことを検証する。
 */
Deno.test("Sprint search - should fail when no milestones found", async () => {
  const adapter = makeAdapter(fixedRunner("[]"));
  const plan: Plan = {
    summary: "find latest sprint",
    steps: [
      { entity: "Sprint", operation: "search", params: { state: "open" } },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "No open milestones found");
});

/**
 * Sprint search + view - itemId連鎖でsearch結果がviewに継承されることを検証する。
 */
Deno.test("Sprint search+view - should chain itemId from search to view", async () => {
  const milestones = [{ number: 17, title: "Sprint 18" }];
  const milestoneDetail = { number: 17, title: "Sprint 18", state: "open", description: "test" };
  let callCount = 0;
  const chainedRunner = (_cmd: string, _args: string[]): Promise<ExecuteResult> => {
    callCount++;
    if (callCount === 1) {
      return Promise.resolve({ code: 0, stdout: JSON.stringify(milestones), stderr: "" });
    }
    return Promise.resolve({ code: 0, stdout: JSON.stringify(milestoneDetail), stderr: "" });
  };
  const adapter = makeAdapter(chainedRunner);
  const plan: Plan = {
    summary: "find latest open sprint",
    steps: [
      { entity: "Sprint", operation: "search", params: { state: "open" } },
      { entity: "Sprint", operation: "view", params: {} },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 2);
  assertEquals(result.stepResults[0].success, true);
  assertEquals(result.stepResults[0].itemId, "17");
  assertEquals(result.stepResults[1].success, true);
  assertEquals(result.stepResults[1].itemId, "17");
  const output = result.stepResults[1].output as { title?: string };
  assertEquals(output?.title, "Sprint 18");
  assertEquals(callCount, 2);
});

/**
 * Sprint create - gh APIエラーレスポンスを正しく伝播することを検証する。
 */
Deno.test("Sprint create - should propagate gh api error", async () => {
  const errorRunner = (_cmd: string, _args: string[]): Promise<ExecuteResult> => {
    return Promise.resolve({ code: 1, stdout: "", stderr: "HTTP 422: Unprocessable Entity" });
  };
  const adapter = makeAdapter(errorRunner);
  const plan: Plan = {
    summary: "start sprint",
    steps: [
      {
        entity: "Sprint",
        operation: "create",
        params: { title: "Sprint 18", description: "Sprint 18" },
      },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "already exists");
});

/**
 * Sprint create - レスポンスからitemIdが正しく抽出されることを検証する。
 */
Deno.test("Sprint create - should extract itemId from response", async () => {
  const outputRunner = (_cmd: string, _args: string[]): Promise<ExecuteResult> => {
    return Promise.resolve({
      code: 0,
      stdout: JSON.stringify({ number: 42, title: "Sprint 18" }),
      stderr: "",
    });
  };
  const adapter = makeAdapter(outputRunner);
  const plan: Plan = {
    summary: "start sprint",
    steps: [
      {
        entity: "Sprint",
        operation: "create",
        params: { title: "Sprint 18", description: "Sprint 18" },
      },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
  assertEquals(result.stepResults[0].itemId, "42");
});

/**
 * Sprint setGoal - itemId 未指定でエラーを返すことを検証する。
 */
Deno.test("Sprint setGoal - should fail without itemId", async () => {
  const { runner } = mockRunner();
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "set sprint goal",
    steps: [
      { entity: "Sprint", operation: "setGoal", params: { description: "goal" } },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "itemId is required");
});

/**
 * Sprint setDueDate - itemId 未指定でエラーを返すことを検証する。
 */
Deno.test("Sprint setDueDate - should fail without itemId", async () => {
  const { runner } = mockRunner();
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "set sprint due date",
    steps: [
      { entity: "Sprint", operation: "setDueDate", params: { dueDate: "2026-07-20T00:00:00Z" } },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "itemId is required");
});

/**
 * Sprint setDueDate - dueDate 未指定でエラーを返すことを検証する。
 */
Deno.test("Sprint setDueDate - should fail without dueDate", async () => {
  const { runner } = mockRunner();
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "set sprint due date",
    steps: [
      { entity: "Sprint", operation: "setDueDate", params: { itemId: "5" } },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "dueDate is required");
});

/**
 * Sprint endSprint - gh APIエラーを正しく伝播することを検証する。
 */
Deno.test("Sprint endSprint - should propagate gh api error", async () => {
  const errorRunner = (_cmd: string, _args: string[]): Promise<ExecuteResult> => {
    return Promise.resolve({ code: 1, stdout: "", stderr: "HTTP 404: Not Found" });
  };
  const adapter = makeAdapter(errorRunner);
  const plan: Plan = {
    summary: "end sprint",
    steps: [
      { entity: "Sprint", operation: "endSprint", params: { itemId: "999", title: "Sprint 18" } },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "HTTP 404");
});

// ======== Sprint (Milestone) Operation Tests ========

/**
 * Sprint create - gh api -X POST milestones が呼ばれることを検証する。
 */
Deno.test("Sprint create - should call gh api POST milestones", async () => {
  const { runner, calls } = mockRunner();
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "start sprint",
    steps: [
      {
        entity: "Sprint",
        operation: "create",
        params: { title: "Sprint 18", description: "Sprint 18" },
      },
    ],
  };
  await adapter.execute(plan);
  assertEquals(calls.length, 1);
  assertEquals(calls[0].cmd, "gh");
  assertEquals(calls[0].args[0], "api");
  assertEquals(calls[0].args[1], "-X");
  assertEquals(calls[0].args[2], "POST");
  assertStringIncludes(calls[0].args.join(" "), "/milestones");
  assertStringIncludes(calls[0].args.join(" "), "-f title=Sprint 18");
});

/**
 * Sprint endSprint - gh api -X PATCH milestones/:number with state=closed が呼ばれることを検証する。
 */
Deno.test("Sprint endSprint - should call gh api PATCH milestones with state=closed", async () => {
  const { runner, calls } = mockRunner();
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "end sprint",
    steps: [
      {
        entity: "Sprint",
        operation: "endSprint",
        params: { itemId: "5", title: "Sprint 18" },
      },
    ],
  };
  await adapter.execute(plan);
  assertEquals(calls.length, 1);
  assertEquals(calls[0].cmd, "gh");
  assertEquals(calls[0].args[0], "api");
  assertEquals(calls[0].args[1], "-X");
  assertEquals(calls[0].args[2], "PATCH");
  assertStringIncludes(calls[0].args.join(" "), "/milestones/5");
  assertStringIncludes(calls[0].args.join(" "), "-f state=closed");
});

/**
 * Sprint endSprint - itemId 未指定でエラーを返すことを検証する。
 */
Deno.test("Sprint endSprint - should fail without itemId", async () => {
  const { runner } = mockRunner();
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "end sprint",
    steps: [
      { entity: "Sprint", operation: "endSprint", params: {} },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "itemId is required");
});

/**
 * Sprint setGoal - gh api -X PATCH milestones/:number with description が呼ばれることを検証する。
 */
Deno.test("Sprint setGoal - should call gh api PATCH milestones with description", async () => {
  const { runner, calls } = mockRunner();
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "set sprint goal",
    steps: [
      {
        entity: "Sprint",
        operation: "setGoal",
        params: { itemId: "5", title: "Sprint 18", description: "Complete all PBIs" },
      },
    ],
  };
  await adapter.execute(plan);
  assertEquals(calls.length, 1);
  assertEquals(calls[0].cmd, "gh");
  assertEquals(calls[0].args[0], "api");
  assertStringIncludes(calls[0].args.join(" "), "/milestones/5");
  assertStringIncludes(calls[0].args.join(" "), "-f description=Complete all PBIs");
});

/**
 * Sprint setDueDate - gh api -X PATCH milestones/:number with due_on が呼ばれることを検証する。
 */
Deno.test("Sprint setDueDate - should call gh api PATCH milestones with due_on", async () => {
  const { runner, calls } = mockRunner();
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "set sprint due date",
    steps: [
      {
        entity: "Sprint",
        operation: "setDueDate",
        params: { itemId: "5", title: "Sprint 18", dueDate: "2026-07-20T00:00:00Z" },
      },
    ],
  };
  await adapter.execute(plan);
  assertEquals(calls.length, 1);
  assertEquals(calls[0].cmd, "gh");
  assertEquals(calls[0].args[0], "api");
  assertStringIncludes(calls[0].args.join(" "), "/milestones/5");
  assertStringIncludes(calls[0].args.join(" "), "-f due_on=2026-07-20T00:00:00Z");
});

/**
 * Sprint view - gh api GET milestones/:number が呼ばれることを検証する。
 */
Deno.test("Sprint view - should call gh api GET milestones", async () => {
  const expectedOutput = JSON.stringify({ number: 5, title: "Sprint 18", state: "open" });
  const adapter = makeAdapter(fixedRunner(expectedOutput));
  const plan: Plan = {
    summary: "view sprint",
    steps: [
      { entity: "Sprint", operation: "view", params: { itemId: "5" } },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
  assertEquals(result.stepResults[0].itemId, "5");
  const output = result.stepResults[0].output as { number?: number };
  assertEquals(output?.number, 5);
});

/**
 * Sprint view - itemId 未指定でエラーを返すことを検証する。
 */
Deno.test("Sprint view - should fail without itemId", async () => {
  const { runner } = mockRunner();
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "view sprint",
    steps: [
      { entity: "Sprint", operation: "view", params: {} },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "itemId is required");
});

/**
 * Sprint - 未登録の操作に対してエラーが返ることを検証する。
 */
Deno.test("Sprint - should return error for unknown operation", async () => {
  const { runner } = mockRunner();
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "unknown op",
    steps: [
      { entity: "Sprint", operation: "unknownOp" as never, params: {} },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "No handler registered");
});

// ======== Epic Operation Tests ========

Deno.test("Epic create - should map params to gh issue create args", async () => {
  const { runner, calls } = mockRunner();
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "test",
    steps: [
      {
        entity: "Epic",
        operation: "create",
        params: { title: "Test Epic", body: "body text" },
      },
    ],
  };
  await adapter.execute(plan);
  assertEquals(calls.length, 1);
  assertEquals(calls[0].cmd, "gh");
  assertEquals(calls[0].args[0], "issue");
  assertEquals(calls[0].args[1], "create");
  assertStringIncludes(calls[0].args.join(" "), "--title Test Epic");
  assertStringIncludes(calls[0].args.join(" "), "--body body text");
  assertStringIncludes(calls[0].args.join(" "), "--label type:Epic");
});

Deno.test("Epic view - should map itemId to gh issue view args", async () => {
  const expectedOutput = JSON.stringify({
    number: 42,
    title: "Test Epic",
    body: "body",
    labels: [{ name: "type:Epic" }],
    id: "node-abc",
  });
  const adapter = makeAdapter(fixedRunner(expectedOutput));
  const plan: Plan = {
    summary: "test",
    steps: [
      { entity: "Epic", operation: "view", params: { itemId: "42" } },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
  assertEquals(result.stepResults[0].itemId, "42");
});

Deno.test("Epic search - should map labelType to gh issue list args", async () => {
  const expectedOutput = JSON.stringify([
    { number: 42, title: "Existing Epic", labels: [{ name: "type:Epic" }] },
  ]);
  const adapter = makeAdapter(fixedRunner(expectedOutput));
  const plan: Plan = {
    summary: "test",
    steps: [
      { entity: "Epic", operation: "search", params: { labelType: "Epic" } },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
  const output = result.stepResults[0].output as Array<Record<string, unknown>>;
  assertEquals(output.length, 1);
  assertEquals(output[0].number, 42);
});

Deno.test("Epic comment - should map itemId and body to gh issue comment args", async () => {
  const { runner, calls } = mockRunner();
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "test",
    steps: [
      { entity: "Epic", operation: "comment", params: { itemId: "42", body: "comment text" } },
    ],
  };
  await adapter.execute(plan);
  assertEquals(calls.length, 1);
  assertEquals(calls[0].cmd, "gh");
  assertEquals(calls[0].args[0], "issue");
  assertEquals(calls[0].args[1], "comment");
  assertEquals(calls[0].args[2], "42");
  assertStringIncludes(calls[0].args.join(" "), "--body comment text");
});

Deno.test("Epic update - should map params to gh issue edit args", async () => {
  const { runner, calls } = mockRunner();
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "test",
    steps: [
      { entity: "Epic", operation: "update", params: { itemId: "42", title: "New Title" } },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
  assertEquals(calls.length, 1);
  assertEquals(calls[0].cmd, "gh");
  assertEquals(calls[0].args[0], "issue");
  assertEquals(calls[0].args[1], "edit");
  assertEquals(calls[0].args[2], "42");
  assertStringIncludes(calls[0].args.join(" "), "--title New Title");
});

// ======== Feature Operation Tests ========

Deno.test("Feature create - should map params to gh issue create args", async () => {
  const { runner, calls } = mockRunner();
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "test",
    steps: [
      {
        entity: "Feature",
        operation: "create",
        params: { title: "Test Feature", body: "body text" },
      },
    ],
  };
  await adapter.execute(plan);
  assertEquals(calls.length, 1);
  assertEquals(calls[0].cmd, "gh");
  assertEquals(calls[0].args[0], "issue");
  assertEquals(calls[0].args[1], "create");
  assertStringIncludes(calls[0].args.join(" "), "--title Test Feature");
  assertStringIncludes(calls[0].args.join(" "), "--body body text");
  assertStringIncludes(calls[0].args.join(" "), "--label type:Feature");
});

Deno.test("Feature view - should map itemId to gh issue view args", async () => {
  const expectedOutput = JSON.stringify({
    number: 42,
    title: "Test Feature",
    body: "body",
    labels: [{ name: "type:Feature" }],
    id: "node-abc",
  });
  const adapter = makeAdapter(fixedRunner(expectedOutput));
  const plan: Plan = {
    summary: "test",
    steps: [
      { entity: "Feature", operation: "view", params: { itemId: "42" } },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
  assertEquals(result.stepResults[0].itemId, "42");
});

Deno.test("Feature search - should map labelType to gh issue list args", async () => {
  const expectedOutput = JSON.stringify([
    { number: 42, title: "Existing Feature", labels: [{ name: "type:Feature" }] },
  ]);
  const adapter = makeAdapter(fixedRunner(expectedOutput));
  const plan: Plan = {
    summary: "test",
    steps: [
      { entity: "Feature", operation: "search", params: { labelType: "Feature" } },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
  const output = result.stepResults[0].output as Array<Record<string, unknown>>;
  assertEquals(output.length, 1);
  assertEquals(output[0].number, 42);
});

Deno.test("Feature comment - should map itemId and body to gh issue comment args", async () => {
  const { runner, calls } = mockRunner();
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "test",
    steps: [
      { entity: "Feature", operation: "comment", params: { itemId: "42", body: "comment text" } },
    ],
  };
  await adapter.execute(plan);
  assertEquals(calls.length, 1);
  assertEquals(calls[0].cmd, "gh");
  assertEquals(calls[0].args[0], "issue");
  assertEquals(calls[0].args[1], "comment");
  assertEquals(calls[0].args[2], "42");
  assertStringIncludes(calls[0].args.join(" "), "--body comment text");
});

Deno.test("Feature update - should map params to gh issue edit args", async () => {
  const { runner, calls } = mockRunner();
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "test",
    steps: [
      { entity: "Feature", operation: "update", params: { itemId: "42", title: "New Title" } },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
  assertEquals(calls.length, 1);
  assertEquals(calls[0].cmd, "gh");
  assertEquals(calls[0].args[0], "issue");
  assertEquals(calls[0].args[1], "edit");
  assertEquals(calls[0].args[2], "42");
  assertStringIncludes(calls[0].args.join(" "), "--title New Title");
});

Deno.test("Feature update with parentEpic - should set parent via GraphQL addSubIssue", async () => {
  let callCount = 0;
  const responses: Record<number, ExecuteResult> = {
    1: { code: 0, stdout: JSON.stringify({ id: "node-epic-7" }), stderr: "" },
    2: { code: 0, stdout: JSON.stringify({ id: "node-feature-42" }), stderr: "" },
    3: {
      code: 0,
      stdout: JSON.stringify({ data: { addSubIssue: { issue: { id: "node-epic-7" } } } }),
      stderr: "",
    },
  };
  const chainedRunner = (_cmd: string, _args: string[]): Promise<ExecuteResult> => {
    callCount++;
    return Promise.resolve(responses[callCount] ?? { code: 0, stdout: "", stderr: "" });
  };
  const adapter = makeAdapter(chainedRunner);
  const plan: Plan = {
    summary: "assign to epic",
    steps: [
      {
        entity: "Feature",
        operation: "update",
        params: { itemId: "42", parentEpic: "7" },
      },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
  assertEquals(callCount, 3);
});

const hierarchyResponse = JSON.stringify({
  data: {
    repository: {
      issue: {
        number: 42,
        title: "Auth Epic",
        body: "## Description\n\nAuth features",
        subIssues: {
          nodes: [
            {
              number: 43,
              title: "Login Feature",
              body: "## Description\n\nLogin",
              labels: { nodes: [{ name: "type:Feature" }] },
            },
          ],
        },
      },
    },
  },
});

Deno.test("Epic showHierarchy - should return epic with features", async () => {
  const adapter = makeAdapter(fixedRunner(hierarchyResponse));
  const plan: Plan = {
    summary: "test",
    steps: [
      { entity: "Epic", operation: "showHierarchy", params: { itemId: "42" } },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
  const output = result.stepResults[0].output as {
    identifier: { title: { value: string }; code?: string };
    features: { items: Array<{ identifier: { title: { value: string } } }> };
  };
  assertEquals(output.identifier.code, "42");
  assertEquals(output.identifier.title.value, "Auth Epic");
  assertEquals(output.features.items.length, 1);
  assertEquals(output.features.items[0].identifier.title.value, "Login Feature");
});

Deno.test("Epic showHierarchy - should handle no sub-issues", async () => {
  const noSubIssues = JSON.stringify({
    data: {
      repository: {
        issue: {
          number: 42,
          title: "Empty Epic",
          body: "## Description\n\nNo features yet",
          subIssues: { nodes: null },
        },
      },
    },
  });
  const adapter = makeAdapter(fixedRunner(noSubIssues));
  const plan: Plan = {
    summary: "test",
    steps: [
      { entity: "Epic", operation: "showHierarchy", params: { itemId: "42" } },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
  const output = result.stepResults[0].output as { features: { items: Array<unknown> } };
  assertEquals(output.features.items.length, 0);
});

Deno.test("Epic showHierarchy - should fail without itemId", async () => {
  const adapter = makeAdapter();
  const plan: Plan = {
    summary: "test",
    steps: [
      { entity: "Epic", operation: "showHierarchy", params: {} },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "itemId is required");
});

Deno.test("Epic showHierarchy - should fail when scope not resolved", async () => {
  const adapter = makeRawAdapter();
  const plan: Plan = {
    summary: "test",
    steps: [
      { entity: "Epic", operation: "showHierarchy", params: { itemId: "42" } },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "Scope not resolved");
});

Deno.test("Epic showHierarchy - should fail on gh api error", async () => {
  const errorRunner = (_cmd: string, _args: string[]): Promise<ExecuteResult> => {
    return Promise.resolve({ code: 1, stdout: "", stderr: "rate limit exceeded" });
  };
  const adapter = makeAdapter(errorRunner);
  const plan: Plan = {
    summary: "test",
    steps: [
      { entity: "Epic", operation: "showHierarchy", params: { itemId: "42" } },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "rate limit exceeded");
});

Deno.test("Epic showHierarchy - should fail on GraphQL errors in body", async () => {
  const gqlError = JSON.stringify({
    errors: [{ message: "Not enough tokens" }],
  });
  const adapter = makeAdapter(fixedRunner(gqlError));
  const plan: Plan = {
    summary: "test",
    steps: [
      { entity: "Epic", operation: "showHierarchy", params: { itemId: "42" } },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "Not enough tokens");
});

Deno.test("Epic showHierarchy - should fail on invalid JSON response", async () => {
  const adapter = makeAdapter(fixedRunner("not json"));
  const plan: Plan = {
    summary: "test",
    steps: [
      { entity: "Epic", operation: "showHierarchy", params: { itemId: "42" } },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, false);
});

Deno.test("Epic showHierarchy - should fail when epic not found", async () => {
  const notFound = JSON.stringify({
    data: { repository: { issue: null } },
  });
  const adapter = makeAdapter(fixedRunner(notFound));
  const plan: Plan = {
    summary: "test",
    steps: [
      { entity: "Epic", operation: "showHierarchy", params: { itemId: "999" } },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "Epic not found");
});

Deno.test("ProductBacklogItem assignToFeature - should set parent via GraphQL addSubIssue", async () => {
  let callCount = 0;
  const responses: Record<number, ExecuteResult> = {
    1: { code: 0, stdout: JSON.stringify({ id: "node-feature-45" }), stderr: "" },
    2: { code: 0, stdout: JSON.stringify({ id: "node-pbi-50" }), stderr: "" },
    3: {
      code: 0,
      stdout: JSON.stringify({ data: { addSubIssue: { issue: { id: "node-feature-45" } } } }),
      stderr: "",
    },
  };
  const chainedRunner = (_cmd: string, _args: string[]): Promise<ExecuteResult> => {
    callCount++;
    return Promise.resolve(responses[callCount] ?? { code: 0, stdout: "", stderr: "" });
  };
  const adapter = makeAdapter(chainedRunner);
  const plan: Plan = {
    summary: "assign to feature",
    steps: [
      {
        entity: "ProductBacklogItem",
        operation: "assignToFeature",
        params: { itemId: "50", parentFeature: "45" },
      },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
  assertEquals(callCount, 3);
});

Deno.test("ProductBacklogItem assignToFeature - should fail without itemId", async () => {
  const adapter = makeAdapter();
  const plan: Plan = {
    summary: "test",
    steps: [
      {
        entity: "ProductBacklogItem",
        operation: "assignToFeature",
        params: { parentFeature: "45" },
      },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "itemId is required");
});

Deno.test("ProductBacklogItem assignToFeature - should fail without parentFeature", async () => {
  const adapter = makeAdapter();
  const plan: Plan = {
    summary: "test",
    steps: [
      {
        entity: "ProductBacklogItem",
        operation: "assignToFeature",
        params: { itemId: "50" },
      },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "parentFeature is required");
});

Deno.test("ProductBacklogItem unassignFromFeature - should fail without itemId", async () => {
  const adapter = makeAdapter();
  const plan: Plan = {
    summary: "test",
    steps: [
      {
        entity: "ProductBacklogItem",
        operation: "unassignFromFeature",
        params: {},
      },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "itemId is required");
});

Deno.test("ProductBacklogItem unassignFromFeature - should succeed when PBI has no parent", async () => {
  const noParentResponse = JSON.stringify({
    data: { node: { parent: null } },
  });
  let callCount = 0;
  const responses: Record<number, ExecuteResult> = {
    1: { code: 0, stdout: JSON.stringify({ id: "node-pbi-50" }), stderr: "" },
    2: { code: 0, stdout: noParentResponse, stderr: "" },
  };
  const chainedRunner = (_cmd: string, _args: string[]): Promise<ExecuteResult> => {
    callCount++;
    return Promise.resolve(responses[callCount] ?? { code: 0, stdout: "", stderr: "" });
  };
  const adapter = makeAdapter(chainedRunner);
  const plan: Plan = {
    summary: "unassign from feature",
    steps: [
      {
        entity: "ProductBacklogItem",
        operation: "unassignFromFeature",
        params: { itemId: "50" },
      },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
  assertEquals(callCount, 2);
});

Deno.test("ProductBacklogItem unassignFromFeature - should remove parent via GraphQL", async () => {
  let callCount = 0;
  const responses: Record<number, ExecuteResult> = {
    1: { code: 0, stdout: JSON.stringify({ id: "node-pbi-50" }), stderr: "" },
    2: {
      code: 0,
      stdout: JSON.stringify({ data: { node: { parent: { id: "node-feature-45" } } } }),
      stderr: "",
    },
    3: {
      code: 0,
      stdout: JSON.stringify({ data: { removeSubIssue: { issue: { id: "node-feature-45" } } } }),
      stderr: "",
    },
  };
  const chainedRunner = (_cmd: string, _args: string[]): Promise<ExecuteResult> => {
    callCount++;
    return Promise.resolve(responses[callCount] ?? { code: 0, stdout: "", stderr: "" });
  };
  const adapter = makeAdapter(chainedRunner);
  const plan: Plan = {
    summary: "unassign from feature",
    steps: [
      {
        entity: "ProductBacklogItem",
        operation: "unassignFromFeature",
        params: { itemId: "50" },
      },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
  assertEquals(callCount, 3);
});
