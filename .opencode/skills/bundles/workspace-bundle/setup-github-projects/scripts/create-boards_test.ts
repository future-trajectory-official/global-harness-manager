/**
 * create-boards モジュールのテスト（WP #763 AC-1）。
 *
 * gh 呼出部は注入可能関数（BoardGhRunner）に分離し、本テストではモックで差し替える。
 * 実装前に失敗すること（RED）を確認するための先行テスト。
 */

import {
  assertEquals,
  assertMatch,
  assertRejects,
  assertStringIncludes,
  assertThrows,
} from "@std/assert";
import { BOARDS } from "../../../../../core/gateway/field-registry.ts";
import {
  BOARD_TITLES,
  buildBoardsPlan,
  dryRunBoards,
  ensureBoards,
  parseCreateBoardsArgs,
  parseProjectCreateJson,
  parseProjectListJson,
  runCreateBoards,
} from "./create-boards.ts";
import type { HarnessRcBoards } from "./generate-harnessrc.ts";

/**
 * ユースケース: 存在するボードは再利用し作成しないこと
 * 検証意図: listBoards が全ボード番号を返した場合、createBoard が呼ばれず既存番号が返ることを確認する
 */
Deno.test("存在チェック→再利用分岐: 既存ボードは作成せず番号を再利用する", async () => {
  let createCalls = 0;
  const boards: HarnessRcBoards = {
    productBacklog: 10,
    sprintBoard: 11,
    retrospectiveBoard: 12,
  };
  const result = await ensureBoards("test-owner", {
    listBoards: (_owner: string) =>
      Promise.resolve([
        { number: boards.productBacklog, name: "Product Backlog" },
        { number: boards.sprintBoard, name: "Sprint Board" },
        { number: boards.retrospectiveBoard, name: "Retrospective Board" },
      ]),
    createBoard: (_owner: string, _title: string) => {
      createCalls++;
      return Promise.resolve({ number: 999 });
    },
  });
  assertEquals(result, boards);
  assertEquals(createCalls, 0);
});

/**
 * ユースケース: 存在しないボードは作成すること
 * 検証意図: listBoards が空の場合、BOARDSキー固定の3ボードが作成され番号が返ることを確認する
 */
Deno.test("不存在→作成分岐: 存在しないボードは3キー固定で作成する", async () => {
  const createdTitles: string[] = [];
  let nextNumber = 20;
  const result = await ensureBoards("test-owner", {
    listBoards: (_owner: string) => Promise.resolve([]),
    createBoard: (_owner: string, title: string) => {
      createdTitles.push(title);
      return Promise.resolve({ number: nextNumber++ });
    },
  });
  assertEquals(result, {
    productBacklog: 20,
    sprintBoard: 21,
    retrospectiveBoard: 22,
  });
  assertEquals(createdTitles.length, 3);
  assertEquals(Object.keys(result).sort(), Object.values(BOARDS).sort());
});

/**
 * ユースケース: 実 `gh project list --format json` 出力をパースして3件検出すること
 * 検証意図: 実JSON（projects配下・余分な属性付き・番号順不同）から番号とタイトルを抽出できることを確認する
 */
Deno.test("実JSONパース: gh project list 出力から3ボードを検出する", () => {
  const raw = JSON.stringify({
    projects: [
      { number: 12, title: "Retrospective Board", closed: false, totalCount: 1 },
      { number: 11, title: "Sprint Board", closed: false },
      { number: 10, title: "Product Backlog", closed: false },
    ],
    totalCount: 3,
  });
  const parsed = parseProjectListJson(raw);
  assertEquals(parsed.length, 3);
  const byName = new Map(parsed.map((board) => [board.name, board.number]));
  assertEquals(byName.get("Product Backlog"), 10);
  assertEquals(byName.get("Sprint Board"), 11);
  assertEquals(byName.get("Retrospective Board"), 12);
});

/**
 * ユースケース: 1件欠落時は欠落分のみ作成すること
 * 検証意図: 2件既存＋1件不在の場合、作成呼出が1件・対象タイトルのみであることを確認する
 */
Deno.test("部分欠落→作成分岐: 欠落した1ボードのみ作成する", async () => {
  const createdTitles: string[] = [];
  const result = await ensureBoards("test-owner", {
    listBoards: (_owner: string) =>
      Promise.resolve([
        { number: 10, name: "Product Backlog" },
        { number: 12, name: "Retrospective Board" },
      ]),
    createBoard: (_owner: string, title: string) => {
      createdTitles.push(title);
      return Promise.resolve({ number: 11 });
    },
  });
  assertEquals(result, {
    productBacklog: 10,
    sprintBoard: 11,
    retrospectiveBoard: 12,
  });
  assertEquals(createdTitles, ["Sprint Board"]);
});

/**
 * ユースケース: ボードキー→タイトル対応がBOARDSキー固定で解決できること
 * 検証意図: タイトル直書きの散在防止（単一マップ集約）を確認する
 */
Deno.test("キー→タイトル対応: BOARDSキー固定の3対応が解決できる", () => {
  assertEquals(BOARD_TITLES, {
    productBacklog: "Product Backlog",
    sprintBoard: "Sprint Board",
    retrospectiveBoard: "Retrospective Board",
  });
  assertEquals(Object.keys(BOARD_TITLES).sort(), Object.values(BOARDS).sort());
});

/**
 * ユースケース: CLI引数から --owner / --dry-run を解決できること
 * 検証意図: フラグ形式と位置引数の両方で所有者を特定できることを確認する
 */
Deno.test("引数解析: --ownerと--dry-runを解決する", () => {
  assertEquals(parseCreateBoardsArgs(["--owner", "test-owner", "--dry-run"]), {
    owner: "test-owner",
    repo: null,
    dryRun: true,
    help: false,
  });
  assertEquals(parseCreateBoardsArgs(["test-owner"]), {
    owner: "test-owner",
    repo: null,
    dryRun: false,
    help: false,
  });
  assertEquals(parseCreateBoardsArgs(["--help"]), {
    owner: "",
    repo: null,
    dryRun: false,
    help: true,
  });
});

/**
 * ユースケース: 実行計画を純関数で組み立てられること
 * 検証意図: 全存在時は再利用3件・作成0件、1件欠落時は再利用2件・作成1件になることを確認する
 */
Deno.test("実行計画: 既存件数に応じた再利用・作成件数を組み立てる", () => {
  const full = buildBoardsPlan([
    { number: 10, name: "Product Backlog" },
    { number: 11, name: "Sprint Board" },
    { number: 12, name: "Retrospective Board" },
  ]);
  assertEquals(full.reuseCount, 3);
  assertEquals(full.createCount, 0);
  assertEquals(full.boards, {
    productBacklog: 10,
    sprintBoard: 11,
    retrospectiveBoard: 12,
  });

  const partial = buildBoardsPlan([
    { number: 10, name: "Product Backlog" },
    { number: 12, name: "Retrospective Board" },
  ]);
  assertEquals(partial.reuseCount, 2);
  assertEquals(partial.createCount, 1);
  assertMatch(partial.lines.join("\n"), /Sprint Board/);
});

/**
 * ユースケース: --dry-run は作成呼出なしで再利用3件・作成0件の計画を出すこと
 * 検証意図: 実ボード新規作成の副作用なしに計画と番号JSONが得られることを確認する
 */
Deno.test("--dry-run: 作成呼出なしで再利用計画と番号JSONを返す", async () => {
  let createCalls = 0;
  const output = await dryRunBoards("test-owner", {
    listBoards: (_owner: string) =>
      Promise.resolve([
        { number: 10, name: "Product Backlog" },
        { number: 11, name: "Sprint Board" },
        { number: 12, name: "Retrospective Board" },
      ]),
    createBoard: (_owner: string, _title: string) => {
      createCalls++;
      return Promise.resolve({ number: 999 });
    },
  });
  assertEquals(createCalls, 0);
  assertStringIncludes(output, "再利用3件");
  assertStringIncludes(output, "作成0件");
  assertStringIncludes(output, '"productBacklog": 10');
});

/**
 * ユースケース: --dry-run は部分欠落時も作成呼出なしで計画を出すこと
 * 検証意図: 1件欠落時も createBoard が呼ばれず、作成1件の計画になることを確認する
 */
