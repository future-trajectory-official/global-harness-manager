/**
 * gh-auth-env モジュールのテスト（WP #785 AC-1）。
 *
 * 対象アイデンティティの認証で gh を実行するため、hosts.yml から
 * ユーザー別トークンを抽出し、プロセス単位の GH_TOKEN 環境変数を構築する
 * 純関数を検証する。実 gh 呼出・実ファイルは使わない。
 */

import { assertEquals, assertMatch, assertThrows } from "@std/assert";
import {
  buildGhEnvForUser,
  parseHostsUserTokens,
  readHostsUserTokens,
  resolveGhEnvForAccount,
  resolveHostsPath,
  resolveRunnerResult,
  verifyTargetAuth,
} from "./gh-auth-env.ts";

const SAMPLE_HOSTS_YAML = `github.com:
    git_protocol: ssh
    users:
        future-trajectory:
            oauth_token: TOKEN_A
        purple-ocean-ego:
            oauth_token: TOKEN_B
    user: future-trajectory
    oauth_token: TOKEN_A
`;

/**
 * ユースケース: hosts.yml からユーザー別トークンを抽出できること
 * 検証意図: users配下の2ユーザーのトークンが取得できることを確認する
 */
Deno.test("hosts.yml解析: users配下のトークンをユーザー別に抽出する", () => {
  assertEquals(parseHostsUserTokens(SAMPLE_HOSTS_YAML), {
    "future-trajectory": "TOKEN_A",
    "purple-ocean-ego": "TOKEN_B",
  });
});

/**
 * ユースケース: usersが存在しないhosts.ymlでは空表が返ること
 * 検証意図: 不正・最小構成のYAMLでも例外なく空表を返すことを確認する
 */
Deno.test("hosts.yml解析: users不在時は空表を返す", () => {
  assertEquals(parseHostsUserTokens("github.com:\n    user: nobody\n"), {});
});

/**
 * ユースケース: 対象ユーザーのGH_TOKEN環境変数を構築できること
 * 検証意図: 第2アカウントのトークンがGH_TOKENに設定されることを確認する
 */
Deno.test("env構築: 対象ユーザーのトークンをGH_TOKENに設定する", () => {
  const tokens = parseHostsUserTokens(SAMPLE_HOSTS_YAML);
  assertEquals(buildGhEnvForUser(tokens, "purple-ocean-ego"), {
    GH_TOKEN: "TOKEN_B",
  });
});

/**
 * ユースケース: 未知ユーザーではenvを構築しないこと
 * 検証意図: トークン不在時はnullを返し、誤った認証で実行しないことを確認する
 */
Deno.test("env構築: 未知ユーザーの場合はnullを返す", () => {
  const tokens = parseHostsUserTokens(SAMPLE_HOSTS_YAML);
  assertEquals(buildGhEnvForUser(tokens, "unknown-user"), null);
});

/**
 * ユースケース: 対象アカウントのenv解決が成功すること
 * 検証意図: トークン表から第2アカウントのenvが取得できることを確認する
 */
Deno.test("env解決: 対象アカウントのenvを取得する", () => {
  const tokens = parseHostsUserTokens(SAMPLE_HOSTS_YAML);
  assertEquals(resolveGhEnvForAccount("purple-ocean-ego", tokens), {
    GH_TOKEN: "TOKEN_B",
  });
});

/**
 * ユースケース: トークン不在のアカウントでは実行せず誘導文で失敗すること
 * 検証意図: 誤った認証での実行を防ぐため例外となることを確認する
 */
Deno.test("env解決: トークン不在時は誘導文付きで例外を投げる", () => {
  const tokens = parseHostsUserTokens(SAMPLE_HOSTS_YAML);
  assertThrows(
    () => resolveGhEnvForAccount("unknown-user", tokens),
    Error,
    "gh auth login",
  );
});

/**
 * ユースケース: env配下のgh認証状態が対象と一致すること
 * 検証意図: env指定の状態確認で対象ユーザーが検証成功することを確認する
 */
Deno.test("env検証: 対象ユーザーの認証が確認できる", () => {
  const seen: Record<string, string>[] = [];
  const result = verifyTargetAuth("purple-ocean-ego", { GH_TOKEN: "TOKEN_B" }, (env) => {
    seen.push(env);
    return {
      code: 0,
      stdout: "",
      stderr: "Logged in to github.com account purple-ocean-ego",
    };
  });
  assertEquals(result.verified, true);
  assertEquals(result.guidance, null);
  assertEquals(seen, [{ GH_TOKEN: "TOKEN_B" }]);
});

/**
 * ユースケース: env配下のgh認証状態が対象と不一致の場合は誘導文となること
 * 検証意図: 不一致時に実行へ進まず誘導文が返ることを確認する
 */
Deno.test("env検証: 不一致時は誘導文を返す", () => {
  const result = verifyTargetAuth("purple-ocean-ego", { GH_TOKEN: "TOKEN_X" }, () => ({
    code: 0,
    stdout: "",
    stderr: "Logged in to github.com account future-trajectory",
  }));
  assertEquals(result.verified, false);
  assertMatch(result.guidance ?? "", /gh auth switch|gh 認証/);
});

/**
 * ユースケース: 不正なYAML・非オブジェクト文書では空表が返ること
 * 検証意図: 解析不能時も例外なく空表を返すことを確認する
 */
