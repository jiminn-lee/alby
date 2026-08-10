import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import path from 'node:path';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const targetsPath = path.join(projectRoot, 'supabase', 'targets.json');
const linkedRefPath = path.join(projectRoot, 'supabase', '.temp', 'project-ref');
const generatedTypesPath = path.join(projectRoot, 'src', 'types', 'database.ts');
const seedPath = path.join(projectRoot, 'supabase', 'seed.sql');
const testFixturesPath = path.join(projectRoot, 'supabase', 'tests', 'database', 'fixtures.inc');
const supabaseConfigPath = path.join(projectRoot, 'supabase', 'config.toml');
const spotifySecretPath = (targetName) => path.join(projectRoot, 'supabase', `.env.spotify.${targetName}.local`);

const [action, target, ...options] = process.argv.slice(2);
const allowedTargets = new Set(['staging', 'production']);

function fail(message) {
  console.error(message);
  process.exit(1);
}

function loadTargets() {
  try {
    return JSON.parse(readFileSync(targetsPath, 'utf8'));
  } catch {
    fail('Missing or invalid supabase/targets.json. Configure the two hosted project refs first.');
  }
}

function projectRefFor(targetName) {
  if (!allowedTargets.has(targetName)) fail('Target must be staging or production.');
  const projectRef = loadTargets()[targetName];
  if (typeof projectRef !== 'string' || !/^[a-z0-9]{20}$/.test(projectRef)) {
    fail(`supabase/targets.json does not contain a valid ${targetName} project ref.`);
  }
  return projectRef;
}

function runSupabase(args, capture = false) {
  const result = spawnSync('npx', ['supabase', '--agent', 'no', ...args], {
    cwd: projectRoot,
    encoding: capture ? 'utf8' : undefined,
    stdio: capture ? ['inherit', 'pipe', 'inherit'] : 'inherit',
  });
  if (result.error) fail(result.error.message);
  if (result.status !== 0) process.exit(result.status ?? 1);
  return result.stdout;
}

function requireLinkedTarget(targetName) {
  const expectedRef = projectRefFor(targetName);
  let linkedRef;
  try {
    linkedRef = readFileSync(linkedRefPath, 'utf8').trim();
  } catch {
    fail(`No hosted project is linked. Run npm run db:link:${targetName} first.`);
  }
  if (linkedRef !== expectedRef) {
    fail(`Refusing to target ${targetName}: the CLI is linked to ${linkedRef}, expected ${expectedRef}.`);
  }
}

function requireConfirmation(targetName) {
  if (!options.includes(`--confirm=${targetName}`)) {
    fail(`Refusing the remote write. Re-run with --confirm=${targetName}.`);
  }
}

switch (action) {
  case 'link':
    runSupabase(['link', '--project-ref', projectRefFor(target)]);
    break;
  case 'migrations':
    requireLinkedTarget(target);
    runSupabase(['migration', 'list', '--linked']);
    break;
  case 'dry-run':
    requireLinkedTarget(target);
    runSupabase(['db', 'push', '--linked', '--dry-run']);
    break;
  case 'push':
    requireLinkedTarget(target);
    requireConfirmation(target);
    runSupabase(['db', 'push', '--linked']);
    break;
  case 'seed':
    if (target !== 'staging') fail('Mock database and Storage fixtures may only be seeded to staging.');
    requireLinkedTarget(target);
    requireConfirmation(target);
    runSupabase(['db', 'push', '--linked', '--include-seed']);
    runSupabase(['seed', 'buckets', '--linked']);
    break;
  case 'config': {
    requireLinkedTarget(target);
    requireConfirmation(target);
    const temporaryRoot = mkdtempSync(path.join(tmpdir(), 'alby-supabase-config-'));
    const temporarySupabaseDir = path.join(temporaryRoot, 'supabase');
    mkdirSync(temporarySupabaseDir);
    let config = readFileSync(supabaseConfigPath, 'utf8');
    if (target === 'production') {
      config = config
        .replace('site_url = "alby-staging://auth/callback"', 'site_url = "alby://auth/callback"')
        .replace(
          'additional_redirect_urls = ["alby-dev://auth/callback", "alby-staging://auth/callback"]',
          'additional_redirect_urls = ["alby://auth/callback"]',
        );
    }
    writeFileSync(path.join(temporarySupabaseDir, 'config.toml'), config);
    const result = spawnSync(
      'npx',
      ['supabase', '--agent', 'no', '--workdir', temporaryRoot, 'config', 'push', '--project-ref', projectRefFor(target)],
      { cwd: projectRoot, stdio: 'inherit' },
    );
    rmSync(temporaryRoot, { recursive: true, force: true });
    if (result.error) fail(result.error.message);
    if (result.status !== 0) process.exit(result.status ?? 1);
    break;
  }
  case 'test':
    if (target !== 'staging') fail('Database tests run only against staging.');
    requireLinkedTarget(target);
    if (readFileSync(seedPath, 'utf8') !== readFileSync(testFixturesPath, 'utf8')) {
      fail('supabase/tests/database/fixtures.inc is out of sync with supabase/seed.sql.');
    }
    runSupabase(['test', 'db', '--linked', 'supabase/tests/database/rls.test.sql']);
    break;
  case 'verify':
    requireLinkedTarget(target);
    runSupabase(['test', 'db', '--linked', `supabase/tests/verification/${target}.test.sql`]);
    break;
  case 'lint':
    if (target !== 'staging') fail('Database lint runs against staging before promotion.');
    requireLinkedTarget(target);
    runSupabase(['db', 'lint', '--linked', '--level', 'warning', '--fail-on', 'error']);
    break;
  case 'types': {
    if (target !== 'staging') fail('Database types are generated from staging after migration verification.');
    requireLinkedTarget(target);
    const generatedTypes = runSupabase(['gen', 'types', 'typescript', '--linked'], true);
    writeFileSync(generatedTypesPath, generatedTypes);
    console.log(`Wrote ${path.relative(projectRoot, generatedTypesPath)} from staging.`);
    break;
  }
  case 'spotify-secrets': {
    requireLinkedTarget(target);
    requireConfirmation(target);
    const secretPath = spotifySecretPath(target);
    if (!existsSync(secretPath)) {
      fail(`Missing ${path.relative(projectRoot, secretPath)}. Copy supabase/.env.spotify.example and add this target's credentials.`);
    }
    runSupabase(['secrets', 'set', '--project-ref', projectRefFor(target), '--env-file', secretPath]);
    break;
  }
  case 'spotify-deploy':
    requireLinkedTarget(target);
    requireConfirmation(target);
    runSupabase(['functions', 'deploy', 'spotify-albums', '--project-ref', projectRefFor(target), '--use-api']);
    break;
  case 'spotify-list':
    requireLinkedTarget(target);
    runSupabase(['functions', 'list', '--project-ref', projectRefFor(target)]);
    break;
  default:
    fail('Usage: node scripts/supabase-target.mjs <link|migrations|dry-run|push|seed|config|test|verify|lint|types|spotify-secrets|spotify-deploy|spotify-list> <staging|production>');
}
