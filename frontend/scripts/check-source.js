import { readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'
let checked = 0
async function check(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name)
    if (entry.isDirectory()) { await check(path); continue }
    if (!/\.(vue|js)$/.test(entry.name)) continue
    const source = await readFile(path, 'utf8')
    if (entry.name.endsWith('.vue')) {
      const { descriptor, errors } = parse(source, { filename: path })
      if (errors.length) throw new Error(path + ': ' + errors.join(', '))
      if (descriptor.script) throw new Error(path + ': utilize apenas script setup')
      const script = descriptor.scriptSetup ? compileScript(descriptor, { id: path }) : null
      const template = compileTemplate({ source: descriptor.template.content, filename: path, id: path, compilerOptions: { bindingMetadata: script?.bindings } })
      if (template.errors.length) throw new Error(path + ': ' + template.errors.join(', '))
      if (/v-html\s*=/.test(source)) throw new Error(path + ': HTML não confiável não é permitido')
    } else {
      const result = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8', windowsHide: true })
      if (result.status !== 0) throw new Error(result.stderr)
    }
    checked++
  }
}
for (const dir of ['src', 'tests', 'scripts']) await check(resolve(dir))
for (const config of ['vite.config.js', 'tailwind.config.js', 'postcss.config.js']) await checkSourceConfig(config)
async function checkSourceConfig(config) {
  const result = spawnSync(process.execPath, ['--check', config], { encoding: 'utf8', windowsHide: true })
  if (result.status !== 0) throw new Error(result.stderr)
}
console.log(checked + ' arquivos validados: sintaxe JavaScript, compilação de SFCs e script setup. Não substitui lint semântico ou validação em navegador.')
