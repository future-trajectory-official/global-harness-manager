import { resolve, normalize, join, dirname } from "@std/path";
import { unzipSync } from "fflate";
import { UntarStream } from "@std/tar";
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
  },
  /**
   * ファイルをダウンロードします
   */
  downloadFile: async (url: string, destPath: string): Promise<void> => {
    logger.info(`Downloading: ${url} -> ${destPath}`);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to download: ${response.statusText}`);

    const contentLength = response.headers.get("content-length");
    const total = contentLength ? parseInt(contentLength, 10) : 0;
    let downloaded = 0;

    const reader = response.body?.getReader();
    if (!reader) throw new Error("Failed to get reader from response body");

    const file = await Deno.open(destPath, { write: true, create: true, truncate: true });

    try {
      let lastPercentage = -1;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          downloaded += value.length;
          await file.write(value);
          if (total > 0) {
            const percentage = Math.round((downloaded / total) * 100);
            if (percentage > lastPercentage) {
              const mbDownloaded = (downloaded / 1024 / 1024).toFixed(1);
              const mbTotal = (total / 1024 / 1024).toFixed(1);
              Deno.stdout.writeSync(new TextEncoder().encode(`\r[INFO] Downloading... ${percentage}% (${mbDownloaded}MB/${mbTotal}MB)`));
              lastPercentage = percentage;
            }
          }
        }
      }
      if (total > 0) {
        Deno.stdout.writeSync(new TextEncoder().encode("\n"));
      }
    } finally {
      file.close();
    }
  },
  /**
   * ファイルまたはディレクトリを移動します（クロスデバイス対応）
   */
  move: async (src: string, dest: string): Promise<void> => {
    try {
      await Deno.rename(src, dest);
    } catch (err) {
      if (err instanceof Error && (err.message.includes("EXDEV") || err.message.includes("cross-device"))) {
        logger.info(`Cross-device link detected, falling back to copy/delete: ${src} -> ${dest}`);
        await fsUtil.copy(src, dest);
        await Deno.remove(src, { recursive: true });
      } else {
        throw err;
      }
    }
  },
  /**
   * アーカイブファイルを展開します
   */
  extract: async (src: string, dest: string, options?: { stripComponents?: number }): Promise<void> => {
    const isZip = src.endsWith(".zip");

    if (isZip) {
      // --- Zip のネイティブ解凍 (fflate) ---
      const data = await Deno.readFile(src);
      const unzipped = unzipSync(data) as Record<string, Uint8Array>;
      
      for (const [relativePath, content] of Object.entries(unzipped)) {
        const fullPath = join(dest, relativePath);
        if (relativePath.endsWith("/")) {
          await Deno.mkdir(fullPath, { recursive: true });
        } else {
          await Deno.mkdir(dirname(fullPath), { recursive: true });
          await Deno.writeFile(fullPath, content);
        }
      }
    } else {
      // --- tar.gz のネイティブ解凍 (@std/tar + DecompressionStream) ---
      const file = await Deno.open(src);
      const decompressedStream = file.readable.pipeThrough(new DecompressionStream("gzip"));
      const untarStream = decompressedStream.pipeThrough(new UntarStream());
      
      for await (const entry of untarStream) {
        let entryPath = entry.path;
        
        // stripComponents の処理
        if (options?.stripComponents) {
          const parts = entryPath.split("/");
          const filteredParts = parts.filter((p: string) => p !== "");
          if (filteredParts.length <= options.stripComponents) continue;
          entryPath = filteredParts.slice(options.stripComponents).join("/");
        }
        
        const fullPath = join(dest, entryPath);
        
        if (entryPath.endsWith("/")) {
          await Deno.mkdir(fullPath, { recursive: true });
        } else {
          await Deno.mkdir(dirname(fullPath), { recursive: true });
          if (entry.readable) {
            const outFile = await Deno.open(fullPath, { write: true, create: true, truncate: true });
            await entry.readable.pipeTo(outFile.writable);
          }
        }
      }
    }
  },
  /**
   * ファイルまたはディレクトリをコピーします
   */
  copy: async (src: string, dest: string): Promise<void> => {
    const stat = await Deno.stat(src);
    if (stat.isDirectory) {
      await Deno.mkdir(dest, { recursive: true });
      for await (const entry of Deno.readDir(src)) {
        await fsUtil.copy(join(src, entry.name), join(dest, entry.name));
      }
    } else {
      await Deno.copyFile(src, dest);
    }

    // Suggestion #2: パーミッションの保持 (Unix-like)
    if (Deno.build.os !== "windows" && stat.mode !== null) {
      try {
        await Deno.chmod(dest, stat.mode & 0o777);
      } catch (_e) {
        // Ignore errors on file systems that don't support chmod
      }
    }
  }
};
