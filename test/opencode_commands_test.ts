/**
 * WP #726 ワークフロー統合（.opencode/commands 集約）検証テスト。
 *
 * 単一の正は `.opencode/commands/*.md` 8本。`.agents/workflows/` は削除済みのため参照しない。
 *
 * fencedコードブロック禁止を設けない根拠:
 * 新構造は自己完結手順であり、コードブロック自体が正当な手順内容である
 * （例: project-setup.md の6件のフェンスマーカー＝3ブロックの認証・クローン手順）。
 * 旧禁止は「ラッパーがスキル内部操作を転記すること」を対象としたものであり、
 * ラッパー廃止により前提が消滅したため、禁止テストは復活させない。
 *
 * ワークフロー追加時の更新手順（プレイブック）:
 *   1. `.opencode/commands/<name>.md` を既存コマンドの複製で作成し、自己完結した手順
 *      （STOPマーカー・フェーズ見出しを持ち、`@.agents/workflows/` 参照を持たない）とする。
 *      末尾に `## 遵守事項` 3項（共有テンプレートと一字一句同一）を付与する。
 *   2. 新規コマンドの `<!-- STOP -->` 数を `rg -o '<!-- STOP -->' | wc -l` で実測し、
 *      STOP_BASELINE へ登録する（未登録はレジストリテストが失敗させる）。
 *   3. コマンド本文は frontmatter（description 非空・subtask:false の2キーのみ）の構造を維持し、
 *      新規 description を FRONTMATTER_SNAPSHOT へ登録する。
 *   4. 新規コマンドのリーフフェーズ見出し一覧を PHASE_SNAPSHOT へ登録する。
 *   5. 新規コマンドの `/.opencode/agents/`・`/.agents/skills/` 参照件数を実測し、
 *      ROLE_LINK_COUNTS・SKILL_LINK_COUNTS へ登録する。
 *   6. 新規にロール定義を参照する場合は `/.opencode/agents/<role>.md` 実在下のみ可。
 * 反復集合は commands ディレクトリの動的走査から駆動されるため、追加で編集が必要な箇所は
 * ②③④⑤のみ。
 */
import { assert, assertEquals } from "@std/assert";
import { parse } from "@std/yaml";

const ROOT = new URL("../", import.meta.url).pathname;
const COMMANDS_DIR = `${ROOT}.opencode/commands`;

/**
 * 介入2でロールリンク置換を行ったスキル側ファイル（コマンド以外）。
 */
const SKILL_LINK_FILES: string[] = [
  `${ROOT}.agents/skills/bundles/git-bundle/hybrid-triage-commit/references/hybrid-triage-commit-process.md`,
  `${ROOT}.agents/skills/bundles/management-bundle/session-planning/SKILL.md`,
];

/**
 * コマンド別の `<!-- STOP -->` 数ベースライン（2026-09-12 実測・旧 wf 値と同数）。
 * 合計58。AC4「STOPマーカーは変更不要」の機械的担保。コマンド追加時はプレイブック②で登録し、
 * レジストリテストが commands 実走査との集合同値を強制する。
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
 * コマンド別の frontmatter description ベースライン（2026-09-13 実測・原文完全一致）。
 * 旧 AC2 の厳密性（原文一致）を commands 単体に対して復活させる。
 * description 変更時は本スナップショットとコマンド本文を同時に更新する。
 */
const FRONTMATTER_SNAPSHOT: Record<string, string> = {
  "kickoff.md":
    "プロジェクトの立ち上げ（キックオフ）を、情熱の検証から技術選定まで段階的に行い、開発開始の合意を形成するワークフロー。",
  "project-setup.md":
    "新規プロジェクト発足と既存プロジェクト参加の両方を統合し、リポジトリ準備からプロセス統一までの一貫したセットアップを行うワークフロー。",
  "refactoring.md": "メトリクスとテストに基づく安全な構造改善サイクル",
  "session-end.md": "セッションの成果を要約し、内省（KPT）とメトリクス記録を行うセッション終了儀式",
  "session-start.md":
    "価値観同期・Work Package特定・戦略策定を段階的に行う高度なセッション開始儀式",
  "sprint-end.md":
    "スプリントの終了プロセス（レビューのアーカイブ、effort分析、サイズ確定、スプリントKPT記録、ベロシティ記録、スプリント評価記録、振り返りのアーカイブ、完了PBI/WPのアーカイブ、自己スキル最適化、スプリント終了、ステートレスリセット）を安全に1ステップずつ実行するワークフロー。",
  "sprint-review.md": "スプリントレビューを意識合わせから検証実行まで段階的に行うワークフロー",
  "sprint-start.md":
    "スプリントの開始プロセス（プロダクトゴール確認、プロダクトバックログリファインメント、分類階層改善、スプリント開始宣言、スプリントプランニング、作業分解、レビュー計画、振り返りの計画）を安全に1ステップずつ実行するワークフロー。",
};

