import { resolve, normalize, join } from "jsr:@std/path";
import { logger } from "./logger.ts";

// --- Path and File System Utilities ---
export const pathUtil = {
  /**
   * 与えられたパスを絶対パスに変換し、区切り文字を正規化します。
   */
  resolvePath: (...pathSegments: string[]): string => {
    if (pathSegments.length === 0) return normalize(resolve());
    return normalize(resolve(pathSegments[0], ...pathSegments.slice(1)));
  },
  /**
   * パスの結合を行います
   */
  joinPath: (...pathSegments: string[]): string => {
    if (pathSegments.length === 0) return "";
    return join(pathSegments[0], ...pathSegments.slice(1));
  },
  /**
   * ~/ をホームディレクトリに展開します
   */
  expandHome: (path: string): string => {
    if (path.startsWith("~/")) {
      const home = Deno.env.get("HOME") || Deno.env.get("USERPROFILE") || "";
      return normalize(join(home, path.slice(2)));
    }
    return normalize(path);
  }
};

export const fsUtil = {
  /**
   * テキストファイルを読み込みます（UTF-8）
   */
  readTextFile: async (filePath: string): Promise<string> => {
    return await Deno.readTextFile(filePath);
  },
  /**
   * テキストファイルを書き込みます（UTF-8）
   * @param dryRun true の場合、実際の書き込みは行いません
   */
  writeTextFile: async (filePath: string, content: string, dryRun = false): Promise<void> => {
    if (dryRun) {
      logger.dryRun(`Write to file: ${filePath}`);
      return;
    }
    await Deno.writeTextFile(filePath, content);
  },
  /**
   * ディレクトリやファイルが存在するか確認します
   */
  exists: async (filePath: string): Promise<boolean> => {
    try {
      await Deno.stat(filePath);
      return true;
    } catch (e) {
      if (e instanceof Deno.errors.NotFound) {
        return false;
      }
      throw e;
    }
  }
};
