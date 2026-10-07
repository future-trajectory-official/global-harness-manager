import { assert, assertEquals, assertRejects, assertStringIncludes } from "@std/assert";
import type { ExecuteResult } from "../shared/io/command.ts";
import {
  aliasUserAsOrganization,
  isOrganizationUnresolved,
  PlanGatewayAdapter,
  toUserProjectQuery,
  upsertVelocitySection,
} from "./plan-gateway-adapter.ts";
import { FIELD, HARNESS_FIELDS } from "./field-registry.ts";
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
  owner: string = OWNER,
  repo: string = REPO,
): PlanGatewayAdapter {
  const adapter = new PlanGatewayAdapter(runner);
  adapter.setScope(owner, repo);
  return adapter;
}

/** ラップなしのPlanGatewayAdapter。Scope.resolveの直接テスト用。 */
function makeRawAdapter(
  runner: ReturnType<typeof mockRunner>["runner"] = mockRunner().runner,
): PlanGatewayAdapter {
  return new PlanGatewayAdapter(runner);
}

/** User所有ボードでの organization 未解決応答（NOT_FOUND）の共通フィクスチャ。 */
const ORG_MISS = JSON.stringify({
  data: { organization: null },
  errors: [{
    type: "NOT_FOUND",
    message: "Could not resolve to an Organization with the login of 'some-user'.",
  }],
});

/** 収集した gh 呼出の中に user(login:) フォールバックが含まれることを断言する。 */
function assertFallbackIssued(calls: { cmd: string; args: string[] }[]): void {
  assert(
    calls.some((c) => c.args.some((a) => a.includes("user(login:"))),
    "user(login:) fallback query should be issued",
  );
}

/** 収集した gh 呼出の中に user(login:) フォールバックが無いことを断言する。 */
function assertNoFallback(calls: { cmd: string; args: string[] }[]): void {
  assert(
    !calls.some((c) => c.args.some((a) => a.includes("user(login:"))),
    "user(login:) query must not be issued",
  );
}

/** user(login:) フォールバック呼出の回数を数える。 */
function countFallbacks(calls: { cmd: string; args: string[] }[]): number {
  return calls.filter((c) => c.args.some((a) => a.includes("user(login:"))).length;
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
 * Scope.resolve - 非git cwd で ambient cwd 解決失敗→repoDir 基準の git remote で解決し gh issue に --repo が付くこと（WP #806 AC-1/AC-2）
 * 検証意図: cwd の `git remote` が失敗し repoDir の `-C` で SSHエイリアス origin を解決でき、
 *   後続の `gh issue list` に `--repo owner/repo` が渡され ambient git remote 不要であることを確認する
 */
Deno.test("Scope.resolve - cwd失敗→repoDir基準で解決し gh issue に--repoを付与", async () => {
  const calls: { cmd: string; args: string[] }[] = [];
  const runner = (cmd: string, args: string[]): Promise<ExecuteResult> => {
    calls.push({ cmd, args });
    if (cmd === "git") {
      // ambient cwd（-C なし）は失敗＝非git、repoDir（-C あり）で成功
      if (args[0] === "-C") {
        return Promise.resolve({
          code: 0,
          stdout:
            "git@github.com-future-trajectory:future-trajectory-official/global-harness-manager.git\n",
          stderr: "",
        });
      }
      return Promise.resolve({ code: 128, stdout: "", stderr: "fatal: not a git repository" });
    }
    return Promise.resolve({ code: 0, stdout: "[]", stderr: "" });
  };
  const adapter = new PlanGatewayAdapter(runner, () => "/ws/global-harness-manager");
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
  assertEquals(result.stepResults[0].success, true);
  const dirCall = calls.find((c) => c.cmd === "git" && c.args[0] === "-C");
  assert(dirCall !== undefined, "cwd失敗後に repoDir基準の git が呼ばれること");
  assertEquals(dirCall!.args.slice(0, 2), ["-C", "/ws/global-harness-manager"]);
  const issueCall = calls.find((c) =>
    c.cmd === "gh" && c.args[0] === "issue" && c.args[1] === "list"
  );
  assert(issueCall !== undefined, "gh issue list が呼ばれること");
  assert(
    issueCall!.args.join(" ").includes("--repo future-trajectory-official/global-harness-manager"),
    `gh issue list に --repo が含まれない: ${issueCall!.args.join(" ")}`,
  );
});

/**
 * Scope.resolve - https origin で gh repo view 検証経路を通るとき、検証呼出にも --repo を付与すること（WP #806 AC-2）
 * 検証意図: parseGitRemoteUrl が一致する https origin では gh auth status 後に gh repo view を呼ぶため、
 *   非git cwd（cwd失敗→repoDir）でも成功するよう `gh repo view ... --repo owner/repo` が付くことを確認する
 */
Deno.test("Scope.resolve - https origin の gh repo view 検証に--repoを付与", async () => {
  const calls: { cmd: string; args: string[] }[] = [];
  const runner = (cmd: string, args: string[]): Promise<ExecuteResult> => {
    calls.push({ cmd, args });
    if (cmd === "git") {
      if (args[0] === "-C") {
        return Promise.resolve({
          code: 0,
          stdout: "https://github.com/my-org/my-repo.git\n",
          stderr: "",
        });
      }
      return Promise.resolve({ code: 128, stdout: "", stderr: "fatal: not a git repository" });
    }
    if (args[0] === "auth") {
      return Promise.resolve({ code: 0, stdout: "Logged in to gh as my-user", stderr: "" });
    }
    if (args[0] === "repo" && args[1] === "view") {
      return Promise.resolve({
        code: 0,
        stdout: JSON.stringify({ owner: { login: "my-org" }, name: "my-repo" }),
        stderr: "",
      });
    }
    return Promise.resolve({ code: 0, stdout: "[]", stderr: "" });
  };
  const adapter = new PlanGatewayAdapter(runner, () => "/ws/my-repo");
  const plan: Plan = {
    summary: "test",
    steps: [
      {
        entity: "Scope",
        operation: "resolve",
        params: { owner: "unknown", repository: "unknown" },
      },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults[0].success, true);
  const repoView = calls.find((c) =>
    c.cmd === "gh" && c.args[0] === "repo" && c.args[1] === "view"
  );
  assert(repoView !== undefined, "gh repo view が呼ばれること");
  assert(
    repoView!.args.join(" ").includes("--repo my-org/my-repo"),
    `gh repo view に --repo が含まれない: ${repoView!.args.join(" ")}`,
  );
});

/**
 * Scope.resolve - cwd が git repo のときは repoDir より cwd を優先すること（WP #806 M4）
 * 検証意図: 非git cwd 対策で repoDir(env/.harnessrc) を用意しても、cwd が git repo ならその remote を優先し、
 *   stale な HARNESS_WORKSPACE_ROOT 等で別 repo に誤解決しない（`-C` を呼ばない）ことを確認する
 */
Deno.test("Scope.resolve - cwd が git repo なら repoDir を使わず cwd 優先", async () => {
  const calls: { cmd: string; args: string[] }[] = [];
  const runner = (cmd: string, args: string[]): Promise<ExecuteResult> => {
    calls.push({ cmd, args });
    if (cmd === "git") {
      // cwd の素の git remote が成功する（git repo 内）。sshエイリアス origin で検証経路を挟まず解決。
      return Promise.resolve({
        code: 0,
        stdout: "git@github.com-alias:real-org/real-repo.git\n",
        stderr: "",
      });
    }
    return Promise.resolve({ code: 0, stdout: "[]", stderr: "" });
  };
  const adapter = new PlanGatewayAdapter(runner, () => "/stale/other-repo");
  const plan: Plan = {
    summary: "test",
    steps: [
      {
        entity: "Scope",
        operation: "resolve",
        params: { owner: "unknown", repository: "unknown" },
      },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults[0].success, true);
  assert(
    !calls.some((c) => c.cmd === "git" && c.args[0] === "-C"),
    "cwd成功時は -C を呼ばないこと（cwd優先）",
  );
  assertEquals(adapter.scopeOwner, "real-org");
  assertEquals(adapter.scopeRepository, "real-repo");
});

/**
 * Scope.resolve - cwd と repoDir 双方失敗時は失敗を返すこと（WP #806 M1/M6）
 * 検証意図: 非git cwd かつ repoDir の `git -C` も失敗する場合、resolve が success:false と error を返すことを確認する
 */
Deno.test("Scope.resolve - cwd と repoDir 双方失敗で success:false", async () => {
  const runner = (_cmd: string, _args: string[]): Promise<ExecuteResult> => {
    return Promise.resolve({ code: 128, stdout: "", stderr: "fatal: not a git repository" });
  };
  const adapter = new PlanGatewayAdapter(runner, () => "/ws/missing-repo");
  const plan: Plan = {
    summary: "test",
    steps: [
      {
        entity: "Scope",
        operation: "resolve",
        params: { owner: "unknown", repository: "unknown" },
      },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults[0].success, false);
  assert(
    typeof result.stepResults[0].error === "string" && result.stepResults[0].error.length > 0,
    "失敗理由を返すこと",
  );
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

/** gh issue edit に渡される newBody を抽出するヘルパー。 */
function extractEditedBody(calls: { cmd: string; args: string[] }[]): string {
  const editCall = calls.find((c) => c.args[0] === "issue" && c.args[1] === "edit");
  assert(editCall, "edit call not found");
  const bodyIdx = editCall.args.indexOf("--body");
  return editCall.args[bodyIdx + 1];
}

const REVIEW_BODY_WITH_ADDED_SECTION = `## スプリント開始時検証計画

### 📦 PBI: [2] [CorePlatform/EntityLifecycle]/Session-Lifecycle-Persistence

#### WP_1: Gatewayハンドラー実装

- ❔ AC_1: WP着手でInProgress遷移
- ➖ AC_3: 全子WP Done時に親PBIが自動Doneに昇格
- ➖ AC_4: 最初のWP着手時に親PBIが自動InProgressに昇格
- ➖ AC_8: 重複startエラー

## スプリント中追加検証計画

### 📦 PBI: [2] 

#### WP_1: 

- ❔ AC_3: WP完了時に兄弟WP検索し親PBI Doneへ
- ❔ AC_4: 最初のWP着手時に兄弟WP検索し親PBI InProgressへ
- ❔ AC_8: Sprint未紐付けWPの開始・完了をブロック`;

Deno.test("Review report - added-plan new ACs replace only in added section", async () => {
  const runner = fixedRunner(JSON.stringify({ body: REVIEW_BODY_WITH_ADDED_SECTION }));
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
        params: {
          itemId: "42",
          postPlanAcGroups: [
            {
              pbiNumber: 2,
              wpNumber: "1",
              acJudgments: [
                { number: "3", judgment: "pass" },
                { number: "4", judgment: "fail" },
                { number: "8", judgment: "fail" },
              ],
            },
          ],
        },
      },
    ],
  };
  await adapter.execute(plan);
  const newBody = extractEditedBody(calls);
  assertStringIncludes(newBody, "- ✅ AC_3: WP完了時に兄弟WP検索し親PBI Doneへ");
  assertStringIncludes(newBody, "- ❌ AC_4: 最初のWP着手時に兄弟WP検索し親PBI InProgressへ");
  assertStringIncludes(newBody, "- ❌ AC_8: Sprint未紐付けWPの開始・完了をブロック");
  assertStringIncludes(newBody, "- ➖ AC_3: 全子WP Done時に親PBIが自動Doneに昇格");
  assertStringIncludes(newBody, "- ➖ AC_4: 最初のWP着手時に親PBIが自動InProgressに昇格");
  assertStringIncludes(newBody, "- ➖ AC_8: 重複startエラー");
  assert(!newBody.includes("✅ AC_3: 全子WP"), "old AC_3 must not be overwritten");
});

Deno.test("Review report - start-plan ACs replace in start section", async () => {
  const body = `## スプリント開始時検証計画

### 📦 PBI: [1] [CorePlatform/EntityLifecycle]/Sprint-Start-Persistence

#### WP_1: Gatewayハンドラー実装

- ❔ AC_1: 「PBIを発案する」操作がGitHub上にtype:PBIラベル付きIssueを作成すること

#### WP_2: Skillスクリプト実装

- ❔ AC_2: 全スクリプトがdry-runモードに対応しPlan表示のみで終了すること

## スプリント中追加検証計画

### 📦 PBI: [1] 

#### WP_1: 

- ❔ AC_5: 計画前effortが独立フィールド harness-effort-summary に記録されること`;
  const runner = fixedRunner(JSON.stringify({ body }));
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
        params: {
          itemId: "42",
          postPlanAcGroups: [
            { pbiNumber: 1, wpNumber: "1", acJudgments: [{ number: "1", judgment: "pass" }] },
            { pbiNumber: 1, wpNumber: "2", acJudgments: [{ number: "2", judgment: "pass" }] },
            { pbiNumber: 1, wpNumber: "1", acJudgments: [{ number: "5", judgment: "pass" }] },
          ],
        },
      },
    ],
  };
  await adapter.execute(plan);
  const newBody = extractEditedBody(calls);
  assertStringIncludes(
    newBody,
    "- ✅ AC_1: 「PBIを発案する」操作がGitHub上にtype:PBIラベル付きIssueを作成すること",
  );
  assertStringIncludes(
    newBody,
    "- ✅ AC_2: 全スクリプトがdry-runモードに対応しPlan表示のみで終了すること",
  );
  assertStringIncludes(
    newBody,
    "- ✅ AC_5: 計画前effortが独立フィールド harness-effort-summary に記録されること",
  );
});

Deno.test("Review report - overallResult updates judgment and PO opinion", async () => {
  const body = `## 総合判定

### 判定結果

❔

### PO意見

❔`;
  const runner = fixedRunner(JSON.stringify({ body }));
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
        params: {
          itemId: "42",
          overallResult: {
            judgment: "fail",
            reason: "不合格項目あり",
          },
        },
      },
    ],
  };
  await adapter.execute(plan);
  const newBody = extractEditedBody(calls);
  assertStringIncludes(newBody, "### 判定結果\n\n❌ 不合格");
  assertStringIncludes(newBody, "不合格項目あり");
});

Deno.test("Review revise - removedScoped removes only the AC in the matching section", async () => {
  const body = `## スプリント開始時検証計画

### 📦 PBI: [2] [CorePlatform/EntityLifecycle]/Session-Lifecycle-Persistence

#### WP_1: Gatewayハンドラー実装

- ❔ AC_1: WP着手でInProgress遷移
- ❔ AC_3: 全子WP Done時に親PBIが自動Doneに昇格

## スプリント中追加検証計画

### 📦 PBI: [2] 

#### WP_1: 

- ❔ AC_3: WP完了時に兄弟WP検索し親PBI Doneへ`;
  const runner = fixedRunner(JSON.stringify({ body }));
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
        operation: "revise",
        params: {
          itemId: "42",
          removedScoped: [
            { pbiNumber: 2, wpNumber: "1", number: "3", description: "新仕様に置換" },
          ],
        },
      },
    ],
  };
  await adapter.execute(plan);
  const newBody = extractEditedBody(calls);
  assertStringIncludes(newBody, "- ➖ AC_3: 新仕様に置換");
  assertStringIncludes(newBody, "- ❔ AC_3: 全子WP Done時に親PBIが自動Doneに昇格");
  assert(!newBody.includes("➖ AC_3: 全子WP"), "start-plan AC_3 must not be removed");
});

Deno.test("Review revise - removedScoped removes start-plan AC when added section has no match", async () => {
  const body = `## スプリント開始時検証計画

### 📦 PBI: [1] [CorePlatform/EntityLifecycle]/Sprint-Start-Persistence

#### WP_1: Gatewayハンドラー実装

- ❔ AC_1: 「PBIを発案する」操作がGitHub上にtype:PBIラベル付きIssueを作成すること
- ❔ AC_5: 計画前effortがharness-efforts-analysisに記録されること

## スプリント中追加検証計画

### 📦 PBI: [2] 

#### WP_1: 

- ❔ AC_3: WP完了時に兄弟WP検索し親PBI Doneへ`;
  const runner = fixedRunner(JSON.stringify({ body }));
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
        operation: "revise",
        params: {
          itemId: "42",
          removedScoped: [
            { pbiNumber: 1, wpNumber: "1", number: "5", description: "旧文言" },
          ],
        },
      },
    ],
  };
  await adapter.execute(plan);
  const newBody = extractEditedBody(calls);
  assertStringIncludes(newBody, "- ➖ AC_5: 旧文言");
  assertStringIncludes(
    newBody,
    "- ❔ AC_1: 「PBIを発案する」操作がGitHub上にtype:PBIラベル付きIssueを作成すること",
  );
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

/**
 * Review archive - 既closed品のclose失敗は成功＋注記に正規化される（冪等化）。
 * ユースケース: スプリント終了時の二重アーカイブ実行。
 * 検証意図: handleCloseItemのalready-closed正規化により全エンティティで冪等であることを確認する。
 */
Deno.test("Review archive - should succeed with note on already closed issue", async () => {
  const runner = (_cmd: string, _args: string[]): Promise<ExecuteResult> => {
    return Promise.resolve({ code: 1, stdout: "", stderr: "already closed" });
  };
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "archive closed Review",
    steps: [
      { entity: "Review", operation: "archive", params: { itemId: "42" } },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults[0].success, true);
  const output = result.stepResults[0].output as { alreadyClosed?: boolean; note?: string };
  assertEquals(output?.alreadyClosed, true);
  assertStringIncludes(output?.note ?? "", "#42");
});

/**
 * Retrospective archive - 既closed品のclose失敗は成功＋注記に正規化される（冪等化）。
 * ユースケース: スプリント終了時の二重アーカイブ実行。
 * 検証意図: handleCloseItemのalready-closed正規化により全エンティティで冪等であることを確認する。
 */
Deno.test("Retrospective archive - should succeed with note on already closed issue", async () => {
  const runner = (_cmd: string, _args: string[]): Promise<ExecuteResult> => {
    return Promise.resolve({ code: 1, stdout: "", stderr: "already closed" });
  };
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "archive closed Retrospective",
    steps: [
      { entity: "Retrospective", operation: "archive", params: { itemId: "42" } },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults[0].success, true);
  const output = result.stepResults[0].output as { alreadyClosed?: boolean; note?: string };
  assertEquals(output?.alreadyClosed, true);
  assertStringIncludes(output?.note ?? "", "#42");
});

/**
 * Sprint archive - archive操作自体が未登録であることを確認（冪等確認）。
 * ユースケース: スプリント終了時の二重アーカイブ実行。
 * 検証意図: Sprintエンティティにarchiveハンドラが存在しない現状を文書化する（実装対象外）。
 */
