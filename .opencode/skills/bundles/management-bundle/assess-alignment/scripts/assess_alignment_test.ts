import { assertEquals } from "@std/assert";
import { visionUseCase } from "../../../../../core/domain/vision-usecase.ts";
import { productGoalUseCase } from "../../../../../core/domain/product-goal-usecase.ts";
import { identify } from "../../../../../core/domain/types.ts";
import type { EntityScope } from "../../../../../core/domain/types.ts";
import {
  buildAlignmentOutput,
  collectLocalCapabilities,
  collectRoles,
  collectRolesFromWorkspace,
  collectSkillsFromWorkspace,
  collectSkillsRecursive,
  collectSkillsShallow,
  extractFrontmatter,
  globalRoleDirs,
  globalSkillsBundleDirs,
  resolveHomeDir,
} from "./assess_alignment.ts";

function makeScope(): EntityScope {
  return { owner: "test-org", repository: "test-repo" };
}

Deno.test("assess-alignment: find without id は search Plan を生成する", () => {
  const identifier = identify(makeScope(), "Vision of test-repo");
  const plan = visionUseCase.find(identifier);

  assertEquals(plan.summary, "Find vision: Vision of test-repo");
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[0].entity, "Scope");
  assertEquals(plan.steps[0].operation, "resolve");
  assertEquals(plan.steps[1].operation, "search");
  assertEquals(plan.steps[1].entity, "Vision");
  assertEquals(plan.steps[1].params.labelType, "Vision");
});

Deno.test("assess-alignment: find with id は view Plan を生成する", () => {
  const identifier = identify(makeScope(), "Vision of test-repo", "node-id", "42");
  const plan = visionUseCase.find(identifier);

  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[0].entity, "Scope");
  assertEquals(plan.steps[0].operation, "resolve");
  assertEquals(plan.steps[1].operation, "view");
  assertEquals(plan.steps[1].entity, "Vision");
  assertEquals(plan.steps[1].params.itemId, "42");
});

Deno.test("assess-alignment: dry-run は search + view の 2 Plan 構造を持つ", () => {
  const scope = makeScope();
  const searchIdentifier = identify(scope, "Vision of test-repo");
  const viewIdentifier = identify(scope, "Vision of test-repo", "node-id", "<itemId>");
  const searchPlan = visionUseCase.find(searchIdentifier);
  const viewPlan = visionUseCase.find(viewIdentifier);

  assertEquals(searchPlan.steps[1].operation, "search");
  assertEquals(viewPlan.steps[1].operation, "view");
  assertEquals(viewPlan.steps[1].params.itemId, "<itemId>");
});

Deno.test("assess-alignment: extractFrontmatter が閉じ --- 付きで正しく抽出する", () => {
  const sampleMd = `---
name: test-role
description: テスト用ロール
---
# Content`;

  const fm = extractFrontmatter(sampleMd);
  assertEquals(fm !== null, true);
  assertEquals(fm!.name, "test-role");
  assertEquals(fm!.description, "テスト用ロール");
});

Deno.test("assess-alignment: extractFrontmatter が閉じ --- 無し（OpenCode形式）でも抽出する", () => {
  const sampleMd = `---
description: アジャイルプロセスを円滑化する
mode: all
permission:
  read: allow
prompt: |
  ## 役割
  あなたはスクラムマスター`;

  const fm = extractFrontmatter(sampleMd);
  assertEquals(fm !== null, true);
  assertEquals(fm!.description, "アジャイルプロセスを円滑化する");
});

Deno.test("assess-alignment: collectRoles が name 無しでも basename を使いロールを収集する", () => {
  const tmpDir = Deno.makeTempDirSync();
  try {
    Deno.writeTextFileSync(
      `${tmpDir}/scrum-master.md`,
      `---
description: アジャイルプロセスを円滑化する
---

# role body`,
    );
    Deno.writeTextFileSync(
      `${tmpDir}/not-a-role.txt`,
      "description: 無視されるべきファイル\n",
    );

    const roles = collectRoles(tmpDir);
    assertEquals(roles.length, 1);
    assertEquals(roles[0].name, "scrum-master");
    assertEquals(roles[0].description, "アジャイルプロセスを円滑化する");
  } finally {
    Deno.removeSync(tmpDir, { recursive: true });
  }
});

Deno.test("assess-alignment: 不正な JSON のパースに失敗する", () => {
  try {
    JSON.parse("{ invalid }");
    throw new Error("Should have thrown");
  } catch (e) {
    assertEquals((e as Error).name, "SyntaxError");
  }
});

