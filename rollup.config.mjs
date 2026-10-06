import typescript from '@rollup/plugin-typescript';
import { defineConfig } from 'rollup';

// @rollup/plugin-typescript leaves fs watch handles open even for a one-shot build, so
// the process never exits on its own (see packages/ui/rollup.config.mjs).
const exitAfterBuild = {
  name: 'exit-after-build',
  closeBundle() {
    if (!process.env.ROLLUP_WATCH) process.exit(0);
  },
};

export default defineConfig([
  {
    input: 'src/index.ts',
    output: [
      { file: 'dist/index.js', format: 'cjs', sourcemap: true },
      { file: 'dist/index.esm.js', format: 'esm', sourcemap: true },
    ],
    plugins: [
      typescript({ declarationDir: 'dist/types', outputToFilesystem: true }),
      exitAfterBuild,
    ],
    external: [/^@cirrobio\//],
  },
]);
