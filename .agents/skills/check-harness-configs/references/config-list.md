# Config Reference: Required Settings

`check-harness-configs` スキルが検証対象とする設定ファイルの一覧です。

## 1. 認証関連
- **`config/identities.txt`**:
  - **役割**: 管理する GitHub アカウントのリスト。
  - **形式**: `アカウント名,メールアドレス` (例: `your-name,your-email@example.com`)

## 2. スキル・パス管理
- **`config/global-skills-path.txt`**:
  - **役割**: エージェントが読み込むスキルのルートディレクトリ。
  - **形式**: 1行に1つのディレクトリパス

## 3. 同期ターゲット (Markdown 形式)
- **`config/publish-rules-targets.md`**:
  - **役割**: ルール（.md）を同期する際のターゲットと対象指定。
- **`config/publish-targets.md`**:
  - **役割**: スキルを同期・公開する際のリモートリポジトリやディレクトリの指定。
