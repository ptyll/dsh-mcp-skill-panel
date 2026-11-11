/** DSH 0.2.2-rc.1 compatibility boundary for live preset mutation.
 *
 * The public composition inventory intentionally returns detached diagnostics,
 * not mutable Loader entries. MCP toggles still need the host's actual entries.
 * This is the only place that reads the registry's internal generation map;
 * keep the DSH peer versions pinned and test this against the real runtime.
 * Never import a second registry instance or create replacement preset trees.
 */
import type { Context } from '@deepseek-ai/cordis'
import type { PresetMount } from '@deepseek-ai/dsh-agent-preset-registry'
import { scopeOf, scopeParentOf } from '@deepseek-ai/dsh-scope'

interface Generation {
  mount: PresetMount
}

function generations(ctx: Context): Map<object, Generation> {
  const records = (ctx.agentPresets as unknown as { generations?: Map<object, Generation> }).generations
  if (!(records instanceof Map)) {
    throw new Error('MCP & Skill Manager: unsupported preset registry; expected DSH 0.2.2-rc.1 generation map')
  }
  for (const [key, record] of records) {
    const mount = record?.mount
    if (!mount || mount.key !== key || typeof mount.presetId !== 'string'
      || typeof mount.tree?.entries !== 'function' || !mount.fiber) {
      throw new Error('MCP & Skill Manager: incompatible DSH preset generation')
    }
  }
  return records
}

export function livePresetMounts(ctx: Context): PresetMount[] {
  return [...generations(ctx).values()].map(record => record.mount)
}

/** Match the exact revision the Agent retained, including a retired revision. */
export function standingMountFor(ctx: Context, agentCtx: Context): PresetMount | undefined {
  const key = scopeOf(agentCtx)
  const parent = key === undefined ? undefined : scopeParentOf(key)
  return parent === undefined ? undefined : generations(ctx).get(parent)?.mount
}
