// Expo CLI's API response cache can be written with a malformed body on
// Node 26 (the `bodyStream` crash in wrapFetchWithCache). The cached version
// catalogue is only a startup optimisation, so bypass it for every npm script.
process.env.EXPO_NO_CACHE = process.env.EXPO_NO_CACHE || '1';

const { spawnSync } = require('child_process');

const cli = require.resolve('@expo/cli');
const result = spawnSync(process.execPath, [cli, ...process.argv.slice(2)], {
  env: process.env,
  stdio: 'inherit',
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
