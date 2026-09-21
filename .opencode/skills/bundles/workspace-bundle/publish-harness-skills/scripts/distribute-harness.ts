import { parseArgs } from "@std/cli/parse-args";
import {
  errorUtil,
  fsUtil,
  logger,
  pathUtil,
  verifyTarget,
} from "../../../../../core/harness-core.ts";

/**
 * WP_1 #748: グローバル配布機構（構造保持コピー＋global-名前変換）。
 * `.opencode/` の中身を `~/.harness/` フラット単一ルートへ構造保持で配布する。
 * 既存 `publish-skills.ts` は破壊せず、本スクリプトを新規実装とする。
 *
 * 【既知の制約（M6: 同梱deno.json）】
 * 配布物として同梱する `deno.json` はリポジトリ root 版（単一の正）である。root版は
 * `setup-hooks`/`validate-task`/`phase-gate`/`validate:jsdoc` 等のタスクが `.opencode/...`
 * を参照するため、フラットな配布先 `~/.harness/` では実行不能になる（import map の `@std/*`
 * はパス非依存のため core 相対 import は解決される）。これは WP_2 で接続検証時に顕在化する
 * 既知の制約として申し送る（本 WP 範囲外）。
 */

/** 構造保持コピー対象ディレクトリ（`.opencode/` 配下。AC1）。
 * `context/` はディレクトリ丸ごとではなく、利用者編集 `product.md` を除く
 * `management.md` と `product.md.example` のみを明示コピーする（include方式・C2対応）。 */
export const COPY_DIRS = ["skills", "core", "agents", "commands", "guides"];

/** 定数化（M2対応: マジックリテラル集約） */
export const BUNDLES_DIR = "bundles";
export const RENAME_MAP_FILE = "skill-rename-map.json";
export const DEFAULT_DEST = "~/.harness";
export const SKILLS_DIR = "skills";

export interface CopyEntry {
  src: string;
  dest: string;
  kind: "dir" | "file";
}

/**
 * スキル名を `global-{name}` 形式へ正規化する（AC2）。
 * 小文字ハイフン統一。`~` はシェル展開リスクのため使用しない。
 * @param name - 変換前のスキル名
 * @returns `global-` 接頭辞付きの正規化名
 */
export function normalizeSkillName(name: string): string {
  const norm = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `global-${norm}`;
}

/**
 * 配布コピー計画を組み立てる（AC1）。
 * 除外方針は include方式：コピー対象を明示列挙し、除外対象（`node_modules/`・`deno.lock`・
 * `package*.json`・`.local/`・`.session/`・`coverage/`・`cov_profile/`・`.log` ・`/tmp/`・
 * `/config/` 実体・`/opencode.json(c)`・利用者編集 `context/product.md`）は計画に含めない。
 * 事後削除は行わず、対象を直接列挙する（C2対応）。
 * @param sourceRoot - 配布元 `.opencode/` ディレクトリの絶対パス
 * @param destRoot - 配布先ルート（例: `~/.harness`）の絶対パス
 * @returns コピーエントリ一覧
 */
export function buildCopyPlan(sourceRoot: string, destRoot: string): CopyEntry[] {
  const plan: CopyEntry[] = [];
  for (const dir of COPY_DIRS) {
    plan.push({
      src: pathUtil.joinPath(sourceRoot, dir),
      dest: pathUtil.joinPath(destRoot, dir),
      kind: "dir",
    });
  }
  // context は include方式（management.md + product.md.example のみ）
  plan.push({
    src: pathUtil.joinPath(sourceRoot, "context", "management.md"),
    dest: pathUtil.joinPath(destRoot, "context", "management.md"),
    kind: "file",
  });
  plan.push({
    src: pathUtil.joinPath(sourceRoot, "context", "product.md.example"),
    dest: pathUtil.joinPath(destRoot, "context", "product.md.example"),
    kind: "file",
  });
  const repoRoot = pathUtil.dirname(sourceRoot);
  plan.push({
    src: pathUtil.joinPath(repoRoot, "deno.json"),
    dest: pathUtil.joinPath(destRoot, "deno.json"),
    kind: "file",
  });
  plan.push({
    src: pathUtil.joinPath(repoRoot, "config", "AGENTS.md.example"),
    dest: pathUtil.joinPath(destRoot, "AGENTS.md"),
    kind: "file",
  });
  return plan;
}

