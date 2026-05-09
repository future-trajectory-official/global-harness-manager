import { assertEquals } from "jsr:@std/assert@1.0.7";
import { detectLanguage } from "../scripts/manage-sandbox.ts";
import { fsUtil } from "../../../../../core/harness-core.ts";

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
