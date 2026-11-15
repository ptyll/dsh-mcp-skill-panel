# Upgrade to DeepSeek Harness 0.2.2-rc.3

Plugin 0.8.1 targets exactly DSH 0.2.2-rc.3. Plugin 0.8.0 targets rc.1 and uses
the removed `agents.roots()` API. Earlier plugin releases also import
`livePresetMounts` and `standingMountFor`, which this runtime no longer exports.
Changing the manifest alone is insufficient.

The rc.3 adapter selects root sessions from `agents.list()` using
`session.header.parentSession`, preserving root-first selection when a child was
registered earlier. An explicit session id still selects that exact Agent.
Catalog diagnostics count roots and all live Agents through the same rc.3 API.
The guarded preset generation adapter continues to work with rc.3.

## Install this checkout

The repository includes prebuilt JavaScript and type declarations:

```sh
npm pack --ignore-scripts
dsh plugin --profile web add ./dsh-mcp-skill-panel-0.8.1.tgz
```

Restart DSH after installation. For Desktop, fully quit the application and use
`--profile desktop`. Alternatively, install directly from the
[v0.8.1 release](https://github.com/ptyll/dsh-mcp-skill-panel/releases/tag/v0.8.1):

```sh
dsh plugin --profile web add "github:ptyll/dsh-mcp-skill-panel#v0.8.1"
```

The release includes the package archive. The existing `v0.8.0` tag remains
specific to DSH 0.2.2-rc.1.

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

The integration harness loads the actual DSH 0.2.2-rc.3 services, including the
Agent and preset registries, tools, native executor, skills, session, projection
and prompt services, together with Cordis and Loader. It invokes
registered HTTP handlers with in-memory request streams, without binding a port.
Checks include admission of rc.3 and rejection of unvalidated DSH versions,
inventory before an Agent exists, root-first selection with a child registered
first, root/child diagnostics, separate presets sharing server names, immediate and deferred
toggles, restart restoration, nested tool execution, browser module registration,
and old/new retained revisions after a preset declaration reload.

Fixtures replace Agent objects and the remote MCP server; the Agent registry and
its lifecycle dispatch are real. Tests do not call a model. The browser module
check verifies registration, not a rendered Desktop/Web
session. A clean dependency installation requires the registry or cached tarballs.
