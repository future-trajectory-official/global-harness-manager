# リネーム・書換規則

`global-` リネームと参照整合性のための規則。

## normalizeSkillName

- 入力を trim → 小文字化 → `[^a-z0-9]+` を `-` に置換 → 前後 `-` を除去。
- 先頭に `global-` を付与する。`~` はシェル展開リスクのため不使用（同関数の JsDoc 参照）。

```ts
`global-${norm}`;
```

## collectSkills

- `skills/bundles/<bundle>/<name>/` のディレクトリ列挙。
- `bundles/` が存在しなければ空配列を返す。

## buildRenameMap

- `{bundle, name}` → `{before: "<bundle>/<name>", after: "global-<name>", bundle, name}`。
- 変換後の重複（異 bundle 同名・異表記衝突）は `throw` で中断。

重複時はコピー前に fail-fast で中断するため、`--dry-run`
で重複エラーが出た場合は配布元のスキル名を修正して再実行する。

## applyRenameMap

- 配布先 `<dest>/skills/bundles/<bundle>/<name>` → `<dest>/skills/bundles/<bundle>/global-<name>`。
- リネーム元が無ければ skip。
- `global-` 先が既存なら置換で最新化（再配布反映）。
- 適用成功分のみを返す。

## rewriteSkillFrontmatter

- 配布先各スキルの `SKILL.md` の `name:` を `global-<name>` へ書換。
- OpenCode は `name` とディレクトリ名の一致を必須とするため。
- 正規表現 `^name:\s*<旧名>\s*$`（multiline）で一致行のみ置換。
- 不一致時は警告して skip。

## rewriteReferences（対象 .md のみ）

1. `(/)?\.opencode/skills/bundles/<bundle>/<name>` →
   `<dest>/skills/bundles/<bundle>/global-<name>`。
2. `(/)?\.opencode/(agents|commands|guides|context|core)/` → `<dest>/$1/`。
3. `[skill:<name>]` → `[skill:global-<name>]`（既存 `global-` は置換しない冪等）。

## rewriteSkillImports（対象 skills/ 配下 .ts のみ）

- `bundles/<bundle>/<name>/` → `bundles/<bundle>/global-<name>/`。
- 既 `global-` 化パスには一致しないため冪等。

## rename-map 書込み（`writeRenameMap`）

- 適用マップを `<dest>/skill-rename-map.json` へ JSON 書込み。
