Aquí está el contexto actualizado:

---

# Redeterminaciones 800/16 — Decreto 1082/17
## Contexto técnico — v23
*Provincia de Córdoba*

---

## Inicio rápido
Al iniciar chat nuevo:
> *"Leíste el contexto de la app Redeterminaciones 800/16 v23. Quiero continuar el desarrollo. [describí qué querés hacer]"*

**Modo de trabajo:** usuario principiante. Solo código listo para copiar/pegar, mínima explicación.

---

## Stack
- Vanilla HTML/CSS/JS modular (scripts normales, no ES modules)
- Firebase Firestore + Auth (Google popup) — SDK v10 gstatic
- SheetJS CDN `xlsx/0.18.5` para importación/exportación Excel
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
`auth.js` — ignorar, roto y sin uso.

---

## Firestore
```
usuarios/{uid}/obras/{obraId}     ← obra completa (sin IOP)
usuarios/{uid}/iop/cordoba        ← { datos: {YYYY-MM: {factor: valor}}, orden: {nombre: nro}, ultimaEdicion }
licencias/{uid}                   ← { activa: bool, vencimiento: "YYYY-MM-DD", plan: "pro" }
```

---

## Estado global
| Variable | Contenido |
|---|---|
| `window.state` | Obra activa |
| `window.obras` | Array de todas las obras del usuario |
| `window.iopGlobal` | `{YYYY-MM: {factor: valor}}` |
| `window.iopOrden` | `{nombreFactor: nroOrden}` |

---

## Licencias
- Verificación en `state.js` dentro de `onAuthStateChanged`
- Si no existe doc en `licencias/{uid}`, está inactiva o venció → muestra `pantalla-licencia`
- `vencimiento` se guarda como string `"YYYY-MM-DD"`
- En caso de error de lectura → bloquea acceso

---

## Estructura de obra (`obraVacia()`)
```
id, fechaCreacion
obra: { nombre, expediente, fecha, fechaApertura, fechaReplanteo, contratista, duracionDias,
        anticipoPct, anticipoPeriodo }
items[]:          { id, nombre, unidad, cantidad, precio, precioOficial, factores[] }
modificaciones[]: ver estructura abajo
planMod[]:        { modId, itemId, periodo(YYYY-MM), cantidad }
realMod[]:        { modId, itemId, periodo(YYYY-MM), cantidad }
plan[]:           { itemId, periodo(YYYY-MM), cantidad }
real[]:           { itemId, periodo(YYYY-MM), cantidad }
adecuaciones[]:   { periodo, empresaPidio, decreto1082, superaGatillo, procede,
                    iopBase, iopActual, basePeriodo, periodoCalculo,
                    factor, total, detalle[],
                    detalleMod[], totalMod }
adecuacionesMod[]: { modId, modNombre, totalMod, totalAjusteOC, detalleMod[], saltos[] }
gatillo: 10
iopBase: YYYY-MM
nextId: 1
```

Compatibilidad (en `descargarTodoDeNube`):
```javascript
if (!state.modificaciones) state.modificaciones = [];
if (!state.planMod) state.planMod = [];
if (!state.realMod) state.realMod = [];
if (!state.adecuacionesMod) state.adecuacionesMod = [];
```

---

## Módulo Modificaciones de Obra (`versiones.js`)

### Estructura de una modificación
```javascript
{
  id,           // timestamp
  nombre,
  periodo,      // YYYY-MM — fecha de aplicación
  items: [
    {
      id, itemIdBase, nombre, unidad,
      cantidad,     // + demasía / − economía
      precio, precioOficial, factores, esNuevo
    }
  ]
}
```

### Tipos de ítems
| Tipo | `itemIdBase` | `cantidad` | Plan | Redeterminación |
|---|---|---|---|---|
| Demasía | id del base | positiva | `planMod` | con remanente |
| Economía | id del base | negativa | no | 100% (rem=1) |
| Ítem nuevo | null | positiva | `planMod` | con remanente |

### Funciones clave `versiones.js`
- `nuevaModificacion()` / `crearModificacion()` — crear modificación
- `abrirDetalleMod(id)` — abrir modal detalle
- `agregarItemMod()` — agregar ítem a modificación
- `eliminarItemMod(itemId)` / `eliminarModificacion()` — eliminar
- `renderDetalleModTabla(mod)` — tabla de ítems en modal
- `renderVersiones()` — lista de modificaciones en pantalla
- `descargarPlantillaPlanMod(modId)` — plantilla Excel plan mod
- `handlePlanModExcel(event, modId)` / `procesarPlanModExcel(rows, modId)` — importar plan mod

### Adecuación acumulada de modificaciones
- `calcularAdecuacionAcumuladaMod(modId, hastaPeriodo)` — calcula saltos faltantes hasta `hastaPeriodo`, respeta saltos ya calculados
- `calcularAdecuacionAcumuladaMod_desde_gatillo()` — wrapper para una sola modificación
- `verDetalleSaltoMod(modId, periodo)` — abre modal con detalle del salto individual
- Estructura `adecuacionesMod[]`: una entrada por modificación con `saltos[]` y totales acumulados
- Botón **+ Mod.** en tabla gatillo por cada período de obra base calculado sin salto → al clickear calcula todos los saltos faltantes hasta ese período
- Botón **Detalle mod.** en períodos con salto ya calculado

---

## engine.js
### `cantidadVigente(itemId, periodo)`
- Suma `item.cantidad` original + cambios de modificaciones aplicadas hasta `periodo`
- Resultado redondeado a 4 decimales
- ⚠️ Solo para mostrar en tablas, NO usar en cálculos de redeterminación

### `remanente(itemId, periodo)`
- Usa `item.cantidad` original (no vigente)
- `cv = item.cantidad`

