# Documentación de UDP Map

Este índice separa instrucciones de trabajo, contratos actuales, decisiones y
antecedentes. La referencia describe el código y SQL versionados; no certifica
lo desplegado ni el resultado en dispositivos reales.

<a id="que-leer"></a>

## Qué leer

| Necesidad                                           | Documento principal                                     |
| --------------------------------------------------- | ------------------------------------------------------- |
| Entender el proyecto y arrancarlo                   | [README raíz](../README.md)                             |
| Reglas de un cambio                                 | [CLAUDE.md](../CLAUDE.md)                               |
| Pendientes, prioridades y decisiones abiertas       | [ROADMAP](ROADMAP.md)                                   |
| Preparar el entorno y contribuir                    | [Desarrollo](guias/desarrollo.md)                       |
| Configurar, reconstruir, desplegar y volver atrás   | [Despliegue](guias/despliegue.md)                       |
| Comprobaciones locales y pruebas manuales           | [Validación](guias/validacion.md)                       |
| Rutas, dominios, fuentes y consumidores             | [Repositorio](referencia/repositorio.md)                |
| Modelo, permisos, RPC, triggers y discrepancias SQL | [Base de datos](referencia/base-de-datos.md)            |
| Códigos, catálogo e importación de salas            | [Salas](referencia/salas.md)                            |
| Avisos, push, sesiones y moderación                 | [Notificaciones](referencia/notificaciones.md)          |
| Detección y aplicación de actualizaciones           | [PWA](referencia/pwa.md)                                |
| Motivos arquitectónicos y consecuencias             | [Arquitectura](decisiones/arquitectura.md)              |
| Alternativas y límites del rework push              | [Decisiones de push](decisiones/notificaciones-push.md) |
| Novedades que muestra la aplicación                 | [CHANGELOG](CHANGELOG.md)                               |

`CHANGELOG.md` conserva su ruta y formato porque Vite lo convierte en el aviso
de actualización. No acumules allí auditorías ni listas auxiliares.

## Cómo interpretar la evidencia

**Implementado** significa que existe en código, configuración o SQL. Una prueba
presente no acredita su ejecución. **Decisión registrada** significa que un
documento o Git expresa una elección; si los motivos fueron reconstruidos por
una auditoría, se señalan como inferencia. **Registro operativo** deja constancia
de una consulta, despliegue o prueba con fecha: no inspecciona hoy ese servicio.
**Pendiente de comprobación** requiere datos, consola, dispositivo, terreno o
un ensayo que no está reproducido.

La reorganización de octubre de 2026 contrastó el corpus con `b16bb4b`.
Las incertidumbres siguen en referencias y plan. No se cambió el producto para
hacer coincidir su comportamiento con una descripción.

## Antecedentes

Los originales se conservaron antes de reescribirlos:

- [Hoja de ruta anterior](historico/2026-10/roadmap-anterior.md): diagnóstico,
  especificaciones, fases cerradas y planes originales.
- [Auditoría de push](historico/2026-10/auditoria-push.md): hallazgos, balance,
  alternativas y alcance de revisión.
- [Bitácora de push](historico/2026-10/bitacora-push.md): diagnóstico y pruebas
  relatadas durante el arreglo.
- [Documentación anterior](historico/2026-10/documentacion-anterior.md): otros
  originales, investigación de salas y observaciones de base de datos.

Son registros fechados con fuente Markdown original plegable. Sus órdenes,
cifras, enlaces y estados pertenecen a aquel corte; consulta el sucesor indicado
antes de operar.

## Mantener la documentación

Una explicación tiene un lugar principal. Desde los demás documentos, enlázala.
Conserva los límites del contrato —plazos, tamaños, permisos— cuando son
necesarios; evita censos manuales de archivos, tests, tablas o líneas.

Al cambiar estructura, actualiza referencia y consumidores. Al cambiar esquema,
actualiza migración, baseline y referencia de base de datos. Al cerrar pendientes,
actualiza el plan sin borrar los motivos de la decisión. Los procedimientos
vigentes viven en guías; los originales y sus cortes, en el histórico.
