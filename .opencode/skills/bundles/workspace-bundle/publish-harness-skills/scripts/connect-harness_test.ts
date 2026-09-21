import { assert, assertEquals } from "@std/assert";
import {
  applyShellEnv,
  buildConnectionConfig,
  buildShellEnvLine,
  GLOBAL_DENY_SKILLS,
  mergeConfig,
  stripJsoncComments,
  writeGlobalConfig,
} from "./connect-harness.ts";

Deno.test("stripJsoncComments - 行・ブロックコメントと末尾カンマを除去する", () => {
  const input = `{
  // line comment
  "a": 1, /* block */
  "b": 2,
}`;
  const parsed = JSON.parse(stripJsoncComments(input));
  assertEquals(parsed, { a: 1, b: 2 });
});

Deno.test("stripJsoncComments - 文字列内の ,} / ,] を破壊しない(M2)", () => {
  const input = `{ "a": "x,}", "b": "y,]", "c": 3, }`;
  const parsed = JSON.parse(stripJsoncComments(input));
  assertEquals(parsed, { a: "x,}", b: "y,]", c: 3 });
});

Deno.test("stripJsoncComments - 文字列内の // を除去しない", () => {
  const input = `{ "url": "https://example.com/a//b" }`;
  const parsed = JSON.parse(stripJsoncComments(input));
  assertEquals(parsed, { url: "https://example.com/a//b" });
});

Deno.test("buildConnectionConfig - skills/instructions/permission.skill を組み立てる", () => {
  const cfg = buildConnectionConfig("~/.harness");
  assertEquals(cfg.skills, ["~/.harness/skills"]);
  assertEquals(cfg.instructions, ["~/.harness/context/*.md", "~/.harness/AGENTS.md"]);
  assertEquals(cfg.permission.skill["global-publish-harness-skills"], "deny");
  assertEquals(cfg.permission.skill["global-setup-harness-env"], "deny");
});

Deno.test("mergeConfig - 既存の model/provider/permission.bash を保持する", () => {
  const existing = {
    model: "opencode-go/model",
    provider: { llama: { name: "local" } },
    permission: { bash: { "rm -rf *": "deny" } },
  };
  const merged = mergeConfig(existing, buildConnectionConfig("~/.harness")) as {
    model: string;
    provider: object;
    skills: string[];
    permission: Record<string, Record<string, unknown>>;
  };
  assertEquals(merged.model, "opencode-go/model");
  assertEquals(merged.provider, { llama: { name: "local" } });
  assertEquals(merged.permission.bash, { "rm -rf *": "deny" });
  assertEquals(merged.permission.skill["global-harness-init"], "deny");
  assertEquals(merged.skills, ["~/.harness/skills"]);
});

Deno.test("mergeConfig - 既存 permission.skill を保持して追加マージする(M1)", () => {
  const existing = {
    model: "x",
    permission: {
      bash: { "rm -rf *": "deny" },
      skill: { "user-skill": "allow", "internal-*": "ask" },
    },
  };
  const merged = mergeConfig(existing, buildConnectionConfig("~/.harness")) as {
    permission: Record<string, Record<string, unknown>>;
  };
  assertEquals(merged.permission.bash, { "rm -rf *": "deny" });
  assertEquals(merged.permission.skill["user-skill"], "allow");
  assertEquals(merged.permission.skill["internal-*"], "ask");
  assertEquals(merged.permission.skill["global-harness-init"], "deny");
});

Deno.test("mergeConfig - permission 未存在でも追加できる", () => {
  const merged = mergeConfig({ model: "x" }, buildConnectionConfig("~/.harness")) as {
    permission: Record<string, Record<string, unknown>>;
  };
  assertEquals(merged.permission.skill["global-harness-clone"], "deny");
});

Deno.test("GLOBAL_DENY_SKILLS - 全て global- 変換後名である", () => {
  for (const name of GLOBAL_DENY_SKILLS) {
    assert(name.startsWith("global-"), `deny skill must be global- prefixed: ${name}`);
  }
});

Deno.test("buildShellEnvLine - export 行を組み立てる", () => {
  assertEquals(
    buildShellEnvLine("OPENCODE_CONFIG_DIR", "~/.harness"),
    'export OPENCODE_CONFIG_DIR="~/.harness"',
  );
});

Deno.test("writeGlobalConfig - 同一内容なら書き換えずコメントを保持する(冪等・M4)", async () => {
  const dir = await Deno.makeTempDir({ prefix: "connect-harness-test-" });
  const file = dir + "/opencode.jsonc";
  const raw = `{
  // ユーザーのコメント
  "model": "x",
  "provider": { "a": 1 },
  "skills": ["/home/dev/.harness/skills"],
  "instructions": ["/home/dev/.harness/context/*.md", "/home/dev/.harness/AGENTS.md"],
  "permission": { "bash": { "rm -rf *": "deny" }, "skill": { "global-harness-init": "deny" } }
}
`;
  await Deno.writeTextFile(file, raw);
  const config = JSON.parse(stripJsoncComments(raw));
  await writeGlobalConfig(file, config, false);
  const after = await Deno.readTextFile(file);
  assert(after.includes("// ユーザーのコメント"), "comment must be preserved");
  assertEquals(after, raw, "unchanged file must not be rewritten");
  await Deno.remove(dir, { recursive: true });
});

Deno.test("applyShellEnv - 既に設定済みならスキップ（冪等）", async () => {
  const dir = await Deno.makeTempDir({ prefix: "connect-harness-test-" });
  const profile = dir + "/.bashrc";
  await Deno.writeTextFile(profile, 'export OPENCODE_CONFIG_DIR="~/.harness"\n');
  const applied = await applyShellEnv("OPENCODE_CONFIG_DIR", "~/.harness", dir, false);
  assertEquals(applied, []);
  await Deno.remove(dir, { recursive: true });
});

Deno.test("applyShellEnv - 未設定プロファイルへ追記する", async () => {
  const dir = await Deno.makeTempDir({ prefix: "connect-harness-test-" });
  await Deno.writeTextFile(dir + "/.bashrc", "export FOO=1\n");
  const applied = await applyShellEnv("OPENCODE_CONFIG_DIR", "~/.harness", dir, false);
  assertEquals(applied, [dir + "/.bashrc"]);
  const content = await Deno.readTextFile(dir + "/.bashrc");
  assert(content.includes('export OPENCODE_CONFIG_DIR="~/.harness"'));
  await Deno.remove(dir, { recursive: true });
});
