import { fromFileUrl } from "@std/path";
import { assert, assertEquals, assertMatch, assertNotMatch } from "@std/assert";

// WP #793 — maintain-context の呼出元リポジトリ基準化を検証する。
// 判定基準は「初回実行か」ではなく「呼出元 product.md が存在するか」（PO決定 Q4）。
// 注意: AC1/AC2 は手順書（SKILL.md / edits.md）の規則記述を検証する。実行時の挙動は検証しない。

const ROOT = fromFileUrl(new URL("../../", import.meta.url));
const SKILL_DIR = ".opencode/skills/bundles/management-bundle/maintain-context";
const SKILL_PATH = `${SKILL_DIR}/SKILL.md`;
const EDITS_PATH = `${SKILL_DIR}/references/edits.md`;
const CONTEXT_DIR = ".github/context";
const LEGACY_PATH = [".opencode", "context"].join("/");

async function readRepo(rel: string): Promise<string> {
  return await Deno.readTextFile(`${ROOT}${rel}`);
}

async function git(args: string[]): Promise<{ code: number; stdout: string }> {
  const out = await new Deno.Command("git", { args, cwd: ROOT, stdout: "piped", stderr: "piped" })
    .output();
  return { code: out.code, stdout: new TextDecoder().decode(out.stdout) };
}

Deno.test("AC1: SKILL.md creates caller product.md from the global example only when it is absent", async () => {
  const skill = await readRepo(SKILL_PATH);
  // 作成分岐: 不在時に、グローバル example を元に呼出元 .github/context/product.md を作成する
  assertMatch(
    skill,
    /product\.md`?\s*が\*\*存在しない\*\*場合は、グローバル\s*`~\/\.harness\/context\/product\.md\.example`\s*を元に/,
    "SKILL.md must define the creation branch when caller product.md is absent (AC1)",
  );
  assertNotMatch(skill, /初回実行/, "SKILL.md must not use first-run status as the criterion (Q4)");
});

Deno.test("AC2: SKILL.md updates only caller product.md when it exists; edits.md forbids global writes", async () => {
  const skill = await readRepo(SKILL_PATH);
  const edits = await readRepo(EDITS_PATH);
  assertMatch(
    skill,
    /存在する場合は、呼出元の `\.github\/context\/product\.md` のみを更新/,
    "SKILL.md must define the update branch as caller product.md only (AC2)",
  );
  assertMatch(
    edits,
    /\|\s*`~\/\.harness\/context\/`（配下全体）\s*\|\s*書き込み禁止\s*\|/,
    "edits.md must list ~/.harness/context/ as write-forbidden (AC2)",
  );
});

Deno.test("AC3: context resources live under .github/context and no tracked file references the legacy path", async () => {
  for (const file of ["management.md", "product.md.example"]) {
    const info = await Deno.stat(`${ROOT}${CONTEXT_DIR}/${file}`);
    assert(info.isFile, `${CONTEXT_DIR}/${file} must exist after migration (AC3)`);
  }
  let legacyExists = true;
  try {
    await Deno.stat(`${ROOT}${LEGACY_PATH}`);
  } catch {
    legacyExists = false;
  }
  assertEquals(legacyExists, false, `${LEGACY_PATH} must no longer exist (AC3)`);

  const tracked = (await git(["ls-files"])).stdout.split("\n").filter((f) => f.length > 0);
  const self = ".opencode/test/maintain_context_caller_repo_test.ts";
  const hits: string[] = [];
  for (const file of tracked) {
    if (file === self) continue;
    let text: string;
    try {
      text = await readRepo(file);
    } catch {
      continue; // バイナリ・削除済み等は対象外
    }
    if (text.includes(LEGACY_PATH)) hits.push(file);
  }
  assertEquals(hits, [], `tracked files still reference ${LEGACY_PATH} (AC3)`);
});

Deno.test("AC4: .github/context/.gitignore is the rule source that ignores product.md and keeps the example tracked", async () => {
  const rules = (await readRepo(`${CONTEXT_DIR}/.gitignore`))
    .split("\n")
    .map((line) => line.trim());
  assert(rules.includes("product.md"), ".github/context/.gitignore must ignore product.md (AC4)");
  assert(
    rules.includes("!product.md.example"),
    ".github/context/.gitignore must re-include product.md.example (AC4)",
  );

  // -v で出力元を確認し、root .gitignore 等の別ルールで通っていないことを保証する
  const ignored = await git(["check-ignore", "-v", `${CONTEXT_DIR}/product.md`]);
  assertEquals(ignored.code, 0, "product.md must be reported as ignored (AC4)");
  assert(
    ignored.stdout.startsWith(`${CONTEXT_DIR}/.gitignore:`),
    `ignore source must be ${CONTEXT_DIR}/.gitignore, got: ${ignored.stdout.trim()} (AC4)`,
  );

  const kept = await git(["check-ignore", "-q", `${CONTEXT_DIR}/product.md.example`]);
  assertEquals(kept.code, 1, "product.md.example must not be ignored (AC4)");
});
