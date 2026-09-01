// Row counts for every public table, so source and target can be compared
// exactly before anything is switched over.
import pg from 'pg'
const client = new pg.Client({ connectionString: process.argv[2] })
await client.connect()
const { rows: tables } = await client.query(
  `SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`
)
const out = {}
for (const t of tables) {
  const { rows } = await client.query(`SELECT count(*)::int AS n FROM "${t.tablename}"`)
  out[t.tablename] = rows[0].n
}
await client.end()
console.log(JSON.stringify(out))