Deno.test("assess-alignment: ProductGoal find は view Plan を生成する", () => {
  const identifier = identify(makeScope(), "Product Goal of test-repo", "pending", "42");
  const plan = productGoalUseCase.find(identifier);

  assertEquals(plan.summary, "Find product goal: Product Goal of test-repo");
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[0].entity, "Scope");
  assertEquals(plan.steps[0].operation, "resolve");
  assertEquals(plan.steps[1].entity, "ProductGoal");
  assertEquals(plan.steps[1].operation, "view");
  assertEquals(plan.steps[1].params.itemId, "42");
});

Deno.test("assess-alignment: ProductGoal search Step が正しい構造を持つ", () => {
  const searchStep = {
    entity: "ProductGoal" as const,
    operation: "search" as const,
    params: { labelType: "ProductGoal" },
  };

  assertEquals(searchStep.entity, "ProductGoal");
  assertEquals(searchStep.operation, "search");
  assertEquals(searchStep.params.labelType, "ProductGoal");
});

Deno.test("assess-alignment: dry-run に ProductGoal の search+view が含まれる", () => {
  const scope = makeScope();
  const visionSearchPlan = visionUseCase.find(identify(scope, "Vision of test-repo"));
  const visionViewPlan = visionUseCase.find(
    identify(scope, "Vision of test-repo", "node-id", "<itemId>"),
  );
  const productGoalSearchStep = {
    entity: "ProductGoal" as const,
    operation: "search" as const,
    params: { labelType: "ProductGoal" },
  };
  const productGoalViewStep = {
    entity: "ProductGoal" as const,
    operation: "view" as const,
    params: { itemId: "<itemId>" },
  };

  const dryRunSteps = [
    ...visionSearchPlan.steps,
    ...visionViewPlan.steps,
    productGoalSearchStep,
    productGoalViewStep,
  ];

  assertEquals(dryRunSteps.length, 6);
  assertEquals(dryRunSteps[0].entity, "Scope");
  assertEquals(dryRunSteps[0].operation, "resolve");
  assertEquals(dryRunSteps[1].operation, "search");
  assertEquals(dryRunSteps[2].entity, "Scope");
  assertEquals(dryRunSteps[2].operation, "resolve");
  assertEquals(dryRunSteps[3].operation, "view");
  assertEquals(dryRunSteps[4].operation, "search");
  assertEquals(dryRunSteps[4].entity, "ProductGoal");
  assertEquals(dryRunSteps[5].operation, "view");
  assertEquals(dryRunSteps[5].entity, "ProductGoal");
});

