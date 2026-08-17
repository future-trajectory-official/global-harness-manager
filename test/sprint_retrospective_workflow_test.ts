import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const ROOT = new URL("../", import.meta.url).pathname;
const WORKFLOWS_DIR = `${ROOT}.agents/workflows`;
const OLD_SKILL_DIR = `${ROOT}.agents/skills/bundles/management-bundle/sprint-retrospective-kpt`;

const RETRO_SKILLS = ["record-sprint-kpt", "record-sprint-metrics", "archive-retrospective"];
const MANAGEMENT_BUNDLE = "/.agents/skills/bundles/management-bundle";

/**
 * Markdown を `## Phase N:` 見出しで分割し、フェーズ番号 → 本文のマップを返す。
 * 【検証の意図】
 * - フェーズ単位の検証（スキル参照・マクロタイミング・次フェーズ参照）を、全文の位置依存から解放する。
 * - フェーズ見出しがない・番号が重複する等の構造異常もこのパーサで検出する。
 */
function splitPhases(markdown: string): Map<number, string> {
  const phases = new Map<number, string>();
  let current: number | null = null;
  const buffer: string[] = [];
  for (const line of markdown.split("\n")) {
    const match = line.match(/^## Phase (\d+):/);
    if (match) {
      if (current !== null) {
        phases.set(current, buffer.join("\n"));
      }
      current = Number(match[1]);
      buffer.length = 0;
    } else {
      buffer.push(line);
    }
  }
  if (current !== null) {
    phases.set(current, buffer.join("\n"));
  }
  return phases;
}

/**
 * Markdown の行折り返し（deno fmt による改行・インデント）とブロック引用記号（>）の影響を
 * 排除するため、フェーズ本文から全空白文字と行頭の `>` を除去して返す。
 */
function normalize(markdown: string | undefined): string {
  return (markdown ?? "").replace(/[\s>]+/g, "");
}

/**
 * 【ユースケース】Retrospective ライフサイクルスキル群のワークフロー組込み検証。
 * 【検証の意図】sprint-start Phase 8 と sprint-end Phase 5/7/8 の参照・タイミング・順序を検証する。
 */
Deno.test("Retrospective skills are integrated into sprint workflows", async () => {
  const sprintStart = await Deno.readTextFile(`${WORKFLOWS_DIR}/sprint-start.md`);
  const sprintEnd = await Deno.readTextFile(`${WORKFLOWS_DIR}/sprint-end.md`);

  const startPhases = splitPhases(sprintStart);
  const endPhases = splitPhases(sprintEnd);

  // 1. sprint-start の Phase 8 が plan-retrospective（計画する）を参照している
  const startPhase8 = normalize(startPhases.get(8));
  assert(startPhase8 !== "", "sprint-start.md must have Phase 8");
  assertEquals(
    startPhase8.includes(`${MANAGEMENT_BUNDLE}/plan-retrospective/SKILL.md`),
    true,
    "sprint-start Phase 8 must reference plan-retrospective SKILL.md",
  );
  assertEquals(
    startPhase8.includes(normalize("マクロの呼出しタイミングは**計画する**です")),
    true,
    "sprint-start Phase 8 must declare macro timing 計画する",
  );

  // 2. sprint-end の各フェーズが対応スキルを参照し、マクロタイミングを宣言している
  const expectedPhases: Record<string, { phase: number; timing: string }> = {
    "record-sprint-kpt": { phase: 5, timing: "実施する" },
    "record-sprint-metrics": { phase: 7, timing: "実施する" },
    "archive-retrospective": { phase: 8, timing: "保管する" },
  };
  for (const skill of RETRO_SKILLS) {
    const { phase, timing } = expectedPhases[skill];
    const body = normalize(endPhases.get(phase));
    assert(body !== "", `sprint-end.md must have Phase ${phase}`);
    assertEquals(
      body.includes(`${MANAGEMENT_BUNDLE}/${skill}/SKILL.md`),
      true,
      `sprint-end Phase ${phase} must reference ${skill} SKILL.md`,
    );
    assertEquals(
      body.includes(normalize(`マクロの呼出しタイミングは**${timing}**です`)),
      true,
      `sprint-end Phase ${phase} must declare macro timing ${timing}`,
    );
  }

  // 3. sprint-end が旧 sprint-retrospective-kpt を参照していない
  assertEquals(
    sprintEnd.includes("sprint-retrospective-kpt"),
    false,
    "sprint-end.md must not reference old sprint-retrospective-kpt skill",
  );

  // 4. sprint-end が plan-retrospective の SKILL.md を参照していない（sprint-start 側に配置済み）
  //    ※ 入力前提条件として「plan-retrospective 実施済み」への言及は依存関係の明示として許容する
  assertEquals(
    sprintEnd.includes(`${MANAGEMENT_BUNDLE}/plan-retrospective/SKILL.md`),
    false,
    "sprint-end.md must not reference plan-retrospective SKILL.md (it is integrated into sprint-start)",
  );

  // 5. フェーズ番号が1から連番で、各フェーズの「次のフェーズ」参照が N+1 であること
  const phaseNumbers = [...endPhases.keys()].sort((a, b) => a - b);
  assertEquals(phaseNumbers.length, 12, "sprint-end.md must have 12 phases");
  for (let n = 1; n <= phaseNumbers.length; n++) {
    assert(
      phaseNumbers.includes(n),
      `sprint-end.md phases must be sequential and include Phase ${n}`,
    );
  }
  for (let n = 1; n < 12; n++) {
    const body = normalize(endPhases.get(n));
    assert(
      body.includes(normalize(`次のフェーズ（Phase ${n + 1}`)),
      `sprint-end Phase ${n} must reference next Phase ${n + 1}`,
    );
  }
});

/**
 * 【ユースケース】旧 sprint-retrospective-kpt スキルディレクトリがリポジトリから削除されていること。
 * 【検証の意図】ディレクトリの不在を検証し、旧スキル削除の定着を確認する。
 */
Deno.test("Old sprint-retrospective-kpt skill directory is removed", async () => {
  try {
    await Deno.stat(OLD_SKILL_DIR);
  } catch (error) {
    assert(
      error instanceof Deno.errors.NotFound,
      "Old sprint-retrospective-kpt skill directory must be removed",
    );
    return;
  }
  assert(false, "Old sprint-retrospective-kpt skill directory must be removed");
});

/**
 * 【ユースケース】link_verification_test の knownFiles に旧リファレンスが残存していないこと。
 * 【検証の意図】retrospective-guide.md の除去がリンク検証テスト側に反映されていることを検証する。
 */
Deno.test("link_verification_test knownFiles no longer contains retrospective-guide.md", async () => {
  const linkTest = await Deno.readTextFile(`${ROOT}test/link_verification_test.ts`);
  assertEquals(
    linkTest.includes("retrospective-guide.md"),
    false,
    "test/link_verification_test.ts knownFiles must not contain retrospective-guide.md",
  );
});