/**
 * コマンド別のリーフフェーズ見出しベースライン（2026-09-13 実測・正規化済み完全一致）。
 * 旧 leafPhaseTitles 相当のロジックで抽出する。
 * フェーズ増減時は本スナップショットとコマンド本文を同時に更新する。
 */
const PHASE_SNAPSHOT: Record<string, string[]> = {
  "kickoff.md": [
    "Phase 0. 構想と情熱の検証",
    "Phase 1. ビジョンの策定",
    "Phase 2. プロダクトゴールの定義",
    "Phase 3. エピック/フィーチャー分類階層の設計",
    "Phase 4. 技術スタックの選定",
    "Phase 5. アライメントの最終検証",
  ],
  "project-setup.md": [
    "1-1. ホスト環境構築",
    "1-2. 前提要件チェック",
    "1-3. 認証設定",
    "1-4. SSH鍵の生成と登録",
    "1-5. リポジトリの確保",
    "2-1. ルールの同期",
    "2-2. スキルの同期",
    "3-1. 通信経路の疎通確認",
  ],
  "refactoring.md": [
    "1-1. 事前メトリクスの測定",
    "1-2. テストの健全性確認（中止判断）",
    "2-1. 実行環境のセットアップ",
    "2-2. 作業ブランチの作成",
    "3-1. 安全な変更の適用とWIP保存",
    "4-1. 厳格な回帰テスト",
    "4-2. 事後メトリクスの測定と改善報告",
    "5-1. コミット履歴のトリアージと再構築",
    "5-2. PR作成と報告",
    "5-3. マージとクリーンアップ",
  ],
  "session-end.md": [
    "1-0. 用語の同期",
    "1-1. 実績effortの記録",
    "2-1. 共進化 KPT",
    "3-1. 協働メトリクスの記録",
    "4-1. WP完了",
    "4-2. セッションアーティファクトのクリーンアップ",
  ],
  "session-start.md": [
    "1-0. 用語の同期",
    "1-1. ビジョンと保有スキルの宣言",
    "2-1. 1セッション1Work Packageの絞り込み",
    "3-1. 専門家による詳細設計",
    "4-1. 計画の承認と WP着手",
  ],
  "sprint-end.md": [
    "Phase 1-0. 用語の同期",
    "Phase 1-1. スプリントレビューのアーカイブ",
    "Phase 2. PBI effort分析",
    "Phase 3. PBIサイズ実績の確定",
    "Phase 4. スプリントKPTの記録",
    "Phase 5. ベロシティ記録",
    "Phase 6. スプリント評価の記録",
    "Phase 7. 振り返りのアーカイブ",
    "Phase 8. 完了PBI/WPのアーカイブ",
    "Phase 9. 自己スキルオプティマイザー",
    "Phase 10. スプリント終了",
    "Phase 11. ステートレスリセットの検討",
  ],
  "sprint-review.md": [
    "Phase 1. スプリントレビューの意識合わせ",
    "Phase 2. アライメントチェック",
    "Phase 3. スプリントレビュー実行",
  ],
  "sprint-start.md": [
    "Phase 1-0. 用語の同期",
    "Phase 1-1. プロダクトゴールの確認",
    "Phase 2. プロダクトバックログリファインメント",
    "Phase 3. 分類階層の改善とPBI配置",
    "Phase 4. スプリント開始宣言",
    "Phase 5. スプリントプランニング",
    "Phase 6. 作業分解",
    "Phase 7. スプリントレビュー計画",
    "Phase 8. 振り返りの計画",
  ],
};

