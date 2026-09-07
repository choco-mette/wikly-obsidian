import { builtinModules } from 'node:module'
import esbuild from 'esbuild'

const production = process.argv[2] === 'production'

const context = await esbuild.context({
  entryPoints: ['src/main.ts'],
  bundle: true,
  external: [
    'obsidian',
    'electron',
    ...builtinModules,
    ...builtinModules.map((m) => `node:${m}`),
  ],
  format: 'cjs',
  target: 'es2021',
  logLevel: 'info',
  sourcemap: production ? false : 'inline',
  outfile: 'main.js',
  minify: production,
})

if (production) {
  await context.rebuild()
  await context.dispose()
} else {
  await context.watch()
}
