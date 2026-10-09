import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import nodeResolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import { defineConfig } from 'rollup';

// @rollup/plugin-typescript leaves fs watch handles open even for a one-shot build, so
// the process never exits on its own (see packages/ui/rollup.config.mjs). Only the last
// config may exit.
const exitAfterBuild = {
  name: 'exit-after-build',
  closeBundle() {
    if (!process.env.ROLLUP_WATCH) process.exit(0);
  },
};

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
const apiClient = createRequire(import.meta.url)('@cirrobio/api-client/package.json');

export default defineConfig([
  // For bundled apps and the portal, which bring their own @cirrobio/api-client.
  {
    input: 'src/index.ts',
    output: [
      { file: 'dist/index.js', format: 'cjs', sourcemap: true },
      { file: 'dist/index.esm.js', format: 'esm', sourcemap: true },
    ],
    plugins: [
      // With tsconfig-base's composite/incremental, a build after `rimraf dist` trusts the
      // incremental state in .rollup.cache, emits no declarations for unchanged files, and
      // leaves dist/types empty (see packages/dashboard/rollup.config.mjs).
      typescript({ declarationDir: 'dist/types', outputToFilesystem: true, compilerOptions: { composite: false, incremental: false } }),
    ],
    external: [/^@cirrobio\//],
  },
  // For no-build apps: one ES module with @cirrobio/api-client inlined.
  {
    input: 'src/index.ts',
    // The API client's compiled `this && this.__awaiter` helpers warn once per file; at a
    // module's top level `this` is undefined either way.
    onwarn(warning, warn) {
      if (warning.code === 'THIS_IS_UNDEFINED' && warning.id?.includes('/node_modules/')) return;
      warn(warning);
    },
    output: {
      file: 'dist/cirro-app-kit.js',
      format: 'esm',
      banner: `/*! @cirrobio/app-kit ${version} (single file, with @cirrobio/api-client ${apiClient.version} inlined) */`,
    },
    plugins: [
      nodeResolve({ browser: true }),
      // tsconfig-base's composite/incremental require declaration output, which this build does not make.
      typescript({
        compilerOptions: { composite: false, incremental: false, declaration: false, declarationMap: false, sourceMap: false },
      }),
    ],
  },
  // The cirro-app command line, for Node: bin/cirro-app.mjs imports it.
  {
    input: 'src/cli.ts',
    output: { file: 'dist/cli.mjs', format: 'esm' },
    external: [/^node:/],
    plugins: [
      typescript({
        compilerOptions: { composite: false, incremental: false, declaration: false, declarationMap: false, sourceMap: false },
      }),
    ],
  },
  // For no-build apps: `hostedMode()` alone, so a page that is not hosted never loads the kit.
  {
    input: 'src/mode.ts',
    output: {
      file: 'dist/cirro-app-mode.js',
      format: 'esm',
      banner: `/*! @cirrobio/app-kit ${version} (hostedMode only) */`,
    },
    plugins: [
      typescript({
        compilerOptions: { composite: false, incremental: false, declaration: false, declarationMap: false, sourceMap: false },
      }),
      exitAfterBuild,
    ],
  },
]);
