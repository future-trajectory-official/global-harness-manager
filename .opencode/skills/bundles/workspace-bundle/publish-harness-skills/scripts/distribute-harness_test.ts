import { assert, assertEquals, assertThrows } from "@std/assert";
import {
  applyRenameMap,
  buildCopyPlan,
  buildRenameMap,
  collectSkills,
  COPY_DIRS,
  normalizeSkillName,
  rewriteReferences,
  rewriteSkillFrontmatter,
  rewriteSkillImports,
} from "./distribute-harness.ts";

Deno.test("normalizeSkillName - global-接頭辞を付与し小文字ハイフン化する", () => {
  assertEquals(normalizeSkillName("select-work-package"), "global-select-work-package");
  assertEquals(normalizeSkillName("Select_Work_Package"), "global-select-work-package");
});

Deno.test("normalizeSkillName - ~ を含まない", () => {
  const name = normalizeSkillName("publish-harness-skills");
  assert(!name.includes("~"), `~ must not be included: ${name}`);
});

Deno.test("normalizeSkillName - 前後デリミタ・連続区切りを正規化する", () => {
  assertEquals(normalizeSkillName("..foo.."), "global-foo");
  assertEquals(normalizeSkillName("a--b"), "global-a-b");
});

Deno.test("COPY_DIRS - AC1の構造保持対象ディレクトリを含みcontextを含まない(C2)", () => {
  for (const dir of ["skills", "core", "agents", "commands", "guides"]) {
    assert(COPY_DIRS.includes(dir), `missing: ${dir}`);
  }
  // C2対応: context はディレクトリ丸ごとでなく include方式のため COPY_DIRS に含めない
  assert(!COPY_DIRS.includes("context"), "context must not be in COPY_DIRS");
});

Deno.test("buildCopyPlan - 除外対象を含まず配布ファイルを含む", () => {
  const plan = buildCopyPlan("/src/.opencode", "/dest");
  const sources = plan.map((p) => p.src);
  assert(sources.some((s) => s.endsWith("/src/.opencode/skills")));
  assert(sources.some((s) => s.endsWith("/src/.opencode/core")));
  assert(sources.some((s) => s.endsWith("deno.json")));
  assert(!sources.some((s) => s.includes("node_modules")));
  assert(!sources.some((s) => s.includes("deno.lock")));
});

Deno.test("buildCopyPlan - contextはmanagementとexampleのみでproduct.md実体を除外する(C2)", () => {
  const plan = buildCopyPlan("/src/.opencode", "/dest");
  const sources = plan.map((p) => p.src);
  assert(sources.some((s) => s.endsWith("context/management.md")));
  assert(sources.some((s) => s.endsWith("context/product.md.example")));
  assert(!sources.some((s) => s.endsWith("context/product.md")));
  // AGENTS.md.example → AGENTS.md のマッピング
  const agents = plan.find((p) => p.kind === "file" && p.dest.endsWith("/AGENTS.md"));
  assert(agents, "AGENTS.md entry must exist");
  assertEquals(agents.src, "/src/config/AGENTS.md.example");
  assertEquals(agents.dest, "/dest/AGENTS.md");
});

