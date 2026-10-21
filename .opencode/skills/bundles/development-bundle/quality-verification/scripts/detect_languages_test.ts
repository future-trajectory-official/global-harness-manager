import { assertEquals, assertStringIncludes } from "@std/assert";

const SKILL_DIR = new URL("..", import.meta.url).pathname;
const SKILL_MD = `${SKILL_DIR}/SKILL.md`;
const SCRIPTS = `${SKILL_DIR}/scripts`;
const DETECT_SH = `${SCRIPTS}/detect-languages.sh`;
const RUN_PY = `${SCRIPTS}/run-qa-py.sh`;
const RUN_SH = `${SCRIPTS}/run-qa-sh.sh`;
const RUN_TS = `${SCRIPTS}/run-qa-ts.sh`;
const DOCKERFILE = `${SKILL_DIR}/assets/dockerfiles/qa-py.Dockerfile`;

type Detection = {
  caseId: string;
  ts: number;
  py: number;
  sh: number;
  d1: string;
};

/**
 * 用途: 検出・runner系テスト用の呼出元fixtureを一時dirに作る。
 * 検証意図: 各テストが独立した呼出元構成で振る舞いをassertできること。
 */
async function makeFixture(files: string[]): Promise<string> {
  const dir = await Deno.makeTempDir({ prefix: "y2-fixture-" });
  for (const f of files) {
    const full = `${dir}/${f}`;
    const slash = full.lastIndexOf("/");
    if (slash > dir.length) {
      await Deno.mkdir(full.slice(0, slash), { recursive: true });
    }
    await Deno.writeTextFile(full, "# fixture\n");
  }
  return dir;
}

/**
 * 用途: fixtureの生成〜後片付けを1箇所に集約する。
 * 検証意図: 6重複写だった try/finally を除去し、例外時のtemp残留を防ぐこと。
 */
