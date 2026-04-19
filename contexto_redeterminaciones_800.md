# Redeterminaciones 800/16 — Decreto 1082/17
## Contexto técnico — v17
*Provincia de Córdoba*

---

## Inicio rápido
Al iniciar chat nuevo:
> *"Leíste el contexto de la app Redeterminaciones 800/16 v17. Quiero continuar el desarrollo. [describí qué querés hacer]"*

**Modo de trabajo:** usuario principiante. Solo código listo para copiar/pegar, mínima explicación.

---

## Stack
- Vanilla HTML/CSS/JS modular (scripts normales, no ES modules)
- Firebase Firestore + Auth (Google popup) — SDK v10 gstatic
- SheetJS CDN `xlsx/0.18.5` para importación/exportación Excel
- PWA: `sw.js` + `manifest.json` en raíz — bumping de versión al deployar
- GitHub Pages

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
```

---

## Estado global
| Variable | Contenido |
|---|---|
| `window.state` | Obra activa |
| `window.obras` | Array de todas las obras del usuario |
| `window.iopGlobal` | `{YYYY-MM: {factor: valor}}` |
| `window.iopOrden` | `{nombreFactor: nroOrden}` — se guarda en Firestore junto al IOP |

`state.iop` NO existe — todo el IOP en `window.iopGlobal`.

---

## Estructura de obra (`obraVacia()`)
```
id, fechaCreacion
obra: { nombre, expediente, fecha, fechaApertura, fechaReplanteo, contratista, duracionDias,
        anticipoPct, anticipoPeriodo }
items[]:      { id, nombre, unidad, cantidad, precio, precioOficial, factores[] }
versiones[]:  { itemId, fecha(YYYY-MM), cantidad, motivo }
plan[]:       { itemId, periodo(YYYY-MM), cantidad }
real[]:       { itemId, periodo(YYYY-MM), cantidad }
adecuaciones[]: { periodo, empresaPidio, superaGatillo, procede,
                  iopBase, iopActual, basePeriodo, periodoCalculo,
                  factor, total, detalle[] }
