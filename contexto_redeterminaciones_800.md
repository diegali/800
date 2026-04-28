# Redeterminaciones 800/16 — Decreto 1082/17
## Contexto técnico — v25
*Provincia de Córdoba*

---

## Inicio rápido
Al iniciar chat nuevo:
> *"Leíste el contexto de la app Redeterminaciones 800/16 v25. Quiero continuar el desarrollo. [describí qué querés hacer]"*

**Modo de trabajo:** usuario principiante. Solo código listo para copiar/pegar, mínima explicación.

---

## Stack
- Vanilla HTML/CSS/JS modular (scripts normales, no ES modules)
- Firebase Firestore + Auth (Google popup) — SDK v10 gstatic
- SheetJS CDN `xlsx/0.18.5`
- Chart.js CDN `4.4.1` — usado en avance real
- PWA: `sw.js` + `manifest.json` — rutas relativas a `/800/` en GitHub Pages
- GitHub Pages: `https://diegali.github.io/800/`

---

## Estructura de archivos
```
index.html / sw.js / manifest.json
css/  base.css · components.css · screens.css
js/
  config.js · state.js · engine.js · ui.js · main.js
  screens/
    resumen.js · estructura.js · versiones.js
    plan.js · iop.js · adecuaciones.js
```

---

## Firestore
```
usuarios/{uid}/obras/{obraId}
usuarios/{uid}/iop/cordoba
licencias/{uid}  ← { activa: bool, vencimiento: "YYYY-MM-DD", plan: "pro" }
```

---

## Estado global
| Variable | Contenido |
|---|---|
| `window.state` | Obra activa |
| `window.obras` | Array de todas las obras |
| `window.iopGlobal` | `{YYYY-MM: {factor: valor}}` |
| `window.iopOrden` | `{nombreFactor: nroOrden}` |

---

## Estructura de obra (`obraVacia()`)
```
id, fechaCreacion
obra: { nombre, expediente, fecha, fechaApertura, fechaReplanteo, contratista,
        duracionDias, anticipoPct, anticipoPeriodo }
items[]:            { id, nro, nombre, unidad, cantidad, precio, precioOficial, factores[] }
modificaciones[]:   ver estructura abajo
planMod[]:          { modId, itemId, periodo, cantidad }
realMod[]:          { modId, itemId, periodo, cantidad }
plan[]:             { itemId, periodo, cantidad }
real[]:             { itemId, periodo, cantidad }
planesHistoricos[]: { id, nombre, fecha, plan[], planMod[] }
adecuaciones[]:     { periodo, empresaPidio, decreto1082, superaGatillo, procede,
                      iopBase, iopActual, basePeriodo, periodoCalculo,
                      factor, total, detalle[], detalleMod[], totalMod }
adecuacionesMod[]:  { modId, modNombre, totalMod, totalAjusteOC, detalleMod[], saltos[] }
gatillo: 10
iopBase: YYYY-MM
nextId: 1
```

### `detalle[]` por ítem
```javascript
{ itemId, nro, nombre, precioVigente, precioRedeterminado, precioProvisorio,
  remTeorico, remReal, remAplicado, nota, factor, adecuacion, ajusteOC, saldoReintegro }
```

### `detalleMod[]` por ítem
```javascript
{ modId, modNombre, itemId, nro, nombre, precioVigente, precioRedeterminado, precioProvisorio,
  remTeorico, remReal, remAplicado, nota, factor, adecuacion, ajusteOC, saldoReintegro }
```

### Compatibilidad (en `descargarTodoDeNube`)
```javascript
if (!state.modificaciones) state.modificaciones = [];
if (!state.planMod) state.planMod = [];
if (!state.realMod) state.realMod = [];
if (!state.adecuacionesMod) state.adecuacionesMod = [];
if (!state.planesHistoricos) state.planesHistoricos = [];
// Migrar nro en ítems de modificaciones sin nro
(state.modificaciones || []).forEach(mod => {
    (mod.items || []).forEach(itemMod => {
        if (itemMod.nro !== undefined) return;
        if (itemMod.esNuevo) {
            const totalBase = state.items.length;
            const nuevosAnteriores = state.modificaciones.flatMap(m => m.items)
                .filter(i => i.esNuevo && i.id < itemMod.id).length;
            itemMod.nro = totalBase + nuevosAnteriores + 1;
        } else {
            const itemBase = state.items.find(i => i.id === itemMod.itemIdBase);
            if (itemBase) itemMod.nro = `${itemBase.nro}.1`;
        }
    });
});
```

