import { assertEquals, assertStringIncludes } from "@std/assert";
import { join } from "@std/path";
import { getSkillScriptPath, PATHS } from "../../../../../../test/test_helper.ts";

/**
 * モック gh / git を作成し、呼び出しログを記録する一時ディレクトリを構築する。
 * PATH の最優先にモック bin を配置することで、実際の gh / git を呼ばずに E2E を実行できる。
 * @param options.issueListOutput issue list が返す JSON。既定は2件。0件ケース検証用に空配列を渡せる
 */
async function setupMockRepo(
  tempDir: string,
  options: { issueListOutput?: string } = {},
): Promise<{
  mockBinDir: string;
  callLogPath: string;
}> {
  const mockBinDir = join(tempDir, "bin");
  const callLogPath = join(tempDir, "gh_call.log");
  await Deno.mkdir(mockBinDir, { recursive: true });

  const logEscape = callLogPath.replace(/'/g, "'\\''");
  const issueListOutput = options.issueListOutput ??
    '[{"number":42,"title":"User Authentication","labels":[{"name":"type:PBI"}]},{"number":7,"title":"Login page","labels":[{"name":"type:Feature"}]}]';

  const mockGhContent = `#!/bin/sh
echo "GH_ARGS: $*" >> '${logEscape}'
case "$1" in
  auth)
    echo "{}"
    exit 0
    ;;
  repo)
    echo '{"owner":{"login":"my-org"},"name":"my-repo"}'
    exit 0
    ;;
  issue)
    if [ "$2" = "list" ]; then
      echo '${issueListOutput}'
      exit 0
    fi
    if [ "$2" = "view" ]; then
      echo '{"number":42,"title":"User Authentication","body":"Implement user login","labels":[{"name":"type:PBI"}],"comments":[],"id":"node-42"}'
      exit 0
    fi
    echo "unexpected: $*" >&2
    exit 1
    ;;
  api)
    if [ "$2" = "graphql" ]; then
      echo '{"data":{"repository":{"issue":{"parent":{"number":10,"title":"Parent Epic","id":"node-10"},"milestone":{"number":19,"title":"Sprint 19"},"subIssues":{"nodes":[{"number":7,"title":"Child feature","id":"node-7"}]},"projectItems":{"nodes":[{"id":"pv-1","project":{"title":"Board","number":1},"sizeEst":{"name":"M"},"sizeAct":{"name":"M"},"effort":{"text":"{\\"initial_estimate\\":2,\\"planned_estimate\\":3}"},"status":{"name":"Todo"}}]}}}}}'
      exit 0
    fi
    case "$2" in
      repos/my-org/my-repo/milestones\?*)
        echo '[{"number":19,"title":"Sprint 19"},{"number":17,"title":"Sprint 18"}]'
        exit 0
        ;;
      repos/my-org/my-repo/milestones/19)
        echo '{"number":19,"title":"Sprint 19"}'
        exit 0
        ;;
    esac
    echo "unexpected: $*" >&2
    exit 1
    ;;
  *)
    echo "unexpected: $*" >&2
    exit 1
    ;;
esac
`;
  const mockGitContent = `#!/bin/sh
echo "GIT_ARGS: $*" >> '${logEscape}'
if [ "$1" = "remote" ] && [ "$2" = "get-url" ]; then
  echo "git@github.com:my-org/my-repo.git"
  exit 0
fi
exit 0
`;

  await Deno.writeTextFile(join(mockBinDir, "gh"), mockGhContent);
  await Deno.chmod(join(mockBinDir, "gh"), 0o755);
  await Deno.writeTextFile(join(mockBinDir, "git"), mockGitContent);
  await Deno.chmod(join(mockBinDir, "git"), 0o755);

  return { mockBinDir, callLogPath };
}

const scriptPath = getSkillScriptPath(
  PATHS.BUNDLES.MANAGEMENT,
  "read-project-state",
  "read_project_state.ts",
);

type ScriptResult = { code: number; stdout: string; stderr: string; callLog: string };

/**
 * モック gh / git を PATH に置いた環境で read_project_state.ts をサブプロセス実行する。
 * ヘルパーは一時ディレクトリの作成・後始末とモック構築を内包し、結果を返す。
 * @param input 標準入力へ渡す入力JSON（文字列の場合はそのまま渡す）
 * @param fn 実行結果の検証コールバック
 * @param mockOptions setupMockRepo へ渡すオプション
 */
async function withMockScript(
  input: Record<string, unknown> | string,
  fn?: (result: ScriptResult) => void | Promise<void>,
  mockOptions: { issueListOutput?: string } = {},
): Promise<ScriptResult> {
  const tempDir = await Deno.makeTempDir();
  let result: ScriptResult;
  try {
    const { mockBinDir, callLogPath } = await setupMockRepo(tempDir, mockOptions);

    const command = new Deno.Command(Deno.execPath(), {
      args: ["run", "-A", scriptPath],
      stdin: "piped",
      stdout: "piped",
      stderr: "piped",
      env: {
        ...Deno.env.toObject(),
        PATH: `${mockBinDir}:${Deno.env.get("PATH")}`,
      },
    });

    const child = command.spawn();
    const writer = child.stdin.getWriter();
    const payload = typeof input === "string" ? input : JSON.stringify(input);
    await writer.write(new TextEncoder().encode(payload));
    await writer.close();

    const { code, stdout, stderr } = await child.output();
    const callLog = await Deno.readTextFile(callLogPath).catch(() => "");
    result = {
      code,
      stdout: new TextDecoder().decode(stdout),
      stderr: new TextDecoder().decode(stderr),
      callLog,
    };
    if (fn) {
      await fn(result);
    }
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
  return result;
}

/**
 * @description PBI一覧検索（search）が read_project_state を通じて gh issue list を発行し、一覧を返すこと
 * @verify gh の issue list 呼び出しログと、成功した step（operation=search）が出力に含まれること
 */
Deno.test("read_project_state - search PBI issues issue list", async () => {
  await withMockScript(
    {
      entityType: "ProductBacklogItem",
      operation: "search",
      params: { state: "open" },
    },
    (result) => {
      assertEquals(
        result.code,
        0,
        `Script failed with code ${result.code}\nStderr: ${result.stderr}`,
      );
      assertStringIncludes(result.stdout, '"success": true');
      assertStringIncludes(result.stdout, '"operation": "search"');
      assertStringIncludes(result.callLog, "GH_ARGS: issue list");
      assertStringIncludes(result.callLog, "--label");
      assertStringIncludes(result.callLog, "type:PBI");
    },
  );
});

/**
 * @description PBI詳細閲覧（find）が read_project_state を通じて gh issue view <code> を発行し、詳細を返すこと
 * @verify gh の issue view 呼び出しログと、成功した step（operation=view）が出力に含まれること
 */
Deno.test("read_project_state - find PBI issues issue view", async () => {
  await withMockScript(
    {
      entityType: "ProductBacklogItem",
      operation: "find",
      params: { itemId: "42" },
    },
    (result) => {
      assertEquals(
        result.code,
        0,
        `Script failed with code ${result.code}\nStderr: ${result.stderr}`,
      );
      assertStringIncludes(result.stdout, '"success": true');
      assertStringIncludes(result.stdout, '"operation": "view"');
      assertStringIncludes(result.stdout, "User Authentication");
      assertStringIncludes(result.callLog, "GH_ARGS: issue view 42");
    },
  );
});

/**
 * @description find の階層リッチ化（parent / milestone / subIssues）が gh api graphql によって実行されること
 * @verify モックgh の graphql 分岐が発火し（GH_ARGS: api graphql が記録される）、
 *        出力に parent（Parent Epic）/ milestone（Sprint 19）/ children（Child feature）が含まれること
 */
Deno.test("read_project_state - find PBI enriches hierarchy via graphql", async () => {
  await withMockScript(
    {
      entityType: "ProductBacklogItem",
      operation: "find",
      params: { itemId: "42" },
    },
    (result) => {
      assertEquals(
        result.code,
        0,
        `Script failed with code ${result.code}\nStderr: ${result.stderr}`,
      );
      assertStringIncludes(result.callLog, "GH_ARGS: api graphql");
      assertStringIncludes(result.stdout, '"parent"');
      assertStringIncludes(result.stdout, "Parent Epic");
      assertStringIncludes(result.stdout, '"milestone"');
      assertStringIncludes(result.stdout, "Sprint 19");
      assertStringIncludes(result.stdout, '"children"');
      assertStringIncludes(result.stdout, "Child feature");
      assertStringIncludes(result.stdout, '"projectItems"');
      assertStringIncludes(result.stdout, '"effort"');
      assertStringIncludes(result.stdout, '\\"initial_estimate\\":2');
    },
  );
});

/**
 * @description 業務前提（単一インスタンス）により Vision / ProductGoal の search が「対象外」エラーを返すこと
 * @verify 出力に "search is not supported for <Entity>" が含まれること
 */
for (const entityType of ["Vision", "ProductGoal"] as const) {
  Deno.test(`read_project_state - ${entityType} search returns unsupported error`, async () => {
    await withMockScript(
      { entityType, operation: "search", params: {} },
      (result) => {
        assertEquals(result.code, 1);
        assertStringIncludes(result.stdout, `search is not supported for ${entityType}`);
      },
    );
  });
}

/**
 * @description 単一インスタンスEntity（Vision / ProductGoal）の find が code 指定で詳細を返すこと
 * @verify 成功した step（operation=view）と gh issue view 42 の呼び出しログが含まれること
 */
for (const entityType of ["Vision", "ProductGoal"] as const) {
  Deno.test(`read_project_state - ${entityType} find by code returns detail`, async () => {
    await withMockScript(
      { entityType, operation: "find", params: { itemId: "42" } },
      (result) => {
        assertEquals(
          result.code,
          0,
          `Script failed with code ${result.code}\nStderr: ${result.stderr}`,
        );
        assertStringIncludes(result.stdout, '"success": true');
        assertStringIncludes(result.stdout, '"operation": "view"');
        assertStringIncludes(result.callLog, "GH_ARGS: issue view 42");
      },
    );
  });
}

/**
 * @description Sprint の find（code省略）が最新オープンのマイルストーンを検索し、詳細を返すこと
 * @verify milestones 検索と milestones/19 の gh api 呼び出しログ、成功した step（operation=view）が含まれること
 */
Deno.test("read_project_state - Sprint find without code resolves latest open", async () => {
  await withMockScript(
    { entityType: "Sprint", operation: "find", params: {} },
    (result) => {
      assertEquals(
        result.code,
        0,
        `Script failed with code ${result.code}\nStderr: ${result.stderr}`,
      );
      assertStringIncludes(result.stdout, '"success": true');
      assertStringIncludes(result.stdout, '"operation": "view"');
      assertStringIncludes(result.stdout, '"number": 19');
      assertStringIncludes(result.callLog, "milestones?state=open");
    },
  );
});

/**
 * @description Sprint の find（code指定）がマイルストーン詳細を返すこと
 * @verify milestones/19 の gh api 呼び出しログと、成功した step（operation=view）が含まれること
 */
Deno.test("read_project_state - Sprint find by code returns milestone", async () => {
  await withMockScript(
    { entityType: "Sprint", operation: "find", params: { itemId: "19" } },
    (result) => {
      assertEquals(
        result.code,
        0,
        `Script failed with code ${result.code}\nStderr: ${result.stderr}`,
      );
      assertStringIncludes(result.stdout, '"success": true');
      assertStringIncludes(result.stdout, '"operation": "view"');
      assertStringIncludes(result.stdout, '"number": 19');
      assertStringIncludes(result.callLog, "milestones/19");
    },
  );
});

/**
 * @description Sprint の search（state指定）が状態別のマイルストーン一覧を返すこと
 * @verify milestones?state=closed の gh api 呼び出しログと、一覧（複数件）を含む成功した step が返ること
 */
Deno.test("read_project_state - Sprint search by state returns milestone list", async () => {
  await withMockScript(
    { entityType: "Sprint", operation: "search", params: { state: "closed" } },
    (result) => {
      assertEquals(
        result.code,
        0,
        `Script failed with code ${result.code}\nStderr: ${result.stderr}`,
      );
      assertStringIncludes(result.stdout, '"success": true');
      assertStringIncludes(result.stdout, '"operation": "search"');
      assertStringIncludes(result.stdout, '"itemId": "19"');
      assertStringIncludes(result.stdout, '"number": 19');
      assertStringIncludes(result.stdout, '"number": 17');
      assertStringIncludes(result.callLog, "milestones?state=closed");
    },
  );
});

/**
 * @description Sprint の search（state未指定）が既定の all でマイルストーン一覧を返すこと
 * @verify milestones?state=all の gh api 呼び出しログと、一覧（複数件）を含む成功した step が返ること
 */
Deno.test("read_project_state - Sprint search default state=all returns milestone list", async () => {
  await withMockScript(
    { entityType: "Sprint", operation: "search", params: {} },
    (result) => {
      assertEquals(
        result.code,
        0,
        `Script failed with code ${result.code}\nStderr: ${result.stderr}`,
      );
      assertStringIncludes(result.stdout, '"success": true');
      assertStringIncludes(result.stdout, '"operation": "search"');
      assertStringIncludes(result.stdout, '"itemId": "19"');
      assertStringIncludes(result.stdout, '"number": 19');
      assertStringIncludes(result.stdout, '"number": 17');
      assertStringIncludes(result.callLog, "milestones?state=all");
    },
  );
});

/**
 * @description Retrospective の search が issue list を発行し一覧を返すこと
 * @verify 出力に success: true と issue list の結果が含まれ、type:Retrospective ラベルで検索されること
 */
Deno.test("read_project_state - Retrospective search returns list", async () => {
  await withMockScript(
    { entityType: "Retrospective", operation: "search", params: {} },
    (result) => {
      assertEquals(result.code, 0);
      assertStringIncludes(result.stdout, '"success": true');
      assertStringIncludes(result.stdout, '"operation": "search"');
      assertStringIncludes(result.callLog, "type:Retrospective");
    },
  );
});

/**
 * @description Retrospective の find が issue view を発行し詳細を返すこと
 * @verify 出力に success: true と指定 Issue の詳細が含まれること
 */
Deno.test("read_project_state - Retrospective find returns details", async () => {
  await withMockScript(
    { entityType: "Retrospective", operation: "find", params: { itemId: "42" } },
    (result) => {
      assertEquals(result.code, 0);
      assertStringIncludes(result.stdout, '"success": true');
      assertStringIncludes(result.stdout, '"operation": "view"');
      assertStringIncludes(result.stdout, '"itemId": "42"');
      assertStringIncludes(result.callLog, "issue view 42");
    },
  );
});

/**
 * @description Epic / Feature / WorkPackage / Review の search が issue list を発行し一覧を返すこと
 * @verify 各Entityのラベル（type:Epic / type:Feature / type:WP / type:Review）を含む issue list 呼び出しが含まれること
 */
for (
  const [entityType, label] of [
    ["Epic", "type:Epic"],
    ["Feature", "type:Feature"],
    ["WorkPackage", "type:WP"],
    ["Review", "type:Review"],
  ] as const
) {
  Deno.test(`read_project_state - ${entityType} search uses label ${label}`, async () => {
    await withMockScript(
      { entityType, operation: "search", params: { state: "open" } },
      (result) => {
        assertEquals(
          result.code,
          0,
          `Script failed with code ${result.code}\nStderr: ${result.stderr}`,
        );
        assertStringIncludes(result.stdout, '"success": true');
        assertStringIncludes(result.stdout, '"operation": "search"');
        assertStringIncludes(result.callLog, "--label");
        assertStringIncludes(result.callLog, label);
      },
    );
  });
}

/**
 * @description Epic / Feature / WorkPackage / Review の find が gh issue view を発行し詳細を返すこと
 * @verify 成功した step（operation=view）と gh issue view 42 の呼び出しログが含まれること
 */
for (const entityType of ["Epic", "Feature", "WorkPackage", "Review"] as const) {
  Deno.test(`read_project_state - ${entityType} find by code returns detail`, async () => {
    await withMockScript(
      { entityType, operation: "find", params: { itemId: "42" } },
      (result) => {
        assertEquals(
          result.code,
          0,
          `Script failed with code ${result.code}\nStderr: ${result.stderr}`,
        );
        assertStringIncludes(result.stdout, '"success": true');
        assertStringIncludes(result.stdout, '"operation": "view"');
        assertStringIncludes(result.callLog, "GH_ARGS: issue view 42");
      },
    );
  });
}

/**
 * @description Scope は検索・閲覧とも不可のため INVALID_INPUT エラーを返すこと
 * @verify 出力に "INVALID_INPUT" が含まれること
 */
Deno.test("read_project_state - Scope find returns invalid input error", async () => {
  await withMockScript(
    { entityType: "Scope", operation: "find", params: {} },
    (result) => {
      assertEquals(result.code, 1);
      assertStringIncludes(result.stdout, "INVALID_INPUT");
    },
  );
});

/**
 * @description 検索結果0件のとき search が空配列を返すこと（エラーにならないこと）
 * @verify モックghが空配列を返すとき、success: true と空の output が返ること
 */
Deno.test("read_project_state - search returns empty list for zero results", async () => {
  await withMockScript(
    {
      entityType: "ProductBacklogItem",
      operation: "search",
      params: { state: "open" },
    },
    (result) => {
      assertEquals(
        result.code,
        0,
        `Script failed with code ${result.code}\nStderr: ${result.stderr}`,
      );
      assertStringIncludes(result.stdout, '"success": true');
      assertStringIncludes(result.stdout, '"operation": "search"');
      assertStringIncludes(result.stdout, '"output": []');
    },
    { issueListOutput: "[]" },
  );
});

/**
 * @description 不正なJSON入力が exit 1 とエラーメッセージを返すこと
 * @verify 壊れたJSONを渡すと code=1 で失敗することを確認する
 */
Deno.test("read_project_state - malformed JSON input fails with exit 1", async () => {
  await withMockScript("{ not valid json ", (result) => {
    assertEquals(result.code, 1, "expected exit code 1 for malformed JSON");
    assertStringIncludes(result.stdout, '"success": false');
  });
});
