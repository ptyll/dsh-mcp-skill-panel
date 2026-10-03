/** DSH 0.2 declarative preset revisions and their live MCP entry handles.
 * The registry import must remain external so it shares the host's mount set.
 * Runtime handles are revision-qualified; persisted intent uses preset/row ids.
 */
import type { Context } from '@deepseek-ai/cordis';
import type { Agent } from '@deepseek-ai/dsh-agent';
import type { Entry } from '@deepseek-ai/cordis-plugin-loader';
import { type PresetMount } from '@deepseek-ai/dsh-agent-preset-registry';
/** A preset's state key is an identity, never a filesystem path in DSH 0.2. */
export declare const presetStateKey: (presetId: string) => string;
export declare function selectedPresetMount(ctx: Context, agent?: Agent): PresetMount | undefined;
/** Host entries and the selected revision; different presets may reuse server names. */
export declare function panelEntries(ctx: Context, agent?: Agent): Entry[];
/** Exact live handles are required: registry inventory ids are relative to its tree. */
export declare function resolvePanelEntry(ctx: Context, entryId: string): Entry | undefined;
export declare function presetLocation(ctx: Context, entry: Entry): {
    file: string;
    rowId: string;
    entryId: string;
} | undefined;
/** preset 文件文本解析出的单行 MCP 配置（key = 短 rowId，如 mcp-filesystem）。 */
export interface PresetMcpParsed {
    serverName: string;
    transport: string | null;
    toolCallTimeoutMs?: number;
}
/**
 * 解析 preset 组合文本，抽取全部 `mcp-*` 行的 serverName/transport/超时。
 * 纯文本正则（preset 文件结构稳定）：按 `^- id:` 切块，块内抓三个键。
 * 键锚定行首（防注释/长键误命中）；值允许可选双引号（YAML `"stdio"` 形态）。
 * 纯函数，可被 selftest 直接覆盖。
 */
export declare function parsePresetMcpText(text: string): Map<string, PresetMcpParsed>;
/** standing 组合中的一行 MCP（inventory 行 + preset 文本配置的合并）。 */
export interface PresetMcpRow {
    /** Opaque, revision-qualified panel handle (not a Host loader id). */
    entryId: string;
    /** preset 文件内短 id（如 mcp-filesystem；state.json row 键）。 */
    rowId: string;
    serverName: string;
    transport: string | null;
    toolCallTimeoutMs?: number;
    disabled: boolean;
    running: boolean;
    /** Stable preset:<id> state key; no file is read or written. */
    file: string;
}
/** List MCP entries from the current mounted definition without a file lookup. */
export declare function listPresetMcpRows(ctx: Context, presetId: string): Promise<{
    rows: PresetMcpRow[];
    presetPath: string;
}>;
/**
 * 按长 entryId 反查其所属 preset 行（toggleMcp 预设兜底用）。
 * 逐 preset 找 entryId 命中，找到即 resolve+read+parse 该 preset。
 */
export declare function findPresetRowByEntryId(ctx: Context, entryId: string): Promise<{
    presetId: string;
    row: PresetMcpRow;
    presetPath: string;
} | undefined>;
