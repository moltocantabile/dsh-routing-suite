# @dsh-external/dsh-router-presets

The router presets (`router-standard`, `router-spec`, `router-react`) packaged as a
DSH ≥ 0.2.1 **bundle**. In 0.2.1 the harness no longer reads
`$DSH_HOME/.agent-presets/`: a preset is an `@deepseek-ai/dsh-agent-preset` row
carried by a bundle patch. This package is that carrier — `cordis.patch.yml`
inserts the three `preset-router-*` rows (each with its migrated entry list
inline as `config.plugins`), and `assets/<preset>/` ships the preset `.mjs`
plugins as package resources so their names resolve from the profile instead of
a preset directory.

Install (profile `web`, DSH_HOME defaults to `~/.dsh`):

```bash
dsh plugin --profile web add /path/to/dsh-routing-suite/bundles/router-presets
```

Then append `"@dsh-external/dsh-router-presets"` to `dsh.profile.bundles` in
`<DSH_HOME>/profiles/web/package.json` (after `@deepseek-ai/dsh-web-app`), and
delete the now-ignored legacy `$DSH_HOME/.agent-presets/` directories.

## Updating

`sources of truth live in `preset/<preset>/` (`preset.yml` for the display name,
description and roster order; `agent.cordis.yml` for the plugin entries).
Never hand-edit `cordis.patch.yml` or `assets/` — regenerate them:

```bash
node scripts/build-preset-bundle.mjs   # idempotent; run from the repo root
```

The generator rewrites relative plugin names (`./router-bootstrap-v34.mjs?v=88`)
to `@dsh-external/dsh-router-presets/assets/<preset>/router-bootstrap-v34.mjs`,
renames the persona `config.text:` key to `config.prefix:`, and re-inserts the
`workflow-ptc` engine row inside each preset's delegation group.