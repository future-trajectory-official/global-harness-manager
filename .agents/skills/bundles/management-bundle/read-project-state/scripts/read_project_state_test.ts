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
    if [ "$2" = "repos/my-org/my-repo/milestones" ]; then
      echo '[{"number":19,"title":"Sprint 19"}]'
      exit 0
    fi
    if [ "\${2#repos/my-org/my-repo/milestones/}" != "$2" ]; then
      echo '{"number":19,"title":"Sprint 19"}'
      exit 0
    fi
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
 * @description PBI一覧検索（search）が read_project_state を通じて gh issue list を発行し、一覧を返すこと
 * @verify gh の issue list 呼び出しログと、成功した step（operation=search）が出力に含まれること
 */
Deno.test("read_project_state - search PBI issues issue list", async () => {
  const tempDir = await Deno.makeTempDir();
  try {
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
        JSON.stringify({
          entityType: "ProductBacklogItem",
          operation: "search",
          params: { state: "open" },
        }),
      ),
    );
    await writer.close();

    const { code, stdout, stderr } = await child.output();
    const output = new TextDecoder().decode(stdout);
    const errOutput = new TextDecoder().decode(stderr);

    assertEquals(code, 0, `Script failed with code ${code}\nStderr: ${errOutput}`);
    assertStringIncludes(output, '"success": true');
    assertStringIncludes(output, '"operation": "search"');

    const logContent = await Deno.readTextFile(callLogPath);
    assertStringIncludes(logContent, "GH_ARGS: issue list");
    assertStringIncludes(logContent, "--label");
    assertStringIncludes(logContent, "type:PBI");
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
        JSON.stringify({
          entityType: "ProductBacklogItem",
          operation: "find",
          params: { itemId: "42" },
        }),
      ),
    );
    await writer.close();

    const { code, stdout, stderr } = await child.output();
    const output = new TextDecoder().decode(stdout);
    const errOutput = new TextDecoder().decode(stderr);

    assertEquals(code, 0, `Script failed with code ${code}\nStderr: ${errOutput}`);
    assertStringIncludes(output, '"success": true');
    assertStringIncludes(output, '"operation": "view"');
    assertStringIncludes(output, "User Authentication");

    const logContent = await Deno.readTextFile(callLogPath);
    assertStringIncludes(logContent, "GH_ARGS: issue view 42");
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
    const { mockBinDir } = await setupMockRepo(tempDir);

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
        JSON.stringify({
          entityType: "Vision",
          operation: "search",
          params: {},
        }),
      ),
    );
    await writer.close();

    const { code, stdout } = await child.output();
    const output = new TextDecoder().decode(stdout);

    assertEquals(code, 1);
    assertStringIncludes(output, "search is not supported for Vision");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});
