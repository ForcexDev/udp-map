import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { FACULTY_PERIMETERS } from '../src/shared/data/facultyPerimeters'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const seedPath = path.join(__dirname, '../supabase/seed/seed.sql')

let seedSql = fs.readFileSync(seedPath, 'utf8')

let updates = '-- ── Polígonos Reales (exportados de facultyPerimeters.ts) ──\n'
for (const [id, polygon] of Object.entries(FACULTY_PERIMETERS)) {
  updates += `update faculties set polygon = '${JSON.stringify(polygon)}'::jsonb where id = '${id}';\n`
}

seedSql = seedSql.replace(
  /-- Huella aproximada: cuadrado GeoJSON.*?(?=insert into careers)/s,
  updates + '\n\n'
)

fs.writeFileSync(seedPath, seedSql)
console.log('✅ seed.sql actualizado con los polígonos reales.')
