// Integration with the published DSH 0.2.0-rc.2 services; no model/API key needed.
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import { join } from 'node:path'
import { mock } from 'node:test'
import { syncBuiltinESMExports } from 'node:module'
import { createServer } from 'node:http'
import { runInNewContext } from 'node:vm'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Timer from '@deepseek-ai/cordis-plugin-timer'
import SessionStore from '@deepseek-ai/dsh-session'
import Projections from '@deepseek-ai/dsh-session-projection'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import Tools from '@deepseek-ai/dsh-tools'
import Skills from '@deepseek-ai/dsh-skill'
import Presets from '@deepseek-ai/dsh-agent-preset-registry'
import { evaluatePluginCompatibility } from '@deepseek-ai/dsh-app-boot'
import { createScope, scopeTarget, scopeOf } from '@deepseek-ai/dsh-scope'

const temporary = await mkdtemp(join(os.tmpdir(), 'dsh-rc2-selftest-'))
mock.method(os, 'homedir', () => temporary)
syncBuiltinESMExports()
const panel = await import('../lib/index.js')
const contexts = []
const servers = []

async function harness() {
  const ctx = new Context()
  contexts.push(ctx)
  await ctx.plugin(Loader)
  await ctx.plugin(Timer)
  await ctx.plugin(SessionStore)
  await ctx.plugin(Projections)
  await ctx.plugin(SystemPrompt, { personaPrefix: '' })
  await ctx.plugin(Tools)
  await ctx.plugin(Skills)
  await ctx.plugin(Presets, { default: 'standard' })
  const agents = new Map()
  ctx.provide('agents', { get: id => agents.get(id), roots: () => [...agents.values()], list: () => [...agents.values()] })
  ctx.provide('fs', {})
  const routes = new Map()
  ctx.provide('webServer', { register: route => {
    routes.set(route.path, route)
    return () => routes.delete(route.path)
  } })
  for (const preset of ['standard', 'other', 'distinct']) {
    await ctx.loader.create({
      id: `preset-${preset}`,
      name: new URL('./fixtures/preset.mjs', import.meta.url).href,
      config: { id: preset, plugins: [{
        id: 'mcp-shared',
        name: new URL('./fixtures/mcp-server.mjs', import.meta.url).href,
        config: { serverName: preset === 'distinct' ? 'unique' : 'shared', preset },
      }] },
    })
  }
  await ctx.loader.await()
  await ctx.loader.create({ id: 'runtime-inventory', name: new URL('../lib/index.js', import.meta.url).href })
  await ctx.loader.await()
  const server = createServer((req, res) => {
    const route = routes.get(new URL(req.url, 'http://localhost').pathname)
    if (route) route.handler(req, res)
    else { res.statusCode = 404; res.end() }
  })
  servers.push(server)
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const origin = `http://127.0.0.1:${server.address().port}`
  let token
  const request = async (path, body) => {
    if (body && !token) token = (await request('/token')).token
    const response = await fetch(`${origin}/api/mcp-skill-panel${path}`, body ? {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-panel-token': token }, body: JSON.stringify(body),
    } : undefined)
    const result = await response.json()
    assert.equal(response.status, 200, JSON.stringify(result))
    assert.equal(result.ok, true, JSON.stringify(result))
    return result
  }
  const agent = async (preset, id) => {
    const agent = { id, session: ctx.sessions.create(id, { meta: { cwd: temporary } }) }
    const scope = createScope(ctx, agent)
    agent.ctx = scope.ctx
    await ctx.agentPresets.mount(scope.ctx, preset)
    agents.set(id, agent)
    await ctx.serial(scopeTarget(agent, scopeOf(scope.ctx)), 'agent/created', { agent, source: 'create' })
    return agent
  }
  return { ctx, request, agent }
}

