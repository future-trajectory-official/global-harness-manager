/**
 * WP #689 ワークフローのコマンド化（.opencode/commands）検証テスト。
 *
 * ワークフロー追加時の更新手順（プレイブック）:
 *   1. `.agents/workflows/` に wf を追加したら、対応する `.opencode/commands/<同名>.md`
 *      を本テンプレート（既存コマンドを複製）で作成する。AC1 の集合同値が自動的に要求する。
 *   2. 新規 wf の `<!-- STOP -->` 数を `rg -o '<!-- STOP -->' | wc -l` で実測し、
 *      STOP_BASELINE へ登録する（未登録はレジストリテストが失敗させる）。
 *   3. コマンド本文は frontmatter（description 原文流用・subtask:false）＋ @ 参照＋
 *      フェーズ表＋遵守事項3項の構造を維持する（AC2〜AC5 と一貫性ガードが検証する）。
 *   4. 新規にロール定義を参照する場合は `/.opencode/agents/<role>.md` 実在下のみ可。
 * 反復集合は wf ディレクトリの動的走査から駆動されるため、追加で編集が必要な箇所は ② のみ。
 */
import { assert, assertEquals } from "@std/assert";
import { parse } from "@std/yaml";

const ROOT = new URL("../", import.meta.url).pathname;
const WORKFLOWS_DIR = `${ROOT}.agents/workflows`;
const COMMANDS_DIR = `${ROOT}.opencode/commands`;

/**
 * 介入2でロールリンク置換を行ったスキル側ファイル（wf 以外）。
 */
const SKILL_LINK_FILES: string[] = [
  `${ROOT}.agents/skills/bundles/git-bundle/hybrid-triage-commit/references/hybrid-triage-commit-process.md`,
  `${ROOT}.agents/skills/bundles/management-bundle/session-planning/SKILL.md`,
];

/**
 * ワークフロー別の `<!-- STOP -->` 数ベースライン（2026-09-04 実測）。
 * AC4「STOPマーカーは変更不要」の機械的担保。wf 追加時はプレイブック②で登録し、
 * レジストリテストが wf 実走査との集合同値を強制する。
 */
const STOP_BASELINE: Record<string, number> = {
  "kickoff.md": 6,
  "project-setup.md": 8,
  "refactoring.md": 10,
  "session-end.md": 5,
  "session-start.md": 5,
  "sprint-end.md": 12,
  "sprint-review.md": 3,
  "sprint-start.md": 9,
};

/**
 * テスト実行中は同一内容を返す読み込みキャッシュ（並行呼び出し時は重複読の可能性があるが
 * 内容不変のため無害）。
 */
const fileCache = new Map<string, string>();

/**
 * 対象ファイルの内容を返し、初回読み込み時はキャッシュに保持する。
 *
 * @param path - 読み込むファイルの絶対パス
 * @returns ファイル内容
 */
async function readTarget(path: string): Promise<string> {
  const cached = fileCache.get(path);
  if (cached !== undefined) {
    return cached;
  }
  const content = await Deno.readTextFile(path);
  fileCache.set(path, content);
  return content;
}

/**
 * .agents/workflows 直下のワークフローファイル名一覧（辞書順）。検証対象集合の単一の情報源。
 *
 * @returns `*.md` ファイル名の配列
 */
async function listWorkflowFiles(): Promise<string[]> {
  const names: string[] = [];
  for await (const entry of Deno.readDir(WORKFLOWS_DIR)) {
    if (entry.isFile && entry.name.endsWith(".md")) {
      names.push(entry.name);
    }
  }
  return names.sort();
}

/**
 * wf ファイル名（\`x.md\`）から基底名 \`x\` を返す。
 *
 * @param file - `.md` 付きファイル名
 * @returns 拡張子を除いた基底名
 */
function baseName(file: string): string {
  return file.replace(/\.md$/, "");
}

/**
 * wf 本文の絶対パスを返す。
 *
 * @param file - `.md` 付き wf ファイル名
 * @returns WORKFLOWS_DIR 配下の絶対パス
 */
function workflowPath(file: string): string {
  return `${WORKFLOWS_DIR}/${file}`;
}

/**
 * wf に対応するコマンドファイルの絶対パスを返す。
 *
 * @param name - wf 基底名（拡張子なし）
 * @returns COMMANDS_DIR 配下の絶対パス
 */
function commandPath(name: string): string {
  return `${COMMANDS_DIR}/${name}.md`;
}

/**
 * レジストリ不変条件: STOP_BASELINE のキー集合と wf ディレクトリの実走査結果が
 * 集合同値であること。新規 wf の検証素通り（登録漏れ）を失敗として検出する。
 */
