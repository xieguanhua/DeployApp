import { Pool } from "pg";

let pool: Pool | null = null;

export function getPgPool() {
  if (pool) return pool;

  const { pgConnectionString } = useRuntimeConfig();
  if (!pgConnectionString) {
    throw createError({
      statusCode: 500,
      statusMessage: "PG_CONNECTION_STRING 未配置"
    });
  }

  pool = new Pool({
    connectionString: pgConnectionString,
    max: 10
  });
  return pool;
}
