/**
 * 构建后补丁：移除打包产物中 Schemastery 的字符串回调动态执行点。
 *
 * 背景：本插件自包含打包了 @deepseek-ai/dsh-tools 的依赖闭包，其中内联了
 * @deepseek-ai/schemastery。Schemastery 的 Schema 构造器支持把字符串形式的
 * callback 经 `new Function("return " + schema.callback)()` 动态求值——该机制
 * 服务于部署配置里的 `!!js` 表达式，输入源是运维配置。
 *
 * 本插件不使用该机制（工具配置是纯对象，配置校验为手写 resolveConfig），
 * 且模型/终端用户的输入永远不会到达这个分支。为了让静态扫描器（Mimosa 等）
 * 在打包产物上零误报、也为了收紧产物自身的动态执行面，构建时将该分支禁用
 * （字符串 callback 一律置为 void 0，对象式 schema 不受影响）。
 */
import { readFileSync, writeFileSync } from 'node:fs'

const path = 'lib/index.js'
let source = readFileSync(path, 'utf8')
const target = 'schema.callback = new Function("return " + schema.callback)();'

if (!source.includes(target)) {
  console.log('[patch] target not found — already patched or upstream changed, nothing to do')
  process.exit(0)
}

source = source.replace(target, 'schema.callback = void 0;')
writeFileSync(path, source)
console.log('[patch] disabled schemastery string-callback eval in lib/index.js')