Deno.test("hosts.yml解析: 不正YAML・非オブジェクト時は空表を返す", () => {
  assertEquals(parseHostsUserTokens("{not valid yaml: ["), {});
  assertEquals(parseHostsUserTokens("- just\n- a\n- list\n"), {});
  assertEquals(parseHostsUserTokens(""), {});
});

/**
 * ユースケース: 空文字・空白のみのトークンは除外されること
 * 検証意図: 無効トークンでGH_TOKENを構築しないことを確認する
 */
Deno.test("hosts.yml解析: 空・空白トークンは除外する", () => {
  const yaml = `github.com:
    users:
        empty-user:
            oauth_token: ""
        blank-user:
            oauth_token: "   "
        valid-user:
            oauth_token: TOKEN_V
`;
  assertEquals(parseHostsUserTokens(yaml), { "valid-user": "TOKEN_V" });
});

/**
 * ユースケース: GH_CONFIG_DIRがhosts.yml解決に優先されること
 * 検証意図: gh本体と同等の設定探索順であることを確認する
 */
Deno.test("hosts.yml解決: GH_CONFIG_DIRを優先する", () => {
  Deno.env.set("GH_CONFIG_DIR", "/tmp/gh-test-config");
  try {
    assertEquals(resolveHostsPath(), "/tmp/gh-test-config/hosts.yml");
  } finally {
    Deno.env.delete("GH_CONFIG_DIR");
  }
});

/**
 * ユースケース: 実ファイルを読み取ってトークン表を得られること
 * 検証意図: 一時ファイル経由の読込と、存在しないファイルでの空表を確認する
 */
Deno.test("hosts.yml読込: 実ファイルと不在ファイルを扱う", () => {
  const path = Deno.makeTempFileSync();
  try {
    Deno.writeTextFileSync(path, SAMPLE_HOSTS_YAML);
    assertEquals(readHostsUserTokens(path), {
      "future-trajectory": "TOKEN_A",
      "purple-ocean-ego": "TOKEN_B",
    });
  } finally {
    Deno.removeSync(path);
  }
  assertEquals(readHostsUserTokens("/tmp/definitely-not-exist-hosts-xyz.yml"), {});
});

/**
 * ユースケース: 対象外アカウントでは既定runnerが返ること
 * 検証意図: accountNameなし時はgh・ファイルに触れず既定動作することを確認する
 */
Deno.test("runner解決: 対象外時は既定runnerを返す", () => {
  const def = { marker: "default" };
  const result = resolveRunnerResult(
    { owner: "some-owner", accountName: null, verified: false, guidance: null },
    def,
    (_env) => ({ marker: "env" }),
    {
      readTokens: () => {
        throw new Error("呼ばれてはならない");
      },
      runStatus: (_env) => {
        throw new Error("呼ばれてはならない");
      },
    },
  );
  assertEquals(result, { ok: true, runner: def });
});

/**
 * ユースケース: トークン不在時は失敗理由が返ること
 * 検証意図: ambient代替実行せず誘導文を返すことを確認する
 */
Deno.test("runner解決: トークン不在時は失敗を返す", () => {
  const result = resolveRunnerResult(
    { owner: "o", accountName: "unknown-user", verified: false, guidance: null },
    { marker: "default" },
    (_env) => ({ marker: "env" }),
    { readTokens: () => ({}) },
  );
  assertEquals(result.ok, false);
  if (!result.ok) assertMatch(result.message, /gh auth login/);
});

/**
 * ユースケース: env検証の不一致時は失敗理由が返ること
 * 検証意図: 誤アイデンティティでの実行に進まないことを確認する
 */
Deno.test("runner解決: env検証不一致時は失敗を返す", () => {
  const result = resolveRunnerResult(
    { owner: "o", accountName: "purple-ocean-ego", verified: false, guidance: null },
    { marker: "default" },
    (_env) => ({ marker: "env" }),
    {
      readTokens: () => ({ "purple-ocean-ego": "TOKEN_X" }),
      runStatus: (_env) => ({
        code: 0,
        stdout: "",
        stderr: "Logged in to github.com account future-trajectory",
      }),
    },
  );
  assertEquals(result.ok, false);
});

/**
 * ユースケース: 検証成功時はenv付きrunnerが返ること
 * 検証意図: runStatusへenvが転送され、生成関数に解決済みenvが渡ることを確認する
 */
Deno.test("runner解決: 成功時はenv付きrunnerを返す", () => {
  const seenStatus: Record<string, string>[] = [];
  const seenRunner: Record<string, string>[] = [];
  const result = resolveRunnerResult(
    { owner: "o", accountName: "purple-ocean-ego", verified: false, guidance: null },
    { marker: "default" },
    (env) => {
      seenRunner.push(env);
      return { marker: "env" };
    },
    {
      readTokens: () => ({ "purple-ocean-ego": "TOKEN_B" }),
      runStatus: (env) => {
        seenStatus.push(env);
        return {
          code: 0,
          stdout: "",
          stderr: "Logged in to github.com account purple-ocean-ego",
        };
      },
    },
  );
  assertEquals(result, { ok: true, runner: { marker: "env" } });
  assertEquals(seenStatus, [{ GH_TOKEN: "TOKEN_B" }]);
  assertEquals(seenRunner, [{ GH_TOKEN: "TOKEN_B" }]);
});
