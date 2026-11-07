import { assert } from "@std/assert";
import { walk } from "@std/fs/walk";

const ROOT = Deno.cwd();
const SKILLS_ROOT = ".opencode/skills/bundles";

/**
 * SKILL.md 内のローカル参照リンクを抽出する。
 *
 * URL・アンカーのみ・画像リンクは検査対象外とする。
 */
export function extractLocalLinks(content: string): string[] {
  const links: string[] = [];
  const regex = /(?<!!)\[[^\]]+\]\(([^)]+)\)/g;
  for (const match of content.matchAll(regex)) {
    const link = match[1].trim();
    if (link.startsWith("http://") || link.startsWith("https://")) continue;
    if (link.startsWith("#")) continue;
    if (link.length === 0) continue;
    links.push(link);
  }
  return links;
}

/**
 * リンク先を実ファイルパスへ解決する。
 *
 * 先頭 `/` はリポジトリルート基準、それ以外はスキルディレクトリ基準で解決する。
 * アンカー（`#...`）は比較前に除去する。
 */
export function resolveSkillLink(link: string, skillDir: string, root: string): string {
  const clean = link.split("#")[0];
  if (clean.startsWith("/")) return `${root}${clean}`;
  return `${skillDir}/${clean}`;
}

/**
 * ユースケース: スキルの SKILL.md が参照するファイルの実在を保証する
 * 検証意図: 全スキルの SKILL.md 内ローカルリンクを解決し、参照先が実ファイルとして
 * 存在することを確認する（リンク切れの再混入を防ぐ回帰ガード）。
 */
Deno.test("SKILL.md の参照先がすべて実在する", async () => {
  const broken: string[] = [];
  let skillCount = 0;
  let linkCount = 0;

  for await (const entry of walk(`${ROOT}/${SKILLS_ROOT}`, { exts: [".md"] })) {
    if (!entry.isFile || !entry.path.endsWith("/SKILL.md")) continue;
    skillCount++;
    const skillDir = entry.path.slice(0, entry.path.lastIndexOf("/"));
    const content = await Deno.readTextFile(entry.path);

    for (const link of extractLocalLinks(content)) {
      linkCount++;
      const resolved = resolveSkillLink(link, skillDir, ROOT);
      try {
        const stat = await Deno.stat(resolved);
        if (!stat.isFile) broken.push(`${entry.path} -> ${link}（ファイルではない）`);
      } catch {
        broken.push(`${entry.path} -> ${link}`);
      }
    }
  }

  assert(skillCount > 0, "SKILL.md が1件も見つからない（検査範囲の設定誤り）");
  assert(linkCount > 0, "検査対象のリンクが0件（検査の空洞化）");
  assert(
    broken.length === 0,
    `参照先が存在しないリンクが ${broken.length} 件あります:\n${broken.join("\n")}`,
  );
});