export interface SkillRef {
  bundle: string;
  name: string;
}

export interface RenameEntry {
  before: string;
  after: string;
  bundle: string;
  /** 元スキル名（before から逆算しない。M2対応） */
  name: string;
}

/**
 * `skills/bundles/<bundle>/<name>/` 配下のスキルを列挙する（AC2）。
 * @param skillsRoot - 配布元 `skills/` ディレクトリの絶対パス
 * @returns `{bundle, name}` 一覧
 */
export async function collectSkills(skillsRoot: string): Promise<SkillRef[]> {
  const skills: SkillRef[] = [];
  const bundlesRoot = pathUtil.joinPath(skillsRoot, BUNDLES_DIR);
  if (!(await fsUtil.exists(bundlesRoot))) {
    return skills;
  }
  for await (const bundleEntry of Deno.readDir(bundlesRoot)) {
    if (!bundleEntry.isDirectory) continue;
    const bundleDir = pathUtil.joinPath(bundlesRoot, bundleEntry.name);
    for await (const skillEntry of Deno.readDir(bundleDir)) {
      if (!skillEntry.isDirectory) continue;
      skills.push({ bundle: bundleEntry.name, name: skillEntry.name });
    }
  }
  return skills;
}

/**
 * スキルのリネームマップを組み立てる（AC2）。
 * 変換後の重複（異bundle同名・異表記が同一正規化名になる衝突）はエラー終了する。
 * @param skills - `collectSkills` の出力
 * @returns 変換マップ（`{before, after, bundle, name}`）
 */
export function buildRenameMap(skills: SkillRef[]): RenameEntry[] {
  const seen = new Map<string, string>();
  const map: RenameEntry[] = [];
  for (const s of skills) {
    const after = normalizeSkillName(s.name);
    if (seen.has(after)) {
      throw new Error(
        `duplicate skill name after rename: ${after} (from ${
          seen.get(after)
        } and ${s.bundle}/${s.name})`,
      );
    }
    seen.set(after, `${s.bundle}/${s.name}`);
    map.push({ before: `${s.bundle}/${s.name}`, after, bundle: s.bundle, name: s.name });
  }
  return map;
}

/** 配布先の安全性を検証する（git dirty チェック）。C3段階抽出。 */
export async function ensureDestSafe(
  destRoot: string,
  force: boolean,
): Promise<boolean> {
  if (await verifyTarget.isGitRepo(destRoot)) {
    if (await verifyTarget.isDirty(destRoot) && !force) {
      logger.warn(`Destination "${destRoot}" is a dirty git repository. Skipping.`);
      logger.info("Use --force to ignore this.");
      return false;
    }
  }
  return true;
}

/** コピー計画を実行する（C3段階抽出）。 */
export async function executeCopyPlan(
  plan: CopyEntry[],
  isDryRun: boolean,
): Promise<void> {
  for (const entry of plan) {
    if (!(await fsUtil.exists(entry.src))) {
      logger.warn(`Source not found: ${entry.src}. Skipping.`);
      continue;
    }
    if (isDryRun) {
      logger.dryRun(`Copy: ${entry.src} -> ${entry.dest}`);
      continue;
    }
    const parent = entry.kind === "dir" ? entry.dest : pathUtil.dirname(entry.dest);
    await Deno.mkdir(parent, { recursive: true }).catch((e) => {
      if (!(e instanceof Deno.errors.AlreadyExists)) throw e;
    });
    await fsUtil.copy(entry.src, entry.dest);
    logger.info(`  Copied: ${entry.src} -> ${entry.dest}`);
  }
}