Deno.test("STOP baseline registry covers exactly the workflow set", async () => {
  const workflows = await listWorkflowFiles();
  assertEquals(
    Object.keys(STOP_BASELINE).sort(),
    workflows,
    "register new workflows in STOP_BASELINE with the measured STOP marker count (playbook step 2)",
  );
});

/**
 * AC4不変条件: 各ワークフローの `<!-- STOP -->` 数がベースラインと一致する。
 * リンク置換等の機械編集が停止マーカー構造へ影響していないことを保証する。
 */
Deno.test("workflows keep the STOP marker baseline (AC4 invariance)", async () => {
  for (const [file, expected] of Object.entries(STOP_BASELINE)) {
    const content = await readTarget(workflowPath(file));
    const count = (content.match(/<!-- STOP -->/g) ?? []).length;
    assertEquals(
      count,
      expected,
      `${file} must keep exactly ${expected} STOP markers after edits`,
    );
  }
});

/**
 * 介入2残存参照ゼロ化ガード: 置換対象（wf 実走査＋スキル2本）にルート絶対パス
 * `/.agents/rules/` への参照が残っていないこと。相対表記の配置説明は対象外。
 */
Deno.test("role references to the removed .agents/rules dir are eliminated", async () => {
  const workflows = await listWorkflowFiles();
  const targets = [...workflows.map((file) => workflowPath(file)), ...SKILL_LINK_FILES];
  for (const path of targets) {
    const content = await readTarget(path);
    assert(
      !content.includes("/.agents/rules/"),
      `${path} still references the removed /.agents/rules/ path`,
    );
  }
});

/**
 * 介入2置換先の実在性: 対象中の /.opencode/agents/<role>.md 参照がすべて実ファイルへ
 * 解決すること。total>=65 は develop-work-package ワークフロー削除（2026-09-06）後の
 * 実測65件（74→9減）への下bound（置換漏れ捕捉）。
 */
Deno.test("replaced role links resolve to existing .opencode/agents files", async () => {
  const workflows = await listWorkflowFiles();
  const targets = [...workflows.map((file) => workflowPath(file)), ...SKILL_LINK_FILES];
  let total = 0;
  for (const path of targets) {
    const content = await readTarget(path);
    for (const match of content.matchAll(/\/\.opencode\/agents\/([a-z-]+)\.md/g)) {
      const target = `${ROOT}.opencode/agents/${match[1]}.md`;
      total += 1;
      assert(
        (await Deno.stat(target)).isFile,
        `${path} links to missing role definition: ${target}`,
      );
    }
  }
  assert(total >= 65, `expected at least 65 replaced role links, found ${total}`);
});

/**
 * AC1: .agents/workflows/*.md の全ワークフローに対応するコマンドファイルが
 * .opencode/commands/ に集合同値で存在する（1ワークフロー1ファイル）。
 * 個数は wf 実走査に従うため、ワークフロー増減に対して固定値を持たない。
 */
Deno.test("AC1 commands mirror workflows one-to-one", async () => {
  const workflows = new Set((await listWorkflowFiles()).map((f) => baseName(f)));
  assert(workflows.size > 0, "no workflows discovered; check WORKFLOWS_DIR");

  const commands = new Set<string>();
  for await (const entry of Deno.readDir(COMMANDS_DIR)) {
    if (entry.isFile && entry.name.endsWith(".md")) {
      commands.add(baseName(entry.name));
    }
  }
  const missing = [...workflows].filter((name) => !commands.has(name));
  const extra = [...commands].filter((name) => !workflows.has(name));
  assertEquals(missing, [], `commands missing for workflows: ${missing.join(", ")}`);
  assertEquals(extra, [], `commands without workflow: ${extra.join(", ")}`);
});

/**
 * markdown先頭の YAML frontmatter をキー値マップへ変換する。
 *
 * @param content - frontmatter を含む markdown 本文
 * @returns frontmatter のパーサ結果（先頭ブロックが無い場合は空オブジェクト）
 */
function parseFrontmatter(content: string): Record<string, unknown> {
  const match = content.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) {
    return {};
  }
  const parsed = parse(match[1]);
  return (parsed && typeof parsed === "object" ? parsed : {}) as Record<string, unknown>;
}

/**
 * AC2: 各コマンドは Opencode 形式 frontmatter（description）を持ち、
 * subtask:false が明示設定されている。キーは description/subtask の2つのみ、
 * description は対応ワークフロー frontmatter の原文と完全一致であること。
 */
