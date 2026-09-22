/**
 * generate-harnessrc モジュールのテスト。
 */

import { assert, assertEquals, assertThrows } from "@std/assert";
import { join } from "@std/path";
import { HARNESS_FIELDS } from "../../../../../core/gateway/field-registry.ts";
import {
  loadHarnessRcConfig,
  resolveHarnessRcPath,
} from "../../../../../core/shared/account/harnessrc-resolver.ts";
import {
  accountNameFromIdentities,
  DEFAULT_OUT_PATH,
  deriveBoardOwner,
  generateHarnessRc,
  parseArgs,
  parseBoardsJson,
  resolveRepoAccount,
  runGenerateHarnessRc,
} from "./generate-harnessrc.ts";

const boards = {
  productBacklog: 10,
  sprintBoard: 11,
  retrospectiveBoard: 12,
};

/** `.harnessrc.example` の fields キー集合を読み取る（テンプレートの `<number>` を 0 に置換してパース）。 */
function exampleFieldsKeys(): Set<string> {
  const raw = Deno.readTextFileSync(".github/schemas/.harnessrc.example");
  const normalized = raw.replaceAll("<number>", "0");
  const parsed = JSON.parse(normalized) as { fields: Record<string, string> };
  return new Set(Object.keys(parsed.fields));
}

/**
 * ユースケース: generateHarnessRc が .harnessrc.example と同構成の .harnessrc を生成すること
 * 検証意図: projects 3キーと fields 等値マップを含む有効な JSON 文字列が返ることを確認する
 */
Deno.test("AC-1: projects 3キーと fields（HARNESS_FIELDS と同数）を含む JSON 文字列を生成する", () => {
  const json = generateHarnessRc(boards);
  const parsed = JSON.parse(json) as Record<string, unknown>;

  const projects = parsed.projects as Record<string, number>;
  assertEquals(projects, { productBacklog: 10, sprintBoard: 11, retrospectiveBoard: 12 });

  const fields = parsed.fields as Record<string, string>;
  assertEquals(Object.keys(fields).length, HARNESS_FIELDS.length);
  assertEquals(Object.keys(fields).sort(), [...HARNESS_FIELDS].sort());
  for (const name of HARNESS_FIELDS) {
    assertEquals(fields[name], name);
  }
});

/**
 * ユースケース: 生成物の fields キー集合が .harnessrc.example と一致すること（ドリフト防止）
 * 検証意図: HARNESS_FIELDS とのトートロジーに留めず、実例ファイルの fields キー集合と
 * 一致することをもってキー構成の公開先との乖離を検出する
 */
Deno.test("AC-1: fields キー集合が .harnessrc.example と一致する", () => {
  const json = generateHarnessRc(boards);
  const parsed = JSON.parse(json) as Record<string, unknown>;
  const fields = parsed.fields as Record<string, string>;
  assertEquals(new Set(Object.keys(fields)), exampleFieldsKeys());
});

/**
 * ユースケース: 生成物が loadHarnessRcConfig で projects/fields を正しく読み取れること
 * 検証意図: 生成した .harnessrc が Gateway 層の読み込みに耐えることを確認する
 */
Deno.test("AC-1: 生成物が loadHarnessRcConfig で projects/fields を正しく読み取れること", () => {
  const json = generateHarnessRc(boards);
  const temp = Deno.makeTempDirSync();
  const path = `${temp}/.harnessrc`;
  Deno.writeTextFileSync(path, json);
  try {
    const config = loadHarnessRcConfig(path);
    assert(config !== null);
    assertEquals(config.projects.productBacklog, 10);
    assertEquals(config.projects.sprintBoard, 11);
    assertEquals(config.projects.retrospectiveBoard, 12);
    assertEquals(config.fields["harness-size-estimate"], "harness-size-estimate");
  } finally {
    Deno.removeSync(temp, { recursive: true });
  }
});

/**
 * ユースケース: _comment を先頭に含む（実 .harnessrc と同構造）
 * 検証意図: 生成物がメタ情報コメントを保持することを確認する
 */
Deno.test("AC-1: _comment を先頭に含む（実 .harnessrc と同構造）", () => {
  const json = generateHarnessRc(boards);
  const parsed = JSON.parse(json) as Record<string, unknown>;
  assert(typeof parsed._comment === "string");
  assert((parsed._comment as string).length > 0);
});

