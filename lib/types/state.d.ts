/** 每个预设文件（key=文件绝对路径）→ 每个 mcp 行 → 意图与上次物化状态。 */
export interface McpRowState {
    /** toggle 时用户意图：是否停用 */
    desired: boolean;
    /** toggle 时该行在文件中的实际状态（true/false/null=无 disabled 键） */
    lastApplied: boolean | null;
}
export type StateFile = {
    mcp?: Record<string, Record<string, McpRowState>>;
    /** 项目级 MCP 启停意图（工作空间 → serverName → 是否停用）；重启后由 syncRows 应用。 */
    projectMcp?: Record<string, Record<string, boolean>>;
    /** 全局 MCP 工具级禁用（serverName → 禁用的工具全名 mcp__<server>__<tool>）；跨工作区生效。 */
    toolDisabled?: Record<string, string[]>;
    /** 项目级 MCP 工具禁用（工作空间 → serverName → 禁用工具全名）；仅该工作区生效。 */
    projectToolDisabled?: Record<string, Record<string, string[]>>;
    /** AI 自动启用标记（mcp_call 保活启用）：entryId → 上次启用时间。 */
    ai?: Record<string, {
        at: number;
    }>;
    /** 面板可写的插件配置（autoManage 开关、生效时机等），优先于 cordis config。 */
    config?: {
        autoManage?: boolean;
        applyMode?: ApplyMode;
        /**
         * AI 中间层的按模型覆盖表（v0.6.0）。键为 `provider`（整个 provider）或
         * `provider/model`（精确到模型）；值 true=启用中间层、false=禁用。
         * 查表顺序 provider/model → provider → autoManage 总开关。
         * 空表 = 旧行为（只看总开关），所以升级零配置零行为变化。
         */
        autoManageByRoute?: Record<string, boolean>;
        /** 工具预算（面板红线提示用，如 grok 的 350 上限）；缺省不提示。 */
        toolBudget?: number;
        /**
         * 中间层生效时隐藏哪些 MCP server（v0.6.1）：
         * - 'disabled'（默认，旧行为）：只隐藏用户手动停用的 server。手动启用的
         *   server 仍直接可见（memory 高灵敏召回、filesystem 直接读写的用法）。
         * - 'all'：对命中中间层的模型隐藏**全部** MCP server 的工具，一律经
         *   dsh_mcp_search / dsh_mcp_call 按需取用。server 保持挂载运行 ——
         *   这正是「grok 走中间层、claude 直连全部工具」能同时成立的原因：
         *   停用 server 会连 claude 一起看不到，而这里只改装配可见性。
         */
        middleLayerHides?: 'disabled' | 'all';
    };
};
/** 生效时机：immediate=立即（默认，下轮生效）；next-session=记意图、新会话/重启生效。 */
export type ApplyMode = 'immediate' | 'next-session';
/** 当前生效时机（缺省 immediate）。 */
export declare function stateApplyMode(state: StateFile): ApplyMode;
/** 按模型覆盖表（缺省空表 = 只看总开关）。 */
export declare function stateAutoManageByRoute(state: StateFile): Record<string, boolean>;
/** 中间层隐藏范围（缺省 'disabled' = 旧行为）。 */
export declare function stateMiddleLayerHides(state: StateFile): 'disabled' | 'all';
/** 工具预算（>0 的有限数才有效，否则视为未设置）。 */
export declare function stateToolBudget(state: StateFile): number | undefined;
export declare function readState(): Promise<StateFile>;
export declare function writeState(state: StateFile): Promise<void>;
/** AI-owner 标记读写：state.json 的 ai 段（entryId → {at}）。 */
export declare function setStateAiOwner(entryId: string, at: number): Promise<void>;
export declare function clearStateAiOwner(entryId: string): Promise<void>;
