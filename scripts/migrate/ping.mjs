import pg from 'pg'
const c = new pg.Client({ connectionString: process.argv[2] })
await c.connect()
await c.query('SELECT 1')
const t = []
for (let i = 0; i < 10; i++) { const s = Date.now(); await c.query('SELECT 1'); t.push(Date.now() - s) }
await c.end()
t.sort((a, b) => a - b)
console.log(`${process.argv[3]}: median ${t[5]}ms  best ${t[0]}ms`)