Deno.test("collectSkills - bundles配下のスキルを列挙する", async () => {
  const root = await Deno.makeTempDir({ prefix: "dist-test-" });
  try {
    await Deno.mkdir(`${root}/bundles/b1/foo`, { recursive: true });
    await Deno.mkdir(`${root}/bundles/b1/bar`, { recursive: true });
    await Deno.mkdir(`${root}/bundles/b2/foo`, { recursive: true });
    const skills = await collectSkills(root);
    assertEquals(skills.length, 3);
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("collectSkills - 非ディレクトリ混在をスキップする", async () => {
  const root = await Deno.makeTempDir({ prefix: "dist-test-" });
  try {
    await Deno.mkdir(`${root}/bundles/b1/foo`, { recursive: true });
    await Deno.writeTextFile(`${root}/bundles/not-a-dir.txt`, "x");
    await Deno.writeTextFile(`${root}/bundles/b1/skip.txt`, "y");
    const skills = await collectSkills(root);
    assertEquals(skills.length, 1);
    assertEquals(skills[0].name, "foo");
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("collectSkills - bundles欠落時は空配列を返す", async () => {
  const root = await Deno.makeTempDir({ prefix: "dist-test-" });
  try {
    const skills = await collectSkills(root);
    assertEquals(skills.length, 0);
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("buildRenameMap - global-形式でbundle起点を保持する", () => {
  const map = buildRenameMap([{ bundle: "b1", name: "foo" }]);
  assertEquals(map, [{
    before: "b1/foo",
    after: "global-foo",
    bundle: "b1",
    name: "foo",
  }]);
});

Deno.test("buildRenameMap - 異bundle同名は重複エラー", () => {
  assertThrows(
    () => buildRenameMap([{ bundle: "b1", name: "foo" }, { bundle: "b2", name: "foo" }]),
    Error,
    "duplicate",
  );
});

Deno.test("buildRenameMap - 異表記が同一正規化名になる衝突を検出する(M3)", () => {
  // "Foo_Bar" と "foo-bar" はともに global-foo-bar に正規化される
  assertEquals(normalizeSkillName("Foo_Bar"), normalizeSkillName("foo-bar"));
  assertThrows(
    () => buildRenameMap([{ bundle: "b1", name: "Foo_Bar" }, { bundle: "b2", name: "foo-bar" }]),
    Error,
    "duplicate",
  );
});

Deno.test("applyRenameMap - リネーム元不在はskipしマップに含めない(M4)", async () => {
  const root = await Deno.makeTempDir({ prefix: "dist-rename-" });
  try {
    const map = buildRenameMap([{ bundle: "b1", name: "foo" }]);
    const applied = await applyRenameMap(map, root, false);
    assertEquals(applied.length, 0, "missing source must be skipped");
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("applyRenameMap - リネーム先既存はskipし冪等にする(M1)", async () => {
  const root = await Deno.makeTempDir({ prefix: "dist-rename-" });
  try {
    await Deno.mkdir(`${root}/skills/bundles/b1/foo`, { recursive: true });
    await Deno.mkdir(`${root}/skills/bundles/b1/global-foo`, { recursive: true });
    const map = buildRenameMap([{ bundle: "b1", name: "foo" }]);
    const applied = await applyRenameMap(map, root, false);
    assertEquals(applied.length, 0, "existing dest must be skipped (idempotent)");
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("applyRenameMap - 正常時にリネームしてマップを返す", async () => {
  const root = await Deno.makeTempDir({ prefix: "dist-rename-" });
  try {
    await Deno.mkdir(`${root}/skills/bundles/b1/foo`, { recursive: true });
    const map = buildRenameMap([{ bundle: "b1", name: "foo" }]);
    const applied = await applyRenameMap(map, root, false);
    assertEquals(applied.length, 1);
    const exists = await Deno.stat(`${root}/skills/bundles/b1/global-foo`);
    assert(exists.isDirectory);
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("rewriteSkillFrontmatter - name: を global- 形式へ書き換える(AC2)", async () => {
  const root = await Deno.makeTempDir({ prefix: "dist-fm-" });
  try {
    const skillDir = `${root}/skills/bundles/b1/global-foo`;
    await Deno.mkdir(skillDir, { recursive: true });
    await Deno.writeTextFile(
      `${skillDir}/SKILL.md`,
      "---\nname: foo\ndescription: bar\n---\nbody\n",
    );
    const map = [{ before: "b1/foo", after: "global-foo", bundle: "b1", name: "foo" }];
    await rewriteSkillFrontmatter(root, map, false);
    const content = await Deno.readTextFile(`${skillDir}/SKILL.md`);
    assert(content.includes("name: global-foo"), "name must be rewritten to global-");
    assert(!content.includes("name: foo"), "old name must be gone");
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("rewriteReferences - .opencodeパスとskill名をグローバル化する(AC2)", async () => {
  const root = await Deno.makeTempDir({ prefix: "dist-ref-" });
  try {
    const file = `${root}/cmd.md`;
    await Deno.writeTextFile(
      file,
      "See [session-planning](/.opencode/skills/bundles/management-bundle/session-planning/SKILL.md)\n" +
        "run [skill:ac-checkpoint-implementation]\n" +
        "agent [scrum-master.md](/.opencode/agents/scrum-master.md)\n" +
        "guide /.opencode/guides/backlog-guidelines.md\n",
    );
    await rewriteReferences(root, false);
    const content = await Deno.readTextFile(file);
    assert(content.includes(`${root}/skills/bundles/management-bundle/global-session-planning`));
    assert(!content.includes("bundle/session-planning"), "old skill path must be gone");
    assert(content.includes("[skill:global-ac-checkpoint-implementation]"));
    assert(!content.includes("[skill:ac-checkpoint-implementation]"));
    assert(content.includes(`${root}/agents/scrum-master.md`));
    assert(content.includes(`${root}/guides/backlog-guidelines.md`));
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("rewriteReferences - 既にglobal-化済みのskill名は二重化しない(冪等・C2)", async () => {
  const root = await Deno.makeTempDir({ prefix: "dist-ref-" });
  try {
    const file = `${root}/cmd.md`;
    await Deno.writeTextFile(
      file,
      "run [skill:global-ac-checkpoint-implementation]\n" +
        "run [skill:ac-checkpoint-implementation]\n",
    );
    await rewriteReferences(root, false);
    const content = await Deno.readTextFile(file);
    assert(content.includes("[skill:global-ac-checkpoint-implementation]"));
    assert(!content.includes("[skill:global-global-ac-checkpoint-implementation]"));
    assert(
      !content.includes("[skill:ac-checkpoint-implementation]"),
      "non-global must be globalized",
    );
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("rewriteSkillImports - .ts内のスキル参照をglobal-化する", async () => {
  const root = await Deno.makeTempDir({ prefix: "dist-ts-" });
  try {
    const dir = `${root}/skills/bundles/development-bundle/develop-environment-setup/scripts`;
    await Deno.mkdir(dir, { recursive: true });
    await Deno.writeTextFile(
      `${dir}/manage-sandbox.ts`,
      'import { x } from "../../../../../skills/bundles/workspace-bundle/setup-harness-env/scripts/setup-hooks.ts";\n',
    );
    const map = [{
      before: "workspace-bundle/setup-harness-env",
      after: "global-setup-harness-env",
      bundle: "workspace-bundle",
      name: "setup-harness-env",
    }];
    await rewriteSkillImports(root, map, false);
    const content = await Deno.readTextFile(`${dir}/manage-sandbox.ts`);
    assert(
      content.includes("bundles/workspace-bundle/global-setup-harness-env/scripts/setup-hooks.ts"),
      "skill ref must be globalized",
    );
    assert(!content.includes("bundle/setup-harness-env/"), "old skill path must be gone");
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("rewriteSkillImports - 既にglobal-化済みは変更しない(冪等)", async () => {
  const root = await Deno.makeTempDir({ prefix: "dist-ts-" });
  try {
    const dir = `${root}/skills/bundles/b1`;
    await Deno.mkdir(dir, { recursive: true });
    const before =
      'import { x } from "../global-foo/mod.ts";\nimport { y } from "../foo/mod.ts";\n';
    await Deno.writeTextFile(`${dir}/a.ts`, before);
    const map = [{ before: "b1/foo", after: "global-foo", bundle: "b1", name: "foo" }];
    await rewriteSkillImports(root, map, false);
    const content = await Deno.readTextFile(`${dir}/a.ts`);
    assert(!content.includes("global-global-foo"), "must not double prefix");
    assert(content.includes('"../global-foo/mod.ts"'), "globalized ref must remain");
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});
