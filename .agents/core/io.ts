const STDIN_BUFFER_SIZE = 1024 * 16;

/**
 * 標準入力から JSON を読み取り、指定された型としてパースする。
 * 入力がない場合はエラーを投げる。
 */
export async function readJsonFromStdin<T>(): Promise<T> {
  const buffer = new Uint8Array(STDIN_BUFFER_SIZE);
  const n = await Deno.stdin.read(buffer);
  if (n === null) throw new Error("No input provided");
  return JSON.parse(new TextDecoder().decode(buffer.subarray(0, n))) as T;
}
