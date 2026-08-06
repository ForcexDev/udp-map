# AGENTS.md

Las reglas de este repositorio para agentes de IA están en **[CLAUDE.md](CLAUDE.md)**.

Este archivo existe porque cada herramienta busca un nombre distinto (`AGENTS.md`,
`CLAUDE.md`, `.cursorrules`, `.github/copilot-instructions.md`). El contenido es
uno solo y vive en `CLAUDE.md`; los demás apuntan ahí para que no se desincronicen.

**Lee `CLAUDE.md` antes de tocar nada.** Lo más importante que dice:

- Todo cambio en la base de datos son tres cosas en el mismo commit: la migración,
  `supabase/schema/baseline.sql` y `docs/DATABASE.md`.
- Antes de dar algo por terminado: `npm run typecheck && npx vitest run && npx eslint src`.
- Hay una lista de reglas del mapa que ya costaron caro. Léelas antes de tocar
  `MapView.tsx`.