Deno.test("AC2 frontmatter has original description and explicit subtask:false", async () => {
  for (const file of await listWorkflowFiles()) {
    const name = baseName(file);
    const [command, workflow] = await Promise.all([
      readTarget(commandPath(name)),
      readTarget(workflowPath(file)),
    ]);
    const fm = parseFrontmatter(command);
    assertEquals(
      Object.keys(fm).sort(),
      ["description", "subtask"],
      `${name}.md must declare exactly description and subtask`,
    );
    assertEquals(fm.subtask, false, `${name}.md must set subtask: false explicitly`);
    const wfDesc = parseFrontmatter(workflow).description;
    assert(typeof wfDesc === "string" && wfDesc.length > 0, `${file} workflow lacks description`);
    assertEquals(fm.description, wfDesc, `${name}.md description must copy workflow original`);
  }
});

/** フェーズ見出しと認められるラベルの前置パターン（番号付き Phase / 数値番号）。 */
const PHASE_LABEL_RE = /^(Phase [\d-]+|\d[\d.-]*\s)/;

/**
 * ワークフロー見出しテキストをコマンド表記法へ正規化する。
 * 「Phase 2: 名称 (English)」型の**半角**括弧接尾（英語併記）を除去し、「: 」を「. 」へ揃える。
 * 全角括弧（例:「（中止判断）」）は意味内容を含むため保持する。
 *
 * @param heading - markdown 見出しのマーカー除去済みテキスト
 * @returns 正規化されたフェーズラベル
 */
function normalizePhaseLabel(heading: string): string {
  return heading.replace(": ", ". ").replace(/\s*\([^()]*\)\s*$/, "").trim();
}

/**
 * ワークフロー本文からリーフレベルのフェーズ見出しを抽出する。
 * ## 見出し直下に ### がある場合は ### のみを葉として採用（## はグループ扱い）。
 * 取りこぼしによる偽通過を許さないため、構造違反は例外ではなく失敗させる:
 *   - `####` 以上の見出し出現 → 即失敗
 *   - ## のない ### / フェーズラベルでない ### → orphans として収集し失敗
 *   - 抽出葉が3件未満（全 wf の観測最小値）→ ヒューリスティック失効疑いで失敗
 *
 * @param content - ワークフロー本文
 * @param label - エラーメッセージ用のファイル識別子
 * @returns 正規化されたリーフェーズラベルの配列
 */