Deno.test("Sprint archive - should report no handler registered", async () => {
  const { runner } = mockRunner();
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "archive Sprint",
    steps: [
      { entity: "Sprint", operation: "archive" as never, params: { itemId: "24" } },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(
    result.stepResults[0].error ?? "",
    "No handler registered for Sprint:archive",
  );
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

/** estimateSize 系テスト用の逐次応答ランナー。消費数を検証可能にする。 */
function makeSequencedRunner(
  responses: { code: number; stdout: string; stderr: string }[],
) {
  const calls: { cmd: string; args: string[] }[] = [];
  let idx = 0;
  const runner = (cmd: string, args: string[]): Promise<ExecuteResult> => {
    calls.push({ cmd, args });
    const r = responses[idx] ?? { code: 0, stdout: "", stderr: "" };
    idx++;
    return Promise.resolve(r);
  };
  return { runner, calls, consumed: () => idx };
}

/** estimateSize 成功系の gh 7連鎖（issue → project → add → options → field → node → edit）。 */
function estimateSuccessResponses(
  optionName = "M",
): { code: number; stdout: string; stderr: string }[] {
  return [
    // 1: gh issue view <id> --json id
    { code: 0, stdout: '{"id":"NODE_123"}', stderr: "" },
    // 2: addItemToProject getProjectId query
    { code: 0, stdout: '{"data":{"organization":{"projectV2":{"id":"PROJ_123"}}}}', stderr: "" },
    // 3: addItemToProject addItem mutation
    {
      code: 0,
      stdout: '{"data":{"addProjectV2ItemById":{"item":{"id":"ITEM_123"}}}}',
      stderr: "",
    },
    // 4: resolveSingleSelectOptionId field options query
    {
      code: 0,
      stdout:
        `{"data":{"organization":{"projectV2":{"field":{"options":[{"id":"OPT_M","name":"${optionName}"}]}}}}}`,
      stderr: "",
    },
    // 5: setSingleSelectFieldValue resolveFieldId
    {
      code: 0,
      stdout: '{"data":{"organization":{"projectV2":{"field":{"id":"FIELD_123"}}}}}',
      stderr: "",
    },
    // 6: setSingleSelectFieldValue resolveProjectNodeId
    { code: 0, stdout: '{"data":{"organization":{"projectV2":{"id":"PROJ_123"}}}}', stderr: "" },
    // 7: setSingleSelectFieldValue item-edit
    { code: 0, stdout: "", stderr: "" },
  ];
}

Deno.test("ProductBacklogItem estimateSize - should succeed with valid itemId", async () => {
  const responses = estimateSuccessResponses();
  const { runner, consumed } = makeSequencedRunner(responses);
  const adapter = new PlanGatewayAdapter(runner);
  adapter.setScope(OWNER, REPO);
  adapter.setProjectBoardNumbers(99, 99);
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
  assertEquals(consumed(), responses.length);
});

/**
 * ユースケース: ボード未設定でestimateSizeを呼んでも無言成功にならないこと
 * 検証意図: success:false と理由（board番号未設定）が返ることを確認する
 */
Deno.test("ProductBacklogItem estimateSize - should return error when board is not configured", async () => {
  const adapter = makeAdapter();
  const plan: Plan = {
    summary: "estimate size without board",
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
  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(
    result.stepResults[0].error ?? "",
    "productBacklogBoardNumber is not configured",
  );
});

/**
 * ユースケース: Issue解決失敗時にestimateSizeが無言成功にならないこと
 * 検証意図: success:false と理由（ノード解決失敗）が返ることを確認する
 */
Deno.test("ProductBacklogItem estimateSize - should return error when issue lookup fails", async () => {
  const runner = (_cmd: string, _args: string[]): Promise<ExecuteResult> => {
    return Promise.resolve({ code: 1, stdout: "", stderr: "issue not found" });
  };
  const adapter = new PlanGatewayAdapter(runner);
  adapter.setScope(OWNER, REPO);
  adapter.setProjectBoardNumbers(99, 99);
  const plan: Plan = {
    summary: "estimate size lookup failure",
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
  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "failed to resolve issue node");
});

/**
 * ユースケース: User所有ボードへのestimateで書込不能時に警告返却されること（WP#805 AC-2再現手順）
 * 再現手順:
 *   1. ボード番号を設定（User所有ボード想定: setProjectBoardNumbers(99, 99)）
 *   2. estimateSize を呼ぶ（gh issue view は成功、projectV2解決は organization→userフォールバック後も未解決）
 *   3. success:false と理由が返ることを確認する（無言成功でないこと）
 * 検証意図: user(login:)フォールバック経路でプロジェクト未解決時に理由付き返却となることを確認する
 */
Deno.test("ProductBacklogItem estimateSize - should return error on User-owned board when project is unresolved", async () => {
  const ORG_MISS = JSON.stringify({
    data: { organization: null },
    errors: [{
      type: "NOT_FOUND",
      message: "Could not resolve to an Organization with the login of 'some-user'.",
    }],
  });
  const responses = [
    // 1: gh issue view <id> --json id
    { code: 0, stdout: '{"id":"NODE_123"}', stderr: "" },
    // 2: getProjectId organization 版クエリ → NOT_FOUND（User所有想定）
    { code: 0, stdout: ORG_MISS, stderr: "" },
    // 3: getProjectId user(login:) フォールバック → 解決不可
    { code: 0, stdout: '{"data":{"user":{"projectV2":null}}}', stderr: "" },
  ];
  const { runner, calls, consumed } = makeSequencedRunner(responses);
  const adapter = new PlanGatewayAdapter(runner);
  adapter.setScope("some-user", REPO);
  adapter.setProjectBoardNumbers(99, 99);
  const plan: Plan = {
    summary: "estimate size on user-owned board",
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
  assertEquals(result.stepResults[0].success, false);
  assertEquals(
    result.stepResults[0].error,
    "board write failed for estimateSize (itemId=42): Project V2 #99 not found",
  );
  assert(
    calls.some((c) => c.args.some((a) => a.includes("user(login:"))),
    "user(login:) fallback query should be issued",
  );
  assertEquals(consumed(), responses.length);
});
/**
 * ユースケース: サイズ選択肢の未解決時にestimateSizeが無言成功にならないこと
 * 検証意図: success:false と理由（選択肢未解決）が返ることを確認する
 */
Deno.test("ProductBacklogItem estimateSize - should return error when size option is unresolved", async () => {
  const responses = estimateSuccessResponses("S");
  const { runner, consumed } = makeSequencedRunner(responses);
  const adapter = new PlanGatewayAdapter(runner);
  adapter.setScope(OWNER, REPO);
  adapter.setProjectBoardNumbers(99, 99);
  const plan: Plan = {
    summary: "estimate size unknown option",
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
  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "failed to resolve size option");
  // 選択肢未解決で早期終了するため options 解決までの4呼出のみ消費
  assertEquals(consumed(), 4);
});

/**
 * ユースケース: 最終書込（item-edit）失敗時にestimateSizeが無言成功にならないこと
 * 検証意図: success:false と理由（書込失敗）が返ることを確認する
 */
Deno.test("ProductBacklogItem estimateSize - should return error when final field write fails", async () => {
  const responses = estimateSuccessResponses().map((r, i, arr) =>
    i === arr.length - 1 ? { code: 1, stdout: "", stderr: "permission denied" } : r
  );
  const { runner, consumed } = makeSequencedRunner(responses);
  const adapter = new PlanGatewayAdapter(runner);
  adapter.setScope(OWNER, REPO);
  adapter.setProjectBoardNumbers(99, 99);
  const plan: Plan = {
    summary: "estimate size write failure",
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
  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "failed to write size option");
  assertEquals(consumed(), responses.length);
});

/**
 * ユースケース: Issue参照の応答不正時にestimateSizeが無言成功にならないこと
 * 検証意図: success:false と理由（書込失敗）が返ることを確認する
 */
Deno.test("ProductBacklogItem estimateSize - should return error when issue lookup response is malformed", async () => {
  const responses = [{ code: 0, stdout: "not-json", stderr: "" }];
  const { runner, consumed } = makeSequencedRunner(responses);
  const adapter = new PlanGatewayAdapter(runner);
  adapter.setScope(OWNER, REPO);
  adapter.setProjectBoardNumbers(99, 99);
  const plan: Plan = {
    summary: "estimate size malformed lookup",
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
  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "board write failed for estimateSize");
  assertEquals(consumed(), responses.length);
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
  assertEquals(calls.length, 2);
  assertStringIncludes(calls[1].args.join(" "), "issue close 42");
});

/**
 * ProductBacklogItem archive - 既closed品は成功＋注記で返す（冪等化）。
 * ユースケース: スプリント終了時の二重アーカイブ実行。
 * 検証意図: success:true、alreadyClosed注記の存在、close未実行を確認する。
 */
Deno.test("ProductBacklogItem archive - should succeed with note if issue is already closed", async () => {
  const calls: { cmd: string; args: string[] }[] = [];
  const runner = (cmd: string, args: string[]): Promise<ExecuteResult> => {
    calls.push({ cmd, args });
    return Promise.resolve({
      code: 0,
      stdout: JSON.stringify({ state: "CLOSED", closed: true }),
      stderr: "",
    });
  };
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "archive closed PBI",
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
  assertEquals(result.stepResults[0].itemId, "42");
  const output = result.stepResults[0].output as { alreadyClosed?: boolean; note?: string };
  assertEquals(output?.alreadyClosed, true);
  assertStringIncludes(output?.note ?? "", "already closed");
  assertStringIncludes(output?.note ?? "", "#42");
  assertEquals(calls.length, 1);
  assertStringIncludes(calls[0].args.join(" "), "issue view 42");
});

/**
 * ProductBacklogItem archive - stateのみCLOSED（closed:false）でも成功＋注記で返す。
 * ユースケース: スプリント終了時の二重アーカイブ実行。
 * 検証意図: OR条件のstate側単独trueをカバーする。
 */
Deno.test("ProductBacklogItem archive - should succeed with note if only state is CLOSED", async () => {
  const runner = (_cmd: string, _args: string[]): Promise<ExecuteResult> => {
    return Promise.resolve({
      code: 0,
      stdout: JSON.stringify({ state: "CLOSED", closed: false }),
      stderr: "",
    });
  };
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "archive closed PBI",
    steps: [
      {
        entity: "ProductBacklogItem",
        operation: "archive",
        params: { itemId: "42" },
      },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults[0].success, true);
  const output = result.stepResults[0].output as { alreadyClosed?: boolean };
  assertEquals(output?.alreadyClosed, true);
});

/**
 * ProductBacklogItem archive - viewとcloseの間の競合でも成功＋注記で返す。
 * ユースケース: 並行二重実行・view OPEN後の状態遷移。
 * 検証意図: 楽観的close失敗時のalready-closed正規化（TOCTOU対策）を確認する。
 */
Deno.test("ProductBacklogItem archive - should succeed with note on close race", async () => {
  let callCount = 0;
  const runner = (_cmd: string, _args: string[]): Promise<ExecuteResult> => {
    callCount++;
    if (callCount === 1) {
      return Promise.resolve({
        code: 0,
        stdout: JSON.stringify({ state: "OPEN", closed: false }),
        stderr: "",
      });
    }
    return Promise.resolve({ code: 1, stdout: "", stderr: "already closed" });
  };
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "archive raced PBI",
    steps: [
      {
        entity: "ProductBacklogItem",
        operation: "archive",
        params: { itemId: "42" },
      },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults[0].success, true);
  const output = result.stepResults[0].output as { alreadyClosed?: boolean; note?: string };
  assertEquals(output?.alreadyClosed, true);
  assertStringIncludes(output?.note ?? "", "#42");
});

/**
 * ProductBacklogItem archive - view失敗時もclose失敗の正規化で成功＋注記で返す。
 * ユースケース: view異常時の既closed品アーカイブ。
 * 検証意図: view失敗のフォールスルー後にcloseがalready-closedで失敗しても冪等であることを確認する。
 */
Deno.test("ProductBacklogItem archive - should succeed with note if view fails but close reports already closed", async () => {
  let callCount = 0;
  const runner = (_cmd: string, _args: string[]): Promise<ExecuteResult> => {
    callCount++;
    if (callCount === 1) {
      return Promise.resolve({ code: 1, stdout: "", stderr: "network error" });
    }
    return Promise.resolve({ code: 1, stdout: "", stderr: "already closed" });
  };
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "archive PBI with view failure",
    steps: [
      {
        entity: "ProductBacklogItem",
        operation: "archive",
        params: { itemId: "42" },
      },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults[0].success, true);
  const output = result.stepResults[0].output as { alreadyClosed?: boolean };
  assertEquals(output?.alreadyClosed, true);
});

/**
 * ProductBacklogItem archive - OPEN明示時はcloseを実行する。
 * ユースケース: 通常のアーカイブ実行。
 * 検証意図: 未closed品ではview→closeの2呼出しになることを明示的に確認する。
 */
Deno.test("ProductBacklogItem archive - should close the issue if explicitly OPEN", async () => {
  const calls: { cmd: string; args: string[] }[] = [];
  const runner = (cmd: string, args: string[]): Promise<ExecuteResult> => {
    calls.push({ cmd, args });
    if (calls.length === 1) {
      return Promise.resolve({
        code: 0,
        stdout: JSON.stringify({ state: "OPEN", closed: false }),
        stderr: "",
      });
    }
    return Promise.resolve({ code: 0, stdout: "", stderr: "" });
  };
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "archive open PBI",
    steps: [
      {
        entity: "ProductBacklogItem",
        operation: "archive",
        params: { itemId: "42" },
      },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults[0].success, true);
  assertEquals(result.stepResults[0].output, undefined);
  assertEquals(calls.length, 2);
  assertStringIncludes(calls[1].args.join(" "), "issue close 42");
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

Deno.test("ProductBacklogItem analyzeEffort - should aggregate subIssues effort and return output", async () => {
  const runner = (_cmd: string, args: string[]): Promise<ExecuteResult> => {
    const cmdStr = args.join(" ");
    if (cmdStr.includes("api graphql")) {
      return Promise.resolve({
        code: 0,
        stdout: JSON.stringify({
          data: {
            repository: {
              issue: {
                subIssues: {
                  nodes: [
                    {
                      projectItems: {
                        nodes: [
                          {
                            project: { number: 10 },
                            effortField: {
                              text: JSON.stringify({
                                initial_estimate: 2,
                                planned_estimate: 3,
                                actual: 4,
                              }),
                            },
                          },
                        ],
                      },
                    },
                    {
                      projectItems: {
                        nodes: [
                          {
                            project: { number: 10 },
                            effortField: {
                              text: JSON.stringify({
                                initial_estimate: 1,
                                planned_estimate: 1,
                                actual: 1,
                              }),
                            },
                          },
                        ],
                      },
                    },
                  ],
                },
              },
            },
          },
        }),
        stderr: "",
      });
    }
    return Promise.resolve({ code: 0, stdout: "", stderr: "" });
  };

  const adapter = makeAdapter(runner);
  adapter.setProjectBoardNumbers(10, 10);
  const plan: Plan = {
    summary: "analyze effort",
    steps: [
      {
        entity: "ProductBacklogItem",
        operation: "analyzeEffort",
        params: { itemId: "42" },
      },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
  const output = result.stepResults[0].output as {
    wp_effort_summary: { initial_estimate: number; planned_estimate: number; actual: number };
  };
  assertEquals(output.wp_effort_summary.initial_estimate, 3);
  assertEquals(output.wp_effort_summary.planned_estimate, 4);
  assertEquals(output.wp_effort_summary.actual, 5);
});

Deno.test("ProductBacklogItem recordAnalysis - should reject invalid JSON body", async () => {
  const adapter = makeAdapter();
  const plan: Plan = {
    summary: "record analysis invalid",
    steps: [
      {
        entity: "ProductBacklogItem",
        operation: "recordAnalysis",
        params: { itemId: "42", body: "not valid json" },
      },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "Invalid JSON");
});

Deno.test("ProductBacklogItem recordAnalysis - should write valid analysis JSON to board", async () => {
  let callCount = 0;
  const calls: { cmd: string; args: string[] }[] = [];
  const chainedRunner = (cmd: string, args: string[]): Promise<ExecuteResult> => {
    callCount++;
    calls.push({ cmd, args });
    const argsStr = args.join(" ");
    if (argsStr.startsWith("issue view ")) {
      return Promise.resolve({
        code: 0,
        stdout: JSON.stringify({ id: "node-pbi-42" }),
        stderr: "",
      });
    }
    if (argsStr.includes("addProjectV2ItemById")) {
      return Promise.resolve({
        code: 0,
        stdout: JSON.stringify({ data: { addProjectV2ItemById: { item: { id: "pvti-42" } } } }),
        stderr: "",
      });
    }
    if (argsStr.includes("field(name: $fieldName)")) {
      return Promise.resolve({
        code: 0,
        stdout: JSON.stringify({
          data: { organization: { projectV2: { field: { id: "field-" + callCount } } } },
        }),
        stderr: "",
      });
    }
    if (argsStr.includes("projectV2(number: $number) { id }")) {
      return Promise.resolve({
        code: 0,
        stdout: JSON.stringify({ data: { organization: { projectV2: { id: "proj-node" } } } }),
        stderr: "",
      });
    }
    return Promise.resolve({ code: 0, stdout: "", stderr: "" });
  };
  const adapter = makeAdapter(chainedRunner);
  adapter.setProjectBoardNumbers(99, 0);
  const plan: Plan = {
    summary: "record analysis valid",
    steps: [
      {
        entity: "ProductBacklogItem",
        operation: "recordAnalysis",
        params: {
          itemId: "42",
          body: JSON.stringify({
            wp_effort_summary: { initial_estimate: 3, planned_estimate: 4, actual: 5 },
            planning_variance_review: "test planning review",
            execution_variance_review: "test execution review",
            improvement_suggestions: "test suggestions",
          }),
        },
      },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);

  const itemEditCalls = calls.filter((c) => c.args.includes("item-edit"));
  assert(itemEditCalls.length >= 4, "expected at least 4 field writes (effort + 3 reviews)");
  const effortWrite = itemEditCalls.find((c) => {
    const idx = c.args.indexOf("--text");
    return idx >= 0 &&
      c.args[idx + 1] === JSON.stringify({ initial_estimate: 3, planned_estimate: 4, actual: 5 });
  });
  assert(effortWrite, "harness-effort-summary should be written with wp_effort_summary value");
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

function milestoneRunner(milestone: { number: number; title: string } | null) {
  return (_cmd: string, _args: string[]): Promise<ExecuteResult> => {
    return Promise.resolve({
      code: 0,
      stdout: JSON.stringify({ milestone }),
      stderr: "",
    });
  };
}

Deno.test("WorkPackage start - should succeed with valid itemId and milestone", async () => {
  const adapter = makeAdapter(milestoneRunner({ number: 19, title: "Sprint 19" }));
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

Deno.test("WorkPackage complete - should succeed with valid itemId and milestone", async () => {
  const adapter = makeAdapter(milestoneRunner({ number: 19, title: "Sprint 19" }));
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

Deno.test("WorkPackage start - should fail when milestone is missing", async () => {
  const adapter = makeAdapter(milestoneRunner(null));
  const plan: Plan = {
    summary: "start WP without milestone",
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
  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "not linked to a Sprint milestone");
});

Deno.test("WorkPackage complete - should fail when milestone is missing", async () => {
  const adapter = makeAdapter(milestoneRunner(null));
  const plan: Plan = {
    summary: "complete WP without milestone",
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
  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "not linked to a Sprint milestone");
});

Deno.test("WorkPackage start - should return gh error when milestone fetch fails", async () => {
  const adapter = makeAdapter((_cmd, _args) =>
    Promise.resolve({ code: 1, stdout: "", stderr: "rate limited" })
  );
  const plan: Plan = {
    summary: "start WP on gh failure",
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
  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "rate limited");
});

Deno.test("WorkPackage complete - should return error when milestone fetch fails", async () => {
  const adapter = makeAdapter((_cmd, _args) =>
    Promise.resolve({ code: 1, stdout: "", stderr: "rate limited" })
  );
  const plan: Plan = {
    summary: "complete WP with gh failure",
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
  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "rate limited");
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
  assertEquals(calls.length, 2);
  assertStringIncludes(calls[1].args.join(" "), "issue close 51");
});

/**
 * WorkPackage archive - 既closed品は成功＋注記で返す（冪等化）。
 * ユースケース: スプリント終了時の二重アーカイブ実行。
 * 検証意図: success:true、alreadyClosed注記の存在、close未実行を確認する。
 */
Deno.test("WorkPackage archive - should succeed with note if issue is already closed", async () => {
  const calls: { cmd: string; args: string[] }[] = [];
  const runner = (cmd: string, args: string[]): Promise<ExecuteResult> => {
    calls.push({ cmd, args });
    return Promise.resolve({
      code: 0,
      stdout: JSON.stringify({ state: "CLOSED", closed: true }),
      stderr: "",
    });
  };
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "archive closed WP",
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
  assertEquals(result.stepResults[0].itemId, "51");
  const output = result.stepResults[0].output as { alreadyClosed?: boolean; note?: string };
  assertEquals(output?.alreadyClosed, true);
  assertStringIncludes(output?.note ?? "", "already closed");
  assertStringIncludes(output?.note ?? "", "#51");
  assertEquals(calls.length, 1);
  assertStringIncludes(calls[0].args.join(" "), "issue view 51");
});

/**
 * WorkPackage archive - closedのみtrue（state:OPEN）でも成功＋注記で返す。
 * ユースケース: スプリント終了時の二重アーカイブ実行。
 * 検証意図: OR条件のclosed側単独trueをカバーする。
 */
Deno.test("WorkPackage archive - should succeed with note if only closed flag is true", async () => {
  const runner = (_cmd: string, _args: string[]): Promise<ExecuteResult> => {
    return Promise.resolve({
      code: 0,
      stdout: JSON.stringify({ state: "OPEN", closed: true }),
      stderr: "",
    });
  };
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "archive closed WP",
    steps: [
      {
        entity: "WorkPackage",
        operation: "archive",
        params: { itemId: "51" },
      },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults[0].success, true);
  const output = result.stepResults[0].output as { alreadyClosed?: boolean };
  assertEquals(output?.alreadyClosed, true);
});

/**
 * WorkPackage archive - viewとcloseの間の競合でも成功＋注記で返す。
 * ユースケース: 並行二重実行・view OPEN後の状態遷移。
 * 検証意図: 楽観的close失敗時のalready-closed正規化（TOCTOU対策）を確認する。
 */
Deno.test("WorkPackage archive - should succeed with note on close race", async () => {
  let callCount = 0;
  const runner = (_cmd: string, _args: string[]): Promise<ExecuteResult> => {
    callCount++;
    if (callCount === 1) {
      return Promise.resolve({
        code: 0,
        stdout: JSON.stringify({ state: "OPEN", closed: false }),
        stderr: "",
      });
    }
    return Promise.resolve({ code: 1, stdout: "", stderr: "already closed" });
  };
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "archive raced WP",
    steps: [
      {
        entity: "WorkPackage",
        operation: "archive",
        params: { itemId: "51" },
      },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults[0].success, true);
  const output = result.stepResults[0].output as { alreadyClosed?: boolean; note?: string };
  assertEquals(output?.alreadyClosed, true);
  assertStringIncludes(output?.note ?? "", "#51");
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

Deno.test("WorkPackage estimatePlannedEffort - should succeed with valid params", async () => {
  const adapter = makeAdapter();
  const plan: Plan = {
    summary: "estimate planned effort",
    steps: [
      {
        entity: "WorkPackage",
        operation: "estimatePlannedEffort",
        params: { itemId: "51", effortPlanned: 5 },
      },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
});

Deno.test("WorkPackage estimatePlannedEffort - should fail without itemId", async () => {
  const adapter = makeAdapter();
  const plan: Plan = {
    summary: "estimate planned effort no id",
    steps: [
      {
        entity: "WorkPackage",
        operation: "estimatePlannedEffort",
        params: { effortPlanned: 5 },
      },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "itemId is required");
});

Deno.test("WorkPackage recordActualEffort - should succeed with valid params", async () => {
  const adapter = makeAdapter();
  const plan: Plan = {
    summary: "record actual effort",
    steps: [
      {
        entity: "WorkPackage",
        operation: "recordActualEffort",
        params: { itemId: "51", effortActual: 8 },
      },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
});

Deno.test("WorkPackage recordActualEffort - should fail without itemId", async () => {
  const adapter = makeAdapter();
  const plan: Plan = {
    summary: "record actual effort no id",
    steps: [
      {
        entity: "WorkPackage",
        operation: "recordActualEffort",
        params: { effortActual: 8 },
      },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "itemId is required");
});

Deno.test("WorkPackage recordAnalysis - should succeed with valid params", async () => {
  const adapter = makeAdapter();
  const plan: Plan = {
    summary: "record analysis",
    steps: [
      {
        entity: "WorkPackage",
        operation: "recordAnalysis",
        params: {
          itemId: "51",
          body: JSON.stringify({
            planning_variance_review: "plan text",
            execution_variance_review: "exec text",
            improvement_suggestions: "suggest text",
          }),
        },
      },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
});

Deno.test("WorkPackage recordAnalysis - should fail without itemId", async () => {
  const adapter = makeAdapter();
  const plan: Plan = {
    summary: "record analysis no id",
    steps: [
      {
        entity: "WorkPackage",
        operation: "recordAnalysis",
        params: { body: "## Process Analysis\nreview text" },
      },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "itemId is required");
});

Deno.test("WorkPackage recordSessionMetrics - should succeed with valid params", async () => {
  const adapter = makeAdapter();
  const plan: Plan = {
    summary: "record session metrics",
    steps: [
      {
        entity: "WorkPackage",
        operation: "recordSessionMetrics",
        params: { itemId: "51", body: "## Session Metrics\n- Intent Alignment Rate: 5" },
      },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
});

Deno.test("WorkPackage recordSessionMetrics - should fail without itemId", async () => {
  const adapter = makeAdapter();
  const plan: Plan = {
    summary: "record session metrics no id",
    steps: [
      {
        entity: "WorkPackage",
        operation: "recordSessionMetrics",
        params: { body: "## Session Metrics\nmetrics text" },
      },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "itemId is required");
});

// ======== Board Integration Tests ========

function makeBoardMock() {
  let idx = 0;
  const calls: { cmd: string; args: string[] }[] = [];
  const responses = [
    // 1: gh issue view <id> --json id
    { code: 0, stdout: '{"id":"NODE_123"}', stderr: "" },
    // 2: gh api graphql -f query=...(getProjectIdQuery)
    { code: 0, stdout: '{"data":{"organization":{"projectV2":{"id":"PROJ_123"}}}}', stderr: "" },
    // 3: gh api graphql -f query=...(addItemMutation)
    { code: 0, stdout: '{"data":{"addProjectV2ItemById":{"item":{"id":"ITEM_123"}}}}', stderr: "" },
    // 4: gh api graphql -f query=...(readTextFieldValue)
    { code: 0, stdout: '{"data":{"node":{"fv":{"text":null}}}}', stderr: "" },
    // 5: gh api graphql -f query=...(resolveFieldId)
    {
      code: 0,
      stdout: '{"data":{"organization":{"projectV2":{"field":{"id":"FIELD_123"}}}}}',
      stderr: "",
    },
    // 6: gh api graphql -f query=...(resolveProjectNodeId)
    { code: 0, stdout: '{"data":{"organization":{"projectV2":{"id":"PROJ_123"}}}}', stderr: "" },
    // 7: gh project item-edit (setTextFieldValue)
    { code: 0, stdout: "", stderr: "" },
    // 8+: gh issue view/edit for bodyAppend fallback (recordSessionMetrics)
    { code: 0, stdout: '{"body":"Existing body content"}', stderr: "" },
    { code: 0, stdout: "", stderr: "" },
  ];
  const runner = (cmd: string, args: string[]): Promise<ExecuteResult> => {
    calls.push({ cmd, args });
    const r = responses[idx];
    idx++;
    return Promise.resolve(r ?? { code: 0, stdout: "", stderr: "" });
  };
  return { runner, calls };
}

function makeBoardMockAdapter(): PlanGatewayAdapter {
  const adapter = new PlanGatewayAdapter(makeBoardMock().runner);
  adapter.setScope(OWNER, REPO);
  adapter.setProjectBoardNumbers(99, 99);
  return adapter;
}

Deno.test("WorkPackage estimatePlannedEffort - should write to board field via setEffortField", async () => {
  const adapter = makeBoardMockAdapter();
  const result = await adapter.execute({
    summary: "estimate planned effort",
    steps: [{
      entity: "WorkPackage",
      operation: "estimatePlannedEffort",
      params: { itemId: "51", effortPlanned: 5 },
    }],
  });
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
});

Deno.test("WorkPackage recordActualEffort - should write to board field via setEffortField", async () => {
  const adapter = makeBoardMockAdapter();
  const result = await adapter.execute({
    summary: "record actual effort",
    steps: [{
      entity: "WorkPackage",
      operation: "recordActualEffort",
      params: { itemId: "51", effortActual: 8 },
    }],
  });
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
});

Deno.test("WorkPackage recordAnalysis - should read/write board field for process analysis", async () => {
  const responses: ExecuteResult[] = [
    { code: 0, stdout: '{"id":"NODE_123"}', stderr: "" },
    { code: 0, stdout: '{"data":{"organization":{"projectV2":{"id":"PROJ_123"}}}}', stderr: "" },
    {
      code: 0,
      stdout: '{"data":{"addProjectV2ItemById":{"item":{"id":"ITEM_123"}}}}',
      stderr: "",
    },
  ];
  for (let i = 0; i < 3; i++) {
    responses.push(
      {
        code: 0,
        stdout: '{"data":{"organization":{"projectV2":{"field":{"id":"FIELD_123"}}}}}',
        stderr: "",
      },
      { code: 0, stdout: '{"data":{"organization":{"projectV2":{"id":"PROJ_123"}}}}', stderr: "" },
    );
  }
  for (let i = 0; i < 3; i++) responses.push({ code: 0, stdout: "", stderr: "" });
  let responseIndex = 0;
  const adapter = makeAdapter(() => Promise.resolve(responses[responseIndex++]));
  adapter.setProjectBoardNumbers(99, 99);
  const result = await adapter.execute({
    summary: "record analysis",
    steps: [{
      entity: "WorkPackage",
      operation: "recordAnalysis",
      params: {
        itemId: "51",
        body: JSON.stringify({
          planning_variance_review: "plan text",
          execution_variance_review: "exec text",
          improvement_suggestions: "suggest text",
        }),
      },
    }],
  });
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
});

Deno.test("WorkPackage recordSessionMetrics - should write to board field for session metrics", async () => {
  const adapter = makeBoardMockAdapter();
  const result = await adapter.execute({
    summary: "record session metrics",
    steps: [{
      entity: "WorkPackage",
      operation: "recordSessionMetrics",
      params: { itemId: "51", body: "## Session Metrics\n- Intent Alignment Rate: 5" },
    }],
  });
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
});

// ======== KPT Board Integration Tests ========

function makeKptBoardMock(failFieldIndex?: number) {
  let idx = 0;
  const calls: { cmd: string; args: string[] }[] = [];
  const responses: { code: number; stdout: string; stderr: string }[] = [
    // 1: gh issue view <id> --json id
    { code: 0, stdout: '{"id":"NODE_123"}', stderr: "" },
    // 2: gh api graphql getProjectIdQuery
    { code: 0, stdout: '{"data":{"organization":{"projectV2":{"id":"PROJ_123"}}}}', stderr: "" },
    // 3: gh api graphql addItemMutation
    { code: 0, stdout: '{"data":{"addProjectV2ItemById":{"item":{"id":"ITEM_123"}}}}', stderr: "" },
  ];
  // 4 フィールド分 × (resolveFieldId, resolveProjectNodeId, item-edit)
  for (let i = 0; i < 4; i++) {
    responses.push(
      {
        code: 0,
        stdout: '{"data":{"organization":{"projectV2":{"field":{"id":"FIELD_123"}}}}}',
        stderr: "",
      },
      { code: 0, stdout: '{"data":{"organization":{"projectV2":{"id":"PROJ_123"}}}}', stderr: "" },
      failFieldIndex === i
        ? { code: 1, stdout: "", stderr: `failed to set field ${i}` }
        : { code: 0, stdout: "", stderr: "" },
    );
  }
  const runner = (cmd: string, args: string[]): Promise<ExecuteResult> => {
    calls.push({ cmd, args });
    const r = responses[idx];
    idx++;
    return Promise.resolve(r ?? { code: 0, stdout: "", stderr: "" });
  };
  return { runner, calls };
}

function makeKptBoardMockAdapter(failFieldIndex?: number): PlanGatewayAdapter {
  const adapter = new PlanGatewayAdapter(makeKptBoardMock(failFieldIndex).runner);
  adapter.setScope(OWNER, REPO);
  adapter.setProjectBoardNumbers(99, 99);
  return adapter;
}

const SAMPLE_KPT = {
  keep: "#### Keep\n\n- Good communication",
  problem: "#### Problem\n\n- Scope was unclear",
  try: "#### Try\n\n- Define scope earlier",
  advise: "#### Advise\n\n- Use checklists",
};

Deno.test("WorkPackage recordKpt - should write to 4 board fields", async () => {
  const mock = makeKptBoardMock();
  const adapter = new PlanGatewayAdapter(mock.runner);
  adapter.setScope(OWNER, REPO);
  adapter.setProjectBoardNumbers(99, 99);
  const result = await adapter.execute({
    summary: "record kpt",
    steps: [{
      entity: "WorkPackage",
      operation: "recordKpt",
      params: { itemId: "51", kpt: SAMPLE_KPT },
    }],
  });
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
  const editCalls = mock.calls.filter((c) => c.args.includes("item-edit"));
  assertEquals(editCalls.length, 4);
  const fieldCalls = mock.calls.filter((c) => c.args.some((a) => a.includes("fieldName=")));
  assertEquals(fieldCalls.length, 4);
  const joined = fieldCalls.map((c) => c.args.join(" ")).join("\n");
  assertStringIncludes(joined, "harness-kpt-keep");
  assertStringIncludes(joined, "harness-kpt-problem");
  assertStringIncludes(joined, "harness-kpt-try");
  assertStringIncludes(joined, "harness-kpt-advise");
  const editJoined = editCalls.map((c) => c.args.join(" ")).join("\n");
  assertStringIncludes(editJoined, "Good communication");
  assertStringIncludes(editJoined, "Scope was unclear");
  assertStringIncludes(editJoined, "Define scope earlier");
  assertStringIncludes(editJoined, "Use checklists");
});

Deno.test("WorkPackage recordKpt - should report failure when a field write fails", async () => {
  const adapter = makeKptBoardMockAdapter(2);
  const result = await adapter.execute({
    summary: "record kpt",
    steps: [{
      entity: "WorkPackage",
      operation: "recordKpt",
      params: { itemId: "51", kpt: SAMPLE_KPT },
    }],
  });
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "failed to set field 2");
});

Deno.test("WorkPackage recordKpt - should fail without itemId", async () => {
  const adapter = makeKptBoardMockAdapter();
  const result = await adapter.execute({
    summary: "record kpt",
    steps: [{
      entity: "WorkPackage",
      operation: "recordKpt",
      params: { kpt: SAMPLE_KPT },
    }],
  });
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "itemId is required");
});

Deno.test("WorkPackage recordKpt - should succeed with empty advise (no write for empty field)", async () => {
  const mock = makeKptBoardMock();
  const adapter = new PlanGatewayAdapter(mock.runner);
  adapter.setScope(OWNER, REPO);
  adapter.setProjectBoardNumbers(99, 99);
  const result = await adapter.execute({
    summary: "record kpt",
    steps: [{
      entity: "WorkPackage",
      operation: "recordKpt",
      params: { itemId: "51", kpt: { keep: "K", problem: "P", try: "T", advise: "" } },
    }],
  });
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
  const editCalls = mock.calls.filter((c) => c.args.includes("item-edit"));
  assertEquals(editCalls.length, 3);
  const fieldCalls = mock.calls.filter((c) => c.args.some((a) => a.includes("fieldName=")));
  assertEquals(fieldCalls.length, 3);
  const joined = fieldCalls.map((c) => c.args.join(" ")).join("\n");
  assertStringIncludes(joined, "harness-kpt-keep");
  assertStringIncludes(joined, "harness-kpt-problem");
  assertStringIncludes(joined, "harness-kpt-try");
  assertEquals(joined.includes("harness-kpt-advise"), false);
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

/**
 * ユースケース: handleFindItem が ProjectV2 の全 harness-* フィールド（KPT・メトリクス等）を
 *   projectItems[].fields として取得・公開すること
 * 検証意図: 従来は size/effort/status のみだった取得対象を拡張し、セッションKPTやスプリント
 *   メトリクス等の読み取りを可能にする（read-project-state の取得不足の解消）。
 */
Deno.test("WorkPackage view - should expose all harness ProjectV2 fields in projectItems", async () => {
  const harness = HARNESS_FIELDS as readonly string[];
  const kptKeepIndex = harness.indexOf(FIELD.kptKeep);
  const metricsSummaryIndex = harness.indexOf(FIELD.metricsSummary);
  const calls: { cmd: string; args: string[] }[] = [];
  let callCount = 0;
  const adapter = makeAdapter((cmd, args) => {
    calls.push({ cmd, args });
    callCount++;
    if (callCount === 1) {
      return Promise.resolve({
        code: 0,
        stdout: JSON.stringify({
          number: 51,
          title: "WP_1",
          body: "body",
          labels: [{ name: "type:WP" }],
          id: "node-wp-51",
        }),
        stderr: "",
      });
    }
    const node: Record<string, unknown> = {
      id: "pvti-51",
      project: { title: "Sprint Board", number: 11 },
      status: { name: "Done" },
    };
    node[`f${kptKeepIndex}`] = { text: "粒度が安定" };
    node[`f${metricsSummaryIndex}`] = { text: '{"intent_alignment_score":4}' };
    return Promise.resolve({
      code: 0,
      stdout: JSON.stringify({
        data: { repository: { issue: { projectItems: { nodes: [node] } } } },
      }),
      stderr: "",
    });
  });
  const plan: Plan = {
    summary: "view WP",
    steps: [{ entity: "WorkPackage", operation: "view", params: { itemId: "51" } }],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
  // GraphQL enrich クエリが KPT フィールド名を SELECT していること
  const gqlCall = calls.find((c) => c.args.join(" ").includes("api graphql"));
  assert(gqlCall, "api graphql call should be issued");
  assertStringIncludes(gqlCall!.args.join(" "), FIELD.kptKeep);
  // 出力に fields マップとして反映されること
  const output = result.stepResults[0].output as Record<string, unknown>;
  const items = output.projectItems as Array<Record<string, unknown>>;
  assertEquals(items.length, 1);
  const fields = items[0].fields as Record<string, unknown>;
  assertEquals(fields[FIELD.kptKeep], "粒度が安定");
  assertEquals(fields[FIELD.metricsSummary], '{"intent_alignment_score":4}');
  // V2 ビルトイン Status も fields に統合されること
  assertEquals(fields["Status"], "Done");
});

// ===== Sprint recordVelocity =====

/**
 * @description upsertVelocitySection が既存の `## Goal` セクションを保持しつつ `## Velocity` を追記すること
 * @verify 結果に Goal と Velocity の両セクションが含まれること
 */
Deno.test("upsertVelocitySection - should append Velocity section preserving Goal", () => {
  const current = "## Goal\n\nスプリントゴール\n";
  const velocity = "## Velocity\n\n3 PBI / 8 points / 67% 一致 / 乖離要約";
  const result = upsertVelocitySection(current, velocity);
  assertStringIncludes(result, "## Goal");
  assertStringIncludes(result, "スプリントゴール");
  assertStringIncludes(result, "## Velocity");
  assertStringIncludes(result, "3 PBI / 8 points / 67% 一致 / 乖離要約");
});

/**
 * @description upsertVelocitySection が既存の Velocity セクションを置換すること
 * @verify 置換後も他セクションが保持され、Velocity セクションが1つだけになること
 */
Deno.test("upsertVelocitySection - should replace existing Velocity section", () => {
  const current = "## Goal\n\nゴール\n\n## Velocity\n\n旧ベロシティ\n";
  const velocity = "## Velocity\n\n新ベロシティ\n";
  const result = upsertVelocitySection(current, velocity);
  assertStringIncludes(result, "## Goal");
  assertStringIncludes(result, "新ベロシティ");
  assert(!result.includes("旧ベロシティ"));
  assertEquals((result.match(/## Velocity/g) ?? []).length, 1);
});

/**
 * @description upsertVelocitySection がセクション未存在時に末尾へ追記すること
 * @verify Goal のみの内容に Velocity が追記されること
 */
Deno.test("upsertVelocitySection - should append when no section exists", () => {
  const current = "plain description";
  const velocity = "## Velocity\n\n1 PBI / 3 points / 100% 一致 / 全一致";
  const result = upsertVelocitySection(current, velocity);
  assertStringIncludes(result, "plain description");
  assertStringIncludes(result, "## Velocity");
});

/**
 * @description upsertVelocitySection が Velocity セクションを中間に持つ文書で後続セクションの空行を保持すること
 * @verify Goal→Velocity→Notes の順で Velocity 置換後も Notes が見出しとして機能すること
 */
Deno.test("upsertVelocitySection - should preserve following section when Velocity is in the middle", () => {
  const current = "## Goal\n\nゴール\n\n## Velocity\n\n旧ベロシティ\n\n## Notes\n\nメモ\n";
  const velocity = "## Velocity\n\n新ベロシティ";
  const result = upsertVelocitySection(current, velocity);
  assertStringIncludes(result, "## Goal");
  assertStringIncludes(result, "新ベロシティ");
  assertStringIncludes(result, "## Notes");
  assertStringIncludes(result, "\n\nメモ");
  assert(!result.includes("旧ベロシティ"));
});

/**
 * @description upsertVelocitySection が複数の Velocity セクションを全て置換すること
 * @verify 置換後は Velocity セクションが1つだけになること
 */
Deno.test("upsertVelocitySection - should replace all Velocity sections", () => {
  const current = "## Velocity\n\n旧1\n\n## Velocity\n\n旧2\n\n## Goal\n\nゴール\n";
  const velocity = "## Velocity\n\n新ベロシティ";
  const result = upsertVelocitySection(current, velocity);
  assertEquals((result.match(/## Velocity/g) ?? []).length, 1);
  assertStringIncludes(result, "新ベロシティ");
  assert(!result.includes("旧1"));
  assert(!result.includes("旧2"));
  assertStringIncludes(result, "## Goal");
});

/**
 * @description upsertVelocitySection が `## Velocity History` 等の類似見出しを誤マッチしないこと
 * @verify Velocity セクションが存在しないため末尾に追記されること
 */
Deno.test("upsertVelocitySection - should not match Velocity History heading", () => {
  const current = "## Goal\n\nゴール\n\n## Velocity History\n\n履歴\n";
  const velocity = "## Velocity\n\n新ベロシティ";
  const result = upsertVelocitySection(current, velocity);
  assertStringIncludes(result, "## Velocity History");
  assertStringIncludes(result, "履歴");
  assertStringIncludes(result, "## Velocity\n\n新ベロシティ");
});

/**
 * @description Sprint recordVelocity が Milestone description を取得し PATCH で更新すること
 * @verify GET 後に PATCH が呼ばれ、velocity が Velocity セクションに含まれること
 */
Deno.test("Sprint recordVelocity - should update milestone description with velocity", async () => {
  let callCount = 0;
  const runner = (_cmd: string, args: string[]): Promise<ExecuteResult> => {
    callCount++;
    if (callCount === 1) {
      return Promise.resolve({
        code: 0,
        stdout: JSON.stringify({ description: "## Goal\n\nゴール\n" }),
        stderr: "",
      });
    }
    if (callCount === 2) {
      const patchArgs = args.join(" ");
      assertStringIncludes(patchArgs, "PATCH");
      assertStringIncludes(patchArgs, "repos/my-org/my-repo/milestones/5");
      assertStringIncludes(patchArgs, "description=");
      assertStringIncludes(patchArgs, "## Velocity");
      assertStringIncludes(patchArgs, "3 PBI / 8 points / 67% 一致 / 乖離");
      return Promise.resolve({ code: 0, stdout: "{}", stderr: "" });
    }
    return Promise.resolve({ code: 0, stdout: "", stderr: "" });
  };
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "Record velocity",
    steps: [
      {
        entity: "Sprint",
        operation: "recordVelocity",
        params: {
          itemId: "5",
          title: "Sprint 5",
          velocity: {
            sprintNumber: 5,
            pbiCount: 3,
            totalWeight: 8,
            matchRate: 2 / 3,
            summary: "乖離",
          },
        },
      },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
  assertEquals(result.stepResults[0].itemId, "5");
  assertEquals(callCount, 2);
});

/**
 * @description Sprint recordVelocity が summary 内の改行を1行に正規化して PATCH すること
 * @verify 改行がスペースに変換され Velocity セクションが破壊されないこと
 */
Deno.test("Sprint recordVelocity - should normalize newlines in summary", async () => {
  let callCount = 0;
  const runner = (_cmd: string, args: string[]): Promise<ExecuteResult> => {
    callCount++;
    if (callCount === 1) {
      return Promise.resolve({
        code: 0,
        stdout: JSON.stringify({ description: "" }),
        stderr: "",
      });
    }
    if (callCount === 2) {
      const patchArgs = args.join(" ");
      assertStringIncludes(patchArgs, "line1 line2");
      assert(!patchArgs.includes("line1\nline2"));
      return Promise.resolve({ code: 0, stdout: "{}", stderr: "" });
    }
    return Promise.resolve({ code: 0, stdout: "", stderr: "" });
  };
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "Record velocity",
    steps: [
      {
        entity: "Sprint",
        operation: "recordVelocity",
        params: {
          itemId: "5",
          title: "Sprint 5",
          velocity: {
            sprintNumber: 5,
            pbiCount: 1,
            totalWeight: 3,
            matchRate: 1,
            summary: "line1\nline2",
          },
        },
      },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults[0].success, true);
  assertEquals(callCount, 2);
});

/**
 * @description Sprint recordVelocity が velocity 欠落時にエラーを返すこと
 * @verify 成功せず、エラーメッセージに velocity が含まれること
 */
Deno.test("Sprint recordVelocity - should fail when velocity is missing", async () => {
  const { runner, calls } = mockRunner();
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "Record velocity",
    steps: [
      {
        entity: "Sprint",
        operation: "recordVelocity",
        params: { itemId: "5" },
      },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "velocity");
  assertEquals(calls.length, 0);
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
 * Sprint endSprint - 既closedマイルストーンへの再実行も成功する（冪等確認）。
 * ユースケース: スプリント終了処理の二重実行。
 * 検証意図: Milestoneのstate=closedへのPATCHはAPI側で冪等であり、2回とも同一の
 * close要求として成功すること（Issue closeとは別経路のため実装対象外）を確認する。
 */
Deno.test("Sprint endSprint - should succeed on already closed milestone", async () => {
  const { runner, calls } = mockRunner();
  const adapter = makeAdapter(runner);
  const runTwice: Plan = {
    summary: "end sprint twice",
    steps: [
      { entity: "Sprint", operation: "endSprint", params: { itemId: "5" } },
      { entity: "Sprint", operation: "endSprint", params: { itemId: "5" } },
    ],
  };
  const result = await adapter.execute(runTwice);
  assertEquals(result.stepResults.length, 2);
  assertEquals(result.stepResults[0].success, true);
  assertEquals(result.stepResults[1].success, true);
  assertEquals(calls.length, 2);
  for (const call of calls) {
    assertStringIncludes(call.args.join(" "), "/milestones/5");
    assertStringIncludes(call.args.join(" "), "state=closed");
  }
});

/**
 *  Sprint setGoal - gh api -X PATCH milestones/:number with description が呼ばれることを検証する。
 *  M6対応: GET（既存description確認）→ PATCH（更新）の2回呼び出しになること
 */
Deno.test("Sprint setGoal - should call gh api GET then PATCH milestones with description", async () => {
  let callCount = 0;
  const runner = (_cmd: string, _args: string[]): Promise<ExecuteResult> => {
    callCount++;
    if (callCount === 1) {
      return Promise.resolve({
        code: 0,
        stdout: JSON.stringify({ description: "old goal" }),
        stderr: "",
      });
    }
    return Promise.resolve({ code: 0, stdout: "", stderr: "" });
  };
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
  assertEquals(callCount, 2);
});

/**
 *  Sprint setGoal - 既存descriptionに Velocity セクションがある場合、PATCH に Velocity が保持されることを検証する。
 *  M6対応: setGoal 実行後も Velocity セクションが消えないこと
 */
Deno.test("Sprint setGoal - should preserve Velocity section when setting goal", async () => {
  let callCount = 0;
  const runner = (_cmd: string, args: string[]): Promise<ExecuteResult> => {
    callCount++;
    if (callCount === 1) {
      return Promise.resolve({
        code: 0,
        stdout: JSON.stringify({ description: "## Velocity\n\n旧ベロシティ\n" }),
        stderr: "",
      });
    }
    const patchArgs = args.join(" ");
    assertStringIncludes(patchArgs, "description=");
    assertStringIncludes(patchArgs, "## Velocity");
    assertStringIncludes(patchArgs, "旧ベロシティ");
    return Promise.resolve({ code: 0, stdout: "", stderr: "" });
  };
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "set sprint goal",
    steps: [
      {
        entity: "Sprint",
        operation: "setGoal",
        params: { itemId: "5", title: "Sprint 18", description: "New goal" },
      },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults[0].success, true);
  assertEquals(callCount, 2);
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
        id: "node-id-epic-42",
        number: 42,
        title: "Auth Epic",
        body: "## Description\n\nAuth features",
        subIssues: {
          nodes: [
            {
              id: "node-id-feature-43",
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
    identifier: { title: { value: string }; code?: string; id?: string };
    features: { items: Array<{ identifier: { title: { value: string }; id?: string } }> };
  };
  assertEquals(output.identifier.code, "42");
  assertEquals(output.identifier.id, "node-id-epic-42");
  assertEquals(output.identifier.title.value, "Auth Epic");
  assertEquals(output.features.items.length, 1);
  assertEquals(output.features.items[0].identifier.title.value, "Login Feature");
  assertEquals(output.features.items[0].identifier.id, "node-id-feature-43");
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

// ======== Retrospective Integration Tests ========

/**
 * ユースケース: Retrospective の plan 操作が type:Retrospective ラベル＋Milestone（Sprint）で Issue を作成すること
 * 検証意図: handleCreateItem が type:Retrospective で呼ばれ、gh issue create --label type:Retrospective と
 *           --milestone <sprint> が発行されることを確認する
 */
Deno.test("Retrospective plan - should create issue with type:Retrospective label and milestone", async () => {
  const { runner, calls } = mockRunner();
  const adapter = new PlanGatewayAdapter(runner);
  adapter.setScope(OWNER, REPO);
  const result = await adapter.execute({
    summary: "Plan retrospective: Sprint 20 Retrospective",
    steps: [{
      entity: "Retrospective",
      operation: "plan",
      params: {
        title: "Sprint 20 Retrospective",
        body: "",
        sprint: "Sprint 20",
      },
    }],
  });
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
  const createCall = calls.find((c) => c.args.includes("create"));
  assert(createCall, "gh issue create should be called");
  assertStringIncludes(createCall.args.join(" "), "--label type:Retrospective");
  assertStringIncludes(createCall.args.join(" "), "--milestone Sprint 20");
});

/**
 * ユースケース: Retrospective の plan 操作が作成した Issue を Retrospective Board へ追加すること
 * 検証意図: retrospectiveBoardNumber が設定されている場合、addItemToProject が呼ばれることを確認する
 */
Deno.test("Retrospective plan - should add created issue to Retrospective Board", async () => {
  let idx = 0;
  const calls: { cmd: string; args: string[] }[] = [];
  const responses: { code: number; stdout: string; stderr: string }[] = [
    // 1: gh issue create
    { code: 0, stdout: "https://github.com/my-org/my-repo/issues/101", stderr: "" },
    // 2: gh issue view <id> --json id
    { code: 0, stdout: '{"id":"NODE_RETRO"}', stderr: "" },
    // 3: gh api graphql getProjectIdQuery
    { code: 0, stdout: '{"data":{"organization":{"projectV2":{"id":"PROJ_RETRO"}}}}', stderr: "" },
    // 4: gh api graphql addItemMutation
    {
      code: 0,
      stdout: '{"data":{"addProjectV2ItemById":{"item":{"id":"ITEM_RETRO"}}}}',
      stderr: "",
    },
  ];
  const runner = (cmd: string, args: string[]): Promise<ExecuteResult> => {
    calls.push({ cmd, args });
    return Promise.resolve(responses[idx++] ?? { code: 0, stdout: "", stderr: "" });
  };
  const adapter = new PlanGatewayAdapter(runner);
  adapter.setScope(OWNER, REPO);
  adapter.setProjectBoardNumbers(99, 99, 12);
  const result = await adapter.execute({
    summary: "Plan retrospective: Sprint 20 Retrospective",
    steps: [{
      entity: "Retrospective",
      operation: "plan",
      params: {
        title: "Sprint 20 Retrospective",
        body: "",
        sprint: "Sprint 20",
      },
    }],
  });
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
  const addCall = calls.find((c) => c.args.some((a) => a.includes("addProjectV2ItemById")));
  assert(addCall, "addItemToProject should be called");
});

/**
 * ユースケース: Retrospective の archive 操作が Issue をクローズすること
 * 検証意図: handleCloseItem が呼ばれ、gh issue close が発行されることを確認する
 */
Deno.test("Retrospective archive - should close the issue", async () => {
  const { runner, calls } = mockRunner();
  const adapter = new PlanGatewayAdapter(runner);
  adapter.setScope(OWNER, REPO);
  const result = await adapter.execute({
    summary: "Archive retrospective: Sprint 20 Retrospective",
    steps: [{
      entity: "Retrospective",
      operation: "archive",
      params: { itemId: "101", state: "closed" },
    }],
  });
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
  const closeCall = calls.find((c) => c.args.includes("close"));
  assert(closeCall, "gh issue close should be called");
  assertStringIncludes(closeCall.args.join(" "), "101");
});

/**
 * ユースケース: Retrospective の view 操作が Issue 詳細を取得すること
 * 検証意図: handleFindItem が呼ばれ、gh issue view が発行されることを確認する
 */
Deno.test("Retrospective view - should fetch the issue details", async () => {
  const viewOutput = JSON.stringify({
    number: 101,
    title: "Sprint 20 Retrospective",
    body: "## Sprint Retrospective",
    labels: [{ name: "type:Retrospective" }],
    id: "node-retro-101",
  });
  const adapter = makeAdapter(fixedRunner(viewOutput));
  const result = await adapter.execute({
    summary: "Find retrospective: Sprint 20 Retrospective",
    steps: [{
      entity: "Retrospective",
      operation: "view",
      params: { itemId: "101" },
    }],
  });
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
  assertEquals(result.stepResults[0].itemId, "101");
});

/**
 * ユースケース: Retrospective の search 操作が type:Retrospective ラベルで検索すること
 * 検証意図: handleSearchItems が type:Retrospective で呼ばれ、gh issue list --label type:Retrospective が発行されることを確認する
 */
Deno.test("Retrospective search - should search issues with type:Retrospective label", async () => {
  const listOutput = JSON.stringify([
    { number: 101, title: "Sprint 20 Retrospective" },
  ]);
  const { runner, calls } = mockRunner();
  const adapter = new PlanGatewayAdapter(
    (cmd, args) => runner(cmd, args).then(() => ({ code: 0, stdout: listOutput, stderr: "" })),
  );
  adapter.setScope(OWNER, REPO);
  const result = await adapter.execute({
    summary: "Search Retrospective: (all)",
    steps: [{
      entity: "Retrospective",
      operation: "search",
      params: {},
    }],
  });
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
  const listCall = calls.find((c) => c.args.includes("list"));
  assert(listCall, "gh issue list should be called");
  assertStringIncludes(listCall.args.join(" "), "--label type:Retrospective");
});

/**
 * ユースケース: Retrospective の recordSprintKpt 操作が itemId なしでエラーを返すこと
 * 検証意図: 記録Stepで itemId が必須であり、欠落時はエラーになることを確認する
 */
Deno.test("Retrospective recordSprintKpt - should fail without itemId", async () => {
  const adapter = new PlanGatewayAdapter(mockRunner().runner);
  adapter.setScope(OWNER, REPO);
  const result = await adapter.execute({
    summary: "Record Sprint KPT: Sprint 20 Retrospective",
    steps: [{
      entity: "Retrospective",
      operation: "recordSprintKpt",
      params: { body: "## KPTA\n\n### Keep\n- Good" },
    }],
  });
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "itemId");
});

/**
 * ユースケース: Retrospective の recordSprintMetrics 操作が itemId なしでエラーを返すこと
 * 検証意図: 記録Stepで itemId が必須であり、欠落時はエラーになることを確認する
 */
Deno.test("Retrospective recordSprintMetrics - should fail without itemId", async () => {
  const adapter = new PlanGatewayAdapter(mockRunner().runner);
  adapter.setScope(OWNER, REPO);
  const result = await adapter.execute({
    summary: "Record Sprint Metrics: Sprint 20 Retrospective",
    steps: [{
      entity: "Retrospective",
      operation: "recordSprintMetrics",
      params: { body: "## Sprint Metrics\n- **Goal Achievement Score**: 5" },
    }],
  });
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "itemId");
});

// ======== Retrospective Board Field-Write Tests (AC-2) ========

/** Retrospective Board へのフィールド書込テスト用モック。fieldCount 分のフィールド応答を生成する。 */
function makeRetroBoardMock(
  fieldCount: number,
  failFieldIndex?: number,
  options: { withBodyAppend?: boolean } = {},
) {
  let idx = 0;
  const calls: { cmd: string; args: string[] }[] = [];
  const responses: { code: number; stdout: string; stderr: string }[] = [
    // 1: gh issue view <id> --json id
    { code: 0, stdout: '{"id":"NODE_RETRO"}', stderr: "" },
    // 2: gh api graphql getProjectIdQuery
    { code: 0, stdout: '{"data":{"organization":{"projectV2":{"id":"PROJ_RETRO"}}}}', stderr: "" },
    // 3: gh api graphql addItemMutation
    {
      code: 0,
      stdout: '{"data":{"addProjectV2ItemById":{"item":{"id":"ITEM_RETRO"}}}}',
      stderr: "",
    },
  ];
  for (let i = 0; i < fieldCount; i++) {
    responses.push(
      {
        code: 0,
        stdout: '{"data":{"organization":{"projectV2":{"field":{"id":"FIELD_RETRO"}}}}}',
        stderr: "",
      },
      {
        code: 0,
        stdout: '{"data":{"organization":{"projectV2":{"id":"PROJ_RETRO"}}}}',
        stderr: "",
      },
      failFieldIndex === i
        ? { code: 1, stdout: "", stderr: `failed to set retro field ${i}` }
        : { code: 0, stdout: "", stderr: "" },
    );
  }
  if (options.withBodyAppend) {
    // gh issue view <id> --json body（Body追記用の現在値取得）
    responses.push({ code: 0, stdout: '{"body":"Existing"}', stderr: "" });
    // gh issue edit <id> --body <newBody>
    responses.push({ code: 0, stdout: "", stderr: "" });
  }
  const runner = (cmd: string, args: string[]): Promise<ExecuteResult> => {
    calls.push({ cmd, args });
    const r = responses[idx];
    idx++;
    return Promise.resolve(r ?? { code: 0, stdout: "", stderr: "" });
  };
  return { runner, calls };
}

const SAMPLE_SPRINT_KPT = {
  keep: "#### Keep\n\n- Good retrospective",
  problem: "#### Problem\n\n- Scope was unclear",
  try: "#### Try\n\n- Define scope earlier",
  advise: "#### Advise\n\n- Use checklists",
};

const SAMPLE_SPRINT_METRICS = {
  summary: {
    goalAchievementScore: 5,
    estimationAccuracyScore: 4,
    qualityIntegrityScore: 5,
    collaborationDisciplineScore: 4,
    velocity: 8,
  },
  goalAchievement: "Goals met",
  estimationAccuracy: "Accurate",
  qualityIntegrity: "High quality",
  collaborationDiscipline: "Disciplined",
  velocity: "Stable velocity",
};

const SAMPLE_SESSION_METRICS = {
  summary: {
    intentAlignmentScore: 5,
    constraintAdherenceScore: 4,
    contextExtractionScore: 5,
    workSizeStabilityScore: 4,
  },
  intentAlignment: "Aligned",
  constraintAdherence: "Compliant",
  contextExtraction: "Extracted",
  workSizeStability: "Stable",
};

/**
 * ユースケース: Retrospective の recordSprintKpt が harness-kpt-* 4フィールドに書込むこと
 * 検証意図: kpta の Keep/Problem/Try/Advise が4つの個別フィールドへ書き込まれ、成功を返すことを確認する
 */
Deno.test("Retrospective recordSprintKpt - should write kpta to 4 harness-kpt-* fields", async () => {
  const mock = makeRetroBoardMock(4);
  const adapter = new PlanGatewayAdapter(mock.runner);
  adapter.setScope(OWNER, REPO);
  adapter.setProjectBoardNumbers(99, 99, 12);
  const result = await adapter.execute({
    summary: "Record Sprint KPT: Sprint 20 Retrospective",
    steps: [{
      entity: "Retrospective",
      operation: "recordSprintKpt",
      params: { itemId: "101", kpta: SAMPLE_SPRINT_KPT },
    }],
  });
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
  const fieldCalls = mock.calls.filter((c) => c.args.some((a) => a.includes("fieldName=")));
  assertEquals(fieldCalls.length, 4);
  const joined = fieldCalls.map((c) => c.args.join(" ")).join("\n");
  assertStringIncludes(joined, "harness-kpt-keep");
  assertStringIncludes(joined, "harness-kpt-problem");
  assertStringIncludes(joined, "harness-kpt-try");
  assertStringIncludes(joined, "harness-kpt-advise");
  const editCalls = mock.calls.filter((c) => c.args.includes("item-edit"));
  assertEquals(editCalls.length, 4);
  const editJoined = editCalls.map((c) => c.args.join(" ")).join("\n");
  assertStringIncludes(editJoined, "Good retrospective");
  assertStringIncludes(editJoined, "Scope was unclear");
  assertStringIncludes(editJoined, "Define scope earlier");
  assertStringIncludes(editJoined, "Use checklists");
});

/**
 * ユースケース: Retrospective の recordSprintMetrics が harness-metrics-summary と5指標独立フィールドに書込むこと
 * 検証意図: summary が snake_case ネスト JSON として書き込まれ、5指標ナラティブが独立フィールドへ書き込まれることを確認する
 */
Deno.test("Retrospective recordSprintMetrics - should write summary and 5 narrative fields", async () => {
  const mock = makeRetroBoardMock(6);
  const adapter = new PlanGatewayAdapter(mock.runner);
  adapter.setScope(OWNER, REPO);
  adapter.setProjectBoardNumbers(99, 99, 12);
  const result = await adapter.execute({
    summary: "Record Sprint Metrics: Sprint 20 Retrospective",
    steps: [{
      entity: "Retrospective",
      operation: "recordSprintMetrics",
      params: { itemId: "101", metrics: SAMPLE_SPRINT_METRICS },
    }],
  });
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
  const fieldCalls = mock.calls.filter((c) => c.args.some((a) => a.includes("fieldName=")));
  assertEquals(fieldCalls.length, 6);
  const joined = fieldCalls.map((c) => c.args.join(" ")).join("\n");
  assertStringIncludes(joined, "harness-metrics-summary");
  assertStringIncludes(joined, "harness-metrics-goal-achievement");
  assertStringIncludes(joined, "harness-metrics-estimation-accuracy");
  assertStringIncludes(joined, "harness-metrics-quality-integrity");
  assertStringIncludes(joined, "harness-metrics-collaboration-discipline");
  assertStringIncludes(joined, "harness-metrics-velocity");
  const editCalls = mock.calls.filter((c) => c.args.includes("item-edit"));
  assertEquals(editCalls.length, 6);
  const editJoined = editCalls.map((c) => c.args.join(" ")).join("\n");
  assertStringIncludes(editJoined, "goal_achievement_rate");
  assertStringIncludes(editJoined, "velocity");
  assertStringIncludes(editJoined, "Goals met");
  assertStringIncludes(editJoined, "Stable velocity");
});

/**
 * ユースケース: WorkPackage の recordSessionMetrics が harness-metrics-summary と4指標独立フィールドに書込むこと
 * 検証意図: セッションメトリクスが新フィールド構成（summary＋4指標）で Sprint Board に書き込まれることを確認する
 */
Deno.test("WorkPackage recordSessionMetrics - should write new summary and 4 narrative fields", async () => {
  const mock = makeRetroBoardMock(5);
  const adapter = new PlanGatewayAdapter(mock.runner);
  adapter.setScope(OWNER, REPO);
  adapter.setProjectBoardNumbers(99, 99);
  const result = await adapter.execute({
    summary: "Record session metrics: WP 51",
    steps: [{
      entity: "WorkPackage",
      operation: "recordSessionMetrics",
      params: { itemId: "51", metrics: SAMPLE_SESSION_METRICS },
    }],
  });
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
  const fieldCalls = mock.calls.filter((c) => c.args.some((a) => a.includes("fieldName=")));
  assertEquals(fieldCalls.length, 5);
  const joined = fieldCalls.map((c) => c.args.join(" ")).join("\n");
  assertStringIncludes(joined, "harness-metrics-summary");
  assertStringIncludes(joined, "harness-metrics-intent-alignment");
  assertStringIncludes(joined, "harness-metrics-constraint-adherence");
  assertStringIncludes(joined, "harness-metrics-context-extraction");
  assertStringIncludes(joined, "harness-metrics-work-size-stability");
  const editCalls = mock.calls.filter((c) => c.args.includes("item-edit"));
  assertEquals(editCalls.length, 5);
  const editJoined = editCalls.map((c) => c.args.join(" ")).join("\n");
  assertStringIncludes(editJoined, "intent_alignment_score");
  assertStringIncludes(editJoined, "work_size_stability_score");
  assertStringIncludes(editJoined, "Aligned");
  assertStringIncludes(editJoined, "Stable");
});

// ======== Retrospective Failure-Path Tests (Phase3 review) ========

/**
 * ユースケース: Retrospective の recordSprintKpt がフィールド書込失敗時にエラーを返すこと
 * 検証意図: フィールド書込のエラーが集約され、失敗が報告されることを確認する
 */
Deno.test("Retrospective recordSprintKpt - should report field write failure", async () => {
  const mock = makeRetroBoardMock(4, 2);
  const adapter = new PlanGatewayAdapter(mock.runner);
  adapter.setScope(OWNER, REPO);
  adapter.setProjectBoardNumbers(99, 99, 12);
  const result = await adapter.execute({
    summary: "Record Sprint KPT: Sprint 20 Retrospective",
    steps: [{
      entity: "Retrospective",
      operation: "recordSprintKpt",
      params: { itemId: "101", kpta: SAMPLE_SPRINT_KPT },
    }],
  });
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "failed to set retro field 2");
});

/**
 * ユースケース: Retrospective の recordSprintMetrics がフィールド書込失敗時にエラーを返すこと
 * 検証意図: summary 書込のエラーが報告されることを確認する
 */
Deno.test("Retrospective recordSprintMetrics - should report field write failure", async () => {
  const mock = makeRetroBoardMock(6, 0);
  const adapter = new PlanGatewayAdapter(mock.runner);
  adapter.setScope(OWNER, REPO);
  adapter.setProjectBoardNumbers(99, 99, 12);
  const result = await adapter.execute({
    summary: "Record Sprint Metrics: Sprint 20 Retrospective",
    steps: [{
      entity: "Retrospective",
      operation: "recordSprintMetrics",
      params: { itemId: "101", metrics: SAMPLE_SPRINT_METRICS },
    }],
  });
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "failed to set retro field 0");
});

/**
 * ユースケース: Retrospective の recordSprintKpt が body 指定時に Issue Body へ追記すること
 * 検証意図: フィールド書込に加え、params.body が handleUpdateItem で反映されることを確認する
 */
Deno.test("Retrospective recordSprintKpt - should append body to Issue body", async () => {
  const mock = makeRetroBoardMock(4, undefined, { withBodyAppend: true });
  const adapter = new PlanGatewayAdapter(mock.runner);
  adapter.setScope(OWNER, REPO);
  adapter.setProjectBoardNumbers(99, 99, 12);
  const result = await adapter.execute({
    summary: "Record Sprint KPT: Sprint 20 Retrospective",
    steps: [{
      entity: "Retrospective",
      operation: "recordSprintKpt",
      params: {
        itemId: "101",
        kpta: SAMPLE_SPRINT_KPT,
        body: "## KPTA\n\n### Keep\n- Good retrospective",
      },
    }],
  });
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
  const bodyEdit = mock.calls.find((c) => c.args.includes("--body"));
  assert(bodyEdit, "gh issue edit --body should be called for body append");
  assertStringIncludes(bodyEdit.args.join(" "), "Good retrospective");
});

/**
 * ユースケース: Retrospective の recordSprintKpt が body のみ（コメントStep）でコメントを追加すること
 * 検証意図: kpta 欠落時は handleAddComment で変更理由コメントが追加されることを確認する
 */
Deno.test("Retrospective recordSprintKpt - should add comment when only body provided", async () => {
  const { runner, calls } = mockRunner();
  const adapter = new PlanGatewayAdapter(runner);
  adapter.setScope(OWNER, REPO);
  const result = await adapter.execute({
    summary: "Record Sprint KPT: Sprint 20 Retrospective",
    steps: [{
      entity: "Retrospective",
      operation: "recordSprintKpt",
      params: { itemId: "101", body: "## Record Sprint KPT\n\n理由" },
    }],
  });
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
  const commentCall = calls.find((c) => c.args.includes("comment"));
  assert(commentCall, "gh issue comment should be called");
  assertStringIncludes(commentCall.args.join(" "), "101");
});

/**
 * ユースケース: Retrospective の recordSprintMetrics が body のみ（コメントStep）でコメントを追加すること
 * 検証意図: metrics 欠落時は handleAddComment で変更理由コメントが追加されることを確認する
 */
Deno.test("Retrospective recordSprintMetrics - should add comment when only body provided", async () => {
  const { runner, calls } = mockRunner();
  const adapter = new PlanGatewayAdapter(runner);
  adapter.setScope(OWNER, REPO);
  const result = await adapter.execute({
    summary: "Record Sprint Metrics: Sprint 20 Retrospective",
    steps: [{
      entity: "Retrospective",
      operation: "recordSprintMetrics",
      params: { itemId: "101", body: "## Record Sprint Metrics\n\n理由" },
    }],
  });
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
  const commentCall = calls.find((c) => c.args.includes("comment"));
  assert(commentCall, "gh issue comment should be called");
  assertStringIncludes(commentCall.args.join(" "), "101");
});

/**
 * ユースケース: Retrospective の recordSprintKpt がボード未設定時でも成功を返すこと
 * 検証意図: retrospectiveBoardNumber 未設定時はフィールド書込をスキップし、成功を返すことを確認する
 */
Deno.test("Retrospective recordSprintKpt - should succeed without board number", async () => {
  const { runner } = mockRunner();
  const adapter = new PlanGatewayAdapter(runner);
  adapter.setScope(OWNER, REPO);
  const result = await adapter.execute({
    summary: "Record Sprint KPT: Sprint 20 Retrospective",
    steps: [{
      entity: "Retrospective",
      operation: "recordSprintKpt",
      params: { itemId: "101", kpta: SAMPLE_SPRINT_KPT },
    }],
  });
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
});

/**
 * ユースケース: WorkPackage の recordSessionMetrics がフィールド書込失敗時にエラーを返すこと
 * 検証意図: セッションメトリクスの書込エラーが集約され報告されることを確認する
 */
Deno.test("WorkPackage recordSessionMetrics - should report field write failure", async () => {
  const mock = makeRetroBoardMock(5, 3);
  const adapter = new PlanGatewayAdapter(mock.runner);
  adapter.setScope(OWNER, REPO);
  adapter.setProjectBoardNumbers(99, 99);
  const result = await adapter.execute({
    summary: "Record session metrics: WP 51",
    steps: [{
      entity: "WorkPackage",
      operation: "recordSessionMetrics",
      params: { itemId: "51", metrics: SAMPLE_SESSION_METRICS },
    }],
  });
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "failed to set retro field 3");
});

/**
 * ユースケース: Retrospective の recordSprintKpt が addItemToProject 失敗時に lookup フォールバックで書込むこと
 * 検証意図: addItemToProject が例外を投げる場合、projectItems の GraphQL lookup で projectItemNodeId を解決し書込むことを確認する
 */
Deno.test("Retrospective recordSprintKpt - should fallback to projectItems lookup", async () => {
  let idx = 0;
  const calls: { cmd: string; args: string[] }[] = [];
  const responses: { code: number; stdout: string; stderr: string }[] = [
    // 1: gh issue view <id> --json id
    { code: 0, stdout: '{"id":"NODE_RETRO"}', stderr: "" },
    // 2: gh api graphql getProjectIdQuery
    { code: 0, stdout: '{"data":{"organization":{"projectV2":{"id":"PROJ_RETRO"}}}}', stderr: "" },
    // 3: gh api graphql addItemMutation → 非 already-on-project エラーで throw
    { code: 0, stdout: '{"errors":[{"message":"Rate limit exceeded"}]}', stderr: "" },
    // 4: gh api graphql lookup で既存 projectItem を解決
    {
      code: 0,
      stdout:
        '{"data":{"repository":{"issue":{"projectItems":{"nodes":[{"id":"ITEM_LOOKUP","project":{"number":12}}]}}}}}',
      stderr: "",
    },
    // 5-7: フィールド1 (resolveFieldId, resolveProjectNodeId, item-edit)
    {
      code: 0,
      stdout: '{"data":{"organization":{"projectV2":{"field":{"id":"FIELD_RETRO"}}}}}',
      stderr: "",
    },
    { code: 0, stdout: '{"data":{"organization":{"projectV2":{"id":"PROJ_RETRO"}}}}', stderr: "" },
    { code: 0, stdout: "", stderr: "" },
    // 8-10: フィールド2
    {
      code: 0,
      stdout: '{"data":{"organization":{"projectV2":{"field":{"id":"FIELD_RETRO"}}}}}',
      stderr: "",
    },
    { code: 0, stdout: '{"data":{"organization":{"projectV2":{"id":"PROJ_RETRO"}}}}', stderr: "" },
    { code: 0, stdout: "", stderr: "" },
    // 11-13: フィールド3
    {
      code: 0,
      stdout: '{"data":{"organization":{"projectV2":{"field":{"id":"FIELD_RETRO"}}}}}',
      stderr: "",
    },
    { code: 0, stdout: '{"data":{"organization":{"projectV2":{"id":"PROJ_RETRO"}}}}', stderr: "" },
    { code: 0, stdout: "", stderr: "" },
    // 14-16: フィールド4
    {
      code: 0,
      stdout: '{"data":{"organization":{"projectV2":{"field":{"id":"FIELD_RETRO"}}}}}',
      stderr: "",
    },
    { code: 0, stdout: '{"data":{"organization":{"projectV2":{"id":"PROJ_RETRO"}}}}', stderr: "" },
    { code: 0, stdout: "", stderr: "" },
  ];
  const runner = (cmd: string, args: string[]): Promise<ExecuteResult> => {
    calls.push({ cmd, args });
    const r = responses[idx];
    idx++;
    return Promise.resolve(r ?? { code: 0, stdout: "", stderr: "" });
  };
  const adapter = new PlanGatewayAdapter(runner);
  adapter.setScope(OWNER, REPO);
  adapter.setProjectBoardNumbers(99, 99, 12);
  const result = await adapter.execute({
    summary: "Record Sprint KPT: Sprint 20 Retrospective",
    steps: [{
      entity: "Retrospective",
      operation: "recordSprintKpt",
      params: { itemId: "101", kpta: SAMPLE_SPRINT_KPT },
    }],
  });
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
  const itemEditCalls = calls.filter((c) => c.args.includes("item-edit"));
  assertEquals(itemEditCalls.length, 4);
  const lookupCall = calls.find((c) => c.args.some((a) => a.includes("projectItems")));
  assert(lookupCall, "projectItems lookup should be called");
});

/**
 * ユースケース: User所有ボードへの書込時に organization クエリが NOT_FOUND になる場合
 * 検証意図: addItemToProject が user(login:) クエリへフォールバックし、ボード追加に成功すること (AC-1)
 */
Deno.test("addItemToProject - should fallback to user query when organization is not found (AC-1)", async () => {
  const calls: { cmd: string; args: string[] }[] = [];
  const runner = (cmd: string, args: string[]): Promise<ExecuteResult> => {
    calls.push({ cmd, args });
    const query = args.find((a) => a.startsWith("query=")) ?? "";
    if (query.includes("addProjectV2ItemById")) {
      return Promise.resolve({
        code: 0,
        stdout: JSON.stringify({
          data: { addProjectV2ItemById: { item: { id: "PVTI_userItem1" } } },
        }),
        stderr: "",
      });
    }
    if (query.includes("user(login:")) {
      return Promise.resolve({
        code: 0,
        stdout: JSON.stringify({ data: { user: { projectV2: { id: "PVT_user10" } } } }),
        stderr: "",
      });
    }
    return Promise.resolve({ code: 0, stdout: ORG_MISS, stderr: "" });
  };
  const adapter = makeAdapter(runner, "some-user", "my-repo");
  const result = await adapter.addItemToProject("I_issue123", 10);
  assertEquals(result.projectItemNodeId, "PVTI_userItem1");
  assertFallbackIssued(calls);
});

/**
 * ユースケース: Organization所有ボードへの書込が従来どおり成功する場合
 * 検証意図: user(login:) クエリを発行せず、既存動作が不変であること (AC-2回帰)
 */
Deno.test("addItemToProject - should not issue user query when organization resolves (AC-2)", async () => {
  const calls: { cmd: string; args: string[] }[] = [];
  const runner = (cmd: string, args: string[]): Promise<ExecuteResult> => {
    calls.push({ cmd, args });
    const query = args.find((a) => a.startsWith("query=")) ?? "";
    if (query.includes("addProjectV2ItemById")) {
      return Promise.resolve({
        code: 0,
        stdout: JSON.stringify({
          data: { addProjectV2ItemById: { item: { id: "PVTI_orgItem1" } } },
        }),
        stderr: "",
      });
    }
    return Promise.resolve({
      code: 0,
      stdout: JSON.stringify({ data: { organization: { projectV2: { id: "PVT_org10" } } } }),
      stderr: "",
    });
  };
  const adapter = makeAdapter(runner);
  const result = await adapter.addItemToProject("I_issue123", 10);
  assertEquals(result.projectItemNodeId, "PVTI_orgItem1");
  assertNoFallback(calls);
});

/**
 * ユースケース: 単一選択肢ID解決時に organization クエリが NOT_FOUND になる場合
 * 検証意図: resolveSingleSelectOptionId が user(login:) クエリへフォールバックして選択肢IDを返すこと (AC-1)
 */
Deno.test("resolveSingleSelectOptionId - should fallback to user query when organization is not found (AC-1)", async () => {
  const calls: { cmd: string; args: string[] }[] = [];
  const runner = (cmd: string, args: string[]): Promise<ExecuteResult> => {
    calls.push({ cmd, args });
    const query = args.find((a) => a.startsWith("query=")) ?? "";
    if (query.includes("user(login:")) {
      return Promise.resolve({
        code: 0,
        stdout: JSON.stringify({
          data: { user: { projectV2: { field: { options: [{ id: "OPT_TODO", name: "Todo" }] } } } },
        }),
        stderr: "",
      });
    }
    return Promise.resolve({ code: 0, stdout: ORG_MISS, stderr: "" });
  };
  const adapter = makeAdapter(runner, "some-user", "my-repo");
  adapter.setProjectBoardNumbers(10, 11, 12);
  const optionId = await adapter.resolveSingleSelectOptionId(
    { boardKey: "sprintBoard", fieldName: "Status" },
    "Todo",
  );
  assertEquals(optionId, "OPT_TODO");
  assertFallbackIssued(calls);
});

/**
 * ユースケース: Organization は解決するが指定ボード番号が存在しない場合
 * 検証意図: projectV2 null を User所有と誤判定せず、user(login:) クエリへフォールバックしないこと
 */
Deno.test("resolveSingleSelectOptionId - should not fallback when organization resolves but board is missing", async () => {
  const calls: { cmd: string; args: string[] }[] = [];
  const runner = (cmd: string, args: string[]): Promise<ExecuteResult> => {
    calls.push({ cmd, args });
    return Promise.resolve({
      code: 0,
      stdout: JSON.stringify({ data: { organization: { projectV2: null } } }),
      stderr: "",
    });
  };
  const adapter = makeAdapter(runner);
  adapter.setProjectBoardNumbers(10, 11, 12);
  const optionId = await adapter.resolveSingleSelectOptionId(
    { boardKey: "sprintBoard", fieldName: "Status" },
    "Todo",
  );
  assertEquals(optionId, undefined);
  assertNoFallback(calls);
});

/**
 * ユースケース: フィールドID解決とプロジェクトID解決の双方で organization クエリが NOT_FOUND になる場合
 * 検証意図: setSingleSelectFieldValue が両解決でフォールバックし、値設定に成功すること (AC-1)
 */
Deno.test("setSingleSelectFieldValue - should fallback on both field and project resolution (AC-1)", async () => {
  const calls: { cmd: string; args: string[] }[] = [];
  const runner = (cmd: string, args: string[]): Promise<ExecuteResult> => {
    calls.push({ cmd, args });
    if (cmd === "gh" && args[0] === "project") {
      return Promise.resolve({ code: 0, stdout: "", stderr: "" });
    }
    const query = args.find((a) => a.startsWith("query=")) ?? "";
    if (query.includes("user(login:")) {
      if (query.includes("field(name:")) {
        return Promise.resolve({
          code: 0,
          stdout: JSON.stringify({
            data: { user: { projectV2: { field: { id: "FIELD_user" } } } },
          }),
          stderr: "",
        });
      }
      return Promise.resolve({
        code: 0,
        stdout: JSON.stringify({ data: { user: { projectV2: { id: "PVT_user11" } } } }),
        stderr: "",
      });
    }
    return Promise.resolve({ code: 0, stdout: ORG_MISS, stderr: "" });
  };
  const adapter = makeAdapter(runner, "some-user", "my-repo");
  adapter.setProjectBoardNumbers(10, 11, 12);
  const result = await adapter.setSingleSelectFieldValue(
    "PVTI_item1",
    { boardKey: "sprintBoard", fieldName: "Status" },
    "OPT_TODO",
  );
  assertEquals(result.success, true);
  assertFallbackIssued(calls);
  assertEquals(countFallbacks(calls), 2);
});

/**
 * ユースケース: ProjectV2ボード検索時に organization クエリが NOT_FOUND になる場合
 * 検証意図: handleProjectSearchItems(#fetchProjectItems経由) がフォールバックして件数を返すこと (AC-1)
 */
Deno.test("handleProjectSearchItems - should fallback to user query when organization is not found (AC-1)", async () => {
  const calls: { cmd: string; args: string[] }[] = [];
  const runner = (cmd: string, args: string[]): Promise<ExecuteResult> => {
    calls.push({ cmd, args });
    const query = args.find((a) => a.startsWith("query=")) ?? "";
    if (query.includes("user(login:")) {
      return Promise.resolve({
        code: 0,
        stdout: JSON.stringify({
          data: {
            user: {
              projectV2: {
                items: {
                  pageInfo: { hasNextPage: false, endCursor: null },
                  nodes: [{
                    content: { number: 1, title: "T1" },
                    fieldValueByName: { name: "Todo" },
                  }],
                },
              },
            },
          },
        }),
        stderr: "",
      });
    }
    return Promise.resolve({ code: 0, stdout: ORG_MISS, stderr: "" });
  };
  const adapter = makeAdapter(runner, "some-user", "my-repo");
  const result = await adapter.handleProjectSearchItems({
    status: "Todo",
    labelType: "WP",
    boardNumber: 11,
  });
  assertEquals(result.success, true);
  const output = result.output as Array<{ number: number; title: string }>;
  assertEquals(output.length, 1);
  assertEquals(output[0].number, 1);
});

/**
 * ユースケース: Organization未解決判定の境界値を直接確認する場合
 * 検証意図: isOrganizationUnresolved が organization null と errors 単独を分離して正しく判定すること
 */
Deno.test("isOrganizationUnresolved - should classify miss and non-miss payloads", () => {
  assertEquals(isOrganizationUnresolved(ORG_MISS), true);
  assertEquals(
    isOrganizationUnresolved(JSON.stringify({ data: { organization: null } })),
    true,
  );
  assertEquals(
    isOrganizationUnresolved(
      JSON.stringify({
        data: { dummy: 1 },
        errors: [{ type: "NOT_FOUND", message: "Could not resolve to an Organization." }],
      }),
    ),
    true,
  );
  assertEquals(isOrganizationUnresolved("not json"), false);
  assertEquals(
    isOrganizationUnresolved(JSON.stringify({ data: { organization: { projectV2: null } } })),
    false,
  );
  assertEquals(
    isOrganizationUnresolved(
      JSON.stringify({ data: null, errors: [{ type: "NOT_FOUND", message: "auth failed" }] }),
    ),
    false,
  );
  assertEquals(
    isOrganizationUnresolved(JSON.stringify({ data: { organization: null }, errors: "broken" })),
    true,
  );
  assertEquals(
    isOrganizationUnresolved(
      JSON.stringify({
        data: { organization: null },
        errors: [{ type: "FORBIDDEN", message: "rate limited" }],
      }),
    ),
    true,
  );
});

/**
 * ユースケース: クエリ書換えの境界値を直接確認する場合
 * 検証意図: toUserProjectQuery が該当箇所の全件置換と無変更を正しく行うこと
 */
Deno.test("toUserProjectQuery - should rewrite all organization roots or leave untouched", () => {
  assertEquals(
    toUserProjectQuery("{ organization(login: $owner) { projectV2(number: 1) { id } } }"),
    "{ user(login: $owner) { projectV2(number: 1) { id } } }",
  );
  assertEquals(
    toUserProjectQuery("{ a: organization(login: $o) { id } b: organization(login: $o) { id } }"),
    "{ a: user(login: $o) { id } b: user(login: $o) { id } }",
  );
  assertEquals(
    toUserProjectQuery("{ repository(owner: $o, name: $r) { id } }"),
    "{ repository(owner: $o, name: $r) { id } }",
  );
});

/**
 * ユースケース: 応答正規化の境界値を直接確認する場合
 * 検証意図: aliasUserAsOrganization が data.user を data.organization へ付け替えて user を削除すること
 */
Deno.test("aliasUserAsOrganization - should alias user as organization and drop user key", () => {
  const normalized = JSON.parse(
    aliasUserAsOrganization(JSON.stringify({ data: { user: { projectV2: { id: "P1" } } } })),
  ) as { data: { organization?: unknown; user?: unknown } };
  assertEquals(normalized.data.organization, { projectV2: { id: "P1" } });
  assertEquals("user" in normalized.data, false);
  const untouched = '{"data":{"organization":{"projectV2":{"id":"P0"}}}}';
  assertEquals(aliasUserAsOrganization(untouched), untouched);
  assertEquals(aliasUserAsOrganization("not json"), "not json");
  assertEquals(
    aliasUserAsOrganization(JSON.stringify({ data: { organization: null, user: null } })),
    JSON.stringify({ data: { organization: null, user: null } }),
  );
});

/**
 * ユースケース: 初回呼出が gh 失敗 (code!=0) の場合
 * 検証意図: フォールバックせず即時返却し、user(login:) を発行しないこと
 */
Deno.test("addItemToProject - should not fallback when first call fails (AC-2)", async () => {
  const calls: { cmd: string; args: string[] }[] = [];
  const runner = (cmd: string, args: string[]): Promise<ExecuteResult> => {
    calls.push({ cmd, args });
    return Promise.resolve({ code: 1, stdout: "", stderr: "network error" });
  };
  const adapter = makeAdapter(runner, "some-user", "my-repo");
  await assertRejects(
    () => adapter.addItemToProject("I_issue123", 10),
    Error,
    "Failed to get project ID",
  );
  assertNoFallback(calls);
});

/**
 * ユースケース: フォールバック先 (user) も失敗する場合
 * 検証意図: 再試行は1回のみで打切り、2回目のエラーをそのまま返すこと（無限フォールバックなし）
 */
Deno.test("addItemToProject - should stop after a single retry when user query also misses", async () => {
  const calls: { cmd: string; args: string[] }[] = [];
  const userMiss = JSON.stringify({
    data: { user: null },
    errors: [{ type: "NOT_FOUND", message: "Could not resolve to a User." }],
  });
  const runner = (cmd: string, args: string[]): Promise<ExecuteResult> => {
    calls.push({ cmd, args });
    const query = args.find((a) => a.startsWith("query=")) ?? "";
    if (query.includes("user(login:")) {
      return Promise.resolve({ code: 0, stdout: userMiss, stderr: "" });
    }
    return Promise.resolve({ code: 0, stdout: ORG_MISS, stderr: "" });
  };
  const adapter = makeAdapter(runner, "some-user", "my-repo");
  await assertRejects(
    () => adapter.addItemToProject("I_issue123", 10),
    Error,
    "GraphQL error",
  );
  assertEquals(countFallbacks(calls), 1);
});

/**
 * ユースケース: フォールバック先の呼出自体が gh 失敗 (code!=0) の場合
 * 検証意図: 2回目のエラーをそのまま返し、3回目の呼出を行わないこと
 */
Deno.test("addItemToProject - should return second error without further retry", async () => {
  const calls: { cmd: string; args: string[] }[] = [];
  const runner = (cmd: string, args: string[]): Promise<ExecuteResult> => {
    calls.push({ cmd, args });
    const query = args.find((a) => a.startsWith("query=")) ?? "";
    if (query.includes("user(login:")) {
      return Promise.resolve({ code: 1, stdout: "", stderr: "user query failed" });
    }
    return Promise.resolve({ code: 0, stdout: ORG_MISS, stderr: "" });
  };
  const adapter = makeAdapter(runner, "some-user", "my-repo");
  await assertRejects(
    () => adapter.addItemToProject("I_issue123", 10),
    Error,
    "Failed to get project ID",
  );
  assertEquals(countFallbacks(calls), 1);
});

/**
 * ユースケース: User所有の大規模ボードを複数ページで検索する場合
 * 検証意図: 各ページでフォールバックし、cursor を保持して件数を合算すること
 */
Deno.test("handleProjectSearchItems - should fallback on every page and merge items", async () => {
  const calls: { cmd: string; args: string[] }[] = [];
  const page = (next: string | null, num: number) =>
    JSON.stringify({
      data: {
        user: {
          projectV2: {
            items: {
              pageInfo: { hasNextPage: next !== null, endCursor: next },
              nodes: [{
                content: { number: num, title: `T${num}` },
                fieldValueByName: { name: "Todo" },
              }],
            },
          },
        },
      },
    });
  const runner = (cmd: string, args: string[]): Promise<ExecuteResult> => {
    calls.push({ cmd, args });
    const query = args.find((a) => a.startsWith("query=")) ?? "";
    if (query.includes("user(login:")) {
      const hasCursor = args.some((a) => a === "cursor=cursor-1");
      return Promise.resolve({
        code: 0,
        stdout: hasCursor ? page(null, 2) : page("cursor-1", 1),
        stderr: "",
      });
    }
    return Promise.resolve({ code: 0, stdout: ORG_MISS, stderr: "" });
  };
  const adapter = makeAdapter(runner, "some-user", "my-repo");
  const result = await adapter.handleProjectSearchItems({
    status: "Todo",
    labelType: "WP",
    boardNumber: 11,
  });
  assertEquals(result.success, true);
  const output = result.output as Array<{ number: number; title: string }>;
  assertEquals(output.map((o) => o.number), [1, 2]);
  assertEquals(countFallbacks(calls), 2);
  assert(
    calls.some((c) => c.args.includes("cursor=cursor-1")),
    "cursor should be preserved on fallback pages",
  );
});

/**
 * ユースケース: Organization解決時にフィールド値設定を行う場合
 * 検証意図: resolveFieldId・resolveProjectNodeId 経路で user(login:) を発行しないこと (AC-2回帰)
 */
Deno.test("setSingleSelectFieldValue - should not issue user query when organization resolves (AC-2)", async () => {
  const calls: { cmd: string; args: string[] }[] = [];
  const runner = (cmd: string, args: string[]): Promise<ExecuteResult> => {
    calls.push({ cmd, args });
    if (cmd === "gh" && args[0] === "project") {
      return Promise.resolve({ code: 0, stdout: "", stderr: "" });
    }
    const query = args.find((a) => a.startsWith("query=")) ?? "";
    if (query.includes("field(name:")) {
      return Promise.resolve({
        code: 0,
        stdout: JSON.stringify({
          data: { organization: { projectV2: { field: { id: "FIELD_org" } } } },
        }),
        stderr: "",
      });
    }
    return Promise.resolve({
      code: 0,
      stdout: JSON.stringify({ data: { organization: { projectV2: { id: "PVT_org11" } } } }),
      stderr: "",
    });
  };
  const adapter = makeAdapter(runner);
  adapter.setProjectBoardNumbers(10, 11, 12);
  const result = await adapter.setSingleSelectFieldValue(
    "PVTI_item1",
    { boardKey: "sprintBoard", fieldName: "Status" },
    "OPT_TODO",
  );
  assertEquals(result.success, true);
  assertNoFallback(calls);
});

/**
 * ユースケース: Organization解決時にボード検索を行う場合
 * 検証意図: #fetchProjectItems 経路で user(login:) を発行しないこと (AC-2回帰)
 */
Deno.test("handleProjectSearchItems - should not issue user query when organization resolves (AC-2)", async () => {
  const calls: { cmd: string; args: string[] }[] = [];
  const runner = (cmd: string, args: string[]): Promise<ExecuteResult> => {
    calls.push({ cmd, args });
    return Promise.resolve({
      code: 0,
      stdout: JSON.stringify({
        data: {
          organization: {
            projectV2: {
              items: {
                pageInfo: { hasNextPage: false, endCursor: null },
                nodes: [{
                  content: { number: 7, title: "T7" },
                  fieldValueByName: { name: "Todo" },
                }],
              },
            },
          },
        },
      }),
      stderr: "",
    });
  };
  const adapter = makeAdapter(runner);
  const result = await adapter.handleProjectSearchItems({
    status: "Todo",
    labelType: "WP",
    boardNumber: 11,
  });
  assertEquals(result.success, true);
  assertNoFallback(calls);
});

// ======== WP #809 AC-1: gateway handler write-error propagation ========

/**
 * ユースケース: PBI提案後のボード追加が失敗した場合
 * 検証意図: 作成済みIssueの識別子を保持し、proposeを失敗として返すこと。
 */
Deno.test("WP809 AC-1 ProductBacklogItem propose - should report board add failure", async () => {
  const adapter = makeAdapter();
  adapter.setProjectBoardNumbers(10, 11, 12);
  adapter.handleCreateItem = () =>
    Promise.resolve({
      operation: "create",
      success: true,
      itemId: "42",
      nodeId: "NODE_PBI_42",
    });
  adapter.addItemToProject = () => Promise.reject(new Error("project write denied"));

  const result = await adapter.execute({
    summary: "propose PBI with board write failure",
    steps: [{ entity: "ProductBacklogItem", operation: "propose", params: { title: "PBI" } }],
  });

  assertEquals(result.stepResults[0].success, false);
  assertEquals(result.stepResults[0].itemId, "42");
  assertStringIncludes(result.stepResults[0].error ?? "", "project write denied");
});

/**
 * ユースケース: PBIサイズ実績のボードfield書込が例外になった場合
 * 検証意図: confirmSizeを成功扱いにせず、例外理由を返すこと。
 */
Deno.test("WP809 AC-1 ProductBacklogItem confirmSize - should report field write exception", async () => {
  const adapter = makeAdapter(() =>
    Promise.resolve({ code: 0, stdout: JSON.stringify({ id: "NODE_PBI_42" }), stderr: "" })
  );
  adapter.setProjectBoardNumbers(10, 11, 12);
  adapter.resolveProjectItemOnBoard = () => Promise.resolve("ITEM_PBI_42");
  adapter.resolveSingleSelectOptionId = () => Promise.resolve("OPTION_M");
  adapter.setSingleSelectFieldValue = () => Promise.reject(new Error("size field write denied"));

  const result = await adapter.execute({
    summary: "confirm PBI size with write exception",
    steps: [{
      entity: "ProductBacklogItem",
      operation: "confirmSize",
      params: { itemId: "42", sizeActual: "M" },
    }],
  });

  assertEquals(result.stepResults[0].success, false);
  assertEquals(result.stepResults[0].operation, "confirmSize");
  assertEquals(result.stepResults[0].itemId, "42");
  assertStringIncludes(result.stepResults[0].error ?? "", "size field write denied");
});

/**
 * ユースケース: PBIプロセス分析のfield書込が例外になった場合
 * 検証意図: recordAnalysisを成功扱いにせず、例外理由を返すこと。
 */
Deno.test("WP809 AC-1 ProductBacklogItem recordAnalysis - should report field write exception", async () => {
  const adapter = makeAdapter(() =>
    Promise.resolve({ code: 0, stdout: JSON.stringify({ id: "NODE_PBI_42" }), stderr: "" })
  );
  adapter.setProjectBoardNumbers(10, 11, 12);
  adapter.resolveProjectItemOnBoard = () => Promise.resolve("ITEM_PBI_42");
  adapter.setTextFieldValue = () => Promise.reject(new Error("analysis field write denied"));
  const body = JSON.stringify({
    wp_effort_summary: { initial_estimate: 2, planned_estimate: 2, actual: 1 },
    planning_variance_review: "planning",
    execution_variance_review: "execution",
    improvement_suggestions: "improve",
  });

  const result = await adapter.execute({
    summary: "record PBI analysis with write exception",
    steps: [{
      entity: "ProductBacklogItem",
      operation: "recordAnalysis",
      params: { itemId: "42", body },
    }],
  });

  assertEquals(result.stepResults[0].success, false);
  assertEquals(result.stepResults[0].operation, "recordAnalysis");
  assertEquals(result.stepResults[0].itemId, "42");
  assertStringIncludes(result.stepResults[0].error ?? "", "analysis field write denied");
});

/**
 * ユースケース: PBI履歴コメント更新の試行が失敗した場合
 * 検証意図: 失敗を記録したうえで通常コメント処理へfallbackし、成功結果を維持すること。
 */
Deno.test("WP809 AC-1 ProductBacklogItem comment - should fallback after history update exception", async () => {
  const adapter = makeAdapter(() => Promise.reject(new Error("history lookup failed")));
  let fallbackCalled = false;
  adapter.handleAddComment = (params) => {
    fallbackCalled = true;
    return Promise.resolve({
      operation: "comment",
      success: true,
      itemId: String(params.itemId ?? ""),
    });
  };

  const result = await adapter.execute({
    summary: "add a PBI history comment",
    steps: [{
      entity: "ProductBacklogItem",
      operation: "comment",
      params: { itemId: "42", body: "history row" },
    }],
  });

  assertEquals(fallbackCalled, true);
  assertEquals(result.stepResults[0].success, true);
  assertEquals(result.stepResults[0].operation, "comment");
  assertEquals(result.stepResults[0].itemId, "42");
});

/**
 * ユースケース: WP作成後のSprint Board追加が失敗した場合
 * 検証意図: 作成済みIssueの識別子を保持し、defineを失敗として返すこと。
 */
Deno.test("WP809 AC-1 WorkPackage define - should report board add failure", async () => {
  const adapter = makeAdapter();
  adapter.setProjectBoardNumbers(10, 11, 12);
  adapter.handleCreateItem = () =>
    Promise.resolve({
      operation: "create",
      success: true,
      itemId: "51",
      nodeId: "NODE_WP_51",
    });
  adapter.handleSetParent = (itemId) =>
    Promise.resolve({ operation: "update", success: true, itemId });
  adapter.addItemToProject = () => Promise.reject(new Error("sprint board write denied"));

  const result = await adapter.execute({
    summary: "define WP with board write failure",
    steps: [{
      entity: "WorkPackage",
      operation: "define",
      params: { title: "WP", parentPbi: "42", body: "body" },
    }],
  });

  assertEquals(result.stepResults[0].success, false);
  assertEquals(result.stepResults[0].itemId, "51");
  assertStringIncludes(result.stepResults[0].error ?? "", "sprint board write denied");
});

for (
  const { operation, params } of [
    { operation: "estimateInitialEffort", params: { itemId: "51", effortInitial: 2 } },
    { operation: "estimatePlannedEffort", params: { itemId: "51", effortPlanned: 2 } },
    { operation: "recordActualEffort", params: { itemId: "51", effortActual: 1 } },
  ] as const
) {
  /**
   * ユースケース: WP effort field操作のrunnerが例外になった場合
   * 検証意図: 各operationが成功扱いにせず、runnerの原因を返すこと。
   */
  Deno.test(`WP809 AC-1 WorkPackage ${operation} - should report runner exception`, async () => {
    const adapter = makeAdapter(() => Promise.reject(new Error("gh runner failed")));
    adapter.setProjectBoardNumbers(10, 11, 12);

    const result = await adapter.execute({
      summary: `${operation} with runner exception`,
      steps: [{ entity: "WorkPackage", operation, params }],
    });

    assertEquals(result.stepResults[0].success, false);
    assertEquals(result.stepResults[0].operation, operation);
    assertEquals(result.stepResults[0].itemId, "51");
    assertStringIncludes(result.stepResults[0].error ?? "", "gh runner failed");
  });
}

/**
 * ユースケース: WPプロセス分析のrunnerが例外になった場合
 * 検証意図: recordAnalysisを成功扱いにせず、例外理由を返すこと。
 */
Deno.test("WP809 AC-1 WorkPackage recordAnalysis - should report runner exception", async () => {
  const adapter = makeAdapter(() => Promise.reject(new Error("gh runner failed")));
  adapter.setProjectBoardNumbers(10, 11, 12);
  const body = JSON.stringify({
    planning_variance_review: "planning",
    execution_variance_review: "execution",
    improvement_suggestions: "improve",
  });

  const result = await adapter.execute({
    summary: "record WP analysis with runner exception",
    steps: [{ entity: "WorkPackage", operation: "recordAnalysis", params: { itemId: "51", body } }],
  });

  assertEquals(result.stepResults[0].success, false);
  assertEquals(result.stepResults[0].operation, "recordAnalysis");
  assertEquals(result.stepResults[0].itemId, "51");
  assertStringIncludes(result.stepResults[0].error ?? "", "gh runner failed");
});

/**
 * ユースケース: Retrospective作成後のボード追加が失敗した場合
 * 検証意図: 作成済みIssueの識別子を保持し、planを失敗として返すこと。
 */
Deno.test("WP809 AC-1 Retrospective plan - should report board add failure", async () => {
  const adapter = makeAdapter();
  adapter.setProjectBoardNumbers(10, 11, 12);
  adapter.handleCreateItem = () =>
    Promise.resolve({
      operation: "create",
      success: true,
      itemId: "77",
      nodeId: "NODE_RETRO_77",
    });
  adapter.addItemToProject = () => Promise.reject(new Error("retrospective board write denied"));

  const result = await adapter.execute({
    summary: "plan retrospective with board write failure",
    steps: [{ entity: "Retrospective", operation: "plan", params: { title: "Sprint retro" } }],
  });

  assertEquals(result.stepResults[0].success, false);
  assertEquals(result.stepResults[0].itemId, "77");
  assertStringIncludes(result.stepResults[0].error ?? "", "retrospective board write denied");
});

/**
 * ユースケース: 履歴コメントのGH更新が成功した後、一時ファイル削除だけが失敗した場合
 * 検証意図: cleanup失敗を警告し、成功したコメント更新を失敗扱いにしないこと。
 */
Deno.test("WP809 AC-1 ProductBacklogItem comment - should warn and preserve success when cleanup fails", async () => {
  let blockedTempPath: string | undefined;
  const runner = async (_cmd: string, args: string[]): Promise<ExecuteResult> => {
    const inputIndex = args.indexOf("--input");
    if (inputIndex >= 0) {
      blockedTempPath = args[inputIndex + 1];
      await Deno.remove(blockedTempPath);
      await Deno.mkdir(blockedTempPath);
      await Deno.writeTextFile(`${blockedTempPath}/keep`, "cleanup should fail");
      return {
        code: 0,
        stdout: JSON.stringify({
          data: { updateIssueComment: { issueComment: { id: "COMMENT_1" } } },
        }),
        stderr: "",
      };
    }
    return {
      code: 0,
      stdout: JSON.stringify({
        comments: [{ id: "COMMENT_1", body: "## History\n\n| 1 | previous |" }],
      }),
      stderr: "",
    };
  };
  const adapter = makeAdapter(runner);

  try {
    const result = await adapter.execute({
      summary: "append history comment with cleanup failure",
      steps: [{
        entity: "ProductBacklogItem",
        operation: "comment",
        params: { itemId: "42", body: "| 2 | updated |" },
      }],
    });

    assertEquals(result.stepResults[0].success, true);
    assert(blockedTempPath, "history update should create a temporary input file");
    const tempStat = await Deno.stat(blockedTempPath);
    assertEquals(
      tempStat.isDirectory,
      true,
      "cleanup failure should leave the replacement directory",
    );
  } finally {
    if (blockedTempPath) await Deno.remove(blockedTempPath, { recursive: true });
  }
});

// ======== WP #809 AC-2: requested write failures are visible ========

/**
 * ユースケース: 要求されたサイズ実績の選択肢がボード上に存在しない場合
 * 検証意図: optionId未解決をsuccess:trueで黙認せずerrorで返すこと。
 */
Deno.test("WP809 AC-2 ProductBacklogItem confirmSize - should fail when option is unresolved", async () => {
  const adapter = makeAdapter(() =>
    Promise.resolve({ code: 0, stdout: JSON.stringify({ id: "NODE_PBI_42" }), stderr: "" })
  );
  adapter.setProjectBoardNumbers(10, 11, 12);
  adapter.resolveProjectItemOnBoard = () => Promise.resolve("ITEM_PBI_42");
  adapter.resolveSingleSelectOptionId = () => Promise.resolve(undefined);

  const result = await adapter.execute({
    summary: "confirm PBI size with missing option",
    steps: [{
      entity: "ProductBacklogItem",
      operation: "confirmSize",
      params: { itemId: "42", sizeActual: "XL" },
    }],
  });

  assertEquals(result.stepResults[0].success, false);
  assertEquals(result.stepResults[0].operation, "confirmSize");
  assertEquals(result.stepResults[0].itemId, "42");
  assertStringIncludes(result.stepResults[0].error ?? "", "XL");
});

/**
 * ユースケース: PBIが対象Board itemとして解決できない場合
 * 検証意図: Board item未解決を要求書込失敗として返すこと。
 */
Deno.test("WP809 AC-2 ProductBacklogItem confirmSize - should fail when Board item is unresolved", async () => {
  const adapter = makeAdapter(() =>
    Promise.resolve({ code: 0, stdout: JSON.stringify({ id: "NODE_PBI_42" }), stderr: "" })
  );
  adapter.setProjectBoardNumbers(10, 11, 12);
  adapter.resolveProjectItemOnBoard = () => Promise.resolve(null);

  const result = await adapter.execute({
    summary: "confirm PBI size without Board item",
    steps: [{
      entity: "ProductBacklogItem",
      operation: "confirmSize",
      params: { itemId: "42", sizeActual: "M" },
    }],
  });

  assertEquals(result.stepResults[0].success, false);
  assertEquals(result.stepResults[0].itemId, "42");
  assertStringIncludes(result.stepResults[0].error ?? "", "42");
});

/**
 * ユースケース: サイズ実績記録のIssue解決でghが失敗した場合
 * 検証意図: gh失敗のstderrを返し、正常終了扱いにしないこと。
 */
Deno.test("WP809 AC-2 ProductBacklogItem confirmSize - should fail when gh issue view fails", async () => {
  const adapter = makeAdapter(() =>
    Promise.resolve({ code: 1, stdout: "", stderr: "issue lookup denied" })
  );
  adapter.setProjectBoardNumbers(10, 11, 12);

  const result = await adapter.execute({
    summary: "confirm PBI size with gh failure",
    steps: [{
      entity: "ProductBacklogItem",
      operation: "confirmSize",
      params: { itemId: "42", sizeActual: "M" },
    }],
  });

  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "issue lookup denied");
});

/**
 * ユースケース: PBI分析更新のIssue解決でghが失敗した場合
 * 検証意図: recordAnalysisが無言成功にならず、ghの原因を返すこと。
 */
Deno.test("WP809 AC-2 ProductBacklogItem recordAnalysis - should fail when gh issue view fails", async () => {
  const adapter = makeAdapter(() =>
    Promise.resolve({ code: 1, stdout: "", stderr: "PBI lookup denied" })
  );
  adapter.setProjectBoardNumbers(10, 11, 12);
  const body = JSON.stringify({ planning_variance_review: "planning" });

  const result = await adapter.execute({
    summary: "record PBI analysis with gh failure",
    steps: [{
      entity: "ProductBacklogItem",
      operation: "recordAnalysis",
      params: { itemId: "42", body },
    }],
  });

  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "PBI lookup denied");
});

/**
 * ユースケース: PBI分析更新で対象Board itemを解決できない場合
 * 検証意図: 要求field書込が未実施のまま成功扱いにならないこと。
 */
Deno.test("WP809 AC-2 ProductBacklogItem recordAnalysis - should fail when Board item is unresolved", async () => {
  const adapter = makeAdapter(() =>
    Promise.resolve({ code: 0, stdout: JSON.stringify({ id: "NODE_PBI_42" }), stderr: "" })
  );
  adapter.setProjectBoardNumbers(10, 11, 12);
  adapter.resolveProjectItemOnBoard = () => Promise.resolve(null);

  const result = await adapter.execute({
    summary: "record PBI analysis without Board item",
    steps: [{
      entity: "ProductBacklogItem",
      operation: "recordAnalysis",
      params: { itemId: "42", body: JSON.stringify({ planning_variance_review: "planning" }) },
    }],
  });

  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "42");
});

/**
 * ユースケース: PBI分析のProject V2 field setterがsuccess:falseを返す場合
 * 検証意図: nested StepResultの失敗とerrorを親operationへ伝播すること。
 */
Deno.test("WP809 AC-2 ProductBacklogItem recordAnalysis - should report field setter failure", async () => {
  const adapter = makeAdapter(() =>
    Promise.resolve({ code: 0, stdout: JSON.stringify({ id: "NODE_PBI_42" }), stderr: "" })
  );
  adapter.setProjectBoardNumbers(10, 11, 12);
  adapter.resolveProjectItemOnBoard = () => Promise.resolve("ITEM_PBI_42");
  adapter.setTextFieldValue = () =>
    Promise.resolve({ operation: "updateField", success: false, error: "PBI field denied" });

  const result = await adapter.execute({
    summary: "record PBI analysis with field failure",
    steps: [{
      entity: "ProductBacklogItem",
      operation: "recordAnalysis",
      params: { itemId: "42", body: JSON.stringify({ planning_variance_review: "planning" }) },
    }],
  });

  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "PBI field denied");
});

/**
 * ユースケース: WP effortの要求書込でghが非0終了した場合
 * 検証意図: GH stderrを親operationの失敗として返すこと。
 */
Deno.test("WP809 AC-2 WorkPackage estimateInitialEffort - should fail when gh issue view fails", async () => {
  const adapter = makeAdapter(() =>
    Promise.resolve({ code: 1, stdout: "", stderr: "WP lookup denied" })
  );
  adapter.setProjectBoardNumbers(10, 11, 12);

  const result = await adapter.execute({
    summary: "estimate initial effort with gh failure",
    steps: [{
      entity: "WorkPackage",
      operation: "estimateInitialEffort",
      params: { itemId: "51", effortInitial: 2 },
    }],
  });

  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "WP lookup denied");
});

/**
 * ユースケース: WP effortの要求書込でBoard itemが解決できない場合
 * 検証意図: field書込をしないままsuccess:trueを返さないこと。
 */
Deno.test("WP809 AC-2 WorkPackage estimatePlannedEffort - should fail when Board item is unresolved", async () => {
  const adapter = makeAdapter(() =>
    Promise.resolve({ code: 0, stdout: JSON.stringify({ id: "NODE_WP_51" }), stderr: "" })
  );
  adapter.setProjectBoardNumbers(10, 11, 12);
  adapter.resolveProjectItemOnBoard = () => Promise.resolve(null);

  const result = await adapter.execute({
    summary: "estimate planned effort without Board item",
    steps: [{
      entity: "WorkPackage",
      operation: "estimatePlannedEffort",
      params: { itemId: "51", effortPlanned: 2 },
    }],
  });

  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "51");
});

/**
 * ユースケース: WP effort field setterがsuccess:falseを返す場合
 * 検証意図: setterの失敗をestimate operationへ伝播すること。
 */
Deno.test("WP809 AC-2 WorkPackage recordActualEffort - should report field setter failure", async () => {
  const adapter = makeAdapter(() =>
    Promise.resolve({ code: 0, stdout: JSON.stringify({ id: "NODE_WP_51" }), stderr: "" })
  );
  adapter.setProjectBoardNumbers(10, 11, 12);
  adapter.resolveProjectItemOnBoard = () => Promise.resolve("ITEM_WP_51");
  adapter.readTextFieldValue = () => Promise.resolve('{"initial_estimate":2}');
  adapter.setTextFieldValue = () =>
    Promise.resolve({ operation: "updateField", success: false, error: "effort field denied" });

  const result = await adapter.execute({
    summary: "record actual effort with field failure",
    steps: [{
      entity: "WorkPackage",
      operation: "recordActualEffort",
      params: { itemId: "51", effortActual: 1 },
    }],
  });

  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "effort field denied");
});

/**
 * ユースケース: ボード未設定でeffort値がないため書込対象が存在しない場合
 * 検証意図: 既存の意図的no-opは正常終了を維持すること。
 */
Deno.test("WP809 AC-2 WorkPackage estimateInitialEffort - should preserve intentional no-op without board", async () => {
  const adapter = makeAdapter();

  const result = await adapter.execute({
    summary: "estimate initial effort without board configuration",
    steps: [{
      entity: "WorkPackage",
      operation: "estimateInitialEffort",
      params: { itemId: "51", effortInitial: 2 },
    }],
  });

  assertEquals(result.stepResults[0].success, true);
  assertEquals(result.stepResults[0].itemId, "51");
});

/**
 * ユースケース: ボード未設定でPBIサイズ実績を書き込めない場合
 * 検証意図: PO合意済みの意図的no-opは従来どおり成功を維持すること。
 */
Deno.test("WP809 AC-2 ProductBacklogItem confirmSize - should preserve intentional no-op without board", async () => {
  const adapter = makeAdapter();

  const result = await adapter.execute({
    summary: "confirm PBI size without board configuration",
    steps: [{
      entity: "ProductBacklogItem",
      operation: "confirmSize",
      params: { itemId: "42", sizeActual: "M" },
    }],
  });

  assertEquals(result.stepResults[0].success, true);
  assertEquals(result.stepResults[0].itemId, "42");
});

/**
 * ユースケース: PBIサイズ実績field setterがsuccess:falseを返す場合
 * 検証意図: setterの失敗をconfirmSizeへ伝播すること。
 */
Deno.test("WP809 AC-2 ProductBacklogItem confirmSize - should report setter failure", async () => {
  const adapter = makeAdapter(() =>
    Promise.resolve({ code: 0, stdout: JSON.stringify({ id: "NODE_PBI_42" }), stderr: "" })
  );
  adapter.setProjectBoardNumbers(10, 11, 12);
  adapter.resolveProjectItemOnBoard = () => Promise.resolve("ITEM_PBI_42");
  adapter.resolveSingleSelectOptionId = () => Promise.resolve("OPTION_M");
  adapter.setSingleSelectFieldValue = () =>
    Promise.resolve({ operation: "updateField", success: false, error: "size field denied" });

  const result = await adapter.execute({
    summary: "confirm PBI size with setter failure",
    steps: [{
      entity: "ProductBacklogItem",
      operation: "confirmSize",
      params: { itemId: "42", sizeActual: "M" },
    }],
  });

  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "size field denied");
});

/**
 * ユースケース: WP分析記録のIssue解決でghが失敗した場合
 * 検証意図: recordAnalysisを無言成功にせず、ghの原因を返すこと。
 */
Deno.test("WP809 AC-2 WorkPackage recordAnalysis - should fail when gh issue view fails", async () => {
  const adapter = makeAdapter(() =>
    Promise.resolve({ code: 1, stdout: "", stderr: "WP analysis lookup denied" })
  );
  adapter.setProjectBoardNumbers(10, 11, 12);
  const body = JSON.stringify({ planning_variance_review: "planning" });

  const result = await adapter.execute({
    summary: "record WP analysis with gh failure",
    steps: [{
      entity: "WorkPackage",
      operation: "recordAnalysis",
      params: { itemId: "51", body },
    }],
  });

  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "WP analysis lookup denied");
});

/**
 * ユースケース: WP分析記録で対象Board itemを解決できない場合
 * 検証意図: 要求field書込が未実施のまま成功扱いにならないこと。
 */
Deno.test("WP809 AC-2 WorkPackage recordAnalysis - should fail when Board item is unresolved", async () => {
  const adapter = makeAdapter(() =>
    Promise.resolve({ code: 0, stdout: JSON.stringify({ id: "NODE_WP_51" }), stderr: "" })
  );
  adapter.setProjectBoardNumbers(10, 11, 12);
  adapter.resolveProjectItemOnBoard = () => Promise.resolve(null);

  const result = await adapter.execute({
    summary: "record WP analysis without Board item",
    steps: [{
      entity: "WorkPackage",
      operation: "recordAnalysis",
      params: { itemId: "51", body: JSON.stringify({ planning_variance_review: "planning" }) },
    }],
  });

  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "51");
});

/**
 * ユースケース: WP分析のProject V2 field setterがsuccess:falseを返す場合
 * 検証意図: nested StepResultの失敗とerrorを親operationへ伝播すること。
 */
Deno.test("WP809 AC-2 WorkPackage recordAnalysis - should report field setter failure", async () => {
  const adapter = makeAdapter(() =>
    Promise.resolve({ code: 0, stdout: JSON.stringify({ id: "NODE_WP_51" }), stderr: "" })
  );
  adapter.setProjectBoardNumbers(10, 11, 12);
  adapter.resolveProjectItemOnBoard = () => Promise.resolve("ITEM_WP_51");
  adapter.setTextFieldValue = () =>
    Promise.resolve({ operation: "updateField", success: false, error: "analysis field denied" });

  const result = await adapter.execute({
    summary: "record WP analysis with field failure",
    steps: [{
      entity: "WorkPackage",
      operation: "recordAnalysis",
      params: { itemId: "51", body: JSON.stringify({ planning_variance_review: "planning" }) },
    }],
  });

  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "analysis field denied");
});

for (
  const { operation, params, error } of [
    {
      operation: "estimateInitialEffort",
      params: { itemId: "51", effortInitial: 2 },
      error: "initial estimate write denied",
    },
    {
      operation: "estimatePlannedEffort",
      params: { itemId: "51", effortPlanned: 2 },
      error: "planned estimate write denied",
    },
  ] as const
) {
  /**
   * ユースケース: effort見積りfield setterがsuccess:falseを返す場合
   * 検証意図: estimate operationがsuccess:falseとsetterの原因を返すこと。
   */
  Deno.test(`WP809 AC-3 WorkPackage ${operation} - should report field setter failure`, async () => {
    const adapter = makeAdapter(() =>
      Promise.resolve({ code: 0, stdout: JSON.stringify({ id: "NODE_WP_51" }), stderr: "" })
    );
    adapter.setProjectBoardNumbers(10, 11, 12);
    adapter.resolveProjectItemOnBoard = () => Promise.resolve("ITEM_WP_51");
    adapter.readTextFieldValue = () => Promise.resolve('{"initial_estimate":2}');
    adapter.setTextFieldValue = () =>
      Promise.resolve({ operation: "updateField", success: false, error });

    const result = await adapter.execute({
      summary: `${operation} with setter failure`,
      steps: [{ entity: "WorkPackage", operation, params }],
    });

    assertEquals(result.stepResults[0].success, false);
    assertEquals(result.stepResults[0].operation, operation);
    assertEquals(result.stepResults[0].itemId, "51");
    assertStringIncludes(result.stepResults[0].error ?? "", error);
  });
}

for (
  const scenario of [
    {
      entity: "ProductBacklogItem",
      operation: "propose",
      step: { entity: "ProductBacklogItem", operation: "propose", params: { title: "PBI" } },
      itemId: "42",
      boardName: "Product Backlog Board",
    },
    {
      entity: "WorkPackage",
      operation: "define",
      step: {
        entity: "WorkPackage",
        operation: "define",
        params: { title: "WP", parentPbi: "40" },
      },
      itemId: "51",
      boardName: "Sprint Board",
    },
    {
      entity: "Retrospective",
      operation: "plan",
      step: { entity: "Retrospective", operation: "plan", params: { title: "Retro" } },
      itemId: "77",
      boardName: "Board #12",
    },
  ] as const
) {
  /**
   * ユースケース: Board設定済みで作成後のIssue node ID解決が失敗した場合
   * 検証意図: addItemToProjectを実行できない作成結果を成功報告しないこと。
   */
  Deno.test(`WP809 review - ${scenario.entity} ${scenario.operation} should fail without created nodeId`, async () => {
    const adapter = makeAdapter();
    adapter.setProjectBoardNumbers(10, 11, 12);
    adapter.handleCreateItem = () =>
      Promise.resolve({ operation: "create", success: true, itemId: scenario.itemId });
    adapter.handleSetParent = (itemId) =>
      Promise.resolve({ operation: "update", success: true, itemId });

    const result = await adapter.execute({
      summary: `create ${scenario.entity} without nodeId`,
      steps: [scenario.step],
    });

    assertEquals(result.stepResults[0].success, false);
    assertEquals(result.stepResults[0].itemId, scenario.itemId);
    assertStringIncludes(result.stepResults[0].error ?? "", scenario.boardName);
    assertStringIncludes(result.stepResults[0].error ?? "", "node ID");
  });
}

/**
 * ユースケース: confirmSizeのgh issue view runnerがrejectした場合
 * 検証意図: itemIdとoperation名を保持した失敗結果を返すこと。
 */
Deno.test("WP809 review confirmSize - should retain PBI context when gh runner rejects", async () => {
  const adapter = makeAdapter(() => Promise.reject(new Error("view runner rejected")));
  adapter.setProjectBoardNumbers(10, 11, 12);

  const result = await adapter.execute({
    summary: "confirm PBI size with rejected view runner",
    steps: [{
      entity: "ProductBacklogItem",
      operation: "confirmSize",
      params: { itemId: "42", sizeActual: "M" },
    }],
  });

  assertEquals(result.stepResults[0].success, false);
  assertEquals(result.stepResults[0].operation, "confirmSize");
  assertEquals(result.stepResults[0].itemId, "42");
  assertStringIncludes(result.stepResults[0].error ?? "", "view runner rejected");
});

/**
 * ユースケース: サイズ実績は書込済みだがサイズ乖離理由のfield書込が失敗する場合
 * 検証意図: fieldの部分成功を親operationのerrorで明示すること。
 */
Deno.test("WP809 review confirmSize - should describe partial field completion", async () => {
  const adapter = makeAdapter(() =>
    Promise.resolve({ code: 0, stdout: JSON.stringify({ id: "NODE_PBI_42" }), stderr: "" })
  );
  adapter.setProjectBoardNumbers(10, 11, 12);
  adapter.resolveProjectItemOnBoard = () => Promise.resolve("ITEM_PBI_42");
  adapter.resolveSingleSelectOptionId = () => Promise.resolve("OPTION_M");
  adapter.setSingleSelectFieldValue = () =>
    Promise.resolve({ operation: "updateField", success: true });
  adapter.setTextFieldValue = () =>
    Promise.resolve({ operation: "updateField", success: false, error: "variance denied" });

  const result = await adapter.execute({
    summary: "confirm PBI size with partial field failure",
    steps: [{
      entity: "ProductBacklogItem",
      operation: "confirmSize",
      params: { itemId: "42", sizeActual: "M", sizeVarianceReason: "reason" },
    }],
  });

  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "Completed fields:");
  assertStringIncludes(result.stepResults[0].error ?? "", "variance denied");
});

/**
 * ユースケース: 分析field群の一部書込がrejectし別field書込が成功する場合
 * 検証意図: 全setterの完了を待ち、成功fieldと失敗field双方をerrorに列挙すること。
 */
Deno.test("WP809 review recordAnalysis - should report completed and failed fields", async () => {
  const adapter = makeAdapter(() =>
    Promise.resolve({ code: 0, stdout: JSON.stringify({ id: "NODE_WP_51" }), stderr: "" })
  );
  adapter.setProjectBoardNumbers(10, 11, 12);
  adapter.resolveProjectItemOnBoard = () => Promise.resolve("ITEM_WP_51");
  adapter.setTextFieldValue = (_itemId, ref) =>
    ref.fieldName.includes("planning")
      ? Promise.resolve({ operation: "updateField", success: true })
      : Promise.reject(new Error("second field rejected"));

  const result = await adapter.execute({
    summary: "record WP analysis with partial writes",
    steps: [{
      entity: "WorkPackage",
      operation: "recordAnalysis",
      params: {
        itemId: "51",
        body: JSON.stringify({
          planning_variance_review: "planning",
          execution_variance_review: "execution",
        }),
      },
    }],
  });

  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "Completed fields:");
  assertStringIncludes(result.stepResults[0].error ?? "", "Failed fields:");
  assertStringIncludes(result.stepResults[0].error ?? "", "second field rejected");
});

/**
 * ユースケース: 履歴lookup失敗後の通常コメントfallbackも失敗する場合
 * 検証意図: lookup失敗warningを記録し、fallback側の失敗を呼出元へ伝播すること。
 */
Deno.test("WP809 review comment - should warn on history lookup and propagate fallback failure", async () => {
  const adapter = makeAdapter((_cmd, args) =>
    Promise.resolve(
      args.includes("comment")
        ? { code: 1, stdout: "", stderr: "regular comment denied" }
        : { code: 1, stdout: "", stderr: "history lookup denied" },
    )
  );
  const warnings: string[] = [];
  const originalWarn = console.warn;
  console.warn = (...values: unknown[]) => warnings.push(values.map(String).join(" "));

  let result;
  try {
    result = await adapter.execute({
      summary: "comment after history lookup failure",
      steps: [{
        entity: "ProductBacklogItem",
        operation: "comment",
        params: { itemId: "42", body: "history row" },
      }],
    });
  } finally {
    console.warn = originalWarn;
  }

  assert(warnings.some((warning) => warning.includes("History lookup failed for PBI #42")));
  assertEquals(result!.stepResults[0].success, false);
  assertStringIncludes(result!.stepResults[0].error ?? "", "regular comment denied");
});

/**
 * ユースケース: 履歴更新GH runnerがrejectした後の一時ファイルcleanup
 * 検証意図: fallbackを続けながら一時ファイルをfinallyで削除すること。
 */
Deno.test("WP809 review comment - should cleanup temp input after GraphQL runner rejects", async () => {
  await Deno.mkdir("/tmp/opencode", { recursive: true });
  let tempPath: string | undefined;
  const runner = (_cmd: string, args: string[]): Promise<ExecuteResult> => {
    const inputIndex = args.indexOf("--input");
    if (inputIndex >= 0) {
      tempPath = args[inputIndex + 1];
      return Promise.reject(new Error("GraphQL runner rejected"));
    }
    if (args.includes("view")) {
      return Promise.resolve({
        code: 0,
        stdout: JSON.stringify({
          comments: [{ id: "COMMENT_1", body: "## History\n\n| 1 | previous |" }],
        }),
        stderr: "",
      });
    }
    return Promise.resolve({ code: 0, stdout: "", stderr: "" });
  };
  const adapter = makeAdapter(runner);

  const result = await adapter.execute({
    summary: "history update runner reject",
    steps: [{
      entity: "ProductBacklogItem",
      operation: "comment",
      params: { itemId: "42", body: "| 2 | updated |" },
    }],
  });

  assertEquals(result.stepResults[0].success, true);
  assert(tempPath, "history update should allocate a temporary input file");
  let exists = true;
  try {
    await Deno.stat(tempPath);
  } catch {
    exists = false;
  }
  assertEquals(exists, false, "temporary input should be removed when runner rejects");
});
