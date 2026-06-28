import type { BoardOutput, ConfigContent, EntityScope, LabelDefinition, List } from "./types.ts";

/**
 * 環境設定の管理を担当するGatewayのポート（インターフェース）。
 *
 * プロジェクト環境の設定情報管理と初期化準備を行う。
 * Gateway層（具象実装）はローカルファイルI/Oやgh CLI経由で
 * 設定の読み書きやProject V2ボードの操作を実行する。
 *
 * ## 依存方向（DIP）
 *
 * - Domain層が本インターフェース（ポート）を定義する
 * - Gateway層が本インターフェースを実装する（アダプター）
 * - Domain層はGateway層の具象実装を知らない
 */
export interface ConfigGateway {
  /**
   * 現在のGitHubリポジトリのスコープを解決する。
   *
   * `gh repo view --json owner,name` を実行し、owner と repository を取得する。
   *
   * @returns 解決されたスコープ（owner, repository）。
   * @throws {Error} GATEWAY_ERROR - gh CLI の実行に失敗した場合。
   */
  resolveScope(): Promise<EntityScope>;

  /**
   * 設定情報を読み込む。
   *
   * @param source - 設定ファイルのソースパスまたは識別子。空文字でないこと。
   * @returns 読み込まれた設定情報。
   * @throws {Error} INVALID_INPUT - source が空文字の場合。
   * @throws {Error} FILE_NOT_FOUND - 指定されたソースが存在しない場合。
   * @throws {Error} GATEWAY_ERROR - ファイルI/Oに失敗した場合。
   */
  readConfig(source: string): ConfigContent;

  /**
   * 設定情報を書き込む。
   *
   * @param target - 設定ファイルの出力先パスまたは識別子。空文字でないこと。
   * @param content - 書き込む設定内容。
   * @throws {Error} INVALID_INPUT - target が空文字の場合。
   * @throws {Error} GATEWAY_ERROR - ファイルI/Oに失敗した場合。
   */
  writeConfig(target: string, content: string): void;

  /**
   * 管理対象のProject V2ボード一覧を取得する。
   *
   * @returns ボードの一覧。ボードが存在しない場合は totalCount が 0 の空リスト。
   * @throws {Error} GATEWAY_ERROR - gh CLIの実行に失敗した場合。
   */
  listBoards(): Promise<List<BoardOutput>>;

  /**
   * 新しいProject V2ボードを作成する。
   *
   * @param name - 作成するボードの名前。空文字でないこと。
   * @param owner - ボードの所有者（GitHubユーザー名または Organization名）。空文字でないこと。
   * @returns 作成されたボードの情報。
   * @throws {Error} INVALID_INPUT - name または owner が空文字の場合。
   * @throws {Error} GATEWAY_ERROR - ボードの作成に失敗した場合。
   */
  createBoard(name: string, owner: string): Promise<BoardOutput>;

  /**
   * GitHub Issue ラベルを作成する。
   *
   * @param label - 作成するラベルの定義（name, color, description）。
   * @throws {Error} INVALID_INPUT - name が空文字の場合。
   * @throws {Error} GATEWAY_ERROR - gh CLI の実行に失敗した場合。
   */
  createLabel(label: LabelDefinition): Promise<void>;
}
