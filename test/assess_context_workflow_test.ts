import { assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

const ROOT = new URL("../", import.meta.url).pathname;
const WORKFLOWS_DIR = `${ROOT}.agents/workflows`;
const ASSESS_CONTEXT_SKILL = "/.agents/skills/bundles/management-bundle/assess-context/SKILL.md";

/**
 * 先頭のフェーズ見出しを正規表現で特定する。
 * sprint系は `## Phase N:`、session系は `## N. ○○フェーズ` 形式。
 * ※ 見出しの完全一致文字列ではなく正規表現で特定することで、見出し文言の変更に耐性を持たせる。
 */
function findLeadingPhaseHeading(content: string, isSprint: boolean): number {
  const pattern = isSprint ? /^## Phase \d+:/ : /^## \d+\.\s/;
  const match = content.match(new RegExp(pattern, "m"));
  if (!match || match.index === undefined) {
    return -1;
  }
  return match.index;
}

/**
 * assess-context の4ワークフロー組込み検証（AC1・AC2）。
 */
Deno.test("assess-context is integrated at the beginning of the 4 lifecycle workflows", async () => {
  const targets: Array<{ file: string; isSprint: boolean }> = [
    { file: "sprint-start.md", isSprint: true },
    { file: "session-start.md", isSprint: false },
    { file: "session-end.md", isSprint: false },
    { file: "sprint-end.md", isSprint: true },
  ];

  for (const { file, isSprint } of targets) {
    const content = await Deno.readTextFile(`${WORKFLOWS_DIR}/${file}`);

    // AC1: 対象ファイルに assess-context スキルへの参照が存在すること
    assert(
      content.includes(ASSESS_CONTEXT_SKILL),
      `${file} must reference assess-context SKILL.md (AC1)`,
    );

    // AC2a: 前置き（冒頭フェーズ見出しより前）に assess-context が存在しないこと
    const leadingPhaseStart = findLeadingPhaseHeading(content, isSprint);
    assert(leadingPhaseStart !== -1, `${file} must have a leading-phase heading`);
    const preface = content.slice(0, leadingPhaseStart);
    assert(
      !preface.includes(ASSESS_CONTEXT_SKILL),
      `${file} must not reference assess-context SKILL.md before the leading phase (AC2)`,
    );

    // AC2b: 冒頭フェーズ内の「最初のサブ見出しブロック」に参照が存在すること。
    //       最初のサブ見出し（### ...）から次のサブ見出し（### ...）までを抽出し、参照を含むことを検証する。
    const leadingPhase = content.slice(leadingPhaseStart);
    const subheadingMatches = [...leadingPhase.matchAll(/^### /gm)];
    assert(
      subheadingMatches.length > 0,
      `${file} must have at least one sub-heading in the leading phase`,
    );
    const firstSubStart = subheadingMatches[0].index!;
    const secondSubStart = subheadingMatches[1]?.index ?? leadingPhase.length;
    const firstSubBlock = leadingPhase.slice(firstSubStart, secondSubStart);
    assert(
      firstSubBlock.includes(ASSESS_CONTEXT_SKILL),
      `${file} must reference assess-context SKILL.md as the first sub-step of the leading phase (AC2)`,
    );
  }
});