---

## Numeración de ítems
- `item.nro` — correlativo entero (1, 2, 3...) — se guarda al importar
- `itemMod.nro` — demasías: `"X.1"` · ítems nuevos: correlativo al final
- Economías: sin nro propio
- Se muestra en todas las pantallas concatenado con el nombre en una sola columna
- En detalle adecuaciones: `max-width:180px`, `text-overflow:ellipsis`, tooltip `title`
- Fallback en render: busca en `state.items` o `state.modificaciones` si no está en detalle

---

## Módulo Modificaciones (`versiones.js`)

### Estructura
```javascript
{
  id, nombre, periodo,
  items: [{ id, nro, itemIdBase, nombre, unidad, cantidad, precio, precioOficial, factores, esNuevo }]
}
```

### Tipos
| Tipo | `nro` | Plan | Redeterminación |
|---|---|---|---|
| Demasía | `"X.1"` | `planMod` | con remanente |
| Economía | sin nro | no | 100% (rem=1) |
| Ítem nuevo | correlativo final | `planMod` | con remanente |

### Funciones clave
- `crearModificacion()`, `abrirDetalleMod(id)`, `agregarItemMod()`, `eliminarItemMod()`, `eliminarModificacion()`
- `renderDetalleModTabla(mod)`, `renderVersiones()`
- `descargarPlantillaPlanMod(modId)`, `handlePlanModExcel(event, modId)`, `procesarPlanModExcel(rows, modId)`
- `calcularAdecuacionAcumuladaMod(modId, hastaPeriodo)` — calcula saltos faltantes, respeta calculados
- `calcularAdecuacionAcumuladaMod_desde_gatillo()` — wrapper
- `verDetalleSaltoMod(modId, periodo)` — modal detalle salto individual

### Botones en tabla gatillo
- **+ Mod.** — períodos sin salto → calcula faltantes hasta ese período
- **Detalle mod.** — períodos con salto → abre modal

---

## engine.js
| Función | Descripción |
|---|---|
| `cantidadVigente(itemId, periodo)` | Solo display, NO cálculos |
| `remanente(itemId, periodo)` | Usa `item.cantidad` original |
| `remanenteMod(mod, itemMod, periodo)` | Economías rem=1, otros usa planMod/realMod |
| `acumPlan/Real(itemId, hasta)` | Plan/real base |
| `acumPlanMod/RealMod(modId, itemId, hasta)` | Plan/real modificación |
| `calcIopBase(periodo)` | Última adec. que procede antes del período |
| `periodoLabel(p)` | `YYYY-MM` → `"Mes YYYY"` |
| `fmt$(n)` / `fmtPct(n)` | Formateo moneda AR / porcentaje |

---

## adecuaciones.js
- Obra base: `cv = item.cantidad` original
- Modificaciones: `cv = itemMod.cantidad` (con signo)
- `calcularDetalleMod(...)` — función centralizada
- `recalcularConMod(periodo)` — recalcula `detalleMod` individual
- `registrarAdecuacionDirecta` — deja `detalleMod: []`
- Anticipo solo en economías: `periodo > anticipoPeriodo && itemMod.cantidad < 0`

### `mostrarDetalle(idx)`
- Tabla obra base: `detalle[]` con nro+nombre
- Tabla modificaciones: detalle acumulado de `adecuacionesMod` sumando saltos por ítem
- Título mod: `"Modificación 1 — Adec. 1 y 2 · Sep 2025"`
- Sección acumulada: `totalAjusteOC`, solo si hay saltos

### Tabla gatillo — columnas
Período · Variación · Base activa · Estado · Acción

---

## plan.js

