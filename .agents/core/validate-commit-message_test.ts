import { assertEquals, assertRejects, assertStringIncludes } from "@std/assert";
import { join } from "@std/path";
import { readConfig, validate, ValidationConfig } from "./validate-commit-message.ts";

/**
 * ユースケース: 設定ファイルから正規表現パターンと言語指定を読み込めること
 * 検証意図: 正常なJSON設定ファイルをパースし、設定オブジェクトとして取得できることを確認する
 */
Deno.test("readConfig - 正常な設定ファイルを読み込める", async () => {
  const dir = await Deno.makeTempDir();
  const configPath = join(dir, "test-config.json");
  const configData = {
    pattern: "^test\\+.+$",
    language: "en",
  };
  await Deno.writeTextFile(configPath, JSON.stringify(configData));

  try {
    const config = await readConfig(configPath);
    assertEquals(config.pattern, "^test\\+.+$");
    assertEquals(config.language, "en");
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

/**
 * ユースケース: 設定ファイルが存在しない場合にエラーになること
 * 検証意図: 設定ファイル不在時のエラーメッセージにファイル名と復旧手順が含まれること
 */
Deno.test("readConfig - 設定ファイルが存在しない場合はエラー", async () => {
  await assertRejects(
    () => readConfig("/nonexistent/path/config.json"),
    Error,
    "commit-msg.config.json",
  );
});

Deno.test("readConfig - 設定ファイル不在時のエラーメッセージに復旧手順が含まれる", async () => {
  let thrown: Error | undefined;
  try {
    await readConfig("/nonexistent/path/config.json");
  } catch (e) {
    thrown = e as Error;
  }
  assertStringIncludes(thrown!.message, "config/commit-msg.config.json.example");
});

/**
 * ユースケース: 設定ファイルが無効なJSONの場合にエラーになること
 * 検証意図: JSONパースエラーのハンドリングを確認する
 */
Deno.test("readConfig - 無効なJSONはエラー", async () => {
  const dir = await Deno.makeTempDir();
  const configPath = join(dir, "invalid.json");
  await Deno.writeTextFile(configPath, "{invalid-json}");

  try {
    await assertRejects(
      () => readConfig(configPath),
      Error,
    );
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

/**
 * ユースケース: 設定ファイルに必須フィールドがない場合にエラーになること
 * 検証意図: 設定のスキーマバリデーションを確認する
 */
Deno.test("readConfig - 必須フィールドがない設定はエラー", async () => {
  const dir = await Deno.makeTempDir();
  const configPath = join(dir, "empty.json");
  await Deno.writeTextFile(configPath, JSON.stringify({}));

  try {
    await assertRejects(
      () => readConfig(configPath),
      Error,
    );
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

/**
 * ユースケース: 正常系メッセージがバリデーションを通過すること
 * 検証意図: 設定されたパターンに合致するメッセージは許可される
 */
Deno.test("validate - パターンに合致するメッセージは通過", () => {
  const config: ValidationConfig = {
    pattern: "^\\w+: .+$",
    language: "en",
  };
  assertEquals(validate("fix: resolve crash", config), { valid: true });
  assertEquals(validate("feat: add login", config), { valid: true });
});

/**
 * ユースケース: 不正な形式のメッセージが拒否されること
 * 検証意図: 設定されたパターンに合致しないメッセージは拒否される
 */
Deno.test("validate - パターンに合致しないメッセージは拒否", () => {
  const config: ValidationConfig = {
    pattern: "^\\w+: .*[\\u3040-\\u309f\\u30a0-\\u30ff\\u4e00-\\u9fff].*$",
    language: "ja",
  };
  const result = validate("fix: resolve crash", config);
  assertEquals(result.valid, false);
  assertEquals(typeof result.error, "string");
});

/**
 * ユースケース: 空のコミットメッセージが拒否されること
 * 検証意図: 空メッセージのエッジケース
 */
Deno.test("validate - 空のメッセージは拒否", () => {
  const config: ValidationConfig = {
    pattern: "^.+$",
    language: "en",
  };
  const result = validate("", config);
  assertEquals(result.valid, false);
});

/**
 * ユースケース: 言語設定を変更すると検証言語が切り替わること
 * 検証意図: 言語固定のハードコードになっていないことを確認する
 */
Deno.test("validate - 言語設定の切替が機能する", () => {
  const enConfig: ValidationConfig = {
    pattern: "^\\w+: .+$",
    language: "en",
  };
  assertEquals(validate("fix: resolve bug", enConfig).valid, true);

  const jaConfig: ValidationConfig = {
    pattern: "^\\w+: .*[\\u3040-\\u309f\\u30a0-\\u30ff\\u4e00-\\u9fff].*$",
    language: "ja",
  };
  assertEquals(validate("fix: resolve bug", jaConfig).valid, false);
  assertEquals(validate("chore: 設定ファイルを追加", jaConfig).valid, true);
});

/**
 * ユースケース: 複数行のコミットメッセージは1行目のみ検証されること
 * 検証意図: コミットメッセージ本文（2行目以降）は検証対象外とする
 */
Deno.test("validate - 複数行メッセージは1行目のみ検証", () => {
  const config: ValidationConfig = {
    pattern: "^\\w+: .*[\\u3040-\\u309f\\u30a0-\\u30ff\\u4e00-\\u9fff].*$",
    language: "ja",
  };
  const multiLine = "feat: 機能を追加\n\nThis is the body.\nMore details here.";
  assertEquals(validate(multiLine, config).valid, true);
});
