# リネーム・書換規則

`global-` リネームと参照整合性のための規則。実装は L46-49・L113-371。

## normalizeSkillName（L46-49）

- 入力を trim → 小文字化 → `[^a-z0-9]+` を `-` に置換 → 前後 `-` を除去。
- 先頭に `global-` を付与する。`~` はシェル展開リスクのため不使用（L43）。

```ts
`global-${norm}`;
```

## collectSkills（L113-128）

- `skills/bundles/<bundle>/<name>/` のディレクトリ列挙。
- `bundles/` が存在しなければ空配列を返す。

## buildRenameMap（L136-152）

- `{bundle, name}` → `{before: "<bundle>/<name>", after: "global-<name>", bundle, name}`。
- 変換後の重複（異 bundle 同名・異表記衝突）は `throw` で中断（L141-147）。

## applyRenameMap（L202-249）

- 配布先 `<dest>/skills/bundles/<bundle>/<name>` → `<dest>/skills/bundles/<bundle>/global-<name>`。
- リネーム元が無ければ skip（L223-226）。
- `global-` 先が既存なら置換で最新化（再配布反映。L227-239）。
- 適用成功分のみを返す（L207・L247）。

## rewriteSkillFrontmatter（L260-291）

- 配布先各スキルの `SKILL.md` の `name:` を `global-<name>` へ書換。
- OpenCode は `name` とディレクトリ名の一致を必須とするため（L253-256）。
- 正規表現 `^name:\s*<旧名>\s*$`（multiline）で一致行のみ置換（L280-283）。
- 不一致時は警告して skip（L284-287）。

## rewriteReferences（L309-334、対象 .md のみ）

1. `(⁠/.opencode)?/skills/bundles/<bundle>/<name>` →
   `<destRoot>/skills/bundles/<bundle>/global-<name>`（L318-321）。
2. `(⁠/.opencode)?/(agents|commands|guides|context|core)/` → `<destRoot>/$1/`（L323-326）。
3. `[skill:<name>]` → `[skill:global-<name>]`（既存 `global-` は置換しない冪等。L328）。

## rewriteSkillImports（L346-371、対象 skills/ 配下 .ts のみ）

- `bundles/<bundle>/<name>/` → `bundles/<bundle>/global-<name>/`（L358-364）。
- 既 `global-` 化パスには一致しないため冪等（L340）。

## rename-map 書込み（L404-412）

- 適用マップを `<dest>/skill-rename-map.json` へ JSON 書込み（`RENAME_MAP_FILE` L30）。
