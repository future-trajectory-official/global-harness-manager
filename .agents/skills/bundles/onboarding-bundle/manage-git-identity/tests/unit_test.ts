import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parseIdentities } from "../scripts/add-identity.ts";

/**
 * parseIdentities - 複数の identity を正しくパースできることを検証する。
 * 2つのアカウント情報が配列として返され、各フィールドが期待値と一致することを確認する。
 */
Deno.test("parseIdentities - should correctly parse multiple identities", () => {
  const content = `
## Project A
- **Account Name**: \`user1\`
- **User Email**: \`user1@example.com\`

## Project B
- **Account Name**: \`user2\`
- **User Email**: \`user2@example.com\`
`;
  const result = parseIdentities(content);
  assertEquals(result.length, 2);
  assertEquals(result[0], { accountName: "user1", accountEmail: "user1@example.com" });
  assertEquals(result[1], { accountName: "user2", accountEmail: "user2@example.com" });
});

/**
 * parseIdentities - 重複するアカウント名がスキップされることを検証する。
 * 同じアカウント名で異なるメールアドレスが定義された場合、最初の定義のみが保持されることを確認する。
 */
Deno.test("parseIdentities - should skip duplicate account names", () => {
  const content = `
## Project A
- **Account Name**: \`user1\`
- **User Email**: \`user1@example.com\`

## Project A Again
- **Account Name**: \`user1\`
- **User Email**: \`different@example.com\`
`;
  const result = parseIdentities(content);
  assertEquals(result.length, 1);
  assertEquals(result[0].accountEmail, "user1@example.com");
});

/**
 * parseIdentities - 不正なフォーマットのコンテンツに対して空配列を返すことを検証する。
 * アカウント名が存在しないセクションをパースした場合の異常系を確認する。
 */
Deno.test("parseIdentities - should return empty array for invalid content", () => {
  const content = `
## Invalid Section
- No account name here
`;
  const result = parseIdentities(content);
  assertEquals(result.length, 0);
});
