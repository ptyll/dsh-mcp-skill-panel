# Upgrade to DeepSeek Harness 0.2.2-rc.1

Plugin 0.8.0 targets exactly DSH 0.2.2-rc.1. Older plugin releases import
`livePresetMounts` and `standingMountFor`, which this runtime no longer exports,
and declare incompatible peer versions. Changing the manifest alone is insufficient.

## Install this checkout

The repository includes prebuilt JavaScript and type declarations:

```sh
npm pack --ignore-scripts
dsh plugin --profile web add ./dsh-mcp-skill-panel-0.8.0.tgz
```

Restart DSH after installation. For Desktop, fully quit the application and use
`--profile desktop`. This change does not itself publish a release or Git tag.

## Compatibility boundary

The new public preset APIs expose detached inventory and module diagnostics,
not the mutable Loader entries needed to enable or disable MCP servers.
`src/preset-runtime.ts` therefore reads the running registry's internal
`generations` map through a single guarded adapter. It validates the map and
mount shape and fails explicitly on an unsupported registry. This is deliberately
version-specific: future DSH releases require fresh compatibility validation.
The adapter never creates a second registry or a replacement preset tree.

Agent lookup uses its scope's parent to select the exact retained revision.
Live handles remain revision-qualified; persisted intent keeps the existing
`preset:<id>` / row identity, including restoration at the next session boundary.
Panel state and catalog formats do not change.

Tool execution now uses the host's executor batch API with raw JSON call arguments
and reads the correlated execution result. The plugin does not replace the user's
executor. Tests load DSH's native executor to exercise actual nested MCP dispatch.

## Validation

```sh
npm ci --ignore-scripts
npm run typecheck
npm run build
npm run verify
npm test
```

The integration harness loads the actual 0.2.2-rc.1 Cordis, Loader, preset registry,
tools, native executor, skills, session, projection and prompt services. It invokes
registered HTTP handlers with in-memory request streams, without binding a port.
Checks include admission and rejection of older DSH versions, inventory before
an Agent exists, separate presets sharing server names, immediate and deferred
toggles, restart restoration, nested tool execution, browser module registration,
and old/new retained revisions after a preset declaration reload.

Fixtures replace the Agent registry and remote MCP server; tests do not call a
model. The browser module check verifies registration, not a rendered Desktop/Web
session. A clean dependency installation requires the registry or cached tarballs.