gatillo: 10
iopBase: YYYY-MM   ← solo para matriz IOP, NO para calcularEstadoGatillo
nextId: 1
```

### Anticipo financiero ✅ implementado v17
- `state.obra.anticipoPct` — porcentaje (ej: `25` → 25%)
- `state.obra.anticipoPeriodo` — período desde el que aplica (`YYYY-MM`)
- Se carga en modales "Nueva obra" y "Editar obra" (`index.html`)
- Se guarda en `guardarObra()` y `guardarEdicionObra()` en `main.js`
- Se aplica en `guardarAdecuacion()` cuando `periodo >= anticipoPeriodo`

### Fórmulas con anticipo (cuando aplica) ✅ verificado adec1
```
anticipo = state.obra.anticipoPct / 100
precioRedeterminado = round(precioBase × anticipo + precioBase × factorRedondeado × (1 - anticipo), 4)
precioProvisorio    = round(precioBase × anticipo + precioBase × (1 + varProvisoria) × (1 - anticipo), 4)
adecuacion          = round(adecuacion × (1 - anticipo), 4)
ajusteOC            = calculado con los precios provisorios modificados (sin cambio de fórmula)
```
- ⚠️ **Pendiente investigar**: diferencia pequeña (~$9.441 sobre $1.924M) en ajusteOC adec 2 para 7 ítems con `precioOficial ≠ precio`. App da `23.832,52`, Excel da `23.834,20` para "Enmarcados". Factor y anticipo coinciden. Causa aún no identificada.

### `precioOficial` en ítems ✅
- `item.precio` = precio de la oferta (base para montos, remanentes, adecuaciones)
- `item.precioOficial` = precio del presupuesto oficial (SOLO para ponderadores de polinómica en `getIOPConsolidado`)
- Si `precioOficial` es 0 o undefined, `getIOPConsolidado` cae a `precio`
- Se importa desde botón "⬆ Importar oficial" en pantalla Estructura
- Plantilla: hoja `Presupuesto`, precio en columna E (índice 4)

### detalle[] por ítem — estructura completa ✅
```
{
  itemId, nombre,
  precioVigente,       ← cantidad × precioBase (precio redet de adec anterior, o precio original)
  precioRedeterminado, ← round(precioBase × factorRedondeado, 4) [sin anticipo]
  precioProvisorio,    ← round(precioBase × (1 + varProvisoria), 4) [sin anticipo]
  remTeorico, remReal, remAplicado,  ← calculados con periodoCalculo (mes anterior)
  nota, factor,
  adecuacion,          ← round(precioVigente × remAplicado × variacion, 4)
  ajusteOC,            ← round(cv × remAplicado × (precioProvisorio - precioProvAnterior) + (cv - cv0) × precioProvAnterior, 4)
  saldoReintegro       ← round(adecuacion - ajusteOC, 4)
}
```
- `total` de la adecuación = suma de `adecuacion` de todos los ítems
- `precioProvAnterior` = `detalleAnterior.precioProvisorio` o `item.precio` si es la primera adecuación

---

## engine.js — funciones clave
| Función | Descripción |
|---|---|
| `cantidadVigente(itemId, periodo)` | Última versión del ítem con fecha <= período |
| `acumPlan(itemId, hasta)` | Suma plan hasta período |
| `acumReal(itemId, hasta)` | Suma real hasta período |
| `remanente(itemId, periodo)` | `{teorico, real, aplicado, nota}` |
| `calcIopBase(periodo)` | Última adec. que procede antes del período, o `state.iopBase`. NO se usa en `calcularEstadoGatillo` |
| `periodoLabel(p)` | `YYYY-MM` → `"Mes YYYY"`. Soporta `MES-N` |
| `fmt$(n)` / `fmtPct(n)` | Formateo moneda AR / porcentaje |

---

## iop.js — funciones clave

### Firmas
```javascript
getIOP(periodo, basePeriodo)              // → VRI ponderado (variación, no valor absoluto)
getIOPConsolidado(periodo, basePeriodo)   // ídem
getIOPFactores(periodo)                   // → window.iopGlobal[periodo]
getFactorItem(item, periodo, basePeriodo) // → factor individual del ítem (ej: 1.1584)
```

### Cálculo VRI (getIOPConsolidado)
```
pesos[factor] = SUMAPRODUCTO(peso_factor_item × (precioOficial × cantidad / totalOficial))
VRI = SUM( pesos[factor] × (IOP_factor_actual / IOP_factor_base − 1) )
```
- Usa `item.precioOficial` para ponderadores (precio presupuesto oficial)
- Si `precioOficial` es 0 o undefined, cae a `item.precio`
- Normalización de nombres de factores con `normUp()` (quita tildes, mayúsculas)

### Factor por ítem (getFactorItem) ✅ corregido v16
```
factorItem = 1 + SUM( peso_f × (IOP_f_periodoCalculo / IOP_f_base − 1) )
```
- Usa `periodoCalculo` como período actual y `basePeriodo` como base
- Cada ítem tiene su propio factor según su polinómica individual
- **Bug corregido v16:** buscaba `factor` (número acumulador) en lugar de `key` (nombre del factor)

### Redondeo en cálculos — ✅ verificado contra Excel
```
factorRedondeado = round(factorItem, 4)
variacion        = round(factorRedondeado - 1, 4)        ← redondear ANTES de multiplicar por FAP
varProvisoria    = round(variacion × FAP, 4)              ← evita error de punto flotante
```

### saveIOP / descargarTodoDeNube
- `saveIOP()` guarda `{ datos: iopGlobal, orden: iopOrden, ultimaEdicion }`
- `descargarTodoDeNube()` restaura tanto `iopGlobal` como `iopOrden` desde Firestore

### renderIOP()
- Lee `gatillo-val` y guarda en `state.gatillo`
- NO lee `gatillo-base` (selector eliminado — base se calcula automáticamente)
- Llama `renderIOPMatriz()` y `renderIOPEstado()`

### recalcIOP()
- Solo lee `gatillo-val`, llama `save()` y `renderIOP()`
- `gatillo-base` eliminado

### renderIOPMatriz()
- Tabla con filas alternadas, fuentes compactas, números con `font-family:var(--mono)`
- Pill resumen (`#iop-resumen-pill`): "N factores · N períodos"
- Sin marcado de base activa

