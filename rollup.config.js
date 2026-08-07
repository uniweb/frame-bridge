import { readFileSync } from 'node:fs'
import resolve from '@rollup/plugin-node-resolve'
import terser from '@rollup/plugin-terser'

// Read from package.json rather than hardcoding. The version is bumped at
// publish time, so a literal here can only ever be stale — and was: every
// published dist carried `@version 1.0.0`, a version this package has never
// had. It went unnoticed for the package's whole history because the banner
// is a comment and `exports` resolves to src/, so the only reader is a
// consumer coming through `main` — which is the entry nobody developing here
// exercises.
const pkg = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8')
)

const banner = `/**
 * ${pkg.name}
 * ${pkg.description}
 * @version ${pkg.version}
 * @license ${pkg.license}
 */`

// Base configuration
const baseConfig = {
  external: [],
  plugins: [resolve()]
}

// Create configs for different builds
export default [
  // ESM build - main entry point
  {
    ...baseConfig,
    input: 'src/index.js',
    output: {
      file: 'dist/esm/index.js',
      format: 'esm',
      banner
    }
  },

  // ESM build - parent only
  {
    ...baseConfig,
    input: 'src/parent/index.js',
    output: {
      file: 'dist/esm/parent.js',
      format: 'esm',
      banner
    }
  },

  // ESM build - child only
  {
    ...baseConfig,
    input: 'src/child/index.js',
    output: {
      file: 'dist/esm/child.js',
      format: 'esm',
      banner
    }
  },

  // IIFE auto-init - parent (for CDN/script tag)
  {
    ...baseConfig,
    input: 'src/parent/auto-init.js',
    output: {
      file: 'dist/auto/parent.js',
      format: 'iife',
      banner
    },
    plugins: [...baseConfig.plugins]
  },

  // IIFE auto-init - parent (minified)
  {
    ...baseConfig,
    input: 'src/parent/auto-init.js',
    output: {
      file: 'dist/auto/parent.min.js',
      format: 'iife',
      banner
    },
    plugins: [...baseConfig.plugins, terser()]
  },

  // IIFE auto-init - child (for CDN/script tag)
  {
    ...baseConfig,
    input: 'src/child/auto-init.js',
    output: {
      file: 'dist/auto/child.js',
      format: 'iife',
      banner
    },
    plugins: [...baseConfig.plugins]
  },

  // IIFE auto-init - child (minified)
  {
    ...baseConfig,
    input: 'src/child/auto-init.js',
    output: {
      file: 'dist/auto/child.min.js',
      format: 'iife',
      banner
    },
    plugins: [...baseConfig.plugins, terser()]
  }
]