/**
 * コマンド別の `/.opencode/agents/` 参照件数ベースライン（2026-09-13 実測）。
 * 旧 total>=65 は削除と追加の相殺を素通りさせるため、ファイル別完全一致で検証する。
 */
const ROLE_LINK_COUNTS: Record<string, number> = {
  "kickoff.md": 6,
  "project-setup.md": 3,
  "refactoring.md": 10,
  "session-end.md": 6,
  "session-start.md": 4,
  "sprint-end.md": 14,
  "sprint-review.md": 6,
  "sprint-start.md": 14,
};

/**
 * コマンド別の `/.agents/skills/` 参照件数ベースライン（2026-09-13 実測）。
 * sprint-end.md の reset.ts スクリプト参照1件を含む。
 */
const SKILL_LINK_COUNTS: Record<string, number> = {
  "kickoff.md": 0,
  "project-setup.md": 7,
  "refactoring.md": 7,
  "session-end.md": 5,
  "session-start.md": 5,
  "sprint-end.md": 13,
  "sprint-review.md": 2,
  "sprint-start.md": 10,
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
 * .opencode/commands 直下のコマンドファイル名一覧（辞書順）。検証対象集合の単一の情報源。
 *
 * @returns `*.md` ファイル名の配列
 */
async function listCommandFiles(): Promise<string[]> {
  const names: string[] = [];
  for await (const entry of Deno.readDir(COMMANDS_DIR)) {
    if (entry.isFile && entry.name.endsWith(".md")) {
      names.push(entry.name);
    }
  }
  return names.sort();
}

/**
 * コマンドファイル名（`x.md`）から基底名 `x` を返す。
 *
 * @param file - `.md` 付きファイル名
 * @returns 拡張子を除いた基底名
 */
function baseName(file: string): string {
  return file.replace(/\.md$/, "");
}

/**
 * コマンド本文の絶対パスを返す。
 *
 * @param file - `.md` 付きコマンドファイル名
 * @returns COMMANDS_DIR 配下の絶対パス
 */
function commandPath(file: string): string {
  return `${COMMANDS_DIR}/${file}`;
}

/**
 * レジストリ不変条件: STOP_BASELINE のキー集合と commands ディレクトリの実走査結果が
 * 集合同値であること。新規コマンドの検証素通り（登録漏れ）を失敗として検出する。
 */
Deno.test("STOP baseline registry covers exactly the command set", async () => {
  const commands = await listCommandFiles();
  assertEquals(
    Object.keys(STOP_BASELINE).sort(),
    commands,
    "register new commands in STOP_BASELINE with the measured STOP marker count (playbook step 2)",
  );
});

/**
 * AC4不変条件: 各コマンドの `<!-- STOP -->` 数がベースラインと一致する。
 * 移植前 wf 値（合計58）と同数を commands 側で保証する。
 */
Deno.test("commands keep the STOP marker baseline (AC4 invariance)", async () => {
  for (const [file, expected] of Object.entries(STOP_BASELINE)) {
    const content = await readTarget(commandPath(file));
    const count = (content.match(/<!-- STOP -->/g) ?? []).length;
    assertEquals(
      count,
      expected,
      `${file} must keep exactly ${expected} STOP markers after edits`,
    );
  }
});

/**
 * 介入2残存参照ゼロ化ガード: 置換対象（commands 実走査＋スキル2本）にルート絶対パス
 * `/.agents/rules/` への参照が残っていないこと。相対表記の配置説明は対象外。
 */
Deno.test("role references to the removed .agents/rules dir are eliminated", async () => {
  const commands = await listCommandFiles();
  const targets = [...commands.map((file) => commandPath(file)), ...SKILL_LINK_FILES];
  for (const path of targets) {
    const content = await readTarget(path);
    assert(
      !content.includes("/.agents/rules/"),
      `${path} still references the removed /.agents/rules/ path`,
    );
  }
});

/**
 * 置換先の実在性: 対象中の /.opencode/agents/<role>.md 参照がすべて実ファイルへ
 * 解決すること。件数は ROLE_LINK_COUNTS でファイル別完全一致を検証する
 * （旧 total>=65 は削除と追加の相殺を素通りさせるマスク問題があるため）。
 */
Deno.test("replaced role links resolve to existing .opencode/agents files", async () => {
  const commands = await listCommandFiles();
  const targets = [...commands.map((file) => commandPath(file)), ...SKILL_LINK_FILES];
  for (const path of targets) {
    const content = await readTarget(path);
    for (const match of content.matchAll(/\/\.opencode\/agents\/([a-z-]+)\.md/g)) {
      const target = `${ROOT}.opencode/agents/${match[1]}.md`;
      assert(
        (await Deno.stat(target)).isFile,
        `${path} links to missing role definition: ${target}`,
      );
    }
  }
  for (const file of commands) {
    const content = await readTarget(commandPath(file));
    const count = [...content.matchAll(/\/\.opencode\/agents\/[a-z-]+\.md/g)].length;
    assertEquals(
      count,
      ROLE_LINK_COUNTS[file],
      `${file} must keep exactly ${ROLE_LINK_COUNTS[file]} role links`,
    );
  }
});

/**
 * スキル参照の実在性と件数: 対象中の /.agents/skills/ 参照がファイル別完全一致であること。
 * 削除と追加の相殺を素通りさせないため合計数の下限値ではなく件数一致で検証する。
 */
Deno.test("skill links match per-file counts", async () => {
  for (const file of await listCommandFiles()) {
    const content = await readTarget(commandPath(file));
    const count = [...content.matchAll(/\/\.agents\/skills\//g)].length;
    assertEquals(
      count,
      SKILL_LINK_COUNTS[file],
      `${file} must keep exactly ${SKILL_LINK_COUNTS[file]} skill links`,
    );
  }
});

/**
 * 自己完結性: 各コマンドは単一の正として自己完結した手順を持つ。
 * STOPマーカーとフェーズ見出し（`## `）を持ち、`@.agents/workflows/` 参照を持たないこと。
 * H1 は `# /<name> — <タイトル>` 書式であること。旧 AC1 鏡像対応の新構造相当ガード。
 */
Deno.test("commands are self-contained procedures", async () => {
  const commands = await listCommandFiles();
  assert(commands.length > 0, "no commands discovered; check COMMANDS_DIR");
  for (const file of commands) {
    const name = baseName(file);
    const content = await readTarget(commandPath(file));
    assert(
      content.includes("<!-- STOP -->"),
      `${name}.md must contain STOP markers as self-contained procedure`,
    );
    assert(
      /^##\s+.+/m.test(content),
      `${name}.md must have phase headings (## ...)`,
    );
    assert(
      !content.includes("@.agents/workflows/"),
      `${name}.md must not reference the removed @.agents/workflows/ path`,
    );
    const h1 = content.match(/^# (.+)$/m)?.[1] ?? "";
    assert(h1.startsWith(`/${name} — `), `${name}.md H1 must start with "/${name} — "`);
  }
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
 * 各コマンドは Opencode 形式 frontmatter（description）を持ち、
 * subtask:false が明示設定されている。キーは description/subtask の2つのみ、
 * description は非空文字列であること（比較対象の workflow 原文は存在しない）。
 */
Deno.test("frontmatter has non-empty description and explicit subtask:false", async () => {
  for (const file of await listCommandFiles()) {
    const name = baseName(file);
    const command = await readTarget(commandPath(file));
    const fm = parseFrontmatter(command);
    assertEquals(
      Object.keys(fm).sort(),
      ["description", "subtask"],
      `${name}.md must declare exactly description and subtask`,
    );
    assertEquals(fm.subtask, false, `${name}.md must set subtask: false explicitly`);
    assert(
      typeof fm.description === "string" && fm.description.length > 0,
      `${name}.md must have a non-empty description`,
    );
  }
});

/**
 * フェーズ見出しと認められるラベルの前置パターン（番号付き Phase / 数値番号）。
 */
const PHASE_LABEL_RE = /^(Phase [\d-]+|\d[\d.-]*\s)/;

/**
 * コマンド見出しテキストを正規化する。
 * 「Phase 2: 名称 (English)」型の半角括弧接尾（英語併記）を除去し、「: 」を「. 」へ揃える。
 * 全角括弧（例:「（中止判断）」）は意味内容を含むため保持する。
 *
 * @param heading - markdown 見出しのマーカー除去済みテキスト
 * @returns 正規化されたフェーズラベル
 */
function normalizePhaseLabel(heading: string): string {
  return heading.replace(": ", ". ").replace(/\s*\([^()]*\)\s*$/, "").trim();
}

/**
 * コマンド本文からリーフレベルのフェーズ見出しを抽出する。
 * ## 見出し直下に ### がある場合は ### のみを葉として採用（## はグループ扱い）。
 * 「ワークフローの進行ルール」「遵守事項」等の非フェーズ ## は葉に含めない。
 * 取りこぼしによる偽通過を許さないため、構造違反は失敗させる:
 *   - `####` 以上の見出し出現 → 即失敗
 *   - ## のない ### / フェーズラベルでない ### → orphans として収集し失敗
 *   - 抽出葉が3件未満（全コマンドの観測最小値）→ ヒューリスティック失効疑いで失敗
 *
 * @param content - コマンド本文
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
    `${label}: フェーズ見出し規約に違反する構造: ${orphans.join(" / ")}`,
  );
  assert(
    leaves.length >= 3,
    `${label}: 抽出リーフが3件未満（ヒューリスティックの取りこぼしを疑う）: ${leaves.length}`,
  );
  return leaves;
}

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
 * FRONTMATTER_SNAPSHOT 不変条件: 各コマンドの description が承認済み原文と完全一致する。
 * 旧 AC2 の厳密性（原文一致）を commands 単体スナップショットとして復活させる。
 */
Deno.test("frontmatter descriptions match the approved snapshot", async () => {
  const commands = await listCommandFiles();
  assertEquals(
    Object.keys(FRONTMATTER_SNAPSHOT).sort(),
    commands,
    "register new commands in FRONTMATTER_SNAPSHOT (playbook step 3)",
  );
  for (const file of commands) {
    const command = await readTarget(commandPath(file));
    const fm = parseFrontmatter(command);
    assertEquals(
      fm.description,
      FRONTMATTER_SNAPSHOT[file],
      `${file} description drifted from the approved snapshot`,
    );
  }
});

/**
 * PHASE_SNAPSHOT 不変条件: 各コマンドのリーフフェーズ見出し一覧が承認済みと完全一致する。
 * 旧 leafPhaseTitles 相当のロジックを commands 向けに復活させた厳密ガード。
 */
Deno.test("commands keep the approved leaf phase baseline", async () => {
  const commands = await listCommandFiles();
  assertEquals(
    Object.keys(PHASE_SNAPSHOT).sort(),
    commands,
    "register new commands in PHASE_SNAPSHOT (playbook step 4)",
  );
  for (const file of commands) {
    const command = await readTarget(commandPath(file));
    assertEquals(
      leafPhaseTitles(command, file),
      PHASE_SNAPSHOT[file],
      `${file} leaf phases drifted from the approved snapshot`,
    );
  }
});

/**
 * 遵守事項の一貫性: 8本同一3項＋STOP/単一の正/内部操作/サブエージェント宣言。
 * 第1項は計数干渉回避のためリテラルでなく「STOP マーカー」と表記する。
 */
Deno.test("commands share identical compliance items and declare STOP/subagent policy", async () => {
  const commands = await listCommandFiles();
  assert(commands.length > 0, "no commands discovered; check COMMANDS_DIR");
  let canonical: string[] | null = null;
  for (const file of commands) {
    const name = baseName(file);
    const command = await readTarget(commandPath(file));
    const items = complianceItems(command);
    assertEquals(items.length, 3, `${name}.md must have exactly 3 compliance items`);
    if (canonical === null) {
      canonical = items;
    } else {
      assertEquals(
        items,
        canonical,
        `${name}.md compliance items drifted from the shared template`,
      );
    }
    assert(command.includes("STOP"), `${name}.md must mention the STOP marker`);
    assert(
      command.includes("Opencode の機能ではなく"),
      `${name}.md misdescribes STOP semantics`,
    );
    assert(command.includes("先読み"), `${name}.md must forbid lookahead before PO instruction`);
    assert(command.includes("単一の正"), `${name}.md must declare the single source of truth`);
    assert(command.includes("内部操作"), `${name}.md must declare no-internals policy`);
    assert(command.includes("サブエージェント"), `${name}.md missing subagent policy`);
    assert(
      command.includes("コマンド自身はサブエージェントを起動せず"),
      `${name}.md must state the command itself does not spawn subagents`,
    );
  }
});
