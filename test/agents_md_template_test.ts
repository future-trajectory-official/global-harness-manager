import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { basename, dirname, fromFileUrl, join } from "@std/path";

/** このテストファイルの位置から解決したリポジトリルートディレクトリ */
const REPO_ROOT = join(dirname(fromFileUrl(import.meta.url)), "..");

/** 静的検証対象のグローバルテンプレート（AGENTS.md.template）の絶対パス */
export const AGENTS_MD_TEMPLATE_PATH = join(
  REPO_ROOT,
  ".agents/skills/bundles/workspace-bundle/publish-harness-rules/references/AGENTS.md.template",
);

/** プレースホルダ名称互換の突合対象となる Antigravity 側テンプレートの絶対パス */
const GEMINI_MD_TEMPLATE_PATH = join(
  REPO_ROOT,
  ".agents/skills/bundles/workspace-bundle/publish-harness-rules/references/GEMINI.md.template",
);

/** ローカル規律テンプレート（プロジェクト配布用 AGENTS.md の源）の絶対パス */
const LOCAL_AGENTS_EXAMPLE_PATH = join(REPO_ROOT, "config", "AGENTS.md.example");

/**
 * グローバルテンプレートの本文を読み込む共通ヘルパー（T2/T3/T6/T7で再利用）。
 */
export async function readAgentsMdTemplate(): Promise<string> {
  return await Deno.readTextFile(AGENTS_MD_TEMPLATE_PATH);
}

/** GEMINI.md.template の本文を読み込むヘルパー */
async function readGeminiMdTemplate(): Promise<string> {
  return await Deno.readTextFile(GEMINI_MD_TEMPLATE_PATH);
}

/** ローカル規律（config/AGENTS.md.example）の本文を読み込むヘルパー（T4/T5で再利用） */
async function readLocalAgentsExample(): Promise<string> {
  return await Deno.readTextFile(LOCAL_AGENTS_EXAMPLE_PATH);
}

/**
 * グローバルテンプレートに含めてはならないパス依存・ハーネス固有トークンの一覧（AC2）。
 * 拡張方針: 「等」を含むAC2の性質上、`.opencode` / `.gitignore` / `SKILL.md` 等のハーネス語・
 * 大文字小文字ゆらぎは現状列挙しない。テンプレートへ新種の配置依存語が混入した場合は
 * 本一覧へ追記して回帰を固定する。
 */
const FORBIDDEN_PATH_DEPENDENT_TOKENS = [
  ".session",
  ".agents",
  "task.md",
  "implementation_plan.md",
  "Antigravity",
  "management.md",
  "product.md",
  "opencode.json",
] as const;

/**
 * ユースケース: publish-harness-rules/references 配下にグローバルテンプレート AGENTS.md.template が新設されている（AC1）
 * 検証意図: テンプレートが存在し、{{LANGUAGE_DESCRIPTION}} が `## 言語` の直下、{{ENVIRONMENT_DESCRIPTION}} が `## 環境` の直下にあることを位置込みで確認する
 */
Deno.test("T1 (AC1): AGENTS.md.template exists with placeholders in right sections", async () => {
  const stat = await Deno.stat(AGENTS_MD_TEMPLATE_PATH).catch(() => null);
  assert(
    stat !== null && stat.isFile,
    `AGENTS.md.template not found at ${AGENTS_MD_TEMPLATE_PATH}`,
  );

  const content = await readAgentsMdTemplate();
  assert(
    /^## 言語\n\{\{LANGUAGE_DESCRIPTION\}\}$/m.test(content),
    "{{LANGUAGE_DESCRIPTION}} が ## 言語 の直下にありません",
  );
  assert(
    /^## 環境\n\{\{ENVIRONMENT_DESCRIPTION\}\}$/m.test(content),
    "{{ENVIRONMENT_DESCRIPTION}} が ## 環境 の直下にありません",
  );
});

