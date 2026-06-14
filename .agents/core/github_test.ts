import { assertEquals } from "@std/assert";
import { closeIssue, createIssue, searchIssues, setGhCommand, updateIssue } from "./github.ts";

const MOCK_SCRIPT = `#!/usr/bin/env bash
# Mock gh CLI for testing
RESPONSE_FILE="$(dirname "$0")/mock-response.json"
case "$1 $2" in
  "issue create")
    cat "$RESPONSE_FILE"
    ;;
  "issue list")
    echo '[{"number":1,"url":"https://github.com/owner/repo/issues/1","title":"Test Issue","state":"open","labels":[{"name":"bug"}],"body":"test body","milestone":{"title":"v1","number":1}}]'
    ;;
  "issue edit")
    echo '{"number":'"$3"',"url":"https://github.com/owner/repo/issues/1","title":"Updated","state":"open","labels":[{"name":"bug"}],"body":"","milestone":null}'
    ;;
  "issue close")
    exit 0
    ;;
  *)
    echo "Unknown command: $*" >&2
    exit 1
    ;;
esac
`;

async function withMockGh(fn: () => Promise<void>) {
  const tmpDir = await Deno.makeTempDir({ prefix: "gh-test-" });
  const mockPath = `${tmpDir}/mock-gh.sh`;
  const responsePath = `${tmpDir}/mock-response.json`;
  await Deno.writeTextFile(mockPath, MOCK_SCRIPT);
  await Deno.writeTextFile(
    responsePath,
    JSON.stringify({ number: 42, url: "https://github.com/owner/repo/issues/42" }),
  );
  await Deno.chmod(mockPath, 0o755);
  setGhCommand(mockPath);
  try {
    await fn();
  } finally {
    setGhCommand("gh");
    await Deno.remove(tmpDir, { recursive: true });
  }
}

Deno.test("github - createIssue should return issue number and url", async () => {
  await withMockGh(async () => {
    const result = await createIssue({ title: "Test" });
    assertEquals(result?.number, 42);
    assertEquals(result?.url, "https://github.com/owner/repo/issues/42");
  });
});

Deno.test("github - searchIssues should return issue list", async () => {
  await withMockGh(async () => {
    const issues = await searchIssues({ state: "open" });
    assertEquals(issues.length, 1);
    assertEquals(issues[0].number, 1);
    assertEquals(issues[0].title, "Test Issue");
  });
});

Deno.test("github - updateIssue should return updated issue", async () => {
  await withMockGh(async () => {
    const result = await updateIssue(1, { title: "Updated" });
    assertEquals(result?.number, 1);
    assertEquals(result?.title, "Updated");
  });
});

Deno.test("github - closeIssue should return true", async () => {
  await withMockGh(async () => {
    const result = await closeIssue(1);
    assertEquals(result, true);
  });
});
