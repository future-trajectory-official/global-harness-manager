// --- Simple Logger ---
export const logger = {
  info: (msg: string) => {
    console.log(`%c[INFO] %c${msg}`, "color: green; font-weight: bold", "");
  },
  warn: (msg: string) => {
    console.warn(`%c[WARN] %c${msg}`, "color: yellow; font-weight: bold", "");
  },
  error: (msg: string) => {
    console.error(`%c[ERROR] %c${msg}`, "color: red; font-weight: bold", "");
  },
  dryRun: (msg: string) => {
    console.log(`%c[DRY-RUN] %c${msg}`, "color: cyan; font-weight: bold", "");
  },
  success: (msg: string) => {
    console.log(`%c[SUCCESS] %c${msg}`, "color: lime; font-weight: bold", "");
  },
  debug: (msg: string) => {
    // デバッグ出力は JSON を stdout に出すスキル（read-project-state 等）の契約を壊さないよう、
    // stderr へ書く。console.debug は Deno では stdout に出力されるため使わない。
    console.error(`%c[DEBUG] %c${msg}`, "color: gray; font-weight: bold", "");
  },
};
