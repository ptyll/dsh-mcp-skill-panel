export const inject = ['tools', 'skills']

export function apply(ctx, config) {
  ctx.effect(() => ctx.tools.register({
    name: `mcp__${config.serverName}__ping`,
    description: `Test MCP in ${config.preset}`,
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] },
    execute: async () => config.preset,
  }))
  ctx.effect(() => ctx.skills.register({
    name: `skill-${config.preset}`,
    description: `Test skill in ${config.preset}`,
    content: 'Test instructions.',
  }))
}