### renderIOPEstado()
- Muestra 3 metrics centrados: Períodos cargados · Factores cargados · Último período
- Sin cálculo de variación (pendiente corrección de `getIOP` con dos parámetros)

### Pantalla IOP — layout
- Barra superior: botón importar + input gatillo (a la derecha, inline)
- Grid: tabla ancha (3fr) + columna Estado IOP (160px), igual alto con `align-items:stretch`

---

## estructura.js — importación de ítems

### `importarItemsExcel(input)` — importa oferta (formato 800)
- Hoja: `Hoja1` o primera hoja
- Precio en columna J (índice 9)
- Filas de ítem: colA = número, colB = nombre, colD = unidad, colE = cantidad, colJ = precio
- Filas de factor: colA null, colF = nombre, colG = nro, colH = peso decimal

### `importarOficialExcel(input)` — importa presupuesto oficial ✅ nuevo v16
- Hoja: `Presupuesto`, `Hoja1`, o primera hoja
- Precio en columna E (índice 4)
- Solo lee filas donde colB = string (nombre ítem) y colE = número (precio)
- Mapea por posición — debe tener exactamente la misma cantidad de ítems que la obra
- Guarda `item.precioOficial` en cada ítem y llama `save()`
- Botón en index.html junto al botón "⬆ Importar oferta"

---

## adecuaciones.js — lógica del gatillo

### `calcularEstadoGatillo()` — algoritmo
```
base_inicial = período IOP anterior a fechaApertura
período 0 (= fechaApertura) → variacion: null, basePeriodo: null
período i (i > 0):
  periodoAnterior = periodos[i-1]
  si adecuación procede en periodoAnterior:
      idxAnterior = todos.indexOf(periodoAnterior)
      baseIndex = todos[idxAnterior - 1]   ← dos posiciones atrás
  periodoCalculo = periodoAnterior
  variacion = getIOP(periodoCalculo, baseIndex)
  supera = variacion > gatillo/100
resultado[i] = { periodo, variacion, supera, basePeriodo: baseIndex, periodoCalculo }
```

### `guardarAdecuacion()` — bloque por ítem con anticipo ✅
```javascript
const FAP = 0.95;
let adecuacion = 0, saldoReintegro = 0, ajusteOC = 0;
let precioRedeterminado = precioBase, precioProvisorio = precioBase;

if (procede) {
    const anticipo = (state.obra.anticipoPct || 0) / 100;
    const aplicarAnticipo = anticipo > 0 && state.obra.anticipoPeriodo && periodo >= state.obra.anticipoPeriodo;

    const factorRedondeado = round(factor, 4);
    const variacion = round(factorRedondeado - 1, 4);
    const varProvisoria = round(variacion * FAP, 4);

    adecuacion = round(precioVigente * rem.aplicado * variacion, 4);

    if (aplicarAnticipo) {
        precioRedeterminado = round(precioBase * anticipo + precioBase * factorRedondeado * (1 - anticipo), 4);
        precioProvisorio    = round(precioBase * anticipo + precioBase * (1 + varProvisoria) * (1 - anticipo), 4);
        adecuacion          = round(adecuacion * (1 - anticipo), 4);
    } else {
        precioRedeterminado = round(precioBase * factorRedondeado, 4);
        precioProvisorio    = round(precioBase * (1 + varProvisoria), 4);
    }

    const precioProvAnterior = detalleAnterior?.precioProvisorio ?? item.precio;
    ajusteOC = round(cv * rem.aplicado * (precioProvisorio - precioProvAnterior) + (cv - cv0) * precioProvAnterior, 4);
    saldoReintegro = round(adecuacion - ajusteOC, 4);
}
total += adecuacion;
```

**Reglas clave:**
1. `remanente` usa `periodoCalculo` (mes anterior), no el período registrado
2. `precioBase` = `precioRedeterminado` de la adecuación anterior que procede, o `item.precio`
3. `precioProvAnterior` = `precioProvisorio` de la adecuación anterior, o `item.precio`
4. Redondear `variacion` antes de multiplicar por FAP (evita error de punto flotante)
5. `ajusteOC` se guarda en el detalle (no se recalcula al mostrar)
6. `precio` de oferta siempre es la base — `precioOficial` solo afecta ponderadores IOP

