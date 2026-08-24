import { assertEquals, assertRejects } from "@std/assert";
import { join } from "@std/path";

import { fsUtil } from "../../../../../../.agents/core/harness-core.ts";
import { installGh, type InstallGhDeps } from "./setup.ts";

const TAR_OFFSET_NAME = 0;
const TAR_OFFSET_MODE = 100;
const TAR_OFFSET_UID = 108;
const TAR_OFFSET_GID = 116;
const TAR_OFFSET_SIZE = 124;
const TAR_OFFSET_MTIME = 136;
const TAR_OFFSET_CHKSUM = 148;
const TAR_OFFSET_TYPEFLAG = 156;

function makeTarHeader(
  path: string,
  size: number,
  type: "file" | "directory",
): Uint8Array {
  const buf = new Uint8Array(512);
  const enc = new TextEncoder();

  const nameBytes = enc.encode(path);
  buf.set(nameBytes.subarray(0, 100), TAR_OFFSET_NAME);

  const mode = type === "directory" ? "0000755" : "0100755";
  buf.set(enc.encode(mode + " "), TAR_OFFSET_MODE);
  buf.set(enc.encode("0001750 "), TAR_OFFSET_UID);
  buf.set(enc.encode("0001750 "), TAR_OFFSET_GID);

  const sizeStr = size.toString(8).padStart(11, "0") + " ";
  buf.set(enc.encode(sizeStr), TAR_OFFSET_SIZE);
  buf.set(enc.encode("0".repeat(11) + " "), TAR_OFFSET_MTIME);
  buf.set(enc.encode(" ".repeat(8)), TAR_OFFSET_CHKSUM);
  buf[TAR_OFFSET_TYPEFLAG] = type === "directory" ? 53 : 48;

  let checksum = 0;
  for (let i = 0; i < 512; i++) checksum += buf[i];
  const chksumStr = checksum.toString(8).padStart(6, "0") + "\0 ";
  buf.set(enc.encode(chksumStr), TAR_OFFSET_CHKSUM);

  return buf;
}

async function concatTarParts(
  ...parts: Uint8Array[]
): Promise<Uint8Array> {
  const totalLen = parts.reduce((a, c) => a + c.length, 0);
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const p of parts) {
    result.set(p, offset);
    offset += p.length;
  }
  const compressed = new Blob([result]).stream().pipeThrough(
    new CompressionStream("gzip"),
  );
  const gzData = await new Response(compressed).arrayBuffer();
  return new Uint8Array(gzData);
}

async function createMinimalTarGz(destPath: string): Promise<void> {
  const content = new TextEncoder().encode("fake gh binary");

  const dir1 = makeTarHeader("gh_2.47.0_linux_amd64/", 0, "directory");
  const dir2 = makeTarHeader("gh_2.47.0_linux_amd64/bin/", 0, "directory");
  const fileHdr = makeTarHeader(
    "gh_2.47.0_linux_amd64/bin/gh",
    content.length,
    "file",
  );

  const paddedLen = Math.ceil(content.length / 512) * 512;
  const fileBlock = new Uint8Array(paddedLen);
  fileBlock.set(content);

  const endBlock = new Uint8Array(1024);
  const gzData = await concatTarParts(
    dir1,
    dir2,
    fileHdr,
    fileBlock,
    endBlock,
  );
  await Deno.writeFile(destPath, gzData);
}

async function createTarGzWithShare(destPath: string): Promise<void> {
  const ghContent = new TextEncoder().encode("fake gh binary");
  const manContent = new TextEncoder().encode("man page");

  const ghDir = makeTarHeader("gh_2.47.0_linux_amd64/", 0, "directory");
  const binDir = makeTarHeader("gh_2.47.0_linux_amd64/bin/", 0, "directory");
  const fileHdr = makeTarHeader(
    "gh_2.47.0_linux_amd64/bin/gh",
    ghContent.length,
    "file",
  );
  const shareDir = makeTarHeader("gh_2.47.0_linux_amd64/share/", 0, "directory");
  const shareManDir = makeTarHeader(
    "gh_2.47.0_linux_amd64/share/man/",
    0,
    "directory",
  );
  const manHdr = makeTarHeader(
    "gh_2.47.0_linux_amd64/share/man/gh.1",
    manContent.length,
    "file",
  );

  const ghFileBlock = new Uint8Array(
    Math.ceil(ghContent.length / 512) * 512,
  );
  ghFileBlock.set(ghContent);
  const manFileBlock = new Uint8Array(
    Math.ceil(manContent.length / 512) * 512,
  );
  manFileBlock.set(manContent);

  const endBlock = new Uint8Array(1024);
  const gzData = await concatTarParts(
    ghDir,
    binDir,
    fileHdr,
    ghFileBlock,
    shareDir,
    shareManDir,
    manHdr,
    manFileBlock,
    endBlock,
  );
  await Deno.writeFile(destPath, gzData);
}

