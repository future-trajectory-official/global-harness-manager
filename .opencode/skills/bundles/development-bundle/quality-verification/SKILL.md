---
name: quality-verification
description: 品質検証（deno test, coverage, lint, type check, format）を標準化された手順で選択・実行し、結果レポートを出力する。
tags:
  trigger:
    - run-quality-checks
    - verify-quality
    - run-qa
    - execute-verification
  category: development
  constraints: requires-deno
---

# Quality Verification

本スキルは、開発の仕上げ段階や任意のタイミングでプロジェクト全体の品質を検証するための標準手順を提供する。
検証タイプの選択から実行、レポート出力までを一貫して行い、品質の可視化と証跡の残存を支援する。

## 用語の分離: `requires-deno-runner` / `requires-deno-target` (Y2)

`requires-deno` は以下の2概念に分離して扱う。以降の表記は本用語に統一する。

- `requires-deno-runner`: denoバイナリの解決 (`command -v deno`)。検証系の実行基盤。
- `requires-deno-target`: Deno検証対象コードの存在 (D1: `deno.json`/`deno.jsonc` の存在、 D2:
  除外後の `*.ts` が1件以上)。呼出元リポジトリ直下で判定する。
- frontmatter の `constraints: requires-deno` は既存ゲート互換のため当面維持し、 機械的な意味は
  `requires-deno-runner` とする (ゲートGが参照するのはrunnerである)。 呼出元での Deno 排除はしない。
  sunset条件: ゲート判定側が `requires-deno-runner/target` を解釈可能になった時点で
  frontmatterを分離表記へ移行する。それまでは旧名を残す。

## 前提条件

- Deno がインストールされ、`deno task` が実行可能であること
- 品質検証の対象となるソースコードが存在すること
- py/sh 系の検証を行う場合は Docker が利用可能であること (checker はコンテナ提供)

## 関連スキルとの関係

本スキルは以下のスキルと**補完関係**にある：

| スキル                         | 関係         | 説明                                                                 |
| ------------------------------ | ------------ | -------------------------------------------------------------------- |
| `ac-checkpoint-implementation` | 補完（下流） | 個別ACの検証を担当。本スキルは全体的な品質保証の最終ゲートを担う。   |
| `develop-environment-setup`    | 補完（上流） | サンドボックス環境構築後に本スキルを実行し、環境の健全性を確認する。 |

## 実行手順

### Step 0: 呼出元の特定と言語検出 (Y2適応)

呼出元リポジトリ直下へ移動した後の `pwd` を起点とする。起点は `git rev-parse --show-toplevel`、
非git時は `$PWD`。スキル側リポジトリのCWDではない。呼出元パスは引数又は環境変数で受け、スキル内で
`cd` する (runnerスクリプトが絶対パス化するため、相対パス渡し可)。呼出元への `deno.json` /
`.gitignore` 配置は行わない (Y1非スコープ)。

ゲートG (ランナー有無): `command -v deno` が不可の場合、`qa:ts` 系のみ停止する
(環境不足として記録+導入案内)。py/sh系はコンテナ提供のため継続する。 ゲートGの実装は
`scripts/run-qa-ts.sh` が担う (deno不在時はSKIP警告・終了コード0)。

検出はすべて存在有無の静的検出 (内容解釈はしない)。拡張子なしshebang・Dockerfile内shellは
一次スクリーニング対象外 (将来拡張・非スコープ)。`git ls-files` はuntracked欠落のため不採用。

```bash
sh <skill-dir>/scripts/detect-languages.sh <caller-dir>
# 出力例 (Nは件数): CASE=B TS=0 PY=N SH=N D1=no
```

| #  | 対象                              | 検出条件 (D1/D2はORで結合)                                        | 備考                 |
| -- | --------------------------------- | ----------------------------------------------------------------- | -------------------- |
| D1 | requires-deno-target (設定あり)   | CWD直下に `deno.json` 又は `deno.jsonc` が存在 (`test -f` で判定) | ランナー設定の存在   |
| D2 | requires-deno-target (コードあり) | 除外後の `*.ts` が1件以上                                         | 検証対象コードの存在 |
| P1 | py                                | 除外後の `*.py` が1件以上                                         |                      |
| S1 | sh                                | 除外後の `*.sh` が1件以上                                         |                      |

除外 (共通): `.git` / `node_modules` / `cov_profile` / `dist` / `build` / `__pycache__` / `vendor`
(`.opencode/node_modules` を含む、任意階層)。 除外リストの正は `scripts/lib-targets.sh`
であり、本表は参照である (二重保守のdriftは `detect_languages_test.ts` の版同期テストで検出する)。
`git ls-files` はuntracked欠落のため不採用 (代償として `.gitignore`
は無視する。生成物の誤検出は件数ログで人間が判断する)。