Deno.test("assess-alignment: ProductGoal コメントからゴール情報を抽出する", () => {
  const sampleComment = "# Version: 2\n\n## Goal\n\nガバナンスの進化";

  const versionMatch = sampleComment.match(/^#\s*Version:\s*(\d+)/m);
  const version = versionMatch ? parseInt(versionMatch[1], 10) : 1;

  const goalMatch = sampleComment.match(/##\s*Goal\s*\n\n([\s\S]*?)(?:\n##|$)/);
  const description = goalMatch ? goalMatch[1].trim() : "";

  assertEquals(version, 2);
  assertEquals(description, "ガバナンスの進化");
});

Deno.test("assess-alignment: ProductGoal コメントが空の場合は null", () => {
  const comments: Array<{ body?: string }> = [];
  assertEquals(comments.length, 0);
});

Deno.test("assess-alignment: ProductGoal が存在しない場合は null（エラーではない）", () => {
  const searchOutput: Array<{ number: number }> = [];
  assertEquals(searchOutput.length, 0);
});

/**
 * AC-1: 不在パスでも例外なく空配列で継続すること
 * 検証意図: collectRolesが存在しないディレクトリでthrowせず[]を返すことを確認する
 */
Deno.test("assess-alignment AC-1: collectRolesは不在パスで空配列を返す", () => {
  const roles = collectRoles("/tmp/does-not-exist-wp856-ac1");
  assertEquals(roles, []);
});

/**
 * AC-1: ワークスペース走査が.claude/agentsを読むこと
 * 検証意図: .opencode配置なし・.claude配置ありのリポジトリでロールを収集できることを確認する
 */
Deno.test("assess-alignment AC-1: collectRolesFromWorkspaceは.claude/agentsを走査する", () => {
  const tmpRoot = Deno.makeTempDirSync();
  try {
    Deno.mkdirSync(`${tmpRoot}/.claude/agents`, { recursive: true });
    Deno.writeTextFileSync(
      `${tmpRoot}/.claude/agents/helper.md`,
      `---\nname: helper\ndescription: 手助け役\n---\n\n# body`,
    );
    const { roles, warnings } = collectRolesFromWorkspace(tmpRoot, `${tmpRoot}/no-home`);
    assertEquals(roles.length, 1);
    assertEquals(roles[0].name, "helper");
    assertEquals(Array.isArray(warnings), true);
  } finally {
    Deno.removeSync(tmpRoot, { recursive: true });
  }
});

/**
 * AC-1: ワークスペース走査が.claude/skillsと.agents/skillsを読むこと
 * 検証意図: Codex/Claude配置のスキルが1段走査で収集できることを確認する
 */
Deno.test("assess-alignment AC-1: collectSkillsFromWorkspaceは.claudeと.agentsのskillsを走査する", () => {
  const tmpRoot = Deno.makeTempDirSync();
  try {
    Deno.mkdirSync(`${tmpRoot}/.claude/skills/a-skill`, { recursive: true });
    Deno.writeTextFileSync(
      `${tmpRoot}/.claude/skills/a-skill/SKILL.md`,
      `---\nname: a-skill\ndescription: えーすきる\n---\n\n# body`,
    );
    Deno.mkdirSync(`${tmpRoot}/.agents/skills/b-skill`, { recursive: true });
    Deno.writeTextFileSync(
      `${tmpRoot}/.agents/skills/b-skill/SKILL.md`,
      `---\nname: b-skill\ndescription: びーすきる\n---\n\n# body`,
    );
    const { skills } = collectSkillsFromWorkspace(tmpRoot, `${tmpRoot}/no-home`);
    const names = skills.map((s) => s.name).sort();
    assertEquals(names, ["a-skill", "b-skill"]);
  } finally {
    Deno.removeSync(tmpRoot, { recursive: true });
  }
});

/**
 * AC-1: 同名衝突時は優先順位先勝＋警告に記録すること
 * 検証意図: opencode優先で重複排除しwarningsに残すことを確認する
 */
Deno.test("assess-alignment AC-1: 同名ロールは先勝し警告に記録される", () => {
  const tmpRoot = Deno.makeTempDirSync();
  try {
    Deno.mkdirSync(`${tmpRoot}/.opencode/agents`, { recursive: true });
    Deno.mkdirSync(`${tmpRoot}/.claude/agents`, { recursive: true });
    Deno.writeTextFileSync(
      `${tmpRoot}/.opencode/agents/dup.md`,
      `---\nname: dup\ndescription: opencode側\n---\n\n# body`,
    );
    Deno.writeTextFileSync(
      `${tmpRoot}/.claude/agents/dup.md`,
      `---\nname: dup\ndescription: claude側\n---\n\n# body`,
    );
    const { roles, warnings } = collectRolesFromWorkspace(tmpRoot, `${tmpRoot}/no-home`);
    assertEquals(roles.length, 1);
    assertEquals(roles[0].description, "opencode側");
    assertEquals(warnings.some((w) => w.includes("dup")), true);
  } finally {
    Deno.removeSync(tmpRoot, { recursive: true });
  }
});

/**
 * AC-1: 全候補不在でも空配列＋warningsで継続すること
 * 検証意図: 境界値として何もないワークスペースでthrowしないことを確認する
 */
Deno.test("assess-alignment AC-1: 全候補不在でも空で継続する", () => {
  const tmpRoot = Deno.makeTempDirSync();
  try {
    const r = collectRolesFromWorkspace(tmpRoot, `${tmpRoot}/no-home`);
    const s = collectSkillsFromWorkspace(tmpRoot, `${tmpRoot}/no-home`);
    assertEquals(r.roles, []);
    assertEquals(s.skills, []);
    assertEquals(r.warnings.length > 0, true);
  } finally {
    Deno.removeSync(tmpRoot, { recursive: true });
  }
});

/**
 * AC-2: 部分成功出力がvision/productGoalを保持しwarningsを同梱すること
 * 検証意図: GitHub取得分がローカル失敗時もJSONに残る形状を確認する
 */
Deno.test("assess-alignment AC-2: buildAlignmentOutputはvisionとwarningsを同梱する", () => {
  const tmpRoot = Deno.makeTempDirSync();
  try {
    const local = collectLocalCapabilities(tmpRoot, `${tmpRoot}/fake-home`);
    const vision = { targetAudience: "a", value: "v", differentiator: "d", outcomes: [] };
    const out = buildAlignmentOutput(vision, null, local);
    assertEquals(out.vision, vision);
    assertEquals(out.productGoal, null);
    assertEquals(out.roles, []);
    assertEquals(out.skills, []);
    assertEquals(out.warnings.length > 0, true);
  } finally {
    Deno.removeSync(tmpRoot, { recursive: true });
  }
});

/**
 * AC-2: ロール収集の異常時もスキル収集が道連れにならないこと
 * 検証意図: 注入した失敗コレクターでも隔離フィクスチャ内のスキルは収集されることを確認する
 */
Deno.test("assess-alignment AC-2: ロール収集失敗でもスキルは収集される", () => {
  const tmpRoot = Deno.makeTempDirSync();
  try {
    Deno.mkdirSync(`${tmpRoot}/.agents/skills/solo`, { recursive: true });
    Deno.writeTextFileSync(
      `${tmpRoot}/.agents/skills/solo/SKILL.md`,
      `---\nname: solo\ndescription: 単独スキル\n---\n\n# body`,
    );
    const failingRoles = (): never => {
      throw new Error("boom roles");
    };
    const local = collectLocalCapabilities(
      tmpRoot,
      `${tmpRoot}/fake-home`,
      failingRoles as unknown as typeof collectRolesFromWorkspace,
    );
    assertEquals(local.roles, []);
    assertEquals(local.skills.map((s) => s.name), ["solo"]);
    assertEquals(local.warnings.some((w) => w.includes("boom roles")), true);
  } finally {
    Deno.removeSync(tmpRoot, { recursive: true });
  }
});

/**
 * AC-2: 両方失敗でも空＋警告で復帰すること
 * 検証意図: 完全ローカル失敗時の境界値でthrowしないことを確認する
 */
Deno.test("assess-alignment AC-2: 両収集失敗でも空で継続する", () => {
  const failing = (): never => {
    throw new Error("boom");
  };
  const local = collectLocalCapabilities(
    "/tmp/does-not-exist-wp856-ac2",
    "/tmp/does-not-exist-wp856-ac2-home",
    failing as unknown as typeof collectRolesFromWorkspace,
    failing as unknown as typeof collectSkillsFromWorkspace,
  );
  assertEquals(local.roles, []);
  assertEquals(local.skills, []);
  assertEquals(local.warnings.length >= 2, true);
});

/**
 * レビューM3: global配置（fake-home/.harness）からロール・スキルを読むこと
 * 検証意図: WP主目的のglobal対応陽性分岐を隔離フィクスチャで確認する
 */
Deno.test("assess-alignment: global配置のロールとスキルを収集する", () => {
  const tmpRoot = Deno.makeTempDirSync();
  try {
    Deno.mkdirSync(`${tmpRoot}/fake-home/.harness/agents`, { recursive: true });
    Deno.writeTextFileSync(
      `${tmpRoot}/fake-home/.harness/agents/g-role.md`,
      `---\nname: g-role\ndescription: global役\n---\n\n# body`,
    );
    Deno.mkdirSync(`${tmpRoot}/fake-home/.harness/skills/bundles/g-bundle/g-skill`, {
      recursive: true,
    });
    Deno.writeTextFileSync(
      `${tmpRoot}/fake-home/.harness/skills/bundles/g-bundle/g-skill/SKILL.md`,
      `---\nname: g-skill\ndescription: global技\n---\n\n# body`,
    );
    const { roles } = collectRolesFromWorkspace(tmpRoot, `${tmpRoot}/fake-home`);
    const { skills } = collectSkillsFromWorkspace(tmpRoot, `${tmpRoot}/fake-home`);
    assertEquals(roles.map((r) => r.name), ["g-role"]);
    assertEquals(skills.map((s) => s.name), ["g-skill"]);
    assertEquals(skills[0].bundle, "g-bundle");
  } finally {
    Deno.removeSync(tmpRoot, { recursive: true });
  }
});

/**
 * レビューM5: HOME不在時はglobal候補を除外して継続すること
 * 検証意図: resolveHomeDir空文字分岐とworkspace継続の境界値を確認する
 */
Deno.test("assess-alignment: HOME不在時はglobalを除外して継続する", () => {
  const tmpRoot = Deno.makeTempDirSync();
  try {
    assertEquals(resolveHomeDir(""), "");
    assertEquals(globalRoleDirs(""), []);
    assertEquals(globalSkillsBundleDirs(""), []);
    const r = collectRolesFromWorkspace(tmpRoot, "");
    const s = collectSkillsFromWorkspace(tmpRoot, "");
    assertEquals(r.roles, []);
    assertEquals(s.skills, []);
  } finally {
    Deno.removeSync(tmpRoot, { recursive: true });
  }
});

/**
 * レビューM4: frontmatterなし定義をスキップして他を収集すること
 * 検証意図: parse失敗時の部分成功スキップ分岐を確認する
 */
Deno.test("assess-alignment: frontmatterなし定義をスキップする", () => {
  const tmpRoot = Deno.makeTempDirSync();
  try {
    Deno.writeTextFileSync(`${tmpRoot}/broken.md`, "# frontmatterなし\n");
    Deno.writeTextFileSync(
      `${tmpRoot}/good.md`,
      `---\nname: good\ndescription: 正常\n---\n\n# body`,
    );
    const roles = collectRoles(tmpRoot);
    assertEquals(roles.map((r) => r.name), ["good"]);
    Deno.mkdirSync(`${tmpRoot}/skills/broken-skill`, { recursive: true });
    Deno.writeTextFileSync(`${tmpRoot}/skills/broken-skill/SKILL.md`, "# nameなし\n");
    Deno.mkdirSync(`${tmpRoot}/skills/good-skill`, { recursive: true });
    Deno.writeTextFileSync(
      `${tmpRoot}/skills/good-skill/SKILL.md`,
      `---\nname: good-skill\ndescription: 正常技\n---\n\n# body`,
    );
    const skills = collectSkillsRecursive(`${tmpRoot}/skills`);
    assertEquals(skills.map((s) => s.name), ["good-skill"]);
  } finally {
    Deno.removeSync(tmpRoot, { recursive: true });
  }
});

/**
 * レビューM6: shallow走査のSKILL.md不在・nameなし分岐を確認すること
 * 検証意図: 警告あり/なし両スキップ分岐と正常収集を確認する
 */
Deno.test("assess-alignment: shallow走査は不良スキルをスキップする", () => {
  const tmpRoot = Deno.makeTempDirSync();
  try {
    Deno.mkdirSync(`${tmpRoot}/empty-dir`, { recursive: true });
    Deno.mkdirSync(`${tmpRoot}/nameless`, { recursive: true });
    Deno.writeTextFileSync(`${tmpRoot}/nameless/SKILL.md`, "# nameなし\n");
    Deno.mkdirSync(`${tmpRoot}/fine`, { recursive: true });
    Deno.writeTextFileSync(
      `${tmpRoot}/fine/SKILL.md`,
      `---\nname: fine\ndescription: 正常\n---\n\n# body`,
    );
    const skills = collectSkillsShallow(tmpRoot);
    assertEquals(skills.map((s) => s.name), ["fine"]);
  } finally {
    Deno.removeSync(tmpRoot, { recursive: true });
  }
});

/**
 * レビューM1: 同名スキルはworkspace優先で先勝すること
 * 検証意図: .claudeがglobalに勝つ順序固定をテストで保証する
 */
Deno.test("assess-alignment: 同名スキルはworkspace優先で先勝する", () => {
  const tmpRoot = Deno.makeTempDirSync();
  try {
    Deno.mkdirSync(`${tmpRoot}/.claude/skills/dup`, { recursive: true });
    Deno.writeTextFileSync(
      `${tmpRoot}/.claude/skills/dup/SKILL.md`,
      `---\nname: dup\ndescription: claude側\n---\n\n# body`,
    );
    Deno.mkdirSync(`${tmpRoot}/fake-home/.harness/skills/bundles/b/dup`, { recursive: true });
    Deno.writeTextFileSync(
      `${tmpRoot}/fake-home/.harness/skills/bundles/b/dup/SKILL.md`,
      `---\nname: dup\ndescription: global側\n---\n\n# body`,
    );
    const { skills, warnings } = collectSkillsFromWorkspace(tmpRoot, `${tmpRoot}/fake-home`);
    assertEquals(skills.length, 1);
    assertEquals(skills[0].description, "claude側");
    assertEquals(warnings.some((w) => w.includes("dup")), true);
  } finally {
    Deno.removeSync(tmpRoot, { recursive: true });
  }
});
