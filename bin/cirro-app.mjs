#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { runCli } from '../dist/cli.mjs';

process.exitCode = runCli(process.argv.slice(2), console, fileURLToPath(new URL('..', import.meta.url)));
