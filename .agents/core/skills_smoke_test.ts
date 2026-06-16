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