/**
 * リネームマップを配布先に適用する（冪等。M1対応）。
 * リネーム元が存在しない場合は skip、リネーム先（`global-`）が既に存在する場合も
 * skip して冪等にし、適用成功分のみのマップを返す（M4対応）。
 * @param map - `buildRenameMap` の出力
 * @param destRoot - 配布先ルート
 * @param isDryRun - dry-run 時は実行せずログのみ
 * @returns 実際に適用（または適用予定）のエントリのみのマップ
 */
export async function applyRenameMap(
  map: RenameEntry[],
  destRoot: string,
  isDryRun: boolean,
): Promise<RenameEntry[]> {
  const applied: RenameEntry[] = [];
  for (const entry of map) {
    const fromDir = pathUtil.joinPath(
      destRoot,
      SKILLS_DIR,
      BUNDLES_DIR,
      entry.bundle,
      entry.name,
    );
    const destDir = pathUtil.joinPath(
      destRoot,
      SKILLS_DIR,
      BUNDLES_DIR,
      entry.bundle,
      entry.after,
    );
    if (!(await fsUtil.exists(fromDir))) {
      logger.warn(`Renamed source not found: ${fromDir}. Skipping.`);
      continue;
    }
    if (await fsUtil.exists(destDir)) {
      logger.warn(`Rename target already exists: ${destDir}. Skipping (idempotent).`);
      continue;
    }
    if (isDryRun) {
      logger.dryRun(`Rename: ${fromDir} -> ${destDir}`);
    } else {
      await fsUtil.move(fromDir, destDir);
      logger.info(`  Renamed: ${fromDir} -> ${destDir}`);
    }
    applied.push(entry);
  }
  return applied;
}

/** 変換マップを JSON として配布先へ書き込む（C3段階抽出）。 */
export async function writeRenameMap(
  destRoot: string,
  map: RenameEntry[],
  isDryRun: boolean,
): Promise<void> {
  const mapPath = pathUtil.joinPath(destRoot, RENAME_MAP_FILE);
  await fsUtil.writeTextFile(mapPath, JSON.stringify(map, null, 2) + "\n", isDryRun);
  logger.info(`Rename map written: ${mapPath}`);
}

async function main(): Promise<void> {
  try {
    const args = parseArgs(Deno.args, {
      string: ["dest"],
      boolean: ["dry-run", "force"],
      alias: { d: "dry-run", f: "force" },
      default: { dest: DEFAULT_DEST },
    });

    const isDryRun = args["dry-run"] || false;
    const force = args["force"] || false;
    // M5対応: destRoot は絶対パスへ解決（相対指定も CWD 基準で安定化）
    const destRoot = pathUtil.resolvePath(pathUtil.expandHome(String(args["dest"])));
    const sourceRoot = pathUtil.resolvePath(".opencode");

    if (!(await fsUtil.exists(sourceRoot))) {
      throw new Error(`Source not found: ${sourceRoot}`);
    }

    logger.info(`Distribute: ${sourceRoot} -> ${destRoot}`);

    if (!(await ensureDestSafe(destRoot, force))) {
      return;
    }

    // C1対応: リネーム計画（重複検知）をコピー前に fail-fast 検証する
    const skills = await collectSkills(pathUtil.joinPath(sourceRoot, SKILLS_DIR));
    const renameMap = buildRenameMap(skills);
    logger.info(`Found ${renameMap.length} skills to rename.`);

    await executeCopyPlan(buildCopyPlan(sourceRoot, destRoot), isDryRun);

    logger.info("Applying skill rename (global- prefix)...");
    const appliedMap = await applyRenameMap(renameMap, destRoot, isDryRun);
    await writeRenameMap(destRoot, appliedMap, isDryRun);

    logger.info("Distribute completed.");
  } catch (e) {
    errorUtil.fatal(e, "Distribute Harness Main");
  }
}

if (import.meta.main) {
  main();
}
