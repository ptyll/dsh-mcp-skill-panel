# Upgrade to DeepSeek Harness 0.2.0-rc.2

This release upgrades `ptyll/dsh-mcp-skill-panel` from tag `v0.6.1` to plugin version `0.7.0`. It targets exactly Harness `0.2.0-rc.2` and is distributed through the [GitHub tag and release archive](https://github.com/ptyll/dsh-mcp-skill-panel/releases/tag/v0.7.0), not npm.

## Install

Install the GitHub tag in your profile, then restart Harness:

```sh
dsh plugin --profile web add github:ptyll/dsh-mcp-skill-panel#v0.7.0
```

Alternatively, download `dsh-mcp-skill-panel-0.7.0.tgz` from the release, or build and test with Node >=22.19:

```sh
npm ci --ignore-scripts
npm run typecheck
npm run build
npm run verify
npm test
npm pack
```

Install the generated archive in the profile you use, then restart Harness:

```sh
dsh plugin --profile web add ./dsh-mcp-skill-panel-0.7.0.tgz
```

For Desktop, fully quit the application and use `--profile desktop`. An absolute archive path can be used from another directory. Reinstalling `github:ptyll/dsh-mcp-skill-panel#v0.6.1` still installs the old code.

## Compatibility changes

Harness replaced the file-backed `dsh-agent-presets` with [`dsh-agent-preset-registry`](https://github.com/deepseek-ai/deepseek-harness/tree/dsh-v0.2.0-rc.2/packages/preset/agent-preset-registry). Its definitions mount eagerly, `resolve()` returns metadata without a path, and `standingKeyFor()` no longer exists. The panel reads live, root-filtered registry mounts, combines them with Host MCP entries, and addresses each preset row with an opaque preset/row/revision handle. No `agent.cordis.yml` is required.

Desired MCP state is stored in the existing `state.json`, under `mcp["preset:<id>"][<relative row id>]`. It is restored after Host loader settlement and at the awaited `agent/created` boundary, before the first model request. Deferred toggles and project MCP initialization also finish at this boundary. Existing sessions retain their preset revision; a panel handle operates on that exact revision, while saved intent is applied across retained revisions at the next boundary or restart.

Scope lookup is performed per session and falls back to the default preset before any session exists. Middle-layer calls resolve entries in the requesting agent's preset and track temporary ownership by live entry identity, so different presets can use the same server name independently. All `@deepseek-ai/*` runtime imports remain external and use the host's module instances.

Existing panel configuration, catalog and per-tool disable lists remain in their current state files. Legacy file-keyed MCP intent is preserved but is not guessed onto new declarative definitions; reapply those toggles after migrating a preset. Legacy file-backed Host entries retain their previous persistence behavior.

## Validation

`npm test` runs the existing catalog/preset/pending-state regressions and a new test against the published rc.2 Cordis, Loader, preset registry, tools, skills, session, projection, prompt and timer services. The panel is loaded through a real Loader entry, with HTTP requests exercising its routes. Checks cover compatibility admission, inventory before a session, two independent presets, immediate/deferred toggles, identity-based persistence, restart restoration, middle-layer tool execution and browser bundle registration.

The integration test uses a local MCP-shaped fixture and a small agent registry fixture; it does not contact a model or remote MCP server. A real Desktop/Web UI session with the user's own MCP servers is still a deployment check.