Deno.test("--dry-run部分欠落: 作成呼出なしで作成1件の計画を返す", async () => {
  let createCalls = 0;
  const output = await dryRunBoards("test-owner", {
    listBoards: (_owner: string) =>
      Promise.resolve([
        { number: 10, name: "Product Backlog" },
        { number: 12, name: "Retrospective Board" },
      ]),
    createBoard: (_owner: string, _title: string) => {
      createCalls++;
      return Promise.resolve({ number: 999 });
    },
  });
  assertEquals(createCalls, 0);
  assertStringIncludes(output, "再利用2件");
  assertStringIncludes(output, "作成1件");
  assertMatch(output, /Sprint Board/);
});

/**
 * ユースケース: 不正JSONの gh project list 出力は拒否すること
 * 検証意図: parseProjectListJson が不正JSONで Error を投げることを確認する
 */
Deno.test("異常系: parseProjectListJson が不正JSONでErrorを投げる", () => {
  assertThrows(
    () => parseProjectListJson("{not-json}"),
    Error,
    "JSON 形式が不正",
  );
});

/**
 * ユースケース: 未知の --* フラグは実作成へ進まず拒否すること
 * 検証意図: --dryrun 等のタイポ時に Error を投げることを確認する
 */
Deno.test("異常系: 未知の --* フラグでErrorを投げる", () => {
  assertThrows(
    () => parseCreateBoardsArgs(["--dryrun"]),
    Error,
    "未知のオプション",
  );
  assertThrows(
    () => parseCreateBoardsArgs(["--owner", "test-owner", "--bogus"]),
    Error,
    "--bogus",
  );
});

/**
 * ユースケース: 余剰の位置引数は利用法エラーになること
 * 検証意図: 2件目以降の位置引数で Error を投げることを確認する
 */
Deno.test("異常系: 余剰の位置引数でErrorを投げる", () => {
  assertThrows(
    () => parseCreateBoardsArgs(["owner-a", "owner-b"]),
    Error,
    "余剰",
  );
  assertThrows(
    () => parseCreateBoardsArgs(["--owner", "owner-a", "owner-b"]),
    Error,
    "余剰",
  );
});

/**
 * ユースケース: --owner の値欠落は拒否すること
 * 検証意図: フラグのみで終端した場合に Error を投げることを確認する
 */
Deno.test("異常系: --owner の値欠落でErrorを投げる", () => {
  assertThrows(
    () => parseCreateBoardsArgs(["--owner"]),
    Error,
    "--owner の値",
  );
});

/**
 * ユースケース: 所有者空文字では作成・計画のいずれも実行しないこと
 * 検証意図: runCreateBoards／dryRunBoards が空文字 owner を日本語文言で拒否することを確認する
 */
Deno.test("異常系: owner空文字では作成・計画を実行しない", async () => {
  await assertRejects(
    () =>
      runCreateBoards("", {
        listBoards: (_owner: string) => Promise.resolve([]),
        createBoard: (_owner: string, _title: string) => Promise.resolve({ number: 1 }),
      }),
    Error,
    "所有者",
  );
  await assertRejects(
    () =>
      dryRunBoards("", {
        listBoards: (_owner: string) => Promise.resolve([]),
        createBoard: (_owner: string, _title: string) => Promise.resolve({ number: 1 }),
      }),
    Error,
    "所有者",
  );
});

/**
 * ユースケース: gh project create 出力から番号を抽出できること
 * 検証意図: parseProjectCreateJson が正常系で番号を返し、不正JSON・番号欠落で
 * Error を投げることを確認する（既定実装の番号欠落ガードの純関数抽出）
 */
Deno.test("gh create出力解析: 番号を抽出し不正時はErrorを投げる", () => {
  assertEquals(parseProjectCreateJson('{"number":42}'), { number: 42 });
  assertThrows(
    () => parseProjectCreateJson("{not-json}"),
    Error,
    "JSON 形式が不正",
  );
  assertThrows(
    () => parseProjectCreateJson("{}"),
    Error,
    "番号が含まれていません",
  );
});