/**
 * ユースケース: 対象リポジトリ毎に --out で生成でき、アカウント特定結果が _comment に反映される
 * 検証意図: AC-3 のアカウント特定（--repo）が生成フローへ接続され、ボード所有者と
 * 認証アカウントが生成物に反映されることを確認する
 */
Deno.test("AC-2: 対象リポジトリ毎に --out で生成できる（マルチアカウント対応）", () => {
  const temp = Deno.makeTempDirSync();
  try {
    const out = join(temp, ".github", "schemas", ".harnessrc");
    const msg = runGenerateHarnessRc(
      [
        "--boards-json",
        JSON.stringify(boards),
        "--out",
        out,
        "--repo",
        "future-trajectory-official/global-harness-manager",
      ],
      () => ({ accountName: "future-trajectory", verified: true, guidance: null }),
    );
    assertEquals(msg, `[OK] wrote ${out}`);
    const config = loadHarnessRcConfig(out);
    assert(config !== null);
    assertEquals(config.projects.productBacklog, 10);
    assertEquals(Object.keys(config.fields).length, HARNESS_FIELDS.length);
    const parsed = JSON.parse(Deno.readTextFileSync(out)) as { _comment: string };
    assert(parsed._comment.includes("ボード所有者: future-trajectory-official"));
    assert(parsed._comment.includes("認証アカウント: future-trajectory"));
  } finally {
    Deno.removeSync(temp, { recursive: true });
  }
});

/**
 * ユースケース: 既定出力先は .github/schemas/.harnessrc（resolver候補と一致）
 * 検証意図: 慣例パスが resolver の候補と一致することを確認する
 */
Deno.test("AC-2: 既定出力先は .github/schemas/.harnessrc（resolver候補と一致）", () => {
  assertEquals(DEFAULT_OUT_PATH, join(".github", "schemas", ".harnessrc"));
});

/**
 * ユースケース: --dry-run はファイルへ書かず標準出力に JSON を返す
 * 検証意図: 出力先なしで生成物の内容を確認できることを確認する
 */
Deno.test("AC-2: --dry-run はファイルへ書かず標準出力に JSON を返す", () => {
  const msg = runGenerateHarnessRc([
    "--boards-json",
    JSON.stringify(boards),
    "--dry-run",
  ]);
  const parsed = JSON.parse(msg) as Record<string, unknown>;
  assert(parsed.projects !== undefined);
  assert(parsed.fields !== undefined);
});

/**
 * ユースケース: --repo 未指定時は生成物にボード所有者・認証アカウントを反映しない
 * 検証意図: owner=null で _comment にメタ情報が追加されないことを確認する
 */
Deno.test("AC-2: --repo 未指定時は _comment にアカウント情報を含めない", () => {
  const json = generateHarnessRc(boards, { owner: null, accountName: null, verified: false });
  const parsed = JSON.parse(json) as { _comment: string };
  assert(!parsed._comment.includes("ボード所有者"));
  assert(!parsed._comment.includes("認証アカウント"));
});

/**
 * ユースケース: 組織所有リポジトリのボード所有者は組織名を返す
 * 検証意図: deriveBoardOwner がオーナーを正しく抽出することを確認する
 */
Deno.test("AC-3: 組織所有リポジトリのボード所有者は組織名を返す", () => {
  assertEquals(
    deriveBoardOwner("future-trajectory-official/global-harness-manager"),
    "future-trajectory-official",
  );
});

/**
 * ユースケース: 個人所有リポジトリのボード所有者は個人アカウントを返す
 * 検証意図: deriveBoardOwner が個人アカウントも正しく抽出することを確認する
 */
Deno.test("AC-3: 個人所有リポジトリのボード所有者は個人アカウントを返す", () => {
  assertEquals(deriveBoardOwner("dev-user/my-private-repo"), "dev-user");
});

/**
 * ユースケース: owner/repo 形式でない入力は null を返す
 * 検証意図: 不正入力時に null を返す境界を確認する
 */
Deno.test("AC-3: owner/repo 形式でない入力は null を返す", () => {
  assertEquals(deriveBoardOwner("not-a-repo"), null);
});

const identitiesMd = `## GHM
- **Repository**: https://github.com/future-trajectory-official/global-harness-manager
- **Account Name**: future-trajectory

## private
- **Repository**: https://github.com/dev-user/my-private-repo
- **Account Name**: dev-user
`;

