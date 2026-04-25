# Config Reference: Required Settings

`check-harness-configs` スキルが検証対象とする設定ファイルの一覧です。

## 1. 認証関連
- **`config/identities.txt`**:
  - **役割**: 管理する GitHub アカウントのリスト。
  - **形式**: `アカウント名,メールアドレス`
- **`config/identities.txt.example`**:
  - `identities.txt` のテンプレート。

## 2. スキル・パス管理
- **`config/global-skills-path.txt`**:
  - **役割**: エージェントが読み込むスキルのルートディレクトリ。
- **`config/global-skills-path.txt.example`**:
  - `global-skills-path.txt` のテンプレート。

## 3. 同期ターゲット
- **`config/publish-targets.md`**:
  - **役割**: スキルを同期・公開する際のリモートリポジトリやディレクトリ。
- **`config/publish-rules-targets.md`**:
  - **役割**: ルール（.md）を同期する際のターゲット。
