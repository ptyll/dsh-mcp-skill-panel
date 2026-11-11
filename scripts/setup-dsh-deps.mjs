// 把 DSH 闭包类型链接进本仓库 node_modules，供 tsc/tsdown 解析。
// 来源：~/.dsh/profiles/node_modules/@deepseek-ai（主闭包）
// Windows 用 junction（mklink /J，无需管理员），POSIX 用符号链接。
import { existsSync, mkdirSync, readdirSync, symlinkSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import os from 'node:os'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const home = os.homedir()
const candidates = [
  process.env.DSH_NODE_MODULES && join(process.env.DSH_NODE_MODULES, '@deepseek-ai'),
  join(home, '.dsh', 'profiles', 'node_modules', '@deepseek-ai'),
  join(home, '.dsh', 'profiles', 'web', 'node_modules', '@deepseek-ai'),
]
const globalRoots = [
  join(dirname(process.execPath), '..', 'lib', 'node_modules'),
  join(dirname(process.execPath), 'node_modules'),
  process.env.npm_config_prefix && join(process.env.npm_config_prefix, 'lib', 'node_modules'),
]
for (const globalRoot of globalRoots) {
  if (!globalRoot) continue
  const dsh = join(globalRoot, '@deepseek-ai', 'dsh', 'package.json')
  if (!existsSync(dsh)) continue
  try {
    const require = createRequire(dsh)
    candidates.push(dirname(dirname(require.resolve('@deepseek-ai/dsh-scope/package.json'))))
  } catch { /* Try the remaining installations. */ }
}
const profileNodeModules = candidates.find(candidate => candidate && existsSync(join(candidate, 'dsh-agent-preset-registry')))
const localScoped = join(root, 'node_modules', '@deepseek-ai')

if (!profileNodeModules) {
  console.error('DSH closure not found; install DSH 0.2.2-rc.1 or set DSH_NODE_MODULES to its node_modules directory')
  process.exit(1)
}

mkdirSync(localScoped, { recursive: true })

let linked = 0
for (const name of readdirSync(profileNodeModules)) {
  const target = join(profileNodeModules, name)
  const link = join(localScoped, name)
  if (existsSync(link)) continue
  try {
    if (process.platform === 'win32') {
      execFileSync('cmd', ['/c', 'mklink', '/J', link, target], { stdio: 'ignore' })
    } else {
      symlinkSync(target, link, 'dir')
    }
    linked += 1
  } catch (error) {
    console.error(`failed to link ${name}:`, String(error))
  }
}
console.log(`dsh closure links ready (${linked} new)`)