async function withFixture<T>(
  files: string[],
  fn: (dir: string) => Promise<T>,
): Promise<T> {
  const dir = await makeFixture(files);
  try {
    return await fn(dir);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
}

async function run(
  prog: string,
  args: string[],
  opts?: { env?: Record<string, string> },
): Promise<{ code: number; out: string }> {
  const cmd = new Deno.Command(prog, {
    args,
    stdout: "piped",
    stderr: "piped",
    stdin: "null",
    env: opts?.env,
  });
  const { code, stdout, stderr } = await cmd.output();
  const dec = new TextDecoder();
  return { code, out: dec.decode(stdout) + dec.decode(stderr) };
}

async function detect(dir: string): Promise<Detection> {
  const { code, out } = await run("sh", [DETECT_SH, dir]);
  assertEquals(code, 0, `detect-languages.sh failed for ${dir}: ${out}`);
  const m = out.match(/CASE=(\w+) TS=(\d+) PY=(\d+) SH=(\d+) D1=(\w+)/);
  if (!m) throw new Error(`unexpected output: ${out}`);
  return { caseId: m[1], ts: +m[2], py: +m[3], sh: +m[4], d1: m[5] };
}

/**
 * 用途: docker/denoのスタブbin dirを作る（runnerのE2E検証用）。
 * 検証意図: 実コンテナなしで分岐・集約・終了コード規約を機械検証できること。
 * スタブdocker: build→0、inspect→固定digest、run→STUB_<TOOL>_EXIT。
 */
async function makeStubBin(extra?: {
  denoExit?: number;
  deno?: boolean;
}): Promise<{ dir: string; log: string }> {
  const dir = await Deno.makeTempDir({ prefix: "y2-stub-" });
  const log = `${dir}/calls.log`;
  await Deno.writeTextFile(
    `${dir}/docker`,
    `#!/bin/sh\necho "docker $@" >> "${log}"\n` +
      `if [ "$1" = "build" ]; then exit 0; fi\n` +
      `if [ "$1" = "inspect" ]; then echo "sha256:stubdigest"; exit 0; fi\n` +
      `case "$*" in\n` +
      `  *ruff*) exit "\${STUB_RUFF_EXIT:-0}";;\n` +
      `  *pytest*) exit "\${STUB_PYTEST_EXIT:-0}";;\n` +
      `  *shellcheck*) exit "\${STUB_SHELLCHECK_EXIT:-0}";;\n` +
      `  *shfmt*) exit "\${STUB_SHFMT_EXIT:-0}";;\n` +
      `esac\nexit 0\n`,
  );
  await Deno.chmod(`${dir}/docker`, 0o755);
  if (extra?.deno !== false) {
    await Deno.writeTextFile(
      `${dir}/deno`,
      `#!/bin/sh\necho "deno $@" >> "${log}"\nexit "\${STUB_DENO_EXIT:-0}"\n`,
    );
    await Deno.chmod(`${dir}/deno`, 0o755);
  }
  return { dir, log };
}

function stubEnv(stub: { dir: string }, extra?: Record<string, string>) {
  return {
    PATH: `${stub.dir}:/usr/bin:/bin`,
    ...extra,
  };
}

// ---- SKILL.md 内容 (AC1の手順仕様) ----

Deno.test({
  name: "Y2 SKILL.md defines qa:ts/qa:py/qa:sh branch labels",
  fn: async () => {
    // 検証意図: 命名 (a)3名案が手順書に束縛されていること。
    const content = await Deno.readTextFile(SKILL_MD);
    assertStringIncludes(content, "qa:ts");
    assertStringIncludes(content, "qa:py");
    assertStringIncludes(content, "qa:sh");
  },
});

Deno.test({
  name: "Y2 SKILL.md documents detection conditions and case table",
  fn: async () => {
    // 検証意図: D1/D2/P1/S1と用語分離が手順書に記録されていること。
    const content = await Deno.readTextFile(SKILL_MD);
    assertStringIncludes(content, "D1");
    assertStringIncludes(content, "requires-deno-target");
    assertStringIncludes(content, "requires-deno-runner");
  },
});

Deno.test({
  name: "Y2 SKILL.md documents mixed-case combination and AND aggregation",
  fn: async () => {
    // 検証意図: A+py/sh併走と終了コード集約規約が明文化されていること。
    const content = await Deno.readTextFile(SKILL_MD);
    assertStringIncludes(content, "併走");
    assertStringIncludes(content, "AND集約");
  },
});

// ---- 検出振る舞い (AC1: 呼出元言語構成の振り分け) ----

Deno.test({
  name: "detect case B: py+sh without Deno target",
  fn: async () => {
    // 検証意図: py/sh共存の呼出元がB判定になること。
    await withFixture(["a.py", "b.sh"], async (dir) => {
      const r = await detect(dir);
      assertEquals({ ...r }, {
        caseId: "B",
        ts: 0,
        py: 1,
        sh: 1,
        d1: "no",
      });
    });
  },
});

Deno.test({
  name: "detect case C: py only",
  fn: async () => {
    // 検証意図: py単独の呼出元がC判定になること。
    await withFixture(["a.py", "sub/b.py"], async (dir) => {
      const r = await detect(dir);
      assertEquals(r.caseId, "C");
      assertEquals(r.py, 2);
    });
  },
});

Deno.test({
  name: "detect case D: sh only",
  fn: async () => {
    // 検証意図: sh単独の呼出元がD判定になること。
    await withFixture(["run.sh"], async (dir) => {
      const r = await detect(dir);
      assertEquals(r.caseId, "D");
      assertEquals(r.sh, 1);
    });
  },
});

Deno.test({
  name: "detect case E: no target files (empty caller)",
  fn: async () => {
    // 検証意図: 対象なし呼出元がE判定・終了コード0になること。
    await withFixture(["README.md"], async (dir) => {
      const r = await detect(dir);
      assertEquals(r.caseId, "E");
    });
  },
});

Deno.test({
  name: "detect case A: Deno target present",
  fn: async () => {
    // 検証意図: D1ありの呼出元がA判定になること。
    await withFixture(["deno.json", "mod.ts", "a.py"], async (dir) => {
      const r = await detect(dir);
      assertEquals(r.caseId, "A");
      assertEquals(r.d1, "yes");
    });
  },
});

Deno.test({
  name: "detect case A: D1 only without ts (config alone)",
  fn: async () => {
    // 検証意図: D1単独（設定あり・tsゼロ）もAに含まれること。
    await withFixture(["deno.json"], async (dir) => {
      const r = await detect(dir);
      assertEquals(r.caseId, "A");
      assertEquals(r.ts, 0);
      assertEquals(r.d1, "yes");
    });
  },
});

Deno.test({
  name: "detect case A: D2 only without config (ts alone)",
  fn: async () => {
    // 検証意図: D2単独（設定なし・tsあり）もAになること（OR条件）。
    await withFixture(["mod.ts"], async (dir) => {
      const r = await detect(dir);
      assertEquals(r.caseId, "A");
      assertEquals(r.d1, "no");
      assertEquals(r.ts, 1);
    });
  },
});

Deno.test({
  name: "detect case A: deno.jsonc counts as D1",
  fn: async () => {
    // 検証意図: deno.jsoncがD1に含まれること。
    await withFixture(["deno.jsonc", "x.py"], async (dir) => {
      const r = await detect(dir);
      assertEquals(r.caseId, "A");
      assertEquals(r.d1, "yes");
    });
  },
});

Deno.test({
  name: "detect excludes vendored and cache dirs at any depth",
  fn: async () => {
    // 検証意図: 除外8種がトップレベル・ネストの双方で効くこと。
    await withFixture([
      "node_modules/x.py",
      ".git/y.sh",
      "cov_profile/z.py",
      "dist/w.sh",
      "build/v.py",
      "__pycache__/u.py",
      "vendor/t.sh",
      ".opencode/node_modules/s.py",
      "sub/vendor/nested.py",
      "sub/dist/nested.sh",
      "sub/build/nested.ts",
      "real.py",
    ], async (dir) => {
      const r = await detect(dir);
      assertEquals(r.py, 1);
      assertEquals(r.sh, 0);
      assertEquals(r.ts, 0);
      assertEquals(r.caseId, "C");
    });
  },
});

Deno.test({
  name: "detect exit 2 for unusable caller dir",
  fn: async () => {
    // 検証意図: 存在しない呼出元は終了コード2で失敗すること。
    const { code } = await run("sh", [DETECT_SH, "/tmp/y2-no-such-dir"]);
    assertEquals(code, 2);
  },
});

// ---- runner E2E (docker/denoスタブ) ----

Deno.test({
  name: "run-qa-py passes ruff and records no-tests pytest as pass",
  fn: async () => {
    // 検証意図: ruff通過＋テストなし(pytest相当5)の集約がPASSになること。
    const stub = await makeStubBin();
    try {
      await withFixture(["a.py"], async (dir) => {
        const { code, out } = await run("sh", [RUN_PY, dir], {
          env: stubEnv(stub, { STUB_PYTEST_EXIT: "5" }),
        });
        assertEquals(code, 0, out);
        const log = await Deno.readTextFile(stub.log);
        assertStringIncludes(log, "build");
        assertStringIncludes(log, "ruff");
      });
    } finally {
      await Deno.remove(stub.dir, { recursive: true });
    }
  },
});

Deno.test({
  name: "run-qa-py fails on ruff findings and pytest errors (not on exit 5)",
  fn: async () => {
    // 検証意図: ruff非0・pytest非0/5以外がFAIL、5はPASS扱いであること。
    const stub = await makeStubBin();
    try {
      // pytest分岐を実行させるため test_*.py を含める。
      await withFixture(["a.py", "test_a.py"], async (dir) => {
        const bad = await run("sh", [RUN_PY, dir], {
          env: stubEnv(stub, { STUB_RUFF_EXIT: "1" }),
        });
        assertEquals(bad.code, 1, bad.out);
        const err = await run("sh", [RUN_PY, dir], {
          env: stubEnv(stub, { STUB_PYTEST_EXIT: "2" }),
        });
        assertEquals(err.code, 1, err.out);
      });
    } finally {
      await Deno.remove(stub.dir, { recursive: true });
    }
  },
});

Deno.test({
  name: "run-qa-sh aggregates shellcheck and shfmt",
  fn: async () => {
    // 検証意図: 両者0でPASS、shfmt差分(1)でFAILになること。
    const stub = await makeStubBin();
    try {
      await withFixture(["run.sh"], async (dir) => {
        const ok = await run("sh", [RUN_SH, dir], { env: stubEnv(stub) });
        assertEquals(ok.code, 0, ok.out);
        const diff = await run("sh", [RUN_SH, dir], {
          env: stubEnv(stub, { STUB_SHFMT_EXIT: "1" }),
        });
        assertEquals(diff.code, 1, diff.out);
        const log = await Deno.readTextFile(stub.log);
        assertStringIncludes(log, "shellcheck");
        assertStringIncludes(log, "shfmt");
      });
    } finally {
      await Deno.remove(stub.dir, { recursive: true });
    }
  },
});

Deno.test({
  name: "run-qa-ts skips with gate G when deno is missing",
  fn: async () => {
    // 検証意図: ゲートG（deno不在）はSKIP警告・終了コード0であること。
    await withFixture(["a.ts"], async (dir) => {
      const { code, out } = await run("sh", [RUN_TS, dir], {
        env: { PATH: "/usr/bin:/bin" },
      });
      assertEquals(code, 0, out);
      assertStringIncludes(out, "SKIP");
    });
  },
});

Deno.test({
  name: "run-qa-ts runs caller qa for D1 and direct steps for D2-only",
  fn: async () => {
    // 検証意図: D1時は呼出元のqa、D2単独時は直接ステップに分岐すること。
    const stub = await makeStubBin();
    try {
      await withFixture(["deno.json", "x.ts"], async (d1) => {
        const { code } = await run("sh", [RUN_TS, d1], {
          env: stubEnv(stub),
        });
        assertEquals(code, 0);
        const log = await Deno.readTextFile(stub.log);
        assertStringIncludes(log, "deno task qa");
      });
      await withFixture(["y.ts"], async (d2) => {
        const { code } = await run("sh", [RUN_TS, d2], {
          env: stubEnv(stub),
        });
        assertEquals(code, 0);
      });
    } finally {
      await Deno.remove(stub.dir, { recursive: true });
    }
  },
});

// ---- 版同期 (Dockerfileを正とする二重保守の機械検出) ----

Deno.test({
  name: "checker pins in SKILL.md match Dockerfile (single source)",
  fn: async () => {
    // 検証意図: 版の二重管理のdriftを機械検出すること。
    const df = await Deno.readTextFile(DOCKERFILE);
    const md = await Deno.readTextFile(SKILL_MD);
    const ruff = df.match(/ruff==(\S+?)"/);
    const pytest = df.match(/pytest==(\S+?)"/);
    const uv = df.match(/astral-sh\/uv:(\S+?)@/);
    const py = df.match(/python:([0-9.]+-slim)@/);
    if (!ruff || !pytest || !uv || !py) throw new Error("pin parse failed");
    for (const v of [ruff[1], pytest[1], uv[1], py[1]]) {
      assertStringIncludes(md, v);
    }
    const sh = await Deno.readTextFile(`${SCRIPTS}/run-qa-sh.sh`);
    for (
      const m of sh.matchAll(
        /(shellcheck:v\S+?@sha256:\w+|shfmt:v\S+?@sha256:\w+)/g,
      )
    ) {
      assertStringIncludes(md, m[1].split("@")[0]);
      assertStringIncludes(md, m[1].split("@")[1]);
    }
  },
});
