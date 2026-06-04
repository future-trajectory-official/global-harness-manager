import { assertEquals } from "jsr:@std/assert@1.0.7";
import { detectLanguage } from "../scripts/manage-sandbox.ts";
import { fsUtil } from "../../../../../../.agents/core/harness-core.ts";

/**
 * detectLanguage - deno.json が存在する場合に "deno" を検出することを検証する。
 * fsUtil.exists をモックし、deno.json のみ存在する環境で正しく判定されることを確認する。
 */
Deno.test("detectLanguage - detects deno", async () => {
  const originalExists = fsUtil.exists;
  fsUtil.exists = (path: string) => Promise.resolve(path === "deno.json");

  try {
    const lang = await detectLanguage();
    assertEquals(lang, "deno");
  } finally {
    fsUtil.exists = originalExists;
  }
});

/**
 * detectLanguage - package.json が存在する場合に "node" を検出することを検証する。
 * Node.js プロジェクトの言語判定ロジックを確認する。
 */
Deno.test("detectLanguage - detects node", async () => {
  const originalExists = fsUtil.exists;
  fsUtil.exists = (path: string) => Promise.resolve(path === "package.json");

  try {
    const lang = await detectLanguage();
    assertEquals(lang, "node");
  } finally {
    fsUtil.exists = originalExists;
  }
});

/**
 * detectLanguage - requirements.txt が存在する場合に "python" を検出することを検証する。
 * Python プロジェクトの言語判定ロジックを確認する。
 */
Deno.test("detectLanguage - detects python", async () => {
  const originalExists = fsUtil.exists;
  fsUtil.exists = (path: string) => Promise.resolve(path === "requirements.txt");

  try {
    const lang = await detectLanguage();
    assertEquals(lang, "python");
  } finally {
    fsUtil.exists = originalExists;
  }
});