### `renderGatillo()` — tabla horizontal
- Columnas = períodos IOP desde `fechaApertura`
- Filas (en orden): var. acumulada · base activa · estado · acción
- Primera columna fija con `position:sticky;left:0`
- Columnas compactas (`min-width:80px`)
- Con gatillo sin calcular: select "¿Empresa pidió?" + botón "Calcular"
- Con adecuación guardada: estado + botón "× Borrar"

### `renderAdecuaciones()` — tabla control
- Columnas centradas excepto Monto (alineado derecha, título "Ajuste OC")
- Sin botón × en cada fila (se eliminó)
- Sin botón "Calcular nueva adecuación" en el header (se eliminó)

### `mostrarDetalle()` — tabla detalle por ítem
Columnas (todas centradas): Ítem · Precio vigente · Rem. teórico · Rem. real · Rem. aplicado · Factor IOP · Monto redeterminado · Ajuste OC · Saldo reintegro · Nota
- Monto redeterminado = `d.adecuacion`
- Ajuste OC = `d.ajusteOC` (guardado en detalle)
- Saldo reintegro = `d.saldoReintegro`

### Pie de `mostrarDetalle()` — dos secciones
**Adecuación seleccionada:**
- Ajuste orden de compra = suma de `ajusteOC` del detalle
- Saldo a integrar (esta adecuación) = suma de `saldoReintegro` del detalle

**Resumen general:**
- Contrato de referencia = contrato original + suma ajusteOC de adecuaciones *anteriores* que proceden
- Nuevo monto de contrato = contrato de referencia + ajusteOC de la adecuación seleccionada
- Saldos acumulados a integrar = suma saldoReintegro de todas las adecuaciones que proceden hasta la seleccionada (inclusive)

Contrato original = `state.items.reduce((s, i) => s + i.cantidad * i.precio, 0)`

### `eliminarAdecuacion(ref)` — acepta string (periodo) o number (índice)

---

## resumen.js — métricas

### grid4 — 4 metrics con color diferenciado
| ID | Label | Valor | Fondo | Borde izq |
|---|---|---|---|---|
| `r-contrato` | Contrato original | `totalOrig` | `#F5F2EA` | `var(--border2)` |
| `r-vigente` | Nuevo monto de contrato | `totalOrig + totalAjusteOC` | `#FEF3D0` | `#C9A84C` |
| `r-adecuado` | Ajuste OC acumulado | `totalAjusteOC` | `#F0FBF4` | `#52B88A` |
| `r-saldo` | Saldo a integrar — definitiva | `totalSaldo` | `#E6EEFA` | `#5B82C8` |

- `totalAjusteOC` = suma de `d.ajusteOC` de todas las adecuaciones que proceden
- `totalSaldo` = suma de `d.saldoReintegro` de todas las adecuaciones que proceden

### Lista adecuaciones calculadas
- Muestra: nombre · período · Ajuste OC (no `a.total`)
- Sin variación IOP % (eliminado)

---

## CSS — organización actual

### `base.css` — paleta negro/dorado (v17)
- `--bg: #FAF8F2` · `--surface: #FFFFFF` · `--surface2: #F5F2EA`
- `--accent: #0D0D0D` · `--accent-mid: #C9A84C` · `--accent-light: #FEF3D0`
- `--text: #0D0D0D` · `--text2: #5A5650` · `--text3: #9A9590`
- `--warn-bg: #FEF3D0` · `--warn: #7A5C00`
- `.nav-item.active` → `background:#C9A84C; color:#0D0D0D; border-left-color:#C9A84C`
- `.main` tiene `overflow-x: hidden`

### `components.css`
- Todos los componentes reutilizables: `.btn`, `.card`, `.tag`, `.modal`, `.form-group`, tabla genérica, `.tbl-wrap`, `.metric`, `.alert`, `.tabs`, `.prog-bar`, `.empty`, etc.