/** グローバルテンプレートが維持すべき6原則の見出し（AC3。連番は ### 1〜6） */
const REQUIRED_PRINCIPLE_HEADINGS = [
  "### 1. 重要操作前の「HITL (Human-in-the-Loop) アライメント」",
  "### 2. 永続状態への依存 (Truth of State)",
  "### 3. ツール実行の規律（ワンライナーの禁止）",
  "### 4. ワークフローの段階的実行と停止義務",
  "### 5. 設計品質デフォルト基準（Design Quality Default）",
  "### 6. Confirmation Protocol (承認の復唱)",
] as const;

/**
 * ユースケース: グローバル原則6項目がテンプレートに維持されている（AC3）
 * 検証意図: Safety Guardrails 配下に HITL原則・永続状態依存・ワンライナー禁止・STOP遵守・設計品質基準・承認復唱の各見出しが存在し、RECOVERY LOG（旧G3）が削除済みで、最低基準の但し書き（具体策による原則の空洞化防止）を含むことを確認する
 */
Deno.test("T2 (AC3): template keeps six global principles without RECOVERY LOG", async () => {
  const content = await readAgentsMdTemplate();
  assertStringIncludes(content, "## Safety Guardrails\n");
  for (const heading of REQUIRED_PRINCIPLE_HEADINGS) {
    assertStringIncludes(content, heading);
  }
  assert(
    !content.includes("RECOVERY LOG"),
    "削除済みのはずの RECOVERY LOG（Context Sync義務）が検出されました",
  );
  assertStringIncludes(
    content,
    "グローバル原則の最低基準（承認ゲートの存在、停止義務、復唱義務）を低下させてはなりません",
  );
});

/**
 * ユースケース: グローバルテンプレートにパス依存記述が含まれない（AC2）
 * 検証意図: ハーネス固有・配置依存の語（.session / .agents / task.md 等）がテンプレート本文のどこにも現れないことを全量走査で確認する
 */
Deno.test("T3 (AC2): template contains no path-dependent tokens", async () => {
  const content = await readAgentsMdTemplate();
  const found = FORBIDDEN_PATH_DEPENDENT_TOKENS.filter((token) => content.includes(token));
  assert(
    found.length === 0,
    `禁止トークンが検出されました: ${found.join(", ")}`,
  );
});

/** ハーネス慣習としてローカル example へ移設済みの事項キー（AC4。HITL対象操作リストの4項目を含む） */
const REQUIRED_LOCAL_CONVENTION_KEYS = [
  ".session/task.md",
  ".session/plan.md",
  "[Phase",
  "[CRITICAL ACTION]",
  ".agents/context",
  "git push",
  "一括置換",
  "ホストOS",
  "deno.json",
] as const;

/**
 * ユースケース: ハーネス慣習（.session管理・Phase宣言・HITL具体手段・用語集参照）がローカル規律へ移設されている（AC4）
 * 検証意図: config/AGENTS.md.example が移設項目（HITL対象操作リスト4項目を含む）をすべて含み、グローバル昇格した「設計品質デフォルト基準」をローカル側から除去済みであることを確認する
 */
Deno.test("T4 (AC4): local example hosts migrated harness conventions", async () => {
  const content = await readLocalAgentsExample();
  for (const key of REQUIRED_LOCAL_CONVENTION_KEYS) {
    assertStringIncludes(content, key);
  }
  assert(
    !content.includes("設計品質デフォルト基準"),
    "設計品質デフォルト基準はグローバルへ昇格済みのためローカルから削除する必要があります",
  );
});

/**
 * ユースケース: 用語集参照が opencode.json.example の instructions と整合する（AC4）
 * 検証意図: instructions の全項目について、AGENTS.md（=local example の配布実体名）または .agents/context 連鎖がローカル規律で担保されることを総称的に検証し、用語集2ファイル（management.md / product.md）への言及とグローバル側の AGENTS.md 参照の成立を確認する
 */
