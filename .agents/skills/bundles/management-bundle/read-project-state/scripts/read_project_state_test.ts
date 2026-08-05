import { assertEquals, assertStringIncludes } from "@std/assert";
import { join } from "@std/path";
import { getSkillScriptPath, PATHS } from "../../../../../../test/test_helper.ts";

/**
 * モック gh / git を作成し、呼び出しログを記録する一時ディレクトリを構築する。
 * PATH の最優先にモック bin を配置することで、実際の gh / git を呼ばずに E2E を実行できる。
 */
async function setupMockRepo(tempDir: string): Promise<{
  mockBinDir: string;
  callLogPath: string;
}> {
  const mockBinDir = join(tempDir, "bin");
  const callLogPath = join(tempDir, "gh_call.log");
  await Deno.mkdir(mockBinDir, { recursive: true });

  const logEscape = callLogPath.replace(/'/g, "'\\''");

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
      echo '[{"number":42,"title":"User Authentication","labels":[{"name":"type:PBI"}]},{"number":7,"title":"Login page","labels":[{"name":"type:Feature"}]}]'
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
    if [ "$3" = "graphql" ]; then
      echo '{"data":{"repository":{"issue":{"parent":null,"milestone":null,"subIssues":{"nodes":[]},"projectItems":{"nodes":[]}}}}}'
      exit 0
    fi
    case "$2" in
      repos/my-org/my-repo/milestones\?*)
        echo '[{"number":19,"title":"Sprint 19"}]'
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

/**
 * モック gh / git を PATH に置いた環境で read_project_state.ts をサブプロセス実行する。
 * @param tempDir setupMockRepo で構築した一時ディレクトリ
 * @param input 標準入力へ渡す入力JSON
 */
async function runScript(
  tempDir: string,
  input: Record<string, unknown>,
): Promise<{ code: number; stdout: string; stderr: string; callLog: string }> {
  const { mockBinDir, callLogPath } = await setupMockRepo(tempDir);

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
  await writer.write(
    new TextEncoder().encode(
      JSON.stringify(input),
    ),
  );
  await writer.close();

  const { code, stdout, stderr } = await child.output();
  const callLog = await Deno.readTextFile(callLogPath).catch(() => "");
  return {
    code,
    stdout: new TextDecoder().decode(stdout),
    stderr: new TextDecoder().decode(stderr),
    callLog,
  };
}

/**
 * @description PBI一覧検索（search）が read_project_state を通じて gh issue list を発行し、一覧を返すこと
 * @verify gh の issue list 呼び出しログと、成功した step（operation=search）が出力に含まれること
 */
Deno.test("read_project_state - search PBI issues issue list", async () => {
  const tempDir = await Deno.makeTempDir();
  try {
    const result = await runScript(tempDir, {
      entityType: "ProductBacklogItem",
      operation: "search",
      params: { state: "open" },
    });

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
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

/**
 * @description PBI詳細閲覧（find）が read_project_state を通じて gh issue view <code> を発行し、詳細を返すこと
 * @verify gh の issue view 呼び出しログと、成功した step（operation=view）が出力に含まれること
 */
Deno.test("read_project_state - find PBI issues issue view", async () => {
  const tempDir = await Deno.makeTempDir();
  try {
    const result = await runScript(tempDir, {
      entityType: "ProductBacklogItem",
      operation: "find",
      params: { itemId: "42" },
    });

    assertEquals(
      result.code,
      0,
      `Script failed with code ${result.code}\nStderr: ${result.stderr}`,
    );
    assertStringIncludes(result.stdout, '"success": true');
    assertStringIncludes(result.stdout, '"operation": "view"');
    assertStringIncludes(result.stdout, "User Authentication");

    assertStringIncludes(result.callLog, "GH_ARGS: issue view 42");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

/**
 * @description 業務前提（単一インスタンス）により Vision の search が「対象外」エラーを返すこと
 * @verify 出力に "search is not supported for Vision" が含まれること
 */
Deno.test("read_project_state - Vision search returns unsupported error", async () => {
  const tempDir = await Deno.makeTempDir();
  try {
    const result = await runScript(tempDir, {
      entityType: "Vision",
      operation: "search",
      params: {},
    });

    assertEquals(result.code, 1);
    assertStringIncludes(result.stdout, "search is not supported for Vision");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

/**
 * @description 業務前提（単一インスタンス）により ProductGoal の search が「対象外」エラーを返すこと
 * @verify 出力に "search is not supported for ProductGoal" が含まれること
 */
Deno.test("read_project_state - ProductGoal search returns unsupported error", async () => {
  const tempDir = await Deno.makeTempDir();
  try {
    const result = await runScript(tempDir, {
      entityType: "ProductGoal",
      operation: "search",
      params: {},
    });

    assertEquals(result.code, 1);
    assertStringIncludes(result.stdout, "search is not supported for ProductGoal");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

/**
 * @description 業務前提（単一インスタンス）により Sprint の search が「対象外」エラーを返すこと
 * @verify 出力に "search is not supported for Sprint" が含まれること
 */
Deno.test("read_project_state - Sprint search returns unsupported error", async () => {
  const tempDir = await Deno.makeTempDir();
  try {
    const result = await runScript(tempDir, {
      entityType: "Sprint",
      operation: "search",
      params: {},
    });

    assertEquals(result.code, 1);
    assertStringIncludes(result.stdout, "search is not supported for Sprint");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

/**
 * @description 単一インスタンスEntity（Vision）の find が code 指定で gh issue view を発行し詳細を返すこと
 * @verify 成功した step（operation=view）と gh issue view 42 の呼び出しログが含まれること
 */
Deno.test("read_project_state - Vision find by code returns detail", async () => {
  const tempDir = await Deno.makeTempDir();
  try {
    const result = await runScript(tempDir, {
      entityType: "Vision",
      operation: "find",
      params: { itemId: "42" },
    });

    assertEquals(
      result.code,
      0,
      `Script failed with code ${result.code}\nStderr: ${result.stderr}`,
    );
    assertStringIncludes(result.stdout, '"success": true');
    assertStringIncludes(result.stdout, '"operation": "view"');
    assertStringIncludes(result.callLog, "GH_ARGS: issue view 42");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

/**
 * @description 単一インスタンスEntity（ProductGoal）の find が code 指定で gh issue view を発行し詳細を返すこと
 * @verify 成功した step（operation=view）と gh issue view 42 の呼び出しログが含まれること
 */
Deno.test("read_project_state - ProductGoal find by code returns detail", async () => {
  const tempDir = await Deno.makeTempDir();
  try {
    const result = await runScript(tempDir, {
      entityType: "ProductGoal",
      operation: "find",
      params: { itemId: "42" },
    });

    assertEquals(
      result.code,
      0,
      `Script failed with code ${result.code}\nStderr: ${result.stderr}`,
    );
    assertStringIncludes(result.stdout, '"success": true');
    assertStringIncludes(result.stdout, '"operation": "view"');
    assertStringIncludes(result.callLog, "GH_ARGS: issue view 42");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

/**
 * @description Sprint の find（code省略）が最新オープンのマイルストーンを検索し、詳細を返すこと
 * @verify milestones 検索と milestones/19 の gh api 呼び出しログ、成功した step（operation=view）が含まれること
 */
Deno.test("read_project_state - Sprint find without code resolves latest open", async () => {
  const tempDir = await Deno.makeTempDir();
  try {
    const result = await runScript(tempDir, {
      entityType: "Sprint",
      operation: "find",
      params: {},
    });

    assertEquals(
      result.code,
      0,
      `Script failed with code ${result.code}\nStderr: ${result.stderr}`,
    );
    assertStringIncludes(result.stdout, '"success": true');
    assertStringIncludes(result.stdout, '"operation": "view"');
    assertStringIncludes(result.stdout, '"number": 19');
    assertStringIncludes(result.callLog, "milestones?state=open");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

/**
 * @description Sprint の find（code指定）がマイルストーン詳細を返すこと
 * @verify milestones/19 の gh api 呼び出しログと、成功した step（operation=view）が含まれること
 */
Deno.test("read_project_state - Sprint find by code returns milestone", async () => {
  const tempDir = await Deno.makeTempDir();
  try {
    const result = await runScript(tempDir, {
      entityType: "Sprint",
      operation: "find",
      params: { itemId: "19" },
    });

    assertEquals(
      result.code,
      0,
      `Script failed with code ${result.code}\nStderr: ${result.stderr}`,
    );
    assertStringIncludes(result.stdout, '"success": true');
    assertStringIncludes(result.stdout, '"operation": "view"');
    assertStringIncludes(result.stdout, '"number": 19');
    assertStringIncludes(result.callLog, "milestones/19");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

/**
 * @description Retrospective の search が明示的な「未実装」エラーを返すこと
 * @verify 出力に "Retrospective: not yet implemented in gateway layer" が含まれること
 */
Deno.test("read_project_state - Retrospective search returns not-implemented error", async () => {
  const tempDir = await Deno.makeTempDir();
  try {
    const result = await runScript(tempDir, {
      entityType: "Retrospective",
      operation: "search",
      params: {},
    });

    assertEquals(result.code, 0);
    assertStringIncludes(result.stdout, "Retrospective: not yet implemented in gateway layer");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

/**
 * @description Retrospective の find が明示的な「未実装」エラーを返すこと
 * @verify 出力に "Retrospective: not yet implemented in gateway layer" が含まれること
 */
Deno.test("read_project_state - Retrospective find returns not-implemented error", async () => {
  const tempDir = await Deno.makeTempDir();
  try {
    const result = await runScript(tempDir, {
      entityType: "Retrospective",
      operation: "find",
      params: { itemId: "42" },
    });

    assertEquals(result.code, 0);
    assertStringIncludes(result.stdout, "Retrospective: not yet implemented in gateway layer");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
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
    const tempDir = await Deno.makeTempDir();
    try {
      const result = await runScript(tempDir, {
        entityType,
        operation: "search",
        params: { state: "open" },
      });

      assertEquals(
        result.code,
        0,
        `Script failed with code ${result.code}\nStderr: ${result.stderr}`,
      );
      assertStringIncludes(result.stdout, '"success": true');
      assertStringIncludes(result.stdout, '"operation": "search"');
      assertStringIncludes(result.callLog, "--label");
      assertStringIncludes(result.callLog, label);
    } finally {
      await Deno.remove(tempDir, { recursive: true });
    }
  });
}

/**
 * @description Epic / Feature / WorkPackage / Review の find が gh issue view を発行し詳細を返すこと
 * @verify 成功した step（operation=view）と gh issue view 42 の呼び出しログが含まれること
 */
for (const entityType of ["Epic", "Feature", "WorkPackage", "Review"] as const) {
  Deno.test(`read_project_state - ${entityType} find by code returns detail`, async () => {
    const tempDir = await Deno.makeTempDir();
    try {
      const result = await runScript(tempDir, {
        entityType,
        operation: "find",
        params: { itemId: "42" },
      });

      assertEquals(
        result.code,
        0,
        `Script failed with code ${result.code}\nStderr: ${result.stderr}`,
      );
      assertStringIncludes(result.stdout, '"success": true');
      assertStringIncludes(result.stdout, '"operation": "view"');
      assertStringIncludes(result.callLog, "GH_ARGS: issue view 42");
    } finally {
      await Deno.remove(tempDir, { recursive: true });
    }
  });
}

/**
 * @description Scope は検索・閲覧とも不可のため INVALID_INPUT エラーを返すこと
 * @verify 出力に "INVALID_INPUT" が含まれること
 */
Deno.test("read_project_state - Scope find returns invalid input error", async () => {
  const tempDir = await Deno.makeTempDir();
  try {
    const result = await runScript(tempDir, {
      entityType: "Scope",
      operation: "find",
      params: {},
    });

    assertEquals(result.code, 1);
    assertStringIncludes(result.stdout, "INVALID_INPUT");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});