### `screens.css`
- `.content { overflow-x: hidden }`
- `.grid-iop`: `grid-template-columns: minmax(0, 3fr) 160px` · `align-items: stretch`
- `.grid-iop > div`: `display:flex; flex-direction:column`
- `.grid-iop > div > .card`: `flex:1`
- `#iop-matrix` estilos, `.sticky-col-nro`, `.sticky-col-factor`, `.sticky-header`
- `#screen-adecuaciones .card { min-width:0; overflow:hidden }`
- Thead fijo tabla avance real: `#real-tabla-completa thead tr th { position:sticky; top:0; z-index:2 }`
- Inputs numéricos sin flechas: `input[type=number]::-webkit-outer-spin-button`

---

## plan.js

### `screen-plan` → `renderPlanScreen()`
- Tabla ítems × períodos (solo plan), períodos de `state.plan`
- `descargarPlantilla()`: Excel con fórmulas Total/% por ítem
- `procesarPlanExcel()`: limpia plan previo de ítems importados

### `screen-real` → `renderRealScreen()` / `renderRealTable()`
- Tabla editable inline — `guardarRealInline(input)`
- Períodos = `state.real` ∪ períodos de obra (fechaReplanteo + duracionDias)
- Primera columna fija con `position:sticky;left:0`
- Thead fijo vía `screens.css`
- Inputs con `onwheel="this.blur()"` y sin flechas
- `descargarPlantillaReal()` / `procesarRealExcel()`

### Conversión períodos
- Con `fechaReplanteo` → `YYYY-MM`
- Sin `fechaReplanteo` → `MES-N`
- `guardarEdicionObra()` remapea `MES-N` → `YYYY-MM` al agregar replanteo

---

## ui.js
- `updateIOPStatusPill()` — **eliminada** (pill removido de la topbar)

---

## Pendiente
- Exportar adecuación a Excel
- Backup JSON
- Edición inline plan
- `renderIOPEstado()`: agregar variación acumulada correcta (requiere `getIOP` con dos parámetros)
- PDF informe adecuación
- Modo auditoría
- Redeterminación definitiva
- Validación plan sume 100% por ítem
- FAP (0.95) hardcodeado — podría ser configurable por obra
- ⚠️ Diferencia ~$9.441 en ajusteOC adec 2 — 7 ítems con `precioOficial ≠ precio` tienen `precioProvisorio` levemente distinto al Excel. Factor y anticipo coinciden. Posiblemente el Excel usa `varProvisoria` con más decimales o distinto orden de redondeo.

---

## Glosario
| Término | Definición |
|---|---|
| VRI | Variación acumulada ponderada por polinómica |
| Gatillo | VRI mínimo para adecuación (default 10%, configurable por obra) |
| FAP | Factor de Adecuación Provisional = 0.95 (reconoce 95% de la variación) |
| `periodoCalculo` | Período anterior al registrado — se usa para calcular VRI, factor y remanente |
| `basePeriodo` | Período base activo al momento del cálculo |
| `adecuacion` | Monto redeterminado bruto por ítem |
| `ajusteOC` | Monto a pagar en orden de compra — calculado con fórmula incremental |
| `saldoReintegro` | adecuacion - ajusteOC — a reintegrar en redeterminación definitiva |
| `precioRedeterminado` | Precio del ítem actualizado por factor de redeterminación — base para la próxima adecuación |
| `precioProvisorio` | Precio del ítem actualizado por factor provisorio (FAP) — base para calcular ajusteOC incremental |
| Rem. aplicado | MIN(teórico, real) — calculado con `periodoCalculo` |
| Penalización | Rem. teórico=0 y real>0 — no reconocido para adecuación |
| fechaApertura | Inicio del cálculo del gatillo |
| fechaReplanteo | Inicio real de obra — base para columnas de plan |
| `precioOficial` | Precio del presupuesto oficial — solo para ponderadores de polinómica en `getIOPConsolidado` |
| `anticipoPct` | Porcentaje de anticipo financiero (ej: 25) — almacenado en `state.obra` |
| `anticipoPeriodo` | Período desde el que aplica el anticipo (`YYYY-MM`) — almacenado en `state.obra` |
