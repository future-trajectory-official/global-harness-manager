import { fromFileUrl, join } from "@std/path";
import { assert, assertMatch, assertNotMatch } from "@std/assert";

// WP #794 AC2 — 6ケース解決表（3パターン×2経路）の規則記述を検証する結合テスト。
// 本ファイルは assess-context / maintain-context / distribute-harness の3バンドルを横断検証する。
// 判定基準は #790 正本（issues/790#issuecomment-6052691440）＋訂正
// （issues/790#issuecomment-6052759879）＋3区分整理（issues/790#issuecomment-6052845569）。
// 注意: 手順書（SKILL.md / references / copy-plan）の規則記述を検証する。実行時の挙動は検証しない。
// #793 が検証済みの範囲（legacy参照0件・.gitignore規則の詳細）は再実装せず、本テストは6ケース行定義に特化する。

const ROOT = fromFileUrl(new URL("../../", import.meta.url));
const ASSESS_SKILL = ".opencode/skills/bundles/management-bundle/assess-context/SKILL.md";
const READS = ".opencode/skills/bundles/management-bundle/assess-context/references/reads.md";
const MAINTAIN_SKILL = ".opencode/skills/bundles/management-bundle/maintain-context/SKILL.md";
const COPY_PLAN =
  ".opencode/skills/bundles/workspace-bundle/distribute-harness/references/copy-plan.md";

async function readRepo(rel: string): Promise<string> {
  return await Deno.readTextFile(join(ROOT, rel));
}

// 手順書は一度だけ読み、6テストで共有する（IO重複の排除）。
const assessSkill = await readRepo(ASSESS_SKILL);
const reads = await readRepo(READS);
const maintainSkill = await readRepo(MAINTAIN_SKILL);
const copyPlan = await readRepo(COPY_PLAN);

function mustMatch(text: string, pattern: RegExp, msg: string): void {
  assertMatch(text, pattern, msg);
}

// 用途: a-m 行（本repo実行 × management経路）が正本参照＋必須性を規定すること。
Deno.test("a-m: self-run management resolves to the repo正本 and is required", () => {
  mustMatch(
    reads,
    /\| *`~\/\.harness\/context\/management\.md` *\| *必須/,
    "reads.md must list the global management.md as required (a-m)",
  );
  mustMatch(
    reads,
    /<repo>\/\.github\/context\/management\.md`?（正本/,
    "reads.md must resolve self-run management.md to the repo正本 (a-m)",
  );
});

// 用途: a-p 行（本repo実行 × product経路）がrepo基準＋未定義扱い＋repo雛形を規定すること。
Deno.test("a-p: self-run product resolves to repo product.md with repo example as template", async () => {
  mustMatch(
    reads,
    /<caller>\/\.github\/context\/product\.md` *\| *任意/,
    "reads.md must list caller product.md as optional (a-p)",
  );
  mustMatch(
    reads,
    /<repo>\/\.github\/context\/product\.md`/,
    "reads.md must resolve self-run product.md to <repo>/.github/context/product.md (a-p)",
  );
  mustMatch(
    reads,
    /<repo>\/\.github\/context\/product\.md\.example/,
    "reads.md must use the repo example as the template for self-run (a-p)",
  );
  mustMatch(reads, /未定義/, "reads.md must treat absent product.md as 未定義 (a-p)");
  const info = await Deno.stat(join(ROOT, ".github/context/product.md.example"));
  assert(info.isFile, ".github/context/product.md.example must exist as the template (a-p)");
});

// 用途: b-m 行（配布先実行 × management経路）が配布除外＋グローバル参照を規定すること。
Deno.test("b-m: distributed repos do not receive management.md (global reference only)", () => {
  mustMatch(
    copyPlan,
    /`context\/` は配布対象外/,
    "copy-plan must exclude context/ from distribution (b-m)",
  );
  mustMatch(
    copyPlan,
    /`context\/` 全件（WP #791・B案で配布廃止/,
    "copy-plan must record the B案 abolition including management.md (b-m)",
  );
  mustMatch(
    assessSkill,
    /~\/\.harness\/context\/management\.md/,
    "assess SKILL.md must reference the global management.md for caller repos (b-m)",
  );
});

// 用途: b-p 行（配布先実行 × product経路）が訂正後の雛形経路（グローバルexample）＋配布除外を規定すること。
Deno.test("b-p: caller product.md is created from the global example; example is not distributed", () => {
  mustMatch(
    maintainSkill,
    /~\/\.harness\/context\/product\.md\.example/,
    "maintain SKILL.md must use the global example as the creation template (b-p, post-correction path)",
  );
  mustMatch(
    maintainSkill,
    /呼出元の `\.github\/context\/product\.md` のみを更新/,
    "maintain SKILL.md must update the caller product.md only (b-p)",
  );
  mustMatch(
    copyPlan,
    /旧 #7（`context\/product\.md\.example`）は WP/,
    "copy-plan must record the removal of example distribution to other repos (b-p, 訂正2)",
  );
  assertNotMatch(
    copyPlan,
    /^\| \d+ \|[^|]*context/m,
    "copy-plan must have no copy-table row distributing context (b-p negative check)",
  );
});

// 用途: c-m 行（呼出元不明 × management経路）が特定促進・エラー報告を規定すること。
Deno.test("c-m: unknown caller requires caller identification (management path)", () => {
  mustMatch(
    assessSkill,
    /呼出元不明時（c-p）は「未定義」とし、呼出元特定を促す/,
    "assess SKILL.md must prompt caller identification for unknown callers (c-m)",
  );
  mustMatch(
    reads,
    /呼出元不明ではエラーとして報告する/,
    "reads.md must report an error for unknown callers (c-m)",
  );
});

// 用途: c-p 行（呼出元不明 × product経路）が未定義扱い＋特定後の解決順序を規定すること。
Deno.test("c-p: unknown caller treats product.md as undefined, then applies caller order", () => {
  mustMatch(
    reads,
    /呼出元不明時は呼出元特定を促し、特定後に呼出元解決順序を適用する/,
    "reads.md must define post-identification caller order for product.md (c-p)",
  );
});

// 用途: 本テスト自体（.opencode/test/ 配下）が配布物に混入しないこと（Architect指摘の回答）。
Deno.test("scope: repo-local tests under .opencode/test/ are not distributed", () => {
  assertNotMatch(
    copyPlan,
    /^\| \d+ \|[^|]*\.opencode\/test/m,
    "copy-plan must have no copy-table row distributing .opencode/test/",
  );
});