function leafPhaseTitles(content: string, label: string): string[] {
  const leaves: string[] = [];
  const orphans: string[] = [];
  let current: { label: string; children: string[] } | null = null;
  const flush = () => {
    if (!current) {
      return;
    }
    if (current.children.length > 0) {
      leaves.push(...current.children);
    } else if (PHASE_LABEL_RE.test(current.label)) {
      leaves.push(current.label);
    }
    // 子を持たない非フェーズ ##（例:「ワークフローの進行ルール」の導入部）は葉でも
    // 違反でもなく、単にスキップする。### 側の規約違反はループ内で orphans 収集済み。
  };
  for (const line of content.split("\n")) {
    assert(!/^#{4,}\s/.test(line), `${label}: 見出し階層に #### 以上を使用しないこと: ${line}`);
    const match = line.match(/^(#{2,3}) (.+)$/);
    if (!match) {
      continue;
    }
    const phaseLabel = normalizePhaseLabel(match[2]);
    if (match[1] === "##") {
      flush();
      current = { label: phaseLabel, children: [] };
    } else if (current && PHASE_LABEL_RE.test(phaseLabel)) {
      current.children.push(phaseLabel);
    } else {
      orphans.push(phaseLabel);
    }
  }
  flush();
  assert(
    orphans.length === 0,
    `${label}: フェーズ見出し規約に違反する構造（### の親欠落・非フェーズ ###・####以上）: ${
      orphans.join(" / ")
    }`,
  );
  assert(
    leaves.length >= 3,
    `${label}: 抽出リーフが3件未満（ヒューリスティックの取りこぼしを疑う）: ${leaves.length}`,
  );
  return leaves;
}

/**
 * 正規表現メタ文字をエスケープする。
 *
 * @param text - リテラルとしてマッチングしたい文字列
 * @returns エスケープ済みパターン文字列
 */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * コマンド本文から「実行順序と状態遷移（呼出側の概要）」セクションを切り出す。
 *
 * @param command - コマンド本文
 * @param name - エラーメッセージ用識別子
 * @returns セクションテキスト（概要見出しから次の ## まで）
 */
function overviewSection(command: string, name: string): string {
  const start = command.indexOf("## 実行順序と状態遷移（呼出側の概要）");
  assert(start >= 0, `${name}.md missing phase overview section`);
  const rest = command.slice(start);
  const nextH2 = rest.indexOf("\n## ", 1);
  return nextH2 >= 0 ? rest.slice(0, nextH2) : rest;
}

/**
 * AC3: 本文は呼出側の概要セクションを持ち、wf の全リーフェーズが**表行として**
 * 網羅される。@ 参照は実在ファイルで、「単一の正」「内部操作に踏み込まない」宣言を
 * 含み、fenced コードブロック（内部手順の転記と見なす）を含まない。
 */
Deno.test("AC3 body covers caller-side phases and references workflow only", async () => {
  for (const file of await listWorkflowFiles()) {
    const name = baseName(file);
    const [command, workflow] = await Promise.all([
      readTarget(commandPath(name)),
      readTarget(workflowPath(file)),
    ]);
    const overview = overviewSection(command, name);
    assert(
      command.includes(`@.agents/workflows/${file}`),
      `${name}.md missing @ reference to workflow file`,
    );
    assert(
      (await Deno.stat(workflowPath(file))).isFile,
      `${name}.md @ reference target does not exist: ${file}`,
    );
    assert(command.includes("単一の正"), `${name}.md missing single-source-of-truth declaration`);
    assert(command.includes("内部操作"), `${name}.md missing no-internals declaration`);
    for (const label of leafPhaseTitles(workflow, name)) {
      const rowRe = new RegExp(`^\\|[^\\n]*${escapeRegExp(label)}[^\\n]*\\|`, "m");
      assert(rowRe.test(overview), `${name}.md phase table row missing: ${label}`);
    }
    assert(
      !/^```/m.test(command),
      `${name}.md must not transcribe skill internals (fenced blocks)`,
    );
  }
});

/**
 * AC4: 各コマンド本文は STOP マーカーが AI への指示表記であり PO 指示まで
 * 先読みしない旨を宣言する（ワークフロー側の STOP 構造不変は基線テストが担保）。
 */
Deno.test("AC4 body declares STOP markers remain AI-facing instructions", async () => {
  for (const file of await listWorkflowFiles()) {
    const name = baseName(file);
    const command = await readTarget(commandPath(name));
    assert(command.includes("`<!-- STOP -->`"), `${name}.md must quote the STOP marker`);
    assert(command.includes("Opencode の機能ではなく"), `${name}.md misdescribes STOP semantics`);
    assert(command.includes("先読み"), `${name}.md must forbid lookahead before PO instruction`);
  }
});

/**
 * AC5: 各コマンド本文は、並行実行を要する個所ではスキル側がサブエージェントの
 * 作成・実行を明示的に行う方針（コマンド自身は起動しない）を宣言する。
 */
Deno.test("AC5 body declares in-skill subagent policy", async () => {
  for (const file of await listWorkflowFiles()) {
    const name = baseName(file);
    const command = await readTarget(commandPath(name));
    assert(command.includes("サブエージェント"), `${name}.md missing subagent policy`);
    assert(
      command.includes("コマンド自身はサブエージェントを起動せず"),
      `${name}.md must state the command itself does not spawn subagents`,
    );
  }
});

/**
 * コマンド本文から「## 遵守事項」の箇条書き項目を抽出する。
 *
 * @param command - コマンド本文
 * @returns 箇条書きテキストの配列（接頭辞 "- " 除去済み）
 */
function complianceItems(command: string): string[] {
  const start = command.indexOf("## 遵守事項");
  if (start < 0) {
    return [];
  }
  return command
    .slice(start)
    .split("\n")
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2));
}

/**
 * コマンド間一貫性ガード: 遵守事項は全コマンドで同一（ただし各項目末尾の全角括弧内は
 * wf 個別補足として許容し、除去して比較する）。H1 タイトルは
 * 「# /<name> — <タイトル>」書式で、余分な括弧接尾を含まないこと。
 */
Deno.test("commands share identical compliance items and H1 format", async () => {
  const strip = (item: string): string => item.replace(/（[^（）]*）。?\s*$/, "").trim();
  let canonical: string[] | null = null;
  for (const file of await listWorkflowFiles()) {
    const name = baseName(file);
    const command = await readTarget(commandPath(name));
    const items = complianceItems(command).map(strip);
    assert(items.length === 3, `${name}.md must have exactly 3 compliance items`);
    const h1 = command.match(/^# (.+)$/m)?.[1] ?? "";
    assert(h1.startsWith(`/${name} — `), `${name}.md H1 must start with "/${name} — "`);
    assert(
      !h1.includes("(") && !h1.includes("（"),
      `${name}.md H1 must not carry a parenthetical suffix: ${h1}`,
    );
    if (canonical === null) {
      canonical = items;
    } else {
      assertEquals(
        items,
        canonical,
        `${name}.md compliance items drifted from the shared template`,
      );
    }
  }
});
