import { assertEquals, assertExists } from "@std/assert";

const SKILL_DIR = new URL("..", import.meta.url).pathname;
const SKILL_MD = `${SKILL_DIR}/SKILL.md`;

function parseYamlFrontmatter(text: string): Record<string, unknown> {
  const match = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) return {};
  const yaml = match[1];
  const result: Record<string, unknown> = {};
  const nameMatch = yaml.match(/^name:\s*(.+)$/m);
  if (nameMatch) result.name = nameMatch[1].trim();
  const descMatch = yaml.match(/^description:\s*(.+)$/m);
  if (descMatch) result.description = descMatch[1].trim();
  const catMatch = yaml.match(/category:\s*(.+)$/m);
  if (catMatch) result.category = catMatch[1].trim();
  const triggerMatch = yaml.match(/trigger:\n((?:\s+- .+\n?)*)/);
  if (triggerMatch) {
    result.tags = triggerMatch[1].split("\n").map((s) => s.trim().replace(/^- /, "")).filter(
      Boolean,
    );
  }
  return result;
}

Deno.test({
  name: "SKILL.md should exist and be readable",
  fn: async () => {
    const content = await Deno.readTextFile(SKILL_MD);
    assertExists(content);
  },
});

Deno.test({
  name: "SKILL.md YAML frontmatter should have correct fields",
  fn: async () => {
    const content = await Deno.readTextFile(SKILL_MD);
    const fm = parseYamlFrontmatter(content);
    assertEquals(fm.name, "ac-checkpoint-implementation");
    assertEquals((fm as Record<string, string>).category, "development");
  },
});

Deno.test({
  name: "SKILL.md should contain all required procedure steps",
  fn: async () => {
    const content = await Deno.readTextFile(SKILL_MD);
    for (let i = 1; i <= 5; i++) {
      assertExists(content.match(new RegExp(`Step ${i}:`)), `Step ${i}: section not found`);
    }
  },
});

Deno.test({
  name: "SKILL.md should state WIP commit is out of scope",
  fn: async () => {
    const content = await Deno.readTextFile(SKILL_MD);
    assertExists(content.match(/WIPコミット/));
    assertExists(content.match(/責務外/));
  },
});

Deno.test({
  name: "SKILL.md should state task status sync is out of scope",
  fn: async () => {
    const content = await Deno.readTextFile(SKILL_MD);
    assertExists(content.match(/タスクステータス同期/));
    assertExists(content.match(/責務外/));
  },
});

Deno.test({
  name: "references directory should contain deno-ts.md and python.md",
  fn: async () => {
    const entries: string[] = [];
    for await (const entry of Deno.readDir(`${SKILL_DIR}/references`)) {
      if (entry.isFile) entries.push(entry.name);
    }
    assertExists(entries.includes("deno-ts.md"));
    assertExists(entries.includes("python.md"));
  },
});