try {
  const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  assert.equal(evaluatePluginCompatibility(manifest, {}, '0.2.0-rc.2'), undefined)
  assert.ok(evaluatePluginCompatibility(manifest, {}, '0.1.2-rc.1'))
  console.log('ok   plugin compatibility policy accepts rc.2 and rejects the retired API')
  await panel.writeState({})
  const h = await harness()
  const initial = (await h.request('/state')).state
  assert.equal(initial.preset, 'standard')
  assert.equal(initial.mcp.length, 1, 'preset rows visible before any Agent exists')
  assert.equal(initial.mcp[0].status, 'active')
  assert.deepEqual(initial.errors, [])
  assert.deepEqual(initial.skills.map(row => row.name), ['skill-standard'])
  await h.request('/debug/collect', {})
  assert.equal((await h.request('/debug')).catalog.unique.tools, 1, 'catalog includes non-default presets')
  console.log('ok   DSH 0.2 registry: MCP inventory and schemas before any session')

  const first = await h.agent('standard', 'first')
  const second = await h.agent('other', 'second')
  const state = async id => (await h.request(`/state?session=${id}`)).state
  const a = await state(first.id)
  const b = await state(second.id)
  assert.equal(a.mcp[0].tools, 1)
  assert.equal(b.mcp[0].tools, 1)
  assert.notEqual(a.mcp[0].entryId, b.mcp[0].entryId)
  assert.deepEqual(a.skills.map(row => row.name), ['skill-standard'])
  assert.deepEqual(b.skills.map(row => row.name), ['skill-other'])
  console.log('ok   sessions with different presets read their own tools and skills')

  const toggle = await h.request('/mcp/toggle', { entryId: a.mcp[0].entryId, disabled: true })
  assert.equal(toggle.applied, true)
  assert.equal(toggle.persisted, true)
  assert.equal((await state(first.id)).mcp[0].disabled, true)
  assert.equal((await state(second.id)).mcp[0].disabled, false)
  assert.equal((await panel.readState()).mcp['preset:standard']['mcp-shared'].desired, true)
  console.log('ok   immediate preset toggle changes the live handle and persists by preset identity')

  await h.request('/config', { applyMode: 'next-session' })
  const deferred = await h.request('/mcp/toggle', { entryId: a.mcp[0].entryId, disabled: false })
  assert.equal(deferred.pending, true)
  assert.equal((await state(first.id)).mcp[0].disabled, true)
  await h.agent('standard', 'third')
  assert.equal((await state(first.id)).mcp[0].disabled, false)
  assert.equal(panel.pendingMcpCount(), 0)
  console.log('ok   agent/created awaits deferred toggles before releasing the first request')

  await h.request('/config', { applyMode: 'immediate', autoManage: true })
  await h.request('/mcp/toggle', { entryId: a.mcp[0].entryId, disabled: true })
  await h.request('/mcp/toggle', { entryId: b.mcp[0].entryId, disabled: true })
  const call = agent => h.ctx.tools.execute({
    callId: `test-${agent.id}`, name: panel.MCP_CALL_TOOL,
    arguments: { server: 'shared', tool: 'ping', arguments: {} },
    agent, signal: new AbortController().signal,
  })
  const calledA = await call(first)
  const calledB = await call(second)
  assert.equal(calledA.isError, false, JSON.stringify(calledA))
  assert.equal(calledB.isError, false, JSON.stringify(calledB))
  assert.match(JSON.stringify(calledA.content), /standard/)
  assert.match(JSON.stringify(calledB.content), /other/)
  assert.equal(Object.keys((await panel.readState()).ai).length, 2, 'AI owners do not collide on relative loader ids')
  console.log('ok   middle-layer calls enable and execute the correct preset when server names overlap')

  const fresh = await harness()
  const restored = (await fresh.request('/state')).state
  assert.equal(restored.mcp[0].disabled, true, 'state restored on a new Cordis runtime')
  console.log('ok   restart restores declarative preset intent without a preset file')

  let registration
  runInNewContext(await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'), {
    window: { __ModuleLoader__: { load: value => { registration = value } } },
  })
  const client = registration.factory(name => {
    if (name === 'react') return { createElement: () => null }
    if (name === 'react/jsx-runtime') return { jsx: () => null, jsxs: () => null }
    throw new Error(`unexpected client dependency ${name}`)
  })
  let section
  client.apply({
    locale: { bind: () => key => key, register: () => () => {} },
    effect: fn => fn(),
    slots: { inject: (_name, fn) => fn(), register: options => { section = options; return () => {} } },
  })
  assert.equal(section.name, 'settings.section')
  assert.equal(section.id, 'runtime-inventory')
  console.log('ok   rebuilt browser bundle loads and registers its settings section')
  console.log('\nselftest-harness: all checks passed')
} finally {
  for (const server of servers) await new Promise(resolve => server.close(resolve))
  for (const ctx of contexts.reverse()) await ctx.fiber.dispose()
  mock.restoreAll()
  syncBuiltinESMExports()
  await rm(temporary, { recursive: true, force: true })
}