### Plan de avance
- `renderPlanScreen()` → `renderPlanTable()` + `renderPlanesHistoricos()`
- `renderPlanTable()` — muestra ítems base + demasías/nuevos intercalados:
  - Ítems base: fondo normal
  - Demasías/nuevos: fondo `var(--surface2)`
  - Demasías aparecen debajo de su ítem base
  - Ítems nuevos al final
  - Períodos: unión de `state.plan` + `state.planMod`

### Importación de plan
- `procesarPlanExcel(data)` — detecta columna Nº (nueva plantilla) o sin nro (vieja)
  - Matchea por nro primero (mod antes que base), luego por nombre como fallback
  - Ítems base → `nuevasPlan[]`, ítems mod → `nuevasPlanMod[]`
  - Abre modal `modal-nombre-plan` para confirmar
- `confirmarNuevoPlan()`:
  - Guarda plan actual en `planesHistoricos[]` (incluye `planMod`)
  - Toma todo del Excel sin corte
  - Actualiza `state.plan` y `state.planMod`

### Plantilla Excel
- `descargarPlantilla()` — incluye ítems base + demasías/nuevos de modificaciones
  - Columna Nº agregada (col 0)
  - Demasías aparecen debajo de su ítem base
  - Ítems nuevos al final

### Historial de planes
- `renderPlanesHistoricos()` — lista con botones Restaurar y ✕
- `restaurarPlanHistorico(id)` — reemplaza `state.plan` y `state.planMod`
- `eliminarPlanHistorico(id)`

### Gráfico avance
- `renderGraficoAvance()` — Chart.js línea, plan completo vs real períodos con datos
- Instancia en `window._graficoAvance`

### Avance real
- `renderRealScreen()` → `renderRealTable()` + `renderGraficoAvance()`
- Tabla: nro+nombre concatenados

---

## resumen.js — grid4
| ID | Label |
|---|---|
| `r-contrato` | Contrato original |
| `r-vigente` | Nuevo monto de contrato |
| `r-adecuado` | Ajuste OC acumulado |
| `r-saldo` | Saldo a integrar |
⚠️ Pendiente: incluir `totalAjusteOC` de `adecuacionesMod`

---

## CSS / UI
- Paleta: `--bg:#FAF8F2` · `--surface:#FFFFFF` · `--surface2:#F5F2EA` · `--accent-mid:#C9A84C`
- Modales nueva/editar obra: `max-width:580px;width:95%;overflow:hidden`

---

## Pendiente
- Exportar adecuación a Excel (con detalleMod y totales)
- Backup JSON
- `renderIOPEstado()`: variación acumulada correcta
- PDF informe adecuación
- Modo auditoría
- Redeterminación definitiva
- FAP hardcodeado (0.95)
- Validación plan sume 100%
- Resumen: incluir `totalAjusteOC` de `adecuacionesMod`
- Avance real: incluir ítems de modificaciones (igual que plan)
- Múltiples modificaciones: análisis pendiente

---

## Glosario
| Término | Definición |
|---|---|
| VRI | Variación acumulada ponderada |
| Gatillo | VRI mínimo (default 10%) |
| FAP | Factor Adecuación Provisional = 0.95 |
| `periodoCalculo` | Período anterior al registrado |
| `basePeriodo` | Período base activo |
| `adecuacion` | Monto redeterminado bruto |
| `ajusteOC` | Monto a pagar en OC |
| `saldoReintegro` | adecuacion - ajusteOC |
| `precioRedeterminado` | Base próxima adecuación |
| `precioProvisorio` | Base ajusteOC incremental |
| `precio` | Precio oferta |
| `precioOficial` | Solo ponderadores polinómica |
| `anticipoPct/Periodo` | Anticipo financiero |
| Rem. aplicado | MIN(teórico, real) salvo Dec.1082 |
| Demasía | Aumento cantidad en modificación |
| Economía | Disminución cantidad (negativa) |
| `planMod/realMod` | Plan/real de modificaciones |
| `detalleMod` | Detalle adecuación modificaciones |
| `adecuacionesMod` | Adecuaciones acumuladas mods |
| `saltos[]` | Detalle por período en adecuacionesMod |
| `planesHistoricos` | Versiones anteriores del plan |
| fechaApertura | Inicio cálculo gatillo |
| fechaReplanteo | Inicio real de obra |