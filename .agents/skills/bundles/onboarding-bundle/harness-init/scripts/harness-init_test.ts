/**
 * harness-init のユニットテスト
 *
 * extractRepoOwner と parseIdentities の振る舞い、
 * CLI引数パース、--dry-run モードの動作を検証する。
 */
import { assertEquals } from "@std/assert";
import { parseArgs } from "@std/cli/parse-args";
import { extractRepoOwner, parseIdentities } from "./harness-init.ts";

Deno.test({
  name: "extractRepoOwner: SSH形式のURLからowner/repoを抽出する",
  fn() {
    assertEquals(extractRepoOwner("git@github.com:owner/repo.git"), "owner/repo");
  },
});

Deno.test({
  name: "extractRepoOwner: HTTPS形式のURLからowner/repoを抽出する",
  fn() {
    assertEquals(extractRepoOwner("https://github.com/owner/repo"), "owner/repo");
  },
});

Deno.test({
  name: "extractRepoOwner: 末尾が.gitのHTTPS形式からowner/repoを抽出する",
  fn() {
    assertEquals(extractRepoOwner("https://github.com/owner/repo.git"), "owner/repo");
  },
});

Deno.test({
  name: "extractRepoOwner: 未知の形式ではnullを返す",
  fn() {
    assertEquals(extractRepoOwner("invalid-url"), null);
  },
});

Deno.test({
  name: "parseIdentities: Visibility未指定時はprivateをデフォルト値とする",
  async fn() {
    const tmpDir = await Deno.makeTempDir({ prefix: "harness-init-test-" });
    const content =
      "# Global Harness Identities\n\n## MyProject\n\n- **Repository**: `git@github.com:owner/repo.git`\n- **Local Path**: `~/projects/repo`\n- **Account Name**: `testuser`\n- **User Email**: `test@users.noreply.github.com`\n";
    const path = `${tmpDir}/identities_no_visibility.md`;
    await Deno.writeTextFile(path, content);
    const projects = await parseIdentities(path);
    await Deno.remove(tmpDir, { recursive: true }).catch(() => {});
    assertEquals(projects.length, 1);
    assertEquals(projects[0].name, "MyProject");
    assertEquals(projects[0].repo, "git@github.com:owner/repo.git");
    assertEquals(projects[0].account, "testuser");
    assertEquals(projects[0].visibility, "private");
  },
});

Deno.test({
  name: "parseIdentities: Visibilityが明示されている場合はその値を使用する",
  async fn() {
    const tmpDir = await Deno.makeTempDir({ prefix: "harness-init-test-" });
    const content =
      "# Global Harness Identities\n\n## MyProject\n\n- **Repository**: `git@github.com:owner/repo.git`\n- **Local Path**: `~/projects/repo`\n- **Account Name**: `testuser`\n- **User Email**: `test@users.noreply.github.com`\n- **Visibility**: `public`\n";
    const path = `${tmpDir}/identities_public.md`;
    await Deno.writeTextFile(path, content);
    const projects = await parseIdentities(path);
    await Deno.remove(tmpDir, { recursive: true }).catch(() => {});
    assertEquals(projects[0].visibility, "public");
  },
});

Deno.test({
  name: "parseIdentities: 必須フィールドが不足しているエントリはスキップする",
  async fn() {
    const tmpDir = await Deno.makeTempDir({ prefix: "harness-init-test-" });
    const content =
      "# Global Harness Identities\n\n## Incomplete\n\n- **Account Name**: `testuser`\n\n## Complete\n\n- **Repository**: `git@github.com:owner/repo.git`\n- **Local Path**: `~/projects/repo`\n- **Account Name**: `testuser`\n- **User Email**: `test@users.noreply.github.com`\n";
    const path = `${tmpDir}/identities_incomplete.md`;
    await Deno.writeTextFile(path, content);
    const projects = await parseIdentities(path);
    await Deno.remove(tmpDir, { recursive: true }).catch(() => {});
    assertEquals(projects.length, 1);
    assertEquals(projects[0].name, "Complete");
  },
});

Deno.test({
  name: "CLI引数: --dry-run フラグをパースできる",
  fn() {
    const args = parseArgs(["--dry-run"], {
      boolean: ["dry-run"],
      alias: { d: "dry-run" },
    });
    assertEquals(args["dry-run"], true);
  },
});

Deno.test({
  name: "CLI引数: --dry-run 未指定時はfalse",
  fn() {
    const args = parseArgs([], {
      boolean: ["dry-run"],
      alias: { d: "dry-run" },
    });
    assertEquals(args["dry-run"], false);
  },
});
