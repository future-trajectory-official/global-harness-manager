import { parseArgs } from "@std/cli/parse-args";
import { dirname, fromFileUrl, join, resolve } from "@std/path";
import { Issue } from "../../../../../core/issue.ts";
import {
  createMilestone,
  getProjectFields,
  listMilestones,
  setProjectField,
} from "../../../../../core/github.ts";
import type { IGitHubContext } from "../../../../../core/github.ts";
import { executeCommand } from "../../../../../core/command.ts";

const PROJECT_ROOT = resolve(dirname(fromFileUrl(import.meta.url)), "../../../../../..");
const DEFAULT_ARCHIVE_PATH = join(PROJECT_ROOT, ".agents/management/product-backlog-archive.md");
const DEFAULT_HARNESSRC_PATH = join(PROJECT_ROOT, ".github/schemas/.harnessrc");

/** アーカイブからパースした1件のPBIエントリ */
interface ArchiveEntry {
  pbiId: string;
  sprint: string;
  sizeEstimate: string;
  sizeActual: string;
  effortInitial: number;
  effortPlaned: number;
  effortActual: number;
  varianceText: string;
}

/** PBI ID を Epic/Feature/Name に分解した結果 */
interface ParsedPbiId {
  epic?: string;
  feature?: string;
  name: string;
}

/** .harnessrc 設定ファイルの型定義（使用するフィールドのみ） */
interface HarnessConfig {
  version: string;
  projects?: { productBacklog: number; sprintBoard: number };
  customFields?: {
    sizeActual: string;
    effortInitial: string;
    effortPlaned: string;
    effortActual: string;
    varianceText: string;
    sequence: string;
  };
}

/**
 * Markdownのリスト形式（`- **フィールド名**: 値`）からフィールド値を抽出する。
 * @param body - 検索対象のMarkdown文字列
 * @param fieldName - 抽出するフィールド名
 * @returns フィールド値、未存在の場合は空文字
 */
function extractField(body: string, fieldName: string): string {
  const regex = new RegExp(
    `^- \\*\\*${fieldName}\\*\\*:\\s*([\\s\\S]*?)(?=\\n- \\*\\*|\\n####|\\n###|$)`,
    "m",
  );
  const match = body.match(regex);
  if (!match) return "";
  return match[1].replace(/\n\s{2,}/g, " ").trim();
}

/**
 * product-backlog-archive.md をパースし、完了PBIエントリの配列を返す。
 * @param content - アーカイブファイルの全文
 * @returns パースされたエントリの配列
 */
function parseArchiveEntries(content: string): ArchiveEntry[] {
  const entries: ArchiveEntry[] = [];

  const pbiRegex =
    /###\s+\[DONE\]\s+(\S+(?:\/\S+)*)\s*\n([\s\S]*?)(?=\n###\s+\[DONE\]|\n##(?!#)|$)/g;
  let match: RegExpExecArray | null;

  while ((match = pbiRegex.exec(content)) !== null) {
    const pbiId = match[1];
    const body = match[2];

    const sprint = extractField(body, "スプリント");
    const sizeEstimate = extractField(body, "見積サイズ");
    const sizeActual = extractField(body, "実感サイズ");
    const varianceText = extractField(body, "予実差分析");

    const effortSection = body.match(
      /Effort実績\s*\(介入回数\)[\s\S]*?(?=\n- \*\*|$)/,
    );
    let effortInitial = 0;
    let effortPlaned = 0;
    let effortActual = 0;

    if (effortSection) {
      const sectionBody = effortSection[0];
      const initialMatch = sectionBody.match(/計画前見積合計:\s*(\d+)回/);
      const planedMatch = sectionBody.match(/計画後見積合計:\s*(\d+)回/);
      const actualMatch = sectionBody.match(/完了時実績合計:\s*(\d+)回/);
      effortInitial = initialMatch ? parseInt(initialMatch[1], 10) : 0;
      effortPlaned = planedMatch ? parseInt(planedMatch[1], 10) : 0;
      effortActual = actualMatch ? parseInt(actualMatch[1], 10) : 0;
    }

    entries.push({
      pbiId,
      sprint,
      sizeEstimate,
      sizeActual,
      effortInitial,
      effortPlaned,
      effortActual,
      varianceText,
    });
  }

  return entries;
}

