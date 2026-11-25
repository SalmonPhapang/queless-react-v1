// Upload Expo web artifacts to Sentry after `expo export --source-maps external`.
// The auth token is read from the environment (Vercel/EAS) or from the local,
// gitignored .env.sentry-build-plugin file. It is never passed on the command line.
const fs = require('fs');
const path = require('path');
const { SentryCli } = require('@sentry/cli');

const root = path.resolve(__dirname, '..');
const project = process.env.SENTRY_PROJECT || 'queless-customer';
const org = process.env.SENTRY_ORG || 'source-code-development';
const dist = path.join(root, 'dist');

function loadDotenv(file) {
  if (!fs.existsSync(file)) return;
  const source = fs.readFileSync(file, 'utf8');
  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!Object.prototype.hasOwnProperty.call(process.env, key)) {
      process.env[key] = value;
    }
  }
}

loadDotenv(path.join(root, '.env.sentry-build-plugin'));

if (!process.env.SENTRY_AUTH_TOKEN) {
  console.error('SENTRY_AUTH_TOKEN is required to upload Sentry source maps.');
  process.exit(1);
}

if (!fs.existsSync(dist)) {
  console.error(`Cannot upload Sentry source maps: ${dist} does not exist.`);
  process.exit(1);
}

new SentryCli()
  .execute(
    [
      'sourcemaps',
      'upload',
      '--org',
      org,
      '--project',
      project,
      dist,
    ],
    true,
  )
  .catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  });