/**
 * ユースケース: identities.md 照合で組織リポジトリの Account Name を特定する
 * 検証意図: accountNameFromIdentities が組織リポジトリを正しく照合することを確認する
 */
Deno.test("AC-3: identities.md 照合で組織リポジトリの Account Name を特定する", () => {
  assertEquals(
    accountNameFromIdentities("future-trajectory-official/global-harness-manager", identitiesMd),
    "future-trajectory",
  );
});

/**
 * ユースケース: identities.md 照合で個人リポジトリの Account Name を特定する
 * 検証意図: accountNameFromIdentities が個人リポジトリを正しく照合することを確認する
 */
Deno.test("AC-3: identities.md 照合で個人リポジトリの Account Name を特定する", () => {
  assertEquals(accountNameFromIdentities("dev-user/my-private-repo", identitiesMd), "dev-user");
});

/**
 * ユースケース: 未登録リポジトリは Account Name を返さない
 * 検証意図: 対応表に無いリポジトリを null で返すことを確認する
 */
Deno.test("AC-3: 未登録リポジトリは Account Name を返さない", () => {
  assertEquals(accountNameFromIdentities("unknown-org/unknown-repo", identitiesMd), null);
});

/**
 * ユースケース: resolveRepoAccount がボード所有者と認証アカウントを区別する
 * 検証意図: owner（リポジトリのオーナー）と accountName（認証アカウント）が別物として返ることを確認する
 */
Deno.test("AC-3: resolveRepoAccount がボード所有者と認証アカウントを区別する", () => {
  const result = resolveRepoAccount("future-trajectory-official/global-harness-manager", () => ({
    accountName: "future-trajectory",
    verified: true,
    guidance: null,
  }));
  assertEquals(result.owner, "future-trajectory-official");
  assertEquals(result.accountName, "future-trajectory");
  assertEquals(result.verified, true);
  assertEquals(result.guidance, null);
});

/**
 * ユースケース: --repo 未指定時は owner/accountName とも null
 * 検証意図: 対象外（repo=null）の場合はすべて null を返すことを確認する
 */
Deno.test("AC-3: --repo 未指定時は owner/accountName とも null", () => {
  const result = resolveRepoAccount(null, () => ({
    accountName: "x",
    verified: false,
    guidance: null,
  }));
  assertEquals(result.owner, null);
  assertEquals(result.accountName, null);
});

/**
 * ユースケース: 既定リゾルバが repo と identitiesText から Account Name を照合し gh 検証する
 * 検証意図: resolveRepoAccount の既定経路（identitiesText を明示注入）でアカウント特定が機能する
 * ことを確認する（gh auth 検証結果は環境依存のため guidance の有無のみ確認）
 */
Deno.test("AC-3: 既定リゾルバが repo と identitiesText から Account Name を照合する", () => {
  const result = resolveRepoAccount(
    "future-trajectory-official/global-harness-manager",
    (repo, _text) => {
      const account = accountNameFromIdentities(repo, identitiesMd);
      return {
        accountName: account,
        verified: account !== null,
        guidance: account === null ? "対象外" : null,
      };
    },
  );
  assertEquals(result.owner, "future-trajectory-official");
  assertEquals(result.accountName, "future-trajectory");
  assertEquals(result.verified, true);
  assertEquals(result.guidance, null);
});

/**
 * ユースケース: 生成物が resolveHarnessRcPath の候補（HARNESS_RC_PATH）から読める
 * 検証意図: 生成した .harnessrc が resolver の候補パスから読み込み可能であることを確認する
 */
Deno.test("AC-4: 生成物が resolveHarnessRcPath の候補（HARNESS_RC_PATH）から読める", () => {
  const temp = Deno.makeTempDirSync();
  try {
    const out = join(temp, ".harnessrc");
    Deno.writeTextFileSync(out, generateHarnessRc(boards));
    const path = resolveHarnessRcPath({
      env: (key) => (key === "HARNESS_RC_PATH" ? out : undefined),
      cwd: () => temp,
      workspaceRoot: () => temp,
      exists: (p) => {
        try {
          Deno.statSync(p);
          return true;
        } catch {
          return false;
        }
      },
    });
    assertEquals(path, out);
    const config = loadHarnessRcConfig(path);
    assert(config !== null);
    assertEquals(config.projects.productBacklog, 10);
  } finally {
    Deno.removeSync(temp, { recursive: true });
  }
});

