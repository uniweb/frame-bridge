import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';

const banner = `/**
 * @uniweb/frame-bridge
 * Promise-based iframe communication library
 * @version 1.0.0
 * @license MIT
 */`;

// Base configuration
const baseConfig = {
    external: [],
    plugins: [resolve()],
};

// Create configs for different builds
export default [
    // ESM build - main entry point
    {
        ...baseConfig,
        input: 'src/index.js',
        output: {
            file: 'dist/esm/index.js',
            format: 'esm',
            banner,
        },
    },

    // ESM build - parent only
    {
        ...baseConfig,
        input: 'src/parent/index.js',
        output: {
            file: 'dist/esm/parent.js',
            format: 'esm',
            banner,
        },
    },

    // ESM build - child only
    {
        ...baseConfig,
        input: 'src/child/index.js',
        output: {
            file: 'dist/esm/child.js',
            format: 'esm',
            banner,
        },
    },

    // UMD build - main entry point
    {
        ...baseConfig,
        input: 'src/index.js',
        output: {
            file: 'dist/umd/index.js',
            format: 'umd',
            name: 'FrameBridge',
            banner,
        },
    },

    // UMD build - parent only
    {
        ...baseConfig,
        input: 'src/parent/index.js',
        output: {
            file: 'dist/umd/parent.js',
            format: 'umd',
            name: 'FrameBridgeParent',
            banner,
        },
    },

    // UMD build - child only
    {
        ...baseConfig,
        input: 'src/child/index.js',
        output: {
            file: 'dist/umd/child.js',
            format: 'umd',
            name: 'FrameBridgeChild',
            banner,
        },
    },

    // IIFE auto-init - parent (for CDN/script tag)
    {
        ...baseConfig,
        input: 'src/parent/auto-init.js',
        output: {
            file: 'dist/auto/parent.js',
            format: 'iife',
            banner,
        },
        plugins: [...baseConfig.plugins],
    },

    // IIFE auto-init - parent (minified)
    {
        ...baseConfig,
        input: 'src/parent/auto-init.js',
        output: {
            file: 'dist/auto/parent.min.js',
            format: 'iife',
            banner,
        },
        plugins: [...baseConfig.plugins, terser()],
    },

    // IIFE auto-init - child (for CDN/script tag)
    {
        ...baseConfig,
        input: 'src/child/auto-init.js',
        output: {
            file: 'dist/auto/child.js',
            format: 'iife',
            banner,
        },
        plugins: [...baseConfig.plugins],
    },

    // IIFE auto-init - child (minified)
    {
        ...baseConfig,
        input: 'src/child/auto-init.js',
        output: {
            file: 'dist/auto/child.min.js',
            format: 'iife',
            banner,
        },
        plugins: [...baseConfig.plugins, terser()],
    },
];
