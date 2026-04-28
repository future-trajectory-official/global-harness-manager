import { executeCommand } from "./command.ts";
import { fsUtil } from "./fs.ts";

/**
 * Distribution destination verification utilities.
 */
export const verifyTarget = {
  /**
   * 指定されたパスが有効な Git リポジトリであるか確認します。
   */
  isGitRepo: async (path: string): Promise<boolean> => {
    return await fsUtil.exists(`${path}/.git`);
  },

  /**
   * リポジトリに未コミットの変更があるか確認します。
   */
  isDirty: async (path: string): Promise<boolean> => {
    const result = await executeCommand({
      cmd: "git",
      args: ["status", "--porcelain"],
      cwd: path,
    });
    return result.stdout.trim().length > 0;
  },

  /**
   * 配布先の安全性を検証します。
   */
  checkSafety: async (path: string): Promise<{ safe: boolean; reason?: string }> => {
    if (!(await fsUtil.exists(path))) {
      return { safe: false, reason: "Directory does not exist." };
    }

    if (!(await verifyTarget.isGitRepo(path))) {
      return { safe: false, reason: "Not a git repository." };
    }

    if (await verifyTarget.isDirty(path)) {
      return { safe: false, reason: "Repository has uncommitted changes (dirty)." };
    }

    return { safe: true };
  },
};
