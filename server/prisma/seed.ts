import { seedDatabase } from '../src/seed';

async function main() {
  const args = process.argv.slice(2);
  const getArg = (name: string) => {
    const idx = args.indexOf(`--${name}`);
    return idx !== -1 ? args[idx + 1] : undefined;
  };

  await seedDatabase({
    username: getArg('username'),
    password: getArg('password'),
    email: getArg('email'),
  });
}

main().catch((e) => {
  console.error('[Seed] Error:', e);
  process.exit(1);
});
