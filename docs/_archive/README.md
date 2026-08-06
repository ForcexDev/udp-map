# Archivo

Documentos **congelados**. No se actualizan y no describen el estado actual del
repositorio: se conservan porque explican cómo se llegó hasta aquí.

Si buscas el estado de hoy, mira [`../ROADMAP.md`](../ROADMAP.md) y
[`../DATABASE.md`](../DATABASE.md).

| Archivo | Qué era | Por qué está aquí |
|---|---|---|
| `ARQUI-2026-07.md` | Auditoría arquitectónica completa, julio de 2026 | Es una foto de un momento, no un documento vivo. Apunta a rutas que ya no existen (`d:\Code\udp-map`). Su contenido útil pasó a `CONTRIBUTING.md` y a `CLAUDE.md` |
| `PLAN-v0.3.md` | El "documento maestro y plan vivo" | Se contradecía a sí mismo: el título decía v0.6.0 y el cuerpo "el repositorio v0.3.0 utiliza", con fecha de julio y "Sprint 5 en progreso". Un find-replace a medias. Lo sustituye `ROADMAP.md` |
| `SPRINTS_STATUS-v0.6.md` | Seguimiento por sprints | Se solapaba con el anterior y también había quedado atrás (decía 12 archivos de pruebas y 54 tests; hoy son 24 y 171). Lo que seguía abierto se movió a la sección "Backlog heredado" de `ROADMAP.md` |

Los tres referenciaban un `securityDB.md` que **nunca existió en el repositorio**:
ocho enlaces rotos repartidos entre ellos y `CONTRIBUTING.md`. Los pendientes de
seguridad viven ahora en la sección 11 de `DATABASE.md` ("Observaciones
abiertas") y en el backlog de `ROADMAP.md`.