/**
 * ユースケース: 生成物は .harnessrc.example と同構成（projects/fields）で設定切替に利用可能
 * 検証意図: projects キーと fields キー集合が公開先と一致することを確認する
 */
Deno.test("AC-4: 生成物は .harnessrc.example と同構成（projects/fields）で設定切替に利用可能", () => {
  const json = generateHarnessRc(boards);
  const parsed = JSON.parse(json) as Record<string, unknown>;
  const projects = parsed.projects as Record<string, number>;
  const fields = parsed.fields as Record<string, string>;
  assertEquals(Object.keys(projects).sort(), [
    "productBacklog",
    "retrospectiveBoard",
    "sprintBoard",
  ]);
  assertEquals(Object.keys(fields).length, HARNESS_FIELDS.length);
  assertEquals(new Set(Object.keys(fields)), exampleFieldsKeys());
});

/**
 * ユースケース: --boards-json に負値を渡した場合 parseBoardsJson がエラーを投げる
 * 検証意図: 3キーが正整数（>0）でない入力を拒否することを確認する
 */
Deno.test("M-4: 負値の --boards-json は parseBoardsJson が拒否する", () => {
  assertThrows(
    () => parseBoardsJson('{"productBacklog":-1,"sprintBoard":11,"retrospectiveBoard":12}'),
    Error,
    "正整数",
  );
});

/**
 * ユースケース: --boards-json に 0 を渡した場合 parseBoardsJson がエラーを投げる
 * 検証意図: 境界値 0 を拒否することを確認する
 */
Deno.test("M-4: 0 を含む --boards-json は parseBoardsJson が拒否する", () => {
  assertThrows(
    () => parseBoardsJson('{"productBacklog":0,"sprintBoard":11,"retrospectiveBoard":12}'),
    Error,
    "正整数",
  );
});

/**
 * ユースケース: --boards-json にキー欠落がある場合 parseBoardsJson がエラーを投げる
 * 検証意図: 3キーすべての必須を検証することを確認する
 */
Deno.test("M-4: キー欠落の --boards-json は parseBoardsJson が拒否する", () => {
  assertThrows(
    () => parseBoardsJson('{"productBacklog":10,"sprintBoard":11}'),
    Error,
    "retrospectiveBoard",
  );
});

/**
 * ユースケース: --boards-json に不正な JSON を渡した場合 parseBoardsJson がエラーを投げる
 * 検証意図: JSON 形式不正を明確なメッセージで拒否することを確認する
 */
Deno.test("M-4: 不正 JSON の --boards-json は parseBoardsJson が拒否する", () => {
  assertThrows(
    () => parseBoardsJson("{not-json}"),
    Error,
    "JSON 形式が不正",
  );
});

/**
 * ユースケース: --boards-json の値が欠落（フラグのみで終端）した場合 parseArgs がエラーを投げる
 * 検証意図: 値欠落を明示エラーにすることを確認する
 */
Deno.test("M-4: --boards-json の値欠落は parseArgs が拒否する", () => {
  assertThrows(
    () => parseArgs(["--boards-json"]),
    Error,
    "値",
  );
});

/**
 * ユースケース: runGenerateHarnessRc が不正な --boards-json を伝播し失敗する
 * 検証意図: CLI 入口で不正 JSON がエラーとなることを確認する
 */
Deno.test("M-4: runGenerateHarnessRc が不正な --boards-json を拒否する", () => {
  assertThrows(
    () => runGenerateHarnessRc(["--boards-json", "{bad"]),
    Error,
  );
});

/**
 * ユースケース: runGenerateHarnessRc が --boards-json 欠落を拒否する
 * 検証意図: 必須キー（productBacklog/sprintBoard/retrospectiveBoard）を列挙して拒否することを確認する
 */
Deno.test("M-4: runGenerateHarnessRc が --boards-json 欠落を拒否する", () => {
  assertThrows(
    () => runGenerateHarnessRc([]),
    Error,
    "productBacklog/sprintBoard/retrospectiveBoard",
  );
});

/**
 * ユースケース: --out の値が欠落（フラグのみで終端）した場合 parseArgs がエラーを投げる
 * 検証意図: 値欠落を明示エラーにすることを確認する
 */
Deno.test("Minor: --out の値欠落は parseArgs が拒否する", () => {
  assertThrows(
    () => parseArgs(["--boards-json", JSON.stringify(boards), "--out"]),
    Error,
    "値",
  );
});