判定フロー (ゲートG → A〜E)。D1/D2はOR結合、P1/S1はAND・単独で分岐する:

| ケース | 検出結果                  | 実行内容                                                                                                       |
| ------ | ------------------------- | -------------------------------------------------------------------------------------------------------------- |
| A      | D1又はD2あり              | `qa:ts` を実行。P1/S1もある混在時は `qa:py` / `qa:sh` を併走 (A＋B系の重ね合わせ)。単独Deno時のみ `qa:ts` のみ |
| B      | D1/D2なし・P1あり・S1あり | py→ruff/pytest、sh→shellcheck/shfmt を組合せ実行。終了コードはAND集約し、枝ごとの成否をレポートに個別記録      |
| C      | D1/D2なし・P1あり・S1なし | py系のみ実行                                                                                                   |
| D      | D1/D2なし・P1なし・S1あり | sh系のみ実行                                                                                                   |
| E      | すべてなし                | 正常系の空振り防止: 何も実行せず終了コード0、検出結果ログ+理由を記録                                           |

AND集約の規約: 各枝runnerの終了コード0のみが成功。ただし pytest終了コード5 (テスト未収集)
は「テストなし」として成功扱いする。shellcheckの指摘 (exit 1)・ shfmtの差分 (exit 1) は枝FAIL
(要修正) として記録する。checker自体の異常 (exit 2等)
は環境エラーとして区別する。総合終了コードは全枝成功時のみ0。

- 複数検出時 (B、及びA混在時) は組合せ実行・排他選択なし。
- D1単独 (設定あり・tsゼロ) の場合はケースAに含めるが、`deno check` 対象列挙が空の
  場合はチェックをスキップ成功として警告記録する (shell globに依存しない)。
- 対象外・空振り時も検出ログ記録を必須とする。ログ形式: 判定ケースID / 各glob件数 (ts/py/sh) /
  D1=yes|no / 日時 / 終了コードを stdout + Quality Verification Report へ追記。

### Step 1: 検証タイプの選択

以下の検証タイプから、目的に応じて1つ以上を選択する。

| # | 検証タイプ     | 目的                                 | 推奨タイミング                 |
| - | -------------- | ------------------------------------ | ------------------------------ |
| 1 | ユニットテスト | 機能の正常動作と回帰防止             | 実装後、マージ前               |
| 2 | カバレッジ測定 | テスト網羅率の確認                   | ユニットテストと同時または別途 |
| 3 | リンター       | コード規約とベストプラクティスの遵守 | コミット前、CI                 |
| 4 | 型チェック     | 型の整合性とコンパイルエラーの防止   | リンターと同時                 |
| 5 | フォーマット   | コードスタイルの統一                 | リンターと同時                 |

### Step 2: 検証の実行

選択した検証タイプに応じたコマンドを実行する。

```bash
# 全検証を一括実行（推奨）
deno task qa

# 個別検証
deno task test        # ユニットテスト
deno task test:cov    # カバレッジ測定付きテスト
deno task lint        # リンター
deno task check       # 型チェック
deno fmt --check      # フォーマットチェック
```

#### 言語別qa分岐ラベル (Y2): `qa:ts` / `qa:py` / `qa:sh`

- `qa:ts` = Deno系一括 (従来の `deno task qa` と同一)。既存 `qa` は `qa:ts`
  へのエイリアスとして残す。
- `qa:py` = py系一括 (ruff check + pytest)。runner `scripts/run-qa-py.sh` で実行する。
- `qa:sh` = sh系一括 (shellcheck + shfmt -d)。runner `scripts/run-qa-sh.sh` で実行する。
- `qa:ts` の実行は runner `scripts/run-qa-ts.sh` が担う (D1あり=呼出元の
  `deno task qa`、D2単独=明示列挙の直接ステップ、ゲートG含む)。
- 命名の対応: 分岐ラベルはコロン (`qa:py`)、checkerイメージ名はハイフン
  (`harness-qa-py`)。混同時は本表を正とする。
- 定義場所の一本化: 分岐はスキル内手順＋runnerスクリプトに一本化する。呼出元に `deno.json`
  を置かないため (Y1非スコープ)、呼出に使う `deno.json` はスキル側
  リポジトリのものか、D2単独時はrunnerの直接ステップに限る。 フォールバック用 `deno.json`
  の配布はしない (呼出元の設定所有権を曖昧にするため)。 配布物に含めるY2機構は
  runnerスクリプト群＋検出スクリプト＋Dockerfile である。

実行は dockerコマンド直書きではなく runner経由とする (除外列挙・集約規約・ build-then-run
をコードで担保するため):

```bash
sh <skill-dir>/scripts/run-qa-py.sh <caller-dir>  # qa:py
sh <skill-dir>/scripts/run-qa-sh.sh <caller-dir>  # qa:sh
sh <skill-dir>/scripts/run-qa-ts.sh <caller-dir>  # qa:ts
```

