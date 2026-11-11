/** DSH 0.2.2-rc.1 compatibility boundary for live preset mutation.
 *
 * The public composition inventory intentionally returns detached diagnostics,
 * not mutable Loader entries. MCP toggles still need the host's actual entries.
 * This is the only place that reads the registry's internal generation map;
 * keep the DSH peer versions pinned and test this against the real runtime.
 * Never import a second registry instance or create replacement preset trees.
 */
import type { Context } from '@deepseek-ai/cordis';
import type { PresetMount } from '@deepseek-ai/dsh-agent-preset-registry';
export declare function livePresetMounts(ctx: Context): PresetMount[];
/** Match the exact revision the Agent retained, including a retired revision. */
export declare function standingMountFor(ctx: Context, agentCtx: Context): PresetMount | undefined;
