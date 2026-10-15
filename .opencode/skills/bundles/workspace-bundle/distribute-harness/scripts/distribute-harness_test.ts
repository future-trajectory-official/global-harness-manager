import { assert, assertEquals, assertThrows } from "@std/assert";
import { dirname, fromFileUrl, join } from "@std/path";
import {
  applyRenameMap,
  buildCopyPlan,
  buildRenameMap,
  collectSkills,
  COPY_DIRS,
  executeCopyPlan,
  normalizeSkillName,
  rewriteDenoJsonTasks,
  rewriteReferences,
  rewriteSkillFrontmatter,
  rewriteSkillImports,
  writeRenameMap,
} from "./distribute-harness.ts";

/** このテストファイルの位置から解決したリポジトリルートディレクトリ */
const REPO_ROOT = join(dirname(fromFileUrl(import.meta.url)), "../../../../../..");

Deno.test("normalizeSkillName - global-接頭辞を付与し小文字ハイフン化する", () => {
  assertEquals(normalizeSkillName("select-work-package"), "global-select-work-package");
  assertEquals(normalizeSkillName("Select_Work_Package"), "global-select-work-package");
});

Deno.test("normalizeSkillName - ~ を含まない", () => {
  const name = normalizeSkillName("example-skill");
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

Deno.test("buildCopyPlan - contextは配布対象外である(WP #791・B案)", () => {
  const plan = buildCopyPlan("/src/.opencode", "/dest");
  const sources = plan.map((p) => p.src);
  assert(!sources.some((s) => s.includes("context/management.md")));
  assert(!sources.some((s) => s.includes("context/product.md.example")));
  assert(!sources.some((s) => s.includes("context/product.md")));
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

Deno.test("applyRenameMap - リネーム先既存は内容を最新化する(再配布更新)", async () => {
  const root = await Deno.makeTempDir({ prefix: "dist-rename-" });
  try {
    await Deno.mkdir(`${root}/skills/bundles/b1/foo`, { recursive: true });
    await Deno.writeTextFile(`${root}/skills/bundles/b1/foo/a.ts`, "new");
    await Deno.mkdir(`${root}/skills/bundles/b1/global-foo`, { recursive: true });
    await Deno.writeTextFile(`${root}/skills/bundles/b1/global-foo/a.ts`, "old");
    const map = buildRenameMap([{ bundle: "b1", name: "foo" }]);
    const applied = await applyRenameMap(map, root, false);
    assertEquals(applied.length, 1, "refreshed dest must be included");
    const content = await Deno.readTextFile(`${root}/skills/bundles/b1/global-foo/a.ts`);
    assertEquals(content, "new", "existing dest content must be refreshed");
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

Deno.test("rewriteReferences - contextは書換対象外で.github/contextは素通しする(WP #791)", async () => {
  const root = await Deno.makeTempDir({ prefix: "dist-ref-" });
  try {
    const file = `${root}/ctx.md`;
    await Deno.writeTextFile(
      file,
      "old /.github/context/management.md\n" +
        "caller <repo>/.github/context/product.md\n" +
        "agent [scrum-master.md](/.opencode/agents/scrum-master.md)\n",
    );
    await rewriteReferences(root, false);
    const content = await Deno.readTextFile(file);
    assert(
      content.includes("/.github/context/management.md"),
      ".github/context must pass through",
    );
    assert(
      content.includes("<repo>/.github/context/product.md"),
      ".github/context must pass through",
    );
    assert(content.includes(`${root}/agents/scrum-master.md`));
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

/**
 * ユースケース: core/shared へのimportは配布時リネームの影響を受けない
 * 検証意図: rewriteSkillImports 後も core/shared/io へのimportが不変であることを確認する（WP#840）
 */
Deno.test("rewriteSkillImports - core/sharedへのimportは不変", async () => {
  const root = await Deno.makeTempDir({ prefix: "dist-ts-" });
  try {
    const dir = `${root}/skills/bundles/development-bundle/develop-environment-setup/scripts`;
    await Deno.mkdir(dir, { recursive: true });
    const before =
      'import { setupGitHooks } from "../../../../../core/shared/io/setup-hooks.ts";\n';
    await Deno.writeTextFile(`${dir}/manage-sandbox.ts`, before);
    const map = [{
      before: "workspace-bundle/setup-harness-env",
      after: "global-setup-harness-env",
      bundle: "workspace-bundle",
      name: "setup-harness-env",
    }];
    await rewriteSkillImports(root, map, false);
    const content = await Deno.readTextFile(`${dir}/manage-sandbox.ts`);
    assertEquals(content, before, "core/shared import must remain unchanged");
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

/**
 * ユースケース: 本番配布の前に --dry-run で配布計画のみ確認する
 * 検証意図: dry-run 実行が配布先へ何も書き込まず、計画が7件であることを確認する
 */
Deno.test("distribute E2E - dry-run は無副作用で計画7件を返す", async () => {
  const sourceRoot = join(REPO_ROOT, ".opencode");
  const dest = await Deno.makeTempDir({ prefix: "dist-e2e-dry-" });
  try {
    const plan = buildCopyPlan(sourceRoot, dest);
    assertEquals(plan.length, 7);
    await executeCopyPlan(plan, true);
    const entries: string[] = [];
    for await (const entry of Deno.readDir(dest)) {
      entries.push(entry.name);
    }
    assertEquals(entries.length, 0, "dry-run must not write anything to dest");
  } finally {
    await Deno.remove(dest, { recursive: true });
  }
});

/**
 * ユースケース: 実配布でハーネス資源が配布先へ到達する
 * 検証意図: 一時ディレクトリへの実実行後にコピー7件・rename-map登録・deno.json書換え済み（#852）・workspace-bundle除外・他bundle残存を確認する
 */
Deno.test("distribute E2E - 実配布が配布先へ到達する", async () => {
  const sourceRoot = join(REPO_ROOT, ".opencode");
  const dest = await Deno.makeTempDir({ prefix: "dist-e2e-real-" });
  try {
    const plan = buildCopyPlan(sourceRoot, dest);
    assertEquals(plan.length, 7);
    const skills = await collectSkills(join(sourceRoot, "skills"));
    const renameMap = buildRenameMap(skills);
    await executeCopyPlan(plan, false);
    const applied = await applyRenameMap(renameMap, dest, false);
    assertEquals(applied.length, renameMap.length);
    await writeRenameMap(dest, applied, false);
    await rewriteSkillFrontmatter(dest, renameMap, false);
    await rewriteReferences(dest, false);
    await rewriteDenoJsonTasks(dest, renameMap, false);
    await rewriteSkillImports(dest, renameMap, false);
    // 配布後除外（SKILL.md 全量配布手順6と同一。利用者の ~/.harness には触れない）
    await Deno.remove(join(dest, "skills", "bundles", "workspace-bundle"), {
      recursive: true,
    });
    const mapRaw = await Deno.readTextFile(join(dest, "skill-rename-map.json"));
    assert(mapRaw.trim().length > 2, "rename map must be registered");
    const [repoDenoJson, destDenoJson] = await Promise.all([
      Deno.readTextFile(join(REPO_ROOT, "deno.json")),
      Deno.readTextFile(join(dest, "deno.json")),
    ]);
    assert(
      !destDenoJson.includes(".opencode/core/"),
      "dest deno.json tasks must not reference .opencode/core/",
    );
    assert(
      destDenoJson.includes("core/shared/io/setup-hooks.ts"),
      "dest deno.json tasks must reference dest-relative core/",
    );
    assert(
      destDenoJson.includes("global-session-planning"),
      "dest deno.json tasks must reference global- renamed skill (L15例)",
    );
    assert(
      !destDenoJson.includes(".opencode/skills/bundles/management-bundle/session-planning/"),
      "old skill path must be gone from dest deno.json",
    );
    assert(
      destDenoJson.includes(".opencode/node_modules"),
      "exclude field must be preserved (tasks以外は不変)",
    );
    assert(
      destDenoJson.includes(".opencode/agents"),
      "JSONCコメントは温存されること（全面再フォーマット禁止）",
    );
    assert(
      destDenoJson.length !== repoDenoJson.length || destDenoJson !== repoDenoJson,
      "dest deno.json must be rewritten for dest (not byte-identical)",
    );
    let workspaceExists = true;
    try {
      await Deno.stat(join(dest, "skills", "bundles", "workspace-bundle"));
    } catch {
      workspaceExists = false;
    }
    assert(!workspaceExists, "workspace-bundle must be excluded after distribution");
    // WP#840: 除外後も manage-sandbox 系が解決可能であること（デカップルの回帰ガード）
    // 配布先のスキル名は global- リネーム済みのため rename 後のパスで参照する
    const destManageSandbox = await Deno.readTextFile(
      join(
        dest,
        "skills",
        "bundles",
        "development-bundle",
        "global-develop-environment-setup",
        "scripts",
        "manage-sandbox.ts",
      ),
    );
    assert(
      !destManageSandbox.includes("workspace-bundle"),
      "manage-sandbox must not reference workspace-bundle after exclusion",
    );
    const destSetupHooks = await Deno.stat(join(dest, "core", "shared", "io", "setup-hooks.ts"));
    assert(destSetupHooks.isFile, "core/shared/io/setup-hooks.ts must be distributed");
    let contextExists = true;
    try {
      await Deno.stat(join(dest, "context"));
    } catch {
      contextExists = false;
    }
    assert(!contextExists, "context must not be distributed (WP #791)");
    const other = await Deno.stat(join(dest, "skills", "bundles", "management-bundle"));
    assert(other.isDirectory, "other bundles must remain after exclusion");
  } finally {
    await Deno.remove(dest, { recursive: true });
  }
});

/**
 * ユースケース: destのcore参照tasksをdest相対へ書換える
 * 検証意図: `.opencode/core/` が `core/` になること・exclude不変を確認する（#852 AC1）
 */
Deno.test("rewriteDenoJsonTasks - core参照をdest相対へ書換える(#852 AC1)", async () => {
  const dest = await Deno.makeTempDir({ prefix: "dist-denojson-core-" });
  try {
    await Deno.writeTextFile(
      join(dest, "deno.json"),
      JSON.stringify(
        {
          tasks: {
            "setup-hooks": "deno run -A .opencode/core/shared/io/setup-hooks.ts",
            "phase-gate": "deno run -A .opencode/core/shared/workflow/phase-gate.ts",
          },
          exclude: [".opencode/node_modules"],
        },
        null,
        2,
      ) + "\n",
    );
    await rewriteDenoJsonTasks(dest, [], false);
    const raw = await Deno.readTextFile(join(dest, "deno.json"));
    const parsed = JSON.parse(raw);
    assertEquals(parsed.tasks["setup-hooks"], "deno run -A core/shared/io/setup-hooks.ts");
    assertEquals(parsed.tasks["phase-gate"], "deno run -A core/shared/workflow/phase-gate.ts");
    assertEquals(parsed.exclude, [".opencode/node_modules"], "tasks以外は書換えない");
  } finally {
    await Deno.remove(dest, { recursive: true });
  }
});

/**
 * ユースケース: L15例のスキル参照をglobal-化する
 * 検証意図: `session-planning` → `global-session-planning` のマップ駆動書換えを確認する（#852 AC1）
 */
Deno.test("rewriteDenoJsonTasks - skills参照をglobal-化する(L15例含む)(#852 AC1)", async () => {
  const dest = await Deno.makeTempDir({ prefix: "dist-denojson-skills-" });
  try {
    await Deno.writeTextFile(
      join(dest, "deno.json"),
      JSON.stringify(
        {
          tasks: {
            "validate-task":
              "deno run -A .opencode/skills/bundles/management-bundle/session-planning/scripts/validate-task.ts --template .opencode/skills/bundles/management-bundle/session-planning/references/task-template.md",
          },
        },
        null,
        2,
      ) + "\n",
    );
    const map = buildRenameMap([{ bundle: "management-bundle", name: "session-planning" }]);
    await rewriteDenoJsonTasks(dest, map, false);
    const parsed = JSON.parse(await Deno.readTextFile(join(dest, "deno.json")));
    assertEquals(
      parsed.tasks["validate-task"],
      "deno run -A skills/bundles/management-bundle/global-session-planning/scripts/validate-task.ts --template skills/bundles/management-bundle/global-session-planning/references/task-template.md",
    );
  } finally {
    await Deno.remove(dest, { recursive: true });
  }
});

/**
 * ユースケース: 未知スキル・無関係文字列を壊さない
 * 検証意図: マップ外パスと無関係文字列が素通りすることを確認する（#852 境界）
 */
Deno.test("rewriteDenoJsonTasks - 未知スキル・無関係文字列は素通りする(#852 境界)", async () => {
  const dest = await Deno.makeTempDir({ prefix: "dist-denojson-boundary-" });
  try {
    const before = {
      tasks: {
        "unknown": "deno run -A .opencode/skills/bundles/unknown-bundle/unknown-skill/x.ts",
        "std": "deno run -A --allow-read main.ts # @std/path利用",
      },
    };
    await Deno.writeTextFile(join(dest, "deno.json"), JSON.stringify(before, null, 2) + "\n");
    const map = buildRenameMap([{ bundle: "management-bundle", name: "session-planning" }]);
    await rewriteDenoJsonTasks(dest, map, false);
    const parsed = JSON.parse(await Deno.readTextFile(join(dest, "deno.json")));
    assertEquals(
      parsed.tasks["unknown"],
      before.tasks["unknown"],
      "未知スキルパスは素通りすること",
    );
    assertEquals(parsed.tasks["std"], before.tasks["std"], "無関係文字列は素通りすること");
  } finally {
    await Deno.remove(dest, { recursive: true });
  }
});

/**
 * ユースケース: 再配布時に二重global-化しない
 * 検証意図: 書換え済みへの再適用が無変化であることを確認する（#852 冪等）
 */
Deno.test("rewriteDenoJsonTasks - 書換え済みへの再適用で変化しない(冪等)(#852)", async () => {
  const dest = await Deno.makeTempDir({ prefix: "dist-denojson-idem-" });
  try {
    const rewritten = {
      tasks: {
        "setup-hooks": "deno run -A core/shared/io/setup-hooks.ts",
        "validate-task":
          "deno run -A skills/bundles/management-bundle/global-session-planning/scripts/validate-task.ts",
      },
    };
    await Deno.writeTextFile(join(dest, "deno.json"), JSON.stringify(rewritten, null, 2) + "\n");
    const before = await Deno.readTextFile(join(dest, "deno.json"));
    const map = buildRenameMap([{ bundle: "management-bundle", name: "session-planning" }]);
    await rewriteDenoJsonTasks(dest, map, false);
    const after = await Deno.readTextFile(join(dest, "deno.json"));
    assertEquals(after, before, "冪等：二重global-化や変化があってはならない");
    assert(!after.includes("global-global-"), "二重global-化があってはならない");
  } finally {
    await Deno.remove(dest, { recursive: true });
  }
});

/**
 * ユースケース: 実deno.json（JSONCコメント付き）を壊さず書換える
 * 検証意図: C1回帰ガード。コメント温存・tasks書換え・exclude不変を確認する（#852 C1）
 */
Deno.test("rewriteDenoJsonTasks - JSONCコメント付きでも書換えコメント温存する(#852 C1)", async () => {
  const dest = await Deno.makeTempDir({ prefix: "dist-denojson-jsonc-" });
  try {
    const raw =
      `{\n  // .opencode/agents はfmt対象外のためコメント\n  "tasks": {\n    "setup-hooks": "deno run -A .opencode/core/shared/io/setup-hooks.ts"\n  },\n  "exclude": [".opencode/node_modules"]\n}\n`;
    await Deno.writeTextFile(join(dest, "deno.json"), raw);
    await rewriteDenoJsonTasks(dest, [], false);
    const after = await Deno.readTextFile(join(dest, "deno.json"));
    assert(after.includes("core/shared/io/setup-hooks.ts"), "tasksは書換わること");
    assert(!after.includes(".opencode/core/"), "旧core参照が残ってはならない");
    assert(after.includes("// .opencode/agents"), "コメントは温存されること");
    assert(after.includes(".opencode/node_modules"), "excludeは不変であること");
  } finally {
    await Deno.remove(dest, { recursive: true });
  }
});

/**
 * ユースケース: deno.json不在・tasks欠落・不正JSONでも配布を壊さない
 * 検証意図: warn-skip/return系の仕様を担保する（#852 M3/M4）
 */
Deno.test("rewriteDenoJsonTasks - 不在・tasks欠落・不正JSONはwarn-skipする(#852)", async () => {
  const dest = await Deno.makeTempDir({ prefix: "dist-denojson-skip-" });
  try {
    await rewriteDenoJsonTasks(dest, [], false);
    await Deno.writeTextFile(join(dest, "deno.json"), `{"exclude": []}\n`);
    await rewriteDenoJsonTasks(dest, [], false);
    await Deno.writeTextFile(join(dest, "deno.json"), `not-json {{{\n`);
    await rewriteDenoJsonTasks(dest, [], false);
  } finally {
    await Deno.remove(dest, { recursive: true });
  }
});

/**
 * ユースケース: 非文字列tasks値・object形式commandに対応する
 * 検証意図: 数値/配列では落ちず、object形式のcommandは書換わること（#852 M5）
 */
Deno.test("rewriteDenoJsonTasks - 非文字列値は素通りしobject-commandは書換える(#852)", async () => {
  const dest = await Deno.makeTempDir({ prefix: "dist-denojson-obj-" });
  try {
    await Deno.writeTextFile(
      join(dest, "deno.json"),
      JSON.stringify(
        {
          tasks: {
            num: 42,
            arr: ["a"],
            obj: { command: "deno run -A .opencode/core/shared/io/setup-hooks.ts" },
          },
        },
        null,
        2,
      ) + "\n",
    );
    await rewriteDenoJsonTasks(dest, [], false);
    const raw = await Deno.readTextFile(join(dest, "deno.json"));
    assert(raw.includes("core/shared/io/setup-hooks.ts"), "object-commandは書換わること");
    assert(!raw.includes(".opencode/core/"), "旧参照が残ってはならない");
  } finally {
    await Deno.remove(dest, { recursive: true });
  }
});

/**
 * ユースケース: dry-runでは配布先へ書込まない
 * 検証意図: isDryRun=trueの無副作用を確認する（#852 Minor）
 */
Deno.test("rewriteDenoJsonTasks - dry-runは書込まない(#852)", async () => {
  const dest = await Deno.makeTempDir({ prefix: "dist-denojson-dry-" });
  try {
    const before = JSON.stringify(
      { tasks: { hook: "deno run -A .opencode/core/shared/io/setup-hooks.ts" } },
      null,
      2,
    ) +
      "\n";
    await Deno.writeTextFile(join(dest, "deno.json"), before);
    await rewriteDenoJsonTasks(dest, [], true);
    assertEquals(await Deno.readTextFile(join(dest, "deno.json")), before);
  } finally {
    await Deno.remove(dest, { recursive: true });
  }
});
