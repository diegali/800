# Redeterminaciones 800/16 — Decreto 1082/17
## Contexto técnico — v16
*Provincia de Córdoba*

---

## Inicio rápido
Al iniciar chat nuevo:
> *"Leíste el contexto de la app Redeterminaciones 800/16 v16. Quiero continuar el desarrollo. [describí qué querés hacer]"*

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
obra: { nombre, expediente, fecha, fechaApertura, fechaReplanteo, contratista, duracionDias }
items[]:      { id, nombre, unidad, cantidad, precio, factores[] }
versiones[]:  { itemId, fecha(YYYY-MM), cantidad, motivo }
plan[]:       { itemId, periodo(YYYY-MM), cantidad }
real[]:       { itemId, periodo(YYYY-MM), cantidad }
adecuaciones[]: { periodo, empresaPidio, decreto1082, superaGatillo, procede,
                  iopBase, iopActual, basePeriodo, periodoCalculo,
                  factor, total, detalle[] }
gatillo: 10
iopBase: YYYY-MM   ← solo para matriz IOP, NO para calcularEstadoGatillo
nextId: 1
```

### detalle[] por ítem — estructura completa ✅
```
{
  itemId, nombre,
  precioVigente,       ← cantidad × precioBase (precio redet de adec anterior, o precio original)
  precioRedeterminado, ← round(precioBase × factorRedondeado, 4) — usando enteros escalados
  precioProvisorio,    ← round(precioBase × factorProvisorio, 4) — usando enteros escalados
  remTeorico, remReal, remAplicado,  ← calculados con periodoCalculo (mes anterior)
  nota, factor,
  adecuacion,          ← round(precioVigente × remAplicado × variacion, 4)
  ajusteOC,            ← round(cv × remAplicado × (precioProvisorio - precioProvAnterior) + (cv - cv0) × precioProvAnterior, 4)
  saldoReintegro       ← round(adecuacion - ajusteOC, 4)
}
```
- `total` de la adecuación = suma de `adecuacion` de todos los ítems
- `precioProvAnterior` = `detalleAnterior.precioProvisorio` o `item.precio` si es la primera adecuación

### Redondeo crítico — evitar errores de punto flotante ✅
```javascript
// CORRECTO — usar enteros escalados para multiplicación de precios:
precioRedeterminado = Math.round(Math.round(precioBase * 10000) * Math.round(factorRedondeado * 10000) / 10000) / 10000;
precioProvisorio    = Math.round(Math.round(precioBase * 10000) * Math.round(factorProvisorio * 10000) / 10000) / 10000;

// INCORRECTO — causa errores de $0.0001 por punto flotante:
precioRedeterminado = Math.round(precioBase * factorRedondeado * 10000) / 10000;
```

---

## engine.js — funciones clave
| Función | Descripción |
|---|---|
| `cantidadVigente(itemId, periodo)` | Última versión del ítem con fecha <= período |
| `acumPlan(itemId, hasta)` | Suma plan hasta período |
| `acumReal(itemId, hasta)` | Suma real hasta período |
| `remanente(itemId, periodo)` | `{teorico, real, aplicado, nota}` — aplicado = MIN(teorico, real) |
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
pesos[factor] = peso del factor en el ítem, dividido 100 si >1, pisa (no suma) entre ítems
VRI = SUM( pesos[factor] × (IOP_factor_actual / IOP_factor_base − 1) )
```

### Factor por ítem (getFactorItem)
```
factorItem = 1 + SUM( peso_f × (IOP_f_periodoCalculo / IOP_f_base − 1) )
```
- Usa `periodoCalculo` como período actual y `basePeriodo` como base
- Cada ítem tiene su propio factor según su polinómica individual

### Redondeo en cálculos — ✅ verificado contra Excel
```javascript
factorRedondeado = Math.round(factor * 10000) / 10000
variacion        = Math.round((factorRedondeado - 1) * 10000) / 10000  // redondear ANTES de × FAP

// factorProvisorio — dos casos:
// Caso A (4to decimal ≠ 0): usar factorRedondeado
// Caso B (4to decimal = 0): usar factor sin redondear
const tieneDecimal4Cero = Math.round(factor * 10000) % 10 === 0;
const factorParaFP = (detalleAnterior && tieneDecimal4Cero) ? factor : factorRedondeado;
factorProvisorio = Math.round((1 + (factorParaFP - 1) * FAP) * 10000) / 10000;  // con adec anterior
factorProvisorio = 1 + Math.round(Math.round((factor - 1) * 10000) / 10000 * FAP * 10000) / 10000;  // sin adec anterior
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

### renderIOPMatriz()
- Tabla con filas alternadas, fuentes compactas, números con `font-family:var(--mono)`
- Pill resumen (`#iop-resumen-pill`): "N factores · N períodos"

### renderIOPEstado()
- Muestra 3 metrics centrados: Períodos cargados · Factores cargados · Último período

### Pantalla IOP — layout
- Barra superior: botón importar + input gatillo (a la derecha, inline)
- Grid: tabla ancha (3fr) + columna Estado IOP (160px), igual alto con `align-items:stretch`

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

### `registrarAdecuacionDirecta(periodo)` y `guardarAdecuacion()` — ✅ verificado adec 1, 2 y 3

