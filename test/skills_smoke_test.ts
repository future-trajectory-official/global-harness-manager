import { assertEquals } from "@std/assert";

const SKILL_DIR = ".agents/skills/bundles/management-bundle";

const EXISTING_SKILLS = [
  "github-pbi-open",
  "github-pbi-search",
  "github-pbi-update",
  "github-pbi-commit",
];

const NEW_SKILLS = [
  "github-wp-create",
  "github-wp-search",
  "github-wp-update",
  "github-sprint-init",
  "github-sprint-review-plan",
  "github-pbi-archive",
  "github-sprint-velocity-record",
];

/** 既存4スキルのスクリプトがdeno checkをパスすることを検証 */
Deno.test("skills_smoke - existing 4 skills should pass deno check", async () => {
  for (const name of EXISTING_SKILLS) {
    const cmd = new Deno.Command("deno", {
      args: ["check", `${SKILL_DIR}/${name}/scripts/${name}.ts`],
    });
    const output = await cmd.output();
    assertEquals(
      output.code,
      0,
      `${name} failed deno check: ${new TextDecoder().decode(output.stderr)}`,
    );
  }
});

/** 新規7スキルのスクリプトがdeno checkをパスすることを検証 */
Deno.test("skills_smoke - new 7 skills should pass deno check", async () => {
  for (const name of NEW_SKILLS) {
    const cmd = new Deno.Command("deno", {
      args: ["check", `${SKILL_DIR}/${name}/scripts/${name}.ts`],
    });
    const output = await cmd.output();
    assertEquals(
      output.code,
      0,
      `${name} failed deno check: ${new TextDecoder().decode(output.stderr)}`,
    );
  }
});

const WP_G_SKILLS = [
  "review-issue",
  "reflection-issue",
];

/** WP_g: review-issue / reflection-issue のスクリプトがdeno checkをパスすることを検証 */
Deno.test("skills_smoke - WP_g skills should pass deno check", async () => {
  for (const name of WP_G_SKILLS) {
    const cmd = new Deno.Command("deno", {
      args: ["check", `${SKILL_DIR}/${name}/scripts/${name}.ts`],
    });
    const output = await cmd.output();
    assertEquals(
      output.code,
      0,
      `${name} failed deno check: ${new TextDecoder().decode(output.stderr)}`,
    );
  }
});

/** WP_g: JSON Schemaが有効なdraft-07形式であることを検証 */
Deno.test("skills_smoke - WP_g skills should have valid JSON schemas", async () => {
  for (const name of WP_G_SKILLS) {
    const schema = JSON.parse(
      await Deno.readTextFile(`${SKILL_DIR}/${name}/schemas/${name}-payload.schema.json`),
    );
    assertEquals(schema.$schema, "http://json-schema.org/draft-07/schema#");
    assertEquals(typeof schema.type, "string");
    assertEquals(Array.isArray(schema.required), true);
  }
});

/** WP_g: SKILL.mdにQuick-Start/前提条件/手順の必須セクションが存在することを検証 */
Deno.test("skills_smoke - WP_g skills should have SKILL.md with required sections", async () => {
  for (const name of WP_G_SKILLS) {
    const skillMd = await Deno.readTextFile(`${SKILL_DIR}/${name}/SKILL.md`);
    assertEquals(skillMd.includes("## Quick-Start"), true, `${name} SKILL.md missing Quick-Start`);
    assertEquals(skillMd.includes("## 前提条件"), true, `${name} SKILL.md missing 前提条件`);
    assertEquals(skillMd.includes("## 手順"), true, `${name} SKILL.md missing 手順`);
  }
});

/** --repoに不正な形式を渡した時にエラーメッセージが出力されることを検証 */
Deno.test("skills_smoke - --repo validation should print error for invalid format", async () => {
  const cmd = new Deno.Command("deno", {
    args: [
      "run",
      "-A",
      `${SKILL_DIR}/github-pbi-open/scripts/github-pbi-open.ts`,
      "--repo",
      "invalid-format",
    ],
    stdin: "piped",
    stdout: "piped",
    stderr: "piped",
  });
  const process = cmd.spawn();
  const writer = process.stdin.getWriter();
  await writer.write(new TextEncoder().encode(JSON.stringify({ title: "Test" })));
  writer.close();
  const output = await process.output();
  assertEquals(output.code, 1);
  const stderr = new TextDecoder().decode(output.stderr);
  assertEquals(stderr.includes("必須"), true, `Expected error about --repo, got: ${stderr}`);
});