Deno.test("T5 (AC4): glossary reference chain aligns with opencode.json.example", async () => {
  const instructionsJson = JSON.parse(
    await Deno.readTextFile(join(REPO_ROOT, "config", "opencode.json.example")),
  ) as { instructions?: string[] };
  const instructions: string[] = instructionsJson.instructions ?? [];
  assert(instructions.length > 0, "instructions が空です");

  const localContent = await readLocalAgentsExample();
  for (const entry of instructions) {
    const covered = entry === "AGENTS.md"
      ? basename(LOCAL_AGENTS_EXAMPLE_PATH) === "AGENTS.md.example"
      : localContent.includes(entry.replace(/\/\*\.[^/]+$/, ""));
    assert(covered, `instructions の ${entry} に対応する参照連鎖がローカル規律で担保されません`);
  }

  assertStringIncludes(localContent, "management.md");
  assertStringIncludes(localContent, "product.md");

  const globalContent = await readAgentsMdTemplate();
  assertStringIncludes(globalContent, "AGENTS.md");
});

/** テンプレート本文からMarkdown見出し（コードフェンス内は除外）を level/text の組として抽出する */
function extractHeadings(content: string): Array<{ level: number; text: string }> {
  const headings: Array<{ level: number; text: string }> = [];
  let inFence = false;
  for (const line of content.split("\n")) {
    if (line.trimStart().startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const match = line.match(/^(#{1,6}) (.+)$/);
    if (match) {
      headings.push({ level: match[1].length, text: match[2].trim() });
    }
  }
  return headings;
}

/**
 * ユースケース: グローバルテンプレートが OpenCode のグローバルAGENTS.mdとして機能する健全なMarkdown構造を持つ（AC5）
 * 検証意図: H1が冒頭ただ一つ、見出し階層の飛び級なし、必須H2セクションが言語→環境→Safety Guardrails の順（旧称 "& Context Sync" は改名済み）、原則が ### 1〜6 の連番で出現すること
 */
Deno.test("T6 (AC5): heading structure is sound for Opencode consumption", async () => {
  const content = await readAgentsMdTemplate();
  const headings = extractHeadings(content);

  const h1s = headings.filter((h) => h.level === 1);
  assertEquals(h1s.length, 1, "H1がちょうど1つではありません");
  assertEquals(headings[0]?.level, 1, "冒頭見出しがH1ではありません");
  assertEquals(headings[0]?.text, "Global Context");

  for (let i = 1; i < headings.length; i++) {
    assert(
      headings[i].level <= headings[i - 1].level + 1,
      `見出し階層の飛び級: 「${headings[i - 1].text}」→「${headings[i].text}」`,
    );
  }

  const h2Texts = headings.filter((h) => h.level === 2).map((h) => h.text);
  assertEquals(h2Texts, ["言語", "環境", "Safety Guardrails"]);
  assert(
    !content.includes("Safety Guardrails & Context Sync"),
    "改名済みの旧見出し「Safety Guardrails & Context Sync」が残存しています",
  );

  const principleNumbers = headings
    .filter((h) => h.level === 3)
    .map((h) => Number(h.text.match(/^(\d+)\./)?.[1] ?? NaN));
  assertEquals(principleNumbers, [1, 2, 3, 4, 5, 6], "原則の連番が ### 1〜6 の順と一致しません");
});

/**
 * ユースケース: プレースホルダ名称が GEMINI.md.template と同一集合である（AC1/WP_5前提）
 * 検証意図: 両テンプレートから {{...}} を正規表現抽出し集合一致を主張することで、WP_5 の syncGlobalPrompt 置換ロジック再利用前提が改名によって暗黙に壊れるのを防ぐ
 */
Deno.test("T7 (AC1): placeholder name set matches GEMINI.md.template", async () => {
  const extractPlaceholders = (content: string): string[] =>
    [...content.matchAll(/\{\{[A-Z_]+\}\}/g)].map((m) => m[0]).sort();

  const agentsPlaceholders = extractPlaceholders(await readAgentsMdTemplate());
  const geminiPlaceholders = extractPlaceholders(await readGeminiMdTemplate());

  assertEquals(
    agentsPlaceholders,
    geminiPlaceholders,
    "両テンプレートのプレースホルダ名称集合が一致しません（WP_5の再利用前提が壊れています）",
  );
});
