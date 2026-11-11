/** DSH 0.2 declarative preset revisions and their live MCP entry handles.
 * The registry import must remain external so it shares the host's mount set.
 * Runtime handles are revision-qualified; persisted intent uses preset/row ids.
 */

import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { Entry } from '@deepseek-ai/cordis-plugin-loader'
import type { PresetMount } from '@deepseek-ai/dsh-agent-preset-registry'
import { livePresetMounts, standingMountFor } from './preset-runtime'
import { isMcpEntry, serverNameOf, mcpEntryConfig } from './mcp-entry'

/** A preset's state key is an identity, never a filesystem path in DSH 0.2. */
export const presetStateKey = (presetId: string): string => `preset:${presetId}`

export function selectedPresetMount(ctx: Context, agent?: Agent): PresetMount | undefined {
  if (agent) return standingMountFor(ctx, agent.ctx)
  const id = ctx.agentPresets.defaultId
  return livePresetMounts(ctx).reverse().find((mount) => mount.presetId === id)
}

/** Host entries and the selected revision; different presets may reuse server names. */
export function panelEntries(ctx: Context, agent?: Agent): Entry[] {
  const entries = [...ctx.loader.entries()]
  const mount = selectedPresetMount(ctx, agent)
  if (mount) entries.push(...mount.tree.entries())
  return entries
}

/** Exact live handles are required: registry inventory ids are relative to its tree. */
export function resolvePanelEntry(ctx: Context, entryId: string): Entry | undefined {
  try { return ctx.loader.resolve(entryId) } catch { /* preset tree */ }
  for (const mount of livePresetMounts(ctx).reverse()) {
    const entry = [...mount.tree.entries()].find((candidate) => presetLocation(ctx, candidate)?.entryId === entryId)
    if (entry) return entry
  }
  return undefined
}

export function presetLocation(ctx: Context, entry: Entry): { file: string; rowId: string; entryId: string } | undefined {
  for (const mount of livePresetMounts(ctx)) {
    if (![...mount.tree.entries()].includes(entry)) continue
    const owner = mount.tree.ctx.fiber.entry
    const prefix = owner ? `${owner.id}:` : ''
    const rowId = entry.id.slice(prefix.length)
    return {
      file: presetStateKey(mount.presetId), rowId,
      entryId: `preset:${encodeURIComponent(mount.presetId)}:${encodeURIComponent(rowId)}:${mount.fiber.uid}`,
    }
  }
  return undefined
}

/** preset 文件文本解析出的单行 MCP 配置（key = 短 rowId，如 mcp-filesystem）。 */
export interface PresetMcpParsed {
  serverName: string
  transport: string | null
  toolCallTimeoutMs?: number
}

/** 短 rowId 回落 serverName（preset 文本缺 serverName 键时用；覆盖已知例外）。 */
function fallbackServerName(rowId: string): string {
  if (rowId === 'mcp-anki') return 'anki-mcp'
  return rowId.replace(/^mcp-/, '')
}

/**
 * 解析 preset 组合文本，抽取全部 `mcp-*` 行的 serverName/transport/超时。
 * 纯文本正则（preset 文件结构稳定）：按 `^- id:` 切块，块内抓三个键。
 * 键锚定行首（防注释/长键误命中）；值允许可选双引号（YAML `"stdio"` 形态）。
 * 纯函数，可被 selftest 直接覆盖。
 */
export function parsePresetMcpText(text: string): Map<string, PresetMcpParsed> {
  const out = new Map<string, PresetMcpParsed>()
  const blocks = String(text ?? '').split(/(?=^- id:\s*)/m)
  for (const block of blocks) {
    const idMatch = /^-\s*id:\s*"?([^"\s]+)"?\s*$/m.exec(block)
    if (!idMatch) continue
    const rowId = idMatch[1]
    if (!rowId.startsWith('mcp-')) continue
    const sn = /^\s*serverName:\s*"?([A-Za-z0-9_-]+)"?\s*(?:#.*)?$/m.exec(block)
    const tr = /^\s*transport:\s*"?(\S+?)"?\s*(?:#.*)?$/m.exec(block)
    const tm = /^\s*toolCallTimeoutMs:\s*"?(\d+)"?\s*(?:#.*)?$/m.exec(block)
    const parsed: PresetMcpParsed = {
      serverName: sn ? sn[1] : fallbackServerName(rowId),
      transport: tr ? tr[1] : null,
    }
    if (tm) {
      const n = Number(tm[1])
      if (Number.isFinite(n) && n > 0) parsed.toolCallTimeoutMs = n
    }
    out.set(rowId, parsed)
  }
  return out
}

/** standing 组合中的一行 MCP（inventory 行 + preset 文本配置的合并）。 */
export interface PresetMcpRow {
  /** Opaque, revision-qualified panel handle (not a Host loader id). */
  entryId: string
  /** preset 文件内短 id（如 mcp-filesystem；state.json row 键）。 */
  rowId: string
  serverName: string
  transport: string | null
  toolCallTimeoutMs?: number
  disabled: boolean
  running: boolean
  /** Stable preset:<id> state key; no file is read or written. */
  file: string
}

/** List MCP entries from the current mounted definition without a file lookup. */
export async function listPresetMcpRows(
  ctx: Context,
  presetId: string,
): Promise<{ rows: PresetMcpRow[]; presetPath: string }> {
  const mount = livePresetMounts(ctx).reverse().find((candidate) => candidate.presetId === presetId)
  if (!mount) return { rows: [], presetPath: presetStateKey(presetId) }
  const presetPath = presetStateKey(presetId)
  const rows: PresetMcpRow[] = []
  for (const entry of mount.tree.entries()) {
    if (!isMcpEntry(entry)) continue
    const info = mcpEntryConfig(entry)
    const rowId = presetLocation(ctx, entry)!.rowId
    rows.push({
      entryId: presetLocation(ctx, entry)!.entryId,
      rowId,
      serverName: serverNameOf(entry),
      transport: typeof info?.transport === 'string' ? info.transport : null,
      toolCallTimeoutMs: typeof info?.toolCallTimeoutMs === 'number' ? info.toolCallTimeoutMs : undefined,
      disabled: entry.disabled,
      running: entry.fiber !== undefined,
      file: presetPath,
    })
  }
  return { rows, presetPath }
}

/**
 * 按长 entryId 反查其所属 preset 行（toggleMcp 预设兜底用）。
 * 逐 preset 找 entryId 命中，找到即 resolve+read+parse 该 preset。
 */
export async function findPresetRowByEntryId(
  ctx: Context,
  entryId: string,
): Promise<{ presetId: string; row: PresetMcpRow; presetPath: string } | undefined> {
  for (const mount of livePresetMounts(ctx).reverse()) {
    const { rows, presetPath } = await listPresetMcpRows(ctx, mount.presetId)
    const row = rows.find((candidate) => candidate.entryId === entryId)
    if (row) return { presetId: mount.presetId, row, presetPath }
  }
  return undefined
}
