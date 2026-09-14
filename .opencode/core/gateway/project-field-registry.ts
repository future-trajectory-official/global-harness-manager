/**
 * Project V2 フィールド名・ボード番号の解決レジストリ（シングルトン）。
 *
 * 本番コードが参照するのはあくまで `.harnessrc`（実ファイル）のみである
 * （`.harnessrc.example` はボード作成時にボード番号を埋める雛形であり、本番コードは参照しない）。
 * `.harnessrc` はボード番号がアカウント・作成タイミングごとに異なるため git追跡不可（gitignore 済み）。
 *
 * `projects`（ボード番号：変動）と `fields`（フィールド名：固定）を読み取り、
 * `field-registry.ts` の型付き定義（HARNESS_FIELDS）と整合することを検証して提供する。
 */
import { HARNESS_FIELDS, isHarnessField } from "./field-registry.ts";

/** `.harnessrc` の構造型。projects と fields を持つ。 */
export interface HarnessConfigInput {
  projects?: Record<string, number>;
  fields?: Record<string, string>;
}

export class ProjectV2FieldRegistry {
  private static instance: ProjectV2FieldRegistry | null = null;
  private projects: Record<string, number> = {};
  private fields: Record<string, string> = {};
  private loaded = false;

  private constructor() {}

  /** 単一インスタンスを返す（シングルトン）。 */
  static getInstance(): ProjectV2FieldRegistry {
    if (!ProjectV2FieldRegistry.instance) {
      ProjectV2FieldRegistry.instance = new ProjectV2FieldRegistry();
    }
    return ProjectV2FieldRegistry.instance;
  }

  /**
   * `.harnessrc` の内容を読み込み、ボード番号とフィールド名を保持する。
   * fields（フィールド名）は不変のため、field-registry の正（HARNESS_FIELDS）と整合することを
   * 検証する（整合しない場合は throw）。これにより `.harnessrc` の fields セクションが実行時の
   * 検証に実際に使われる。
   */
  load(config: HarnessConfigInput): void {
    this.projects = config.projects ?? {};
    this.fields = config.fields ?? {};
    this.loaded = true;
    this.validateFieldsAgainstRegistry();
  }

  /** `.harnessrc` の fields が field-registry の正（HARNESS_FIELDS）と整合するか検証する。 */
  private validateFieldsAgainstRegistry(): void {
    const registry = HARNESS_FIELDS as readonly string[];
    for (const name of Object.keys(this.fields)) {
      if (!registry.includes(name)) {
        throw new Error(`Field "${name}" in .harnessrc is not a known harness field`);
      }
    }
    for (const name of registry) {
      if (!(name in this.fields)) {
        throw new Error(`Harness field "${name}" is missing from .harnessrc fields`);
      }
    }
  }

  /** 設定が読み込まれているか（少なくともボード番号が 1 つ以上）を返す。 */
  isConfigured(): boolean {
    return this.loaded && Object.keys(this.projects).length > 0;
  }

  /**
   * ボード識別子に対応する実ボード番号を返す。未設定時は undefined。
   */
  board(key: string): number | undefined {
    return this.projects[key];
  }

  /**
   * フィールド名を正のレジストリとして解決して返す。
   * フィールド名は不変（リポジトリ・アカウント非依存）のため、`field-registry.ts` の正
   * （HARNESS_FIELDS）に含まれることを検証し、さらに `.harnessrc` の fields（現在有効な
   * フィールド集合）へ登録済みであることを検証する。
   */
  field(name: string): string {
    if (!isHarnessField(name)) {
      throw new Error(`Unknown harness field: ${name}`);
    }
    if (!(name in this.fields)) {
      throw new Error(`Field "${name}" is not registered in .harnessrc fields`);
    }
    return name;
  }

  /** テスト用にシングルトン状態をリセットする。 */
  reset(): void {
    this.projects = {};
    this.fields = {};
    this.loaded = false;
  }
}