/**
 * PBI ID（例: `[Epic/Feature]/PBI-Name`）を Epic/Feature/Name に分解する。
 * @param id - PBI ID文字列
 * @returns 分解結果。Epic/Featureを持たない単純IDの場合は name のみ設定
 */
function parsePbiId(id: string): ParsedPbiId {
  const match = id.match(/^\[([^\/]+)(?:\/([^\]]+))?\]\/(.+)$/);
  if (match) {
    return { epic: match[1], feature: match[2], name: match[3] };
  }
  return { name: id };
}

/**
 * .harnessrc 設定ファイルを読み込む。
 * @param path - 設定ファイルのパス（省略時はデフォルトパスを探索）
 * @returns 設定オブジェクト、読み込み失敗時は null
 */
async function loadConfig(path?: string): Promise<HarnessConfig | null> {
  const paths = path ? [path] : [DEFAULT_HARNESSRC_PATH];
  for (const p of paths) {
    try {
      const content = await Deno.readTextFile(p);
      return JSON.parse(content) as HarnessConfig;
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Epic Issue を検索し、存在しなければ作成してcloseする。
 * @param context - GitHub操作コンテキスト
 * @param epicId - Epicのタイトル
 * @returns Epic Issue インスタンス
 */
async function findOrCreateEpic(context: IGitHubContext, epicId: string): Promise<Issue> {
  const existing = await Issue.list(context, { labels: ["type:Epic"], state: "all" });
  const found = existing.find((i) => i.title === epicId);
  if (found) return found;
  const epic = await Issue.create(context, {
    title: epicId,
    body: `## Epic\n${epicId}`,
    labels: ["type:Epic"],
  });
  await epic.close();
  console.log(`  Created Epic #${epic.number}: ${epicId} (closed)`);
  return epic;
}

/**
 * Feature Issue を検索し、存在しなければEpic配下に作成してcloseする。
 * @param context - GitHub操作コンテキスト
 * @param epicId - 親Epicのタイトル
 * @param featureId - Featureのタイトル
 * @param epicIssue - 親Epic Issueインスタンス
 * @returns Feature Issue インスタンス
 */
async function findOrCreateFeature(
  context: IGitHubContext,
  epicId: string,
  featureId: string,
  epicIssue: Issue,
): Promise<Issue> {
  const existing = await Issue.list(context, { labels: ["type:Feature"], state: "all" });
  const found = existing.find((i) => i.title === featureId);
  if (found) return found;
  const feature = await Issue.create(context, {
    title: featureId,
    body: `## Feature\n${featureId}\n\nPart of Epic: ${epicId}`,
    labels: ["type:Feature"],
  });
  await epicIssue.attach(feature);
  await feature.close();
  console.log(`  Created Feature #${feature.number}: ${featureId} (closed)`);
  return feature;
}

/**
 * アーカイブエントリからGitHub IssueのBodyを構築する。
 * @param entry - アーカイブエントリ
 * @returns Issue Body文字列
 */
function buildIssueBody(entry: ArchiveEntry): string {
  const lines: string[] = [];
  if (entry.sprint) lines.push(`## スプリント\n${entry.sprint}`);
  if (entry.sizeEstimate) lines.push(`## 見積サイズ\n${entry.sizeEstimate}`);
  if (entry.sizeActual) lines.push(`## 実感サイズ\n${entry.sizeActual}`);
  lines.push(
    `## Effort実績\n- 計画前: ${entry.effortInitial}回\n- 計画後: ${entry.effortPlaned}回\n- 完了時: ${entry.effortActual}回`,
  );
  if (entry.varianceText) lines.push(`## 予実差分析\n${entry.varianceText}`);
  return lines.join("\n\n");
}

/**
 * 指定されたスプリント名のマイルストーンが存在することを保証する。
 * 存在しない場合は作成を試みる（作成失敗しても処理は続行する）。
 * @param context - GitHub操作コンテキスト
 * @param sprintName - マイルストーン名（例: "Sprint 11"）
 * @returns マイルストーン名、未設定時は undefined
 */
async function ensureMilestone(
  context: IGitHubContext,
  sprintName: string,
): Promise<string | undefined> {
  const existing = await listMilestones(context);
  if (existing.some((m) => m.title === sprintName)) return sprintName;
  const created = await createMilestone(context, { title: sprintName });
  if (created) console.log(`  Created Milestone: ${sprintName}`);
  return sprintName;
}

/**
 * アーカイブエントリに対応するIssueを検索し、存在しなければ新規作成する。
 * 作成時は Epic/Feature 階層の再現、close（完了PBI）、マイルストーン設定を行う。
 * @param context - GitHub操作コンテキスト
 * @param entry - アーカイブエントリ
 * @param config - .harnessrc設定
 * @returns Issue番号とタイトル
 */
async function ensureIssue(
  context: IGitHubContext,
  entry: ArchiveEntry,
  _config: HarnessConfig,
): Promise<{ number: number; title: string }> {
  const existingIssues = await Issue.list(context, {
    labels: ["type:PBI"],
    state: "all",
    limit: 200,
  });
  const matched = existingIssues.find((i) => i.title === parsePbiId(entry.pbiId).name);
  if (matched) return { number: matched.number, title: matched.title };

  const parsed = parsePbiId(entry.pbiId);
  const body = buildIssueBody(entry);
  const milestone = entry.sprint ? await ensureMilestone(context, entry.sprint) : undefined;
  const labels = ["type:PBI"];

  let parentIssue: Issue;

  if (parsed.epic) {
    const epicIssue = await findOrCreateEpic(context, parsed.epic);
    let featureIssue: Issue | undefined;
    if (parsed.feature) {
      featureIssue = await findOrCreateFeature(context, parsed.epic, parsed.feature, epicIssue);
    }
    parentIssue = await Issue.create(context, {
      title: parsed.name,
      body,
      labels,
      milestone,
    });
    const attachTarget = featureIssue ?? epicIssue;
    await attachTarget.attach(parentIssue);
  } else {
    parentIssue = await Issue.create(context, {
      title: parsed.name,
      body,
      labels,
      milestone,
    });
  }

  await parentIssue.close();
  console.log(`  Created PBI #${parentIssue.number}: ${parsed.name} (closed)`);
  return { number: parentIssue.number, title: parsed.name };
}

/**
 * IssueをProject V2に追加し、Project ItemのNode IDを取得する。
 * @param context - GitHub操作コンテキスト
 * @param issueNumber - 追加するIssue番号
 * @param projectNumber - Project V2の番号
 * @returns Project Item Node ID、失敗時は null
 */
async function addToProjectAndGetItemId(
  context: IGitHubContext,
  issueNumber: number,
  projectNumber: string,
): Promise<string | null> {
  const issueUrl =
    `https://github.com/${context.owner}/${context.repository}/issues/${issueNumber}`;
  const result = await executeCommand({
    cmd: "gh",
    args: [
      "project",
      "item-add",
      String(projectNumber),
      "--owner",
      context.owner,
      "--url",
      issueUrl,
      "--format",
      "json",
    ],
  });
  if (result.code !== 0) return null;
  try {
    const data = JSON.parse(result.stdout);
    return data.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Project V2のNode IDを取得する。
 * @param context - GitHub操作コンテキスト
 * @param projectNumber - Project V2の番号
 * @returns Project Node ID、失敗時は null
 */
async function getProjectNodeId(
  context: IGitHubContext,
  projectNumber: string,
): Promise<string | null> {
  const result = await executeCommand({
    cmd: "gh",
    args: [
      "project",
      "view",
      String(projectNumber),
      "--owner",
      context.owner,
      "--format",
      "json",
      "--jq",
      ".id",
    ],
  });
  if (result.code !== 0) return null;
  return result.stdout.trim() || null;
}

/**
 * Project V2のカスタムフィールドにアーカイブエントリの値を設定する。
 * Number型・Text型・Single Select型を自動判別し、適切なghフラグを使用する。
 * @param context - GitHub操作コンテキスト
 * @param projectNumber - Project V2の番号
 * @param issueNumber - 対象Issue番号
 * @param entry - アーカイブエントリ（設定元データ）
 * @param config - .harnessrc設定
 */
async function setProjectFields(
  context: IGitHubContext,
  projectNumber: string,
  issueNumber: number,
  entry: ArchiveEntry,
  config: HarnessConfig,
): Promise<void> {
  const itemId = await addToProjectAndGetItemId(context, issueNumber, projectNumber);
  if (!itemId) {
    console.error(`  WARNING: Could not add issue #${issueNumber} to project ${projectNumber}`);
    return;
  }

  const projectNodeId = await getProjectNodeId(context, projectNumber);
  if (!projectNodeId) {
    console.error(`  WARNING: Could not resolve project node ID for #${projectNumber}`);
    return;
  }

  const fields = await getProjectFields(context, projectNumber);
  const fieldIdMap = new Map(fields.map((f) => [f.name, f.id]));
  const fieldTypeMap = new Map(fields.map((f) => [f.name, f.type]));
  const fieldOptionsMap = new Map<string, Map<string, string>>();
  for (const f of fields) {
    if (f.options) {
      const optMap = new Map(f.options.map((o) => [o.name, o.id]));
      fieldOptionsMap.set(f.name, optMap);
    }
  }

  const fieldUpdates: { name: string; value: string }[] = [];

  if (config.customFields?.effortInitial && entry.effortInitial > 0) {
    const name = config.customFields.effortInitial;
    if (fieldIdMap.has(name)) {
      fieldUpdates.push({ name, value: String(entry.effortInitial) });
    }
  }
  if (config.customFields?.effortPlaned && entry.effortPlaned > 0) {
    const name = config.customFields.effortPlaned;
    if (fieldIdMap.has(name)) {
      fieldUpdates.push({ name, value: String(entry.effortPlaned) });
    }
  }
  if (config.customFields?.effortActual && entry.effortActual > 0) {
    const name = config.customFields.effortActual;
    if (fieldIdMap.has(name)) {
      fieldUpdates.push({ name, value: String(entry.effortActual) });
    }
  }
  if (config.customFields?.sizeActual && entry.sizeActual) {
    const name = config.customFields.sizeActual;
    if (fieldIdMap.has(name)) {
      fieldUpdates.push({ name, value: entry.sizeActual });
    }
  }
  if (config.customFields?.varianceText && entry.varianceText) {
    const name = config.customFields.varianceText;
    if (fieldIdMap.has(name)) {
      fieldUpdates.push({ name, value: entry.varianceText });
    }
  }

  for (const update of fieldUpdates) {
    const fieldId = fieldIdMap.get(update.name);
    if (!fieldId) {
      console.error(`  WARNING: Field "${update.name}" not found on project`);
      continue;
    }
    const fieldType = fieldTypeMap.get(update.name);
    const isSingleSelect = fieldType === "ProjectV2SingleSelectField";
    const optMap = fieldOptionsMap.get(update.name);

    if (isSingleSelect && optMap) {
      const optId = optMap.get(update.value);
      if (!optId) {
        console.error(`  WARNING: Option "${update.value}" not found for field "${update.name}"`);
        continue;
      }
      const ok = await setProjectField(context, {
        itemId,
        fieldId: fieldId,
        value: optId,
        projectId: projectNodeId,
        valueType: "singleSelectOptionId",
      });
      if (ok) {
        console.log(`  Set ${update.name} = ${update.value}`);
      } else {
        console.error(`  WARNING: Failed to set ${update.name}`);
      }
    } else {
      const ok = await setProjectField(context, {
        itemId,
        fieldId: fieldId,
        value: update.value,
        projectId: projectNodeId,
      });
      if (ok) {
        console.log(`  Set ${update.name} = ${update.value.slice(0, 60)}`);
      } else {
        console.error(`  WARNING: Failed to set ${update.name}`);
      }
    }
  }
}

/**
 * dry-runモード: アーカイブファイルを読み込み、パース結果を表示する。
 * 実際のIssue作成やフィールド書き込みは行わない。
 * @param archivePath - アーカイブファイルのパス
 */
async function cmdDryRun(archivePath: string): Promise<void> {
  const content = await Deno.readTextFile(archivePath);
  const entries = parseArchiveEntries(content);

  console.log(`Found ${entries.length} archived PBI(s):\n`);

  for (const entry of entries) {
    if (!entry.pbiId) {
      console.warn("  WARNING: Skipping entry with empty pbiId");
      continue;
    }
    if (entry.effortInitial === 0 && entry.effortPlaned === 0 && entry.effortActual === 0) {
      console.warn(`  NOTE: ${entry.pbiId} has no Effort実績 data (fields will be set to 0)`);
    }
    const parsed = parsePbiId(entry.pbiId);
    console.log(`  PBI: ${entry.pbiId}`);
    console.log(`    Title: ${parsed.name}`);
    console.log(`    Sprint: ${entry.sprint || "(unknown)"}`);
    console.log(
      `    Size: estimate=${entry.sizeEstimate || "(none)"} / actual=${
        entry.sizeActual || "(none)"
      }`,
    );
    console.log(
      `    Effort: initial=${entry.effortInitial} / planed=${entry.effortPlaned} / actual=${entry.effortActual}`,
    );
    console.log(
      `    Variance: ${entry.varianceText ? entry.varianceText.slice(0, 60) + "..." : "(none)"}`,
    );
    console.log(
      `    Action: ${
        parsed.epic
          ? "Create under " + parsed.epic + (parsed.feature ? "/" + parsed.feature : "")
          : "Create independent PBI"
      }`,
    );
    console.log(`    Project V2 fields to set:`);
    console.log(`      ${"harness-effort-initial"}: ${entry.effortInitial}`);
    console.log(`      ${"harness-effort-planed"}: ${entry.effortPlaned}`);
    console.log(`      ${"harness-effort-actual"}: ${entry.effortActual}`);
    console.log(`      ${"harness-size-actual"}: ${entry.sizeActual || "(unset)"}`);
    if (entry.varianceText) {
      console.log(`      ${"harness-variance-text"}: ${entry.varianceText.slice(0, 60)}...`);
    }
    console.log("");
  }
}

/**
 * migrateモード: アーカイブPBIをGitHub Issueとして作成し、Project V2フィールドを設定する。
 * dryRun=true の場合は作成/書き込みを行わず計画のみ表示する。
 * @param archivePath - アーカイブファイルのパス
 * @param repo - 対象リポジトリ（"owner/repo" 形式）
 * @param dryRun - trueの場合はdry-run
 */
async function cmdMigrate(
  archivePath: string,
  repo: string,
  dryRun: boolean,
): Promise<void> {
  const [owner, repoName] = repo.split("/");
  const context: IGitHubContext = { owner, repository: repoName };
  const config = await loadConfig();
  if (!config) {
    console.error("Error: Could not load .harnessrc config");
    Deno.exit(1);
  }

  const content = await Deno.readTextFile(archivePath);
  const entries = parseArchiveEntries(content);

  if (dryRun) {
    console.log("[DRY-RUN] Would create/migrate the following entries:\n");
    for (const entry of entries) {
      const parsed = parsePbiId(entry.pbiId);
      console.log(`  PBI: ${entry.pbiId}`);
      console.log(`    Title to create: ${parsed.name}`);
      if (parsed.epic) {
        console.log(`    Under: ${parsed.epic}${parsed.feature ? "/" + parsed.feature : ""}`);
      }
      if (entry.sprint) console.log(`    Milestone: ${entry.sprint}`);
      if (config.customFields) {
        console.log(`    Fields to set:`);
        if (config.customFields.effortInitial && entry.effortInitial > 0) {
          console.log(`      ${config.customFields.effortInitial}: ${entry.effortInitial}`);
        }
        if (config.customFields.effortPlaned && entry.effortPlaned > 0) {
          console.log(`      ${config.customFields.effortPlaned}: ${entry.effortPlaned}`);
        }
        if (config.customFields.effortActual && entry.effortActual > 0) {
          console.log(`      ${config.customFields.effortActual}: ${entry.effortActual}`);
        }
        if (config.customFields.sizeActual && entry.sizeActual) {
          console.log(`      ${config.customFields.sizeActual}: ${entry.sizeActual}`);
        }
        if (config.customFields.varianceText && entry.varianceText) {
          console.log(
            `      ${config.customFields.varianceText}: ${entry.varianceText.slice(0, 60)}`,
          );
        }
      }
      console.log("");
    }
    return;
  }

  for (const entry of entries) {
    console.log(`\nProcessing: ${entry.pbiId}`);
    const issue = await ensureIssue(context, entry, config);
    console.log(`  Issue #${issue.number}: ${issue.title}`);

    if (config.projects?.sprintBoard) {
      console.log(`  Setting effort fields on Sprint Board #${config.projects.sprintBoard}...`);
      await setProjectFields(
        context,
        String(config.projects.sprintBoard),
        issue.number,
        entry,
        config,
      );
    }
    if (config.projects?.productBacklog) {
      console.log(
        `  Setting size/variance fields on Product Backlog #${config.projects.productBacklog}...`,
      );
      await setProjectFields(
        context,
        String(config.projects.productBacklog),
        issue.number,
        entry,
        config,
      );
    }
  }
}

/** ヘルプ表示 */
function printUsage(): void {
  console.log(`Usage:
  migrate-archive-to-github --dry-run [--backlog <path>]
  migrate-archive-to-github --migrate --repo <owner/repo> [--backlog <path>] [--dry-run]

Options:
  --dry-run                       Preview archive entries and fields to set
  --migrate                       Execute migration: create Issues if not exist, then set Project V2 fields
  --repo <owner/repo>             Target repository (required for --migrate)
  --backlog <path>                Path to product-backlog-archive.md (default: .agents/management/product-backlog-archive.md)
  --help                          Show this help`);
}

/** CLIエントリポイント。引数をパースし、対応するコマンドを実行する。 */
async function main(): Promise<void> {
  const args = parseArgs(Deno.args, {
    string: ["repo", "backlog"],
    boolean: ["dry-run", "migrate", "help"],
    alias: { h: "help", d: "dry-run", r: "repo", m: "migrate", b: "backlog" },
  });

  if (args.help || (!args["dry-run"] && !args.migrate)) {
    printUsage();
    Deno.exit(0);
  }

  const archivePath = args.backlog || DEFAULT_ARCHIVE_PATH;

  if (args.migrate) {
    if (!args.repo) {
      console.error("Error: --repo is required for --migrate");
      Deno.exit(1);
    }
    await cmdMigrate(archivePath, args.repo, !!args["dry-run"]);
    Deno.exit(0);
  }

  if (args["dry-run"]) {
    await cmdDryRun(archivePath);
    Deno.exit(0);
  }
}

if (import.meta.main) {
  await main();
}
