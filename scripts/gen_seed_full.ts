import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { CAMPUSES, FACULTIES, CAREERS, CATEGORIES } from '../src/shared/data/campusData'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const seedPath = path.join(__dirname, '../supabase/seed/seed.sql')

let sql = `-- ═══════════════════════════════════════════════════════════════\n`
sql += `-- Seed: campus, facultades (→ place pins), carreras, categorías,\n`
sql += `-- plano indoor demo y lista de admins.\n`
sql += `-- ⚠️ Sincronizado automáticamente desde campusData.ts\n`
sql += `-- ═══════════════════════════════════════════════════════════════\n\n`

sql += `insert into campuses (id, name, lat, lng) values\n`
sql += CAMPUSES.map(c => `  ('${c.id}', '${c.name}', ${c.lat}, ${c.lng})`).join(',\n')
sql += `\non conflict (id) do nothing;\n\n`

sql += `insert into faculties (id, name, name_en, campus_id, lat, lng, image) values\n`
sql += FACULTIES.map(f => `  ('${f.id}', '${f.name}', '${f.name_en}', '${f.campus_id}', ${f.lat}, ${f.lng}, ${f.image ? `'${f.image}'` : 'null'})`).join(',\n')
sql += `\non conflict (id) do nothing;\n\n`

// Los perímetros NO se siembran. Viven solo en \`faculties.polygon\` y se
// dibujan desde /admin/mapeo. Aquí hubo una copia generada desde el archivo
// estático, se desincronizó, y como este script no tiene comando de npm nadie
// se enteró durante meses. Una base recién sembrada arranca sin contornos y se
// trazan desde el editor, que es de donde salen ahora.

sql += `insert into careers (faculty_id, name, name_en) values\n`
sql += CAREERS.map(c => `  ('${c.faculty_id}', '${c.name}', '${c.name_en}')`).join(',\n')
sql += `;\n\n`

sql += `insert into categories (id, kind, name, name_en, color, svg_path, ttl_hours) values\n`
sql += CATEGORIES.map(c => `  ('${c.id}', '${c.kind}', '${c.name}', '${c.name_en}', '${c.color}', '${c.svgPath}', ${c.ttl_hours === null ? 'null' : c.ttl_hours})`).join(',\n')
sql += `\non conflict (id) do nothing;\n\n`

sql += `-- ── Facultades como pines \`place\` permanentes ──\n`
sql += `insert into pins (type, title, faculty_id, lat, lng, is_permanent, is_official)\n`
sql += `select 'place', f.name, f.id, f.lat, f.lng, true, true\n`
sql += `from faculties f\n`
sql += `where not exists (\n`
sql += `  select 1 from pins p where p.type = 'place' and p.faculty_id = f.id\n`
sql += `);\n\n`

// El mapeo interior (buildings, building_floors, areas) no se siembra: se traza
// a mano desde /admin/mapeo y se exporta desde ahí.

// Los correos de admin no se generan: son datos personales y el seed vive en el
// repositorio. Se insertan a mano tras un reset (ver docs/DATABASE.md, §10).
sql += `-- ── Admins iniciales ──\n`
sql += `-- No van aquí: son correos de personas reales y este archivo está en el\n`
sql += `-- repositorio. Se insertan a mano tras un reset, y ANTES de que esas personas\n`
sql += `-- se registren, porque el rol admin se asigna en el alta y no después:\n`
sql += `--\n`
sql += `--   insert into admin_emails (email) values ('alguien@mail.udp.cl');\n`
sql += `--\n`
sql += `-- Ver el runbook en docs/DATABASE.md, sección 10.\n`

fs.writeFileSync(seedPath, sql)
console.log('✅ seed.sql REGENERADO COMPLETAMENTE con toda la data de campusData.ts.')
