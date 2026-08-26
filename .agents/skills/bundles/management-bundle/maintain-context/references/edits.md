# maintain-context 編集規則

本リファレンスは、maintain-context がプロジェクト固有の用語集 `product.md`
に用語を追加・変更する際の規則を定める。読み込み系 `assess-context` が扱う読み込みと対をなし、
**不変の管理概念 `management.md` を変更しない**ことを最優先のガードとする。

## 1. 編集対象と対象外

| 対象                                 | 扱い         | 説明                                                        |
| ------------------------------------ | ------------ | ----------------------------------------------------------- |
| `.agents/context/product.md`         | **編集対象** | プロジェクト固有の用語。git追跡対象外・利用者編集           |
| `.agents/context/management.md`      | 対象外       | ハーネスの管理概念。git追跡対象・不変配布。**編集禁止**     |
| `.agents/context/product.md.example` | 対象外       | 構造見本。git追跡対象。**編集しない**（見本用語の混入防止） |

- 編集対象は **`product.md` のみ**。`.example`（構造見本）・`management.md`（不変）は変更しない。

## 2. `product.md` の構造（配布汎用）

- `product.md` は、`product.md.example`（構造見本）に準じたセクション構成を持つ。
- 実際のセクション見出しや具体的な用語・概念は**各リポジトリの実態に依存**するため、本スキルは固定しない。
- 編集時は、対象リポジトリの `product.md` に既に存在するセクション（表・箇条書き等）の形式に合わせ、
  一貫性を保つこと。見本（`.example`）には決して追記しない。

## 3. 編集の作法

1. `product.md` を `Read` で読み、現在の用語・構造を把握する。
2. 追加・変更する用語を、それを置くべき既存セクションの形式（表・箇条書き）に合わせて記述する。
3. `management.md` が定義する管理概念（9概念・状態遷移・指標・品質要件等）は**記載しない**。
   （管理概念はハーネスが管理する不変定義のため）
4. 変更履歴は本ファイル内には残さない。git（VCS）のコミット履歴で代替する。

## 4. `management.md` 不変ガード（編集後検証）

`product.md` を編集した後、`management.md` に差分がないことを機械的に確認する。

```bash
# management.md に変更がないこと
git diff --name-only .agents/context/management.md
# → 空（出力なし）であれば OK。何か出力された場合は編集を取り消す。

# product.md.example にも変更がないこと
git diff --name-only .agents/context/product.md.example
# → 空（出力なし）であれば OK。
```

- 上記の出力が空でない場合は、`management.md` または `product.md.example`
  を誤って変更したことを示す。`git restore` で取り消し、`product.md` のみに限定し直すこと。
- **破壊的操作の禁止**: `management.md` の再生成を目的とした編集は行わない。

## 5. gitignore 運用（`product.md` の追跡維持）

- `product.md` は git追跡対象外（利用者編集）とする。context 配下のネスト `.gitignore` 等に
  `product.md`、`!product.md.example` を定義し、これを維持する。
- この gitignore 設定を削除・変更しないこと。削除すると `product.md`
  が追跡対象となり、配布・マージ時に不整合を生じる。
- 具体的なファイル配置は各リポジトリの規約に従うが、「`product.md`（利用者編集・追跡対象外）と
  `product.md.example`（配布対象・追跡対象）」の分離は必ず維持する。