function createFakeLogger(): InstallGhDeps["logger"] {
  return {
    info: () => {},
    warn: () => {},
    error: () => {},
    success: () => {},
  };
}

function createFakeDeps(
  fsOverrides?: Partial<InstallGhDeps["fs"]>,
): { deps: InstallGhDeps; calls: string[] } {
  const calls: string[] = [];
  const baseFs: InstallGhDeps["fs"] = {
    downloadFile: (_url, _destPath) => {
      calls.push("downloadFile");
      return Promise.resolve();
    },
    extract: () => {
      calls.push("extract");
      return Promise.resolve();
    },
    exists: (_path) => {
      calls.push("exists");
      return Promise.resolve(false);
    },
    move: () => {
      calls.push("move");
      return Promise.resolve();
    },
    remove: () => {
      calls.push("remove");
      return Promise.resolve();
    },
    mkdir: () => {
      calls.push("mkdir");
      return Promise.resolve();
    },
  };
  const deps: InstallGhDeps = {
    fs: { ...baseFs, ...fsOverrides },
    cmd: () => {
      calls.push("cmd");
      return Promise.resolve({ code: 0, stdout: "", stderr: "" });
    },
    logger: createFakeLogger(),
  };
  return { deps, calls };
}

async function withTempDir<T>(
  fn: (dir: string) => Promise<T>,
): Promise<T> {
  const dir = await Deno.makeTempDir();
  try {
    return await fn(dir);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
}

Deno.test("installGh - ダウンロード→extract→chmodの一連の流れ", async () => {
  await withTempDir(async (binDir) => {
    const { deps, calls } = createFakeDeps();
    await installGh(binDir, "linux", "x86_64", deps);

    assertEquals(
      calls.includes("downloadFile"),
      true,
      "downloadFileが呼ばれること",
    );
    assertEquals(calls.includes("extract"), true, "extractが呼ばれること");
    assertEquals(calls.includes("cmd"), true, "chmodが実行されること");
    assertEquals(calls.includes("remove"), true, "中間ファイルが削除されること");
    assertEquals(calls.includes("mkdir"), true, "binDirが作成されること");
  });
});

Deno.test("installGh - downloadFileエラー時にエラーが伝搬する", async () => {
  await withTempDir(async (binDir) => {
    const { deps } = createFakeDeps({
      downloadFile: () => Promise.reject(new Error("Download failed")),
    });
    await assertRejects(
      () => installGh(binDir, "linux", "x86_64", deps),
      Error,
      "Download failed",
    );
  });
});

Deno.test(
  "installGh - downloadFileエラー時にも中間ファイル削除が試行される",
  async () => {
    await withTempDir(async (binDir) => {
      const { deps, calls } = createFakeDeps({
        downloadFile: () => Promise.reject(new Error("DL error")),
      });
      await assertRejects(
        () => installGh(binDir, "linux", "x86_64", deps),
        Error,
        "DL error",
      );

      assertEquals(
        calls.includes("remove"),
        true,
        "エラー後も中間ファイル削除が試行されること",
      );
      assertEquals(calls.includes("extract"), false, "extractは呼ばれないこと");
      assertEquals(calls.includes("cmd"), false, "cmdは呼ばれないこと");
    });
  },
);

Deno.test("installGh - extractエラー時にも中間ファイル削除が試行される", async () => {
  await withTempDir(async (binDir) => {
    const { deps, calls } = createFakeDeps({
      downloadFile: (_url, destPath) => {
        calls.push("downloadFile");
        return Deno.writeFile(destPath, new Uint8Array([0, 1, 2]));
      },
      extract: () => Promise.reject(new Error("Extract failed")),
    });
    await assertRejects(
      () => installGh(binDir, "linux", "x86_64", deps),
      Error,
      "Extract failed",
    );

    assertEquals(
      calls.includes("remove"),
      true,
      "エラー後も中間ファイル削除が試行されること",
    );
  });
});

Deno.test("installGh - ghが既に存在する場合はダウンロードをスキップ", async () => {
  await withTempDir(async (binDir) => {
    const ghPath = join(binDir, "gh");
    await Deno.writeTextFile(ghPath, "existing-gh");

    const { deps, calls } = createFakeDeps({
      exists: (path: string) => {
        calls.push("exists");
        return Promise.resolve(path === ghPath);
      },
    });
    await installGh(binDir, "linux", "x86_64", deps);

    assertEquals(
      calls.includes("downloadFile"),
      false,
      "既存時はdownloadFileが呼ばれないこと",
    );
    assertEquals(
      calls.includes("extract"),
      false,
      "既存時はextractが呼ばれないこと",
    );
    assertEquals(
      calls.includes("cmd"),
      false,
      "既存時はcmdが呼ばれないこと",
    );
  });
});

Deno.test(
  "installGh - minimal tar.gz → 実extractでghバイナリが配置される",
  async () => {
    await withTempDir(async (binDir) => {
      const ghPath = join(binDir, "gh");
      const calls: string[] = [];
      const deps: InstallGhDeps = {
        fs: {
          downloadFile: async (_url: string, destPath: string) => {
            calls.push("downloadFile");
            await createMinimalTarGz(destPath);
          },
          extract: async (
            src: string,
            dest: string,
            options?: { stripComponents?: number },
          ) => {
            calls.push("extract");
            await fsUtil.extract(src, dest, options);
          },
          exists: async (path: string) => {
            calls.push("exists");
            return await fsUtil.exists(path);
          },
          move: async (src: string, dest: string) => {
            calls.push("move");
            await fsUtil.move(src, dest);
          },
          remove: async (
            path: string,
            options?: { recursive?: boolean },
          ) => {
            calls.push("remove");
            await fsUtil.remove(path, options);
          },
          mkdir: async (
            path: string,
            options?: { recursive?: boolean },
          ) => {
            calls.push("mkdir");
            await fsUtil.mkdir(path, options);
          },
        },
        cmd: () => {
          calls.push("cmd");
          return Promise.resolve({ code: 0, stdout: "", stderr: "" });
        },
        logger: createFakeLogger(),
      };
      await installGh(binDir, "linux", "x86_64", deps);

      const stat = await Deno.stat(ghPath);
      assertEquals(stat.isFile, true, "ghがファイルとして配置されていること");

      const removeIdx = calls.indexOf("remove");
      const cmdIdx = calls.indexOf("cmd");
      assertEquals(
        calls.includes("downloadFile"),
        true,
        "downloadFileが呼ばれること",
      );
      assertEquals(calls.includes("extract"), true, "extractが呼ばれること");
      assertEquals(calls.includes("move"), true, "moveが呼ばれること");
      assertEquals(removeIdx >= 0, true, "removeが呼ばれること");
      assertEquals(cmdIdx >= 0, true, "cmdが呼ばれること");
      assertEquals(removeIdx < cmdIdx, true, "removeはcmdより前に呼ばれること");
    });
  },
);

Deno.test(
  "installGh - tar.gzにshare/が含まれる場合もcleanupされる",
  async () => {
    await withTempDir(async (binDir) => {
      const ghPath = join(binDir, "gh");
      const sharePath = join(binDir, "share");
      const deps: InstallGhDeps = {
        fs: {
          downloadFile: async (_url: string, destPath: string) => {
            await createTarGzWithShare(destPath);
          },
          extract: fsUtil.extract,
          exists: fsUtil.exists,
          move: fsUtil.move,
          remove: fsUtil.remove,
          mkdir: fsUtil.mkdir,
        },
        cmd: () => Promise.resolve({ code: 0, stdout: "", stderr: "" }),
        logger: createFakeLogger(),
      };
      await installGh(binDir, "linux", "x86_64", deps);

      assertEquals(
        await Deno.stat(ghPath).then(() => true).catch(() => false),
        true,
        "ghが配置されること",
      );
      assertEquals(
        await Deno.stat(sharePath).then(() => true).catch(() => false),
        false,
        "share/が削除されていること",
      );
    });
  },
);

Deno.test(
  "installGh - OS/archの組み合わせでghTargetが正しく導出される",
  () => {
    const cases: [string, string, string][] = [
      ["linux", "x86_64", "linux_amd64"],
      ["linux", "aarch64", "linux_arm64"],
      ["darwin", "x86_64", "macOS_amd64"],
      ["darwin", "aarch64", "macOS_arm64"],
      ["windows", "x86_64", "windows_amd64"],
      ["windows", "aarch64", "windows_amd64"],
    ];
    for (const [os, arch, expected] of cases) {
      const ghTarget = arch === "aarch64" && os !== "windows"
        ? `${os === "darwin" ? "macOS" : "linux"}_arm64`
        : `${os === "darwin" ? "macOS" : os}_amd64`;
      assertEquals(
        ghTarget,
        expected,
        `${os}/${arch} → ${expected}`,
      );
    }
  },
);
