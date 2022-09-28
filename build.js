const esbuild = require('esbuild');
const { dependencies } = require('./package.json');

const config = {
    allowOverwrite: true,
    bundle: true,
    external: Object.keys(dependencies),
}

// build for iife
esbuild.build({
    ...config,
    entryPoints: ['./src/index.js'],
    outfile: './dist/index.js',
})
    .catch(() => process.exit(1));

// build for esm
esbuild.build({
    ...config,
    entryPoints: ['./src/index.js'],
    outfile: './dist/index.mjs',
    format: 'esm',
})
    .catch(() => process.exit(1));

// build elements for esm
esbuild.build({
    ...config,
    entryPoints: ['./elements/elements.ts'],
    outfile: './elements/dist/elements.js',
    external: [...config.external, 'guigna'],
})    
    .catch(() => process.exit(1));


// build elements for esm
esbuild.build({
    ...config,
    entryPoints: ['./elements/elements.ts'],
    outfile: './elements/dist/elements.mjs',
    format: 'esm',
    external: [...config.external, 'guigna'],
})
    .catch(() => process.exit(1));

// build jsx
esbuild.build({
    ...config,
    entryPoints: ['./jsx/jsx.ts'],
    outfile: './jsx/dist/jsx.js',
    external: [...config.external, 'guigna'],
})
    .catch(() => process.exit(1));

// build jsx for esm
esbuild.build({
    ...config,
    entryPoints: ['./jsx/jsx.ts'],
    outfile: './jsx/dist/jsx.mjs',
    format: 'esm',
    external: [...config.external, 'guigna'],
})
    .catch(() => process.exit(1));