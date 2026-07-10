import { assertEquals, assertRejects } from "@std/assert";
import { join } from "@std/path";

import { installGh, type InstallGhDeps } from "./setup.ts";

function createFakeDeps(): { deps: InstallGhDeps; calls: string[] } {
  const calls: string[] = [];
  const deps: InstallGhDeps = {
    fs: {
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
    },
    cmd: () => {
      calls.push("cmd");
      return Promise.resolve({ code: 0, stdout: "", stderr: "" });
    },
    logger: {
      info: () => {
        calls.push("info");
      },
      warn: () => {},
      error: () => {},
      success: () => {},
    },
  };
  return { deps, calls };
}

Deno.test("installGh - fake depsでダウンロード成功", async () => {
  const binDir = await Deno.makeTempDir();
  try {
    const { deps, calls } = createFakeDeps();
    await installGh(binDir, "linux", "x86_64", deps);

    assertEquals(calls.includes("downloadFile"), true, "downloadFileが呼ばれること");
    assertEquals(calls.includes("extract"), true, "extractが呼ばれること");
    assertEquals(calls.includes("cmd"), true, "chmod(chmod)が実行されること");
    assertEquals(calls.includes("remove"), true, "中間ファイルが削除されること");
    assertEquals(calls.includes("mkdir"), true, "binDirが作成されること");
  } finally {
    await Deno.remove(binDir, { recursive: true });
  }
});

Deno.test("installGh - downloadFileがエラーをthrowした場合", async () => {
  const binDir = await Deno.makeTempDir();
  try {
    const { deps } = createFakeDeps();
    const errorDeps: InstallGhDeps = {
      ...deps,
      fs: { ...deps.fs, downloadFile: () => Promise.reject(new Error("Download failed")) },
    };
    await assertRejects(
      () => installGh(binDir, "linux", "x86_64", errorDeps),
      Error,
      "Download failed",
    );
  } finally {
    await Deno.remove(binDir, { recursive: true });
  }
});

Deno.test("installGh - ghが既に存在する場合はスキップ", async () => {
  const binDir = await Deno.makeTempDir();
  try {
    const { deps, calls } = createFakeDeps();
    const skipDeps: InstallGhDeps = {
      ...deps,
      fs: {
        ...deps.fs,
        exists: (path: string) => {
          if (path === join(binDir, "gh")) return Promise.resolve(true);
          return Promise.resolve(false);
        },
      },
    };
    await installGh(binDir, "linux", "x86_64", skipDeps);

    assertEquals(calls.includes("downloadFile"), false, "既存時はdownloadFileが呼ばれないこと");
    assertEquals(calls.includes("extract"), false, "既存時はextractが呼ばれないこと");
    assertEquals(calls.includes("cmd"), false, "既存時はcmdが呼ばれないこと");
  } finally {
    await Deno.remove(binDir, { recursive: true });
  }
});
