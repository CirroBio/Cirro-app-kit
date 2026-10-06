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
      typescript({ declarationDir: 'dist/types', outputToFilesystem: true }),
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
      exitAfterBuild,
    ],
  },
]);