### `remanenteMod(mod, itemMod, periodo)`
- Economías (`cantidad < 0`): siempre `{teorico:1, real:1, aplicado:1, nota:'economia'}`
- Demasías/nuevos: usa `acumPlanMod` y `acumRealMod`

### Funciones engine
| Función | Descripción |
|---|---|
| `acumPlan(itemId, hasta)` | Suma plan base |
| `acumReal(itemId, hasta)` | Suma real base |
| `acumPlanMod(modId, itemId, hasta)` | Suma planMod |
| `acumRealMod(modId, itemId, hasta)` | Suma realMod |
| `calcIopBase(periodo)` | Última adec. que procede antes del período |
| `periodoLabel(p)` | `YYYY-MM` → `"Mes YYYY"` |
| `fmt$(n)` / `fmtPct(n)` | Formateo moneda AR / porcentaje |

---

## adecuaciones.js
### Separación obra base / modificaciones
- Obra base: `cv = item.cantidad` original
- Modificaciones: `cv = itemMod.cantidad` (con signo)
- `calcularDetalleMod(periodo, periodoCalculo, basePeriodo, factorGlobal, adecAnterior, procede, decreto1082, anticipo)` — función centralizada
- `recalcularConMod(periodo)` — recalcula `detalleMod` de una adecuación individual
- `registrarAdecuacionDirecta` — deja `detalleMod: []` vacío

### Anticipo en modificaciones
```javascript
const aplicarAnticipoMod = anticipo > 0 && state.obra.anticipoPeriodo
    && periodo > state.obra.anticipoPeriodo && itemMod.cantidad < 0;
```

### Tabla gatillo — columnas
Período · Variación · Base activa · Estado · Acción

### `mostrarDetalle(idx)`
- Muestra detalle obra base + modificaciones
- Sección "Modificaciones de obra": usa detalle acumulado de `adecuacionesMod` si existe, sumando todos los saltos por ítem
- Título: `"Modificación 1 — Adec. 1 y 2 · Sep 2025"`
- Sección "Adecuación acumulada": muestra `totalAjusteOC` acumulado, solo si `adecuacionesMod` tiene saltos

---

## plan.js
- `cv = item.cantidad` para % ejecutado
- `renderRealScreen()` llama a `renderRealTable()` + `renderGraficoAvance()`
- `renderGraficoAvance()` — gráfico Chart.js línea, plan vs real acumulado %
  - Plan: todos los períodos de la obra (hasta el último)
  - Real: solo períodos con datos
  - Instancia guardada en `window._graficoAvance` (se destruye antes de recrear)

---

## resumen.js — grid4
| ID | Label |
|---|---|
| `r-contrato` | Contrato original |
| `r-vigente` | Nuevo monto de contrato |
| `r-adecuado` | Ajuste OC acumulado |
| `r-saldo` | Saldo a integrar |

⚠️ Pendiente: incluir `totalAjusteOC` de `adecuacionesMod` en los totales

---

## CSS / UI
### Paleta
- `--bg: #FAF8F2` · `--surface: #FFFFFF` · `--surface2: #F5F2EA` · `--accent-mid: #C9A84C`
- `.nav-item.active` → `background:#C9A84C; color:#0D0D0D`

### Modales nueva/editar obra
- `max-width:580px;width:95%;overflow:hidden`
- Grid fechas: `repeat(3,minmax(0,1fr))`
- Anticipo en card `surface2` con % grande en `accent-mid`
- Labels en uppercase 10px

---

## Pendiente
- Exportar adecuación a Excel (incluir detalleMod y totales combinados)
- Backup JSON
- `renderIOPEstado()`: variación acumulada correcta
- PDF informe adecuación
- Modo auditoría
- Redeterminación definitiva
- FAP (0.95) hardcodeado
- Validación plan sume 100% por ítem
- Resumen: incluir `totalAjusteOC` de `adecuacionesMod`
- Plan de modificación: tabla en pantalla separada
- Múltiples modificaciones: análisis pendiente

---

## Glosario
| Término | Definición |
|---|---|
| VRI | Variación acumulada ponderada por polinómica |
| Gatillo | VRI mínimo para adecuación (default 10%) |
| FAP | Factor de Adecuación Provisional = 0.95 |
| `periodoCalculo` | Período anterior al registrado |
| `basePeriodo` | Período base activo |
| `adecuacion` | Monto redeterminado bruto por ítem |
| `ajusteOC` | Monto a pagar en orden de compra |
| `saldoReintegro` | adecuacion - ajusteOC |
| `precioRedeterminado` | Base para la próxima adecuación |
| `precioProvisorio` | Base para calcular ajusteOC incremental |
| `precio` | Precio de oferta |
| `precioOficial` | Precio presupuesto oficial — solo ponderadores |
| `anticipoPct` | Porcentaje anticipo financiero |
| `anticipoPeriodo` | Período desde que aplica (`periodo > anticipoPeriodo`) |
| Rem. aplicado | MIN(teórico, real) — salvo decreto 1082 |
| Decreto 1082 | Penalizados/teorico-menor usan remReal |
| Demasía | Aumento de cantidad en modificación |
| Economía | Disminución de cantidad (negativa) |
| `planMod[]` | Plan de avance de demasías/nuevos |
| `realMod[]` | Avance real de demasías/nuevos |
| `detalleMod[]` | Detalle adecuación ítems de modificaciones |
| `adecuacionesMod[]` | Adecuaciones acumuladas de modificaciones |
| `saltos[]` | Detalle por período dentro de `adecuacionesMod` |
| fechaApertura | Inicio del cálculo del gatillo |
| fechaReplanteo | Inicio real de obra |