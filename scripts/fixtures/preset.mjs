export const inject = ['agentPresets']

export async function* apply(ctx, config) {
  yield await ctx.agentPresets.register(config)
}
