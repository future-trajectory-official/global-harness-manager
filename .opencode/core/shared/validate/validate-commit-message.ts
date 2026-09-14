import { dirname, join } from "@std/path";

export interface ValidationConfig {
  pattern: string;
  language: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

const PROJECT_ROOT = dirname(dirname(new URL(".", import.meta.url).pathname));

export const DEFAULT_CONFIG_PATH = join(
  PROJECT_ROOT,
  "config",
  "commit-msg.config.json",
);

export const DEFAULT_CONFIG: ValidationConfig = {
  pattern: "^\\w+(?:\\(\\w+\\))?: .*[\\u3040-\\u309f\\u30a0-\\u30ff\\u4e00-\\u9fff].*$",
  language: "ja",
};

/**
 * 設定ファイルを読み込み、パースする
 * @param configPath - 設定ファイルのパス（省略時はデフォルトパス）
 * @returns パースされた設定オブジェクト
 * @throws ファイルが存在しないか、無効なJSONの場合
 */
export async function readConfig(
  configPath: string = DEFAULT_CONFIG_PATH,
): Promise<ValidationConfig> {
  let content: string;
  try {
    content = await Deno.readTextFile(configPath);
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) {
      throw new Error(
        `設定ファイルが見つかりません: ${configPath}\n不足ファイル: commit-msg.config.json\n復旧手順: config/commit-msg.config.json.example をコピーして作成してください`,
      );
    }
    throw err;
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error(
      `設定ファイルのパースに失敗しました: ${configPath}`,
    );
  }

  if (typeof parsed.pattern !== "string" || !parsed.pattern) {
    throw new Error(
      `設定ファイルに有効な "pattern" フィールドが必要です: ${configPath}`,
    );
  }

  return {
    pattern: parsed.pattern,
    language: typeof parsed.language === "string" ? parsed.language : "ja",
  };
}

/**
 * コミットメッセージを設定に基づいて検証する
 * @param message - 検証対象のコミットメッセージ
 * @param config - 検証設定
 * @returns 検証結果
 */
export function validate(
  message: string,
  config: ValidationConfig,
): ValidationResult {
  if (!message || message.trim() === "") {
    return { valid: false, error: "コミットメッセージが空です。" };
  }

  const firstLine = message.split("\n")[0];
  const regex = new RegExp(config.pattern);

  if (!regex.test(firstLine)) {
    return {
      valid: false,
      error:
        `コミットメッセージがパターンに合致しません。言語: ${config.language}, パターン: ${config.pattern}`,
    };
  }

  return { valid: true };
}

async function main(): Promise<void> {
  const args = Deno.args;
  if (args.length < 1) {
    console.error("使用方法: deno run -A validate-commit-message.ts <commit-message-file>");
    Deno.exit(1);
  }

  const messageFilePath = args[0];
  let message: string;
  try {
    message = await Deno.readTextFile(messageFilePath);
  } catch {
    console.error(`コミットメッセージファイルを読み込めません: ${messageFilePath}`);
    Deno.exit(1);
  }

  let config: ValidationConfig;
  try {
    config = await readConfig();
  } catch (err) {
    console.error(String(err));
    Deno.exit(1);
  }

  const result = validate(message, config);
  if (!result.valid) {
    console.error(result.error);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  await main();
}
