import js from '@eslint/js'
import globals from 'globals'
import obsidian from 'eslint-plugin-obsidianmd'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: { globals: globals.browser },
    plugins: { obsidian },
  },
  {
    files: ['*.config.mjs'],
    languageOptions: { globals: globals.node },
  },
  { ignores: ['main.js', 'node_modules/**'] },
)