runnerの要点 (詳細は各スクリプトのヘッダコメントを正とする):

- `run-qa-py.sh`: 実行前にイメージを必ずビルドする (PO決定#855-5。キャッシュで
  不変時は即時)。`ruff check --no-cache` (`:ro` マウントのため必須)＋
  `pytest -p no:cacheprovider`＋`PYTHONDONTWRITEBYTECODE=1` (`:ro` 安全のため)。 pytestは
  `test_*.py` / `*_test.py` のみを対象にする (全 `.py` 渡しは呼出元の
  未宣言依存で収集エラーになるため)。
- `run-qa-sh.sh`: 除外付きで列挙した `.sh` を `shellcheck` / `shfmt -d` に渡す。
  両イメージともentrypointが本体のため、コマンド名を重ねないこと (`shfmt` 側も同様。`shfmt shfmt -d`
  は誤り)。
- `run-qa-ts.sh`: D1あり=呼出元の `deno task qa`、D2単独= `fmt --check` / `lint` / `check`
  (明示列挙) / `test` の直接実行。config不在時の `deno check`
  空振りはスキップ成功として警告記録する。

checker提供の版 (2026-10-21確定・証跡。Dockerfileを正とし、本表との一致は `detect_languages_test.ts`
の版同期テストで機械検出する):

| checker    | 提供形態                                                                                              | 版      |
| ---------- | ----------------------------------------------------------------------------------------------------- | ------- |
| ruff       | `harness-qa-py:20261021` 内蔵                                                                         | 0.17.1  |
| pytest     | `harness-qa-py:20261021` 内蔵                                                                         | 9.1.1   |
| uv         | `harness-qa-py:20261021` 内蔵                                                                         | 0.13.4  |
| shellcheck | `koalaman/shellcheck:v0.11.0@sha256:61862eba1fcf09a484ebcc6feea46f1782532571a34ed51fedf90dd25f925a8d` | 0.11.0  |
| shfmt      | `mvdan/shfmt:v3.14.1@sha256:8c06884a35683d8763fba6c0d9484d11a61a96da65f8d497d6f625825a6043f2`         | v3.14.1 |

`harness-qa-py:20261021` はローカルビルドイメージである (基盤
`python:3.12-slim@sha256:6c4dd321d176d61ea848dc8c73a4f7dbae8f70e0ee48bb411ea2f045b599fa8e`

- `ghcr.io/astral-sh/uv:0.13.4@sha256:9f130421e930bfbdc563c00740466603f8723158e90297d07957c2294640262b`
  由来のuv同梱 + `ruff==0.17.1` `pytest==9.1.1` をpip固定)。 版タグは可変名 (`latest`/`stable`)
  を使わず版対応タグ＋digestで固定する。 ビルドは runner が実行の都度行う
  (不変時はキャッシュで即時)。実行後は `docker inspect` の digest を Report に記録する
  (タグではなくdigestで検証する)。 再ビルド手順: `assets/dockerfiles/qa-py.Dockerfile` を正とする。

### Step 3: 結果の確認

各検証の終了コードと出力内容を確認する。

- **終了コード 0**: 全検証成功
- **終了コード 非0**: 検証失敗（詳細は出力内容を参照）

### Step 4: レポートの提示

検証完了後、以下のフォーマットで結果レポートを提示する。

```markdown
### Quality Verification Report

**検証日時**: YYYY-MM-DD HH:mm **実行環境**: [local / sandbox / CI]

#### 呼出元検出 (Y2追記欄)

- 判定ケースID: [A/B/C/D/E] / ts=[N] py=[N] sh=[N] / D1=[yes/no] / 日時 / 終了コード=[N]
- checker版: ruff=[ver] pytest=[ver] shellcheck=[ver] shfmt=[ver] / uv=[ver]
- イメージ: [name:tag@sha256:digest] x N / 実行コマンド全文

#### 実行した検証

- [x] deno test --all passed (N tests)
- [ ] deno lint --N warnings
- [x] deno check --passed
- [x] deno fmt --check --passed

#### カバレッジサマリー（測定した場合）

- 全体カバレッジ: XX.XX%

#### 総評

[All checks passed / 修正が必要な項目あり]
```

## 注意事項

- **プロジェクト全体の品質ゲートとして使用すること**:
  部分的な修正の検証ではなく、必ずプロジェクト全体のテスト・リンター・型チェックを実行し、回帰を防止する。
- **カバレッジ測定後のクリーンアップは呼出側の責務**:
  本スキルは検証のみを行い、生成されたアーティファクトの削除は行わない。
- **WIPコミットやPR作成は本スキルの責務外**: Git操作やCI連携は外側のワークフローが管理する。