```javascript
// Por cada ítem:
const adecsPrevias = state.adecuaciones
    .filter(a => a.procede && a.periodo < periodo)
    .sort((a, b) => b.periodo.localeCompare(a.periodo));
const adecAnterior = adecsPrevias[0];
const detalleAnterior = adecAnterior?.detalle?.find(d => d.itemId === item.id);
const precioBase = detalleAnterior?.precioRedeterminado ?? item.precio;
const precioVigente = cv * precioBase;

const rem = remanente(item.id, periodoCalculo || periodo);

// Decreto 1082: penalizados y teorico-menor usan remReal
if (decreto1082) {
    if (rem.nota === 'penalizado' || rem.nota === 'teorico-menor') {
        rem.aplicado = rem.real;
        rem.nota = 'decreto1082';
    }
}

const FAP = 0.95;
const factorRedondeado = Math.round(factor * 10000) / 10000;
const variacion = Math.round((factorRedondeado - 1) * 10000) / 10000;
const tieneDecimal4Cero = Math.round(factor * 10000) % 10 === 0;
const factorParaFP = (detalleAnterior && tieneDecimal4Cero) ? factor : factorRedondeado;
const factorProvisorio = detalleAnterior
    ? Math.round((1 + (factorParaFP - 1) * FAP) * 10000) / 10000
    : 1 + Math.round(Math.round((factor - 1) * 10000) / 10000 * FAP * 10000) / 10000;

adecuacion = Math.round(precioVigente * rem.aplicado * variacion * 10000) / 10000;
// Usar enteros escalados para evitar error de punto flotante:
precioRedeterminado = Math.round(Math.round(precioBase * 10000) * Math.round(factorRedondeado * 10000) / 10000) / 10000;
precioProvisorio    = Math.round(Math.round(precioBase * 10000) * Math.round(factorProvisorio * 10000) / 10000) / 10000;

const precioProvAnterior = detalleAnterior?.precioProvisorio ?? item.precio;
ajusteOC = Math.round((cv * rem.aplicado * (precioProvisorio - precioProvAnterior) + (cv - cv) * precioProvAnterior) * 10000) / 10000;
saldoReintegro = Math.round((adecuacion - ajusteOC) * 10000) / 10000;
```

**Reglas clave:**
1. `remanente` usa `periodoCalculo` (mes anterior), no el período registrado
2. `precioBase` = `precioRedeterminado` de la adecuación anterior que procede, o `item.precio`
3. `precioProvAnterior` = `precioProvisorio` de la adecuación anterior, o `item.precio`
4. Redondear `variacion` antes de multiplicar por FAP (evita error de punto flotante)
5. `ajusteOC` se guarda en el detalle (no se recalcula al mostrar)
6. `precioRedeterminado` y `precioProvisorio` usan enteros escalados para multiplicación
7. Decreto 1082 por adecuación: checkbox `decreto1082-${periodo}` en tabla gatillo y `decreto1082-modal` en modal

### Decreto 1082 — comportamiento
- Campo `decreto1082: boolean` guardado en cada adecuación en Firestore
- Activación: checkbox en tabla gatillo (junto a select empresa pidió) y en modal nueva adecuación
- Efecto: ítems con `nota === 'penalizado'` o `nota === 'teorico-menor'` usan `rem.aplicado = rem.real`
- Nota del ítem cambia a `'decreto1082'` → se muestra como tag info "Dec. 1082"

### `renderGatillo()` — tabla horizontal
- Columnas = períodos IOP desde `fechaApertura`
- Filas (en orden): var. acumulada · base activa · estado · acción
- Primera columna fija con `position:sticky;left:0`
- Columnas compactas (`min-width:80px`)
- Con gatillo sin calcular: select empresa pidió + checkbox Dec. 1082 + botón "Calcular"
- Con adecuación guardada: estado + botón "× Borrar"

### `renderAdecuaciones()` — tabla control
- Columnas centradas excepto Monto (alineado derecha, título "Ajuste OC")
- Sin botón × en cada fila
- Sin botón "Calcular nueva adecuación" en el header

### `mostrarDetalle()` — tabla detalle por ítem
Columnas (todas centradas): Ítem · Precio vigente · Rem. teórico · Rem. real · Rem. aplicado · Factor IOP · Monto redeterminado · Ajuste OC · Saldo reintegro · Nota
- `notaMap2` incluye: `'decreto1082': ['tag-info', 'Dec. 1082']`

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
- Sin variación IOP %

---

## CSS — organización actual

### `base.css` — paleta negro/dorado (v15)
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
- `updateIOPStatusPill()` — **eliminada**

---

## Pendiente
- Exportar adecuación a Excel (función `exportarAdecuacion()` existe pero puede necesitar actualización para decreto1082)
- Backup JSON
- Edición inline plan
- `renderIOPEstado()`: agregar variación acumulada correcta (requiere `getIOP` con dos parámetros)
- PDF informe adecuación
- Modo auditoría
- Redeterminación definitiva
- Validación plan sume 100% por ítem
- FAP (0.95) hardcodeado — podría ser configurable por obra

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
| Rem. aplicado | MIN(teórico, real) — salvo decreto 1082 activo |
| Penalización | Rem. teórico=0 y real>0 — no reconocido salvo decreto 1082 |
| Decreto 1082 | Modificación del 800/16: ítems penalizados y teorico-menor usan remReal como aplicado |
| fechaApertura | Inicio del cálculo del gatillo |
| fechaReplanteo | Inicio real de obra — base para columnas de plan |
