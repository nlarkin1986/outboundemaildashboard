export function databaseConnectionStringFromEnv() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.delete('sslmode');
  return url.toString();
}
