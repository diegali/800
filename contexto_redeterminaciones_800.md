# Redeterminaciones 800/16 — Decreto 1082/17
## Contexto técnico — v18
*Provincia de Córdoba*

---

## Inicio rápido
Al iniciar chat nuevo:
> *"Leíste el contexto de la app Redeterminaciones 800/16 v18. Quiero continuar el desarrollo. [describí qué querés hacer]"*

**Modo de trabajo:** usuario principiante. Solo código listo para copiar/pegar, mínima explicación.

---

## Stack
- Vanilla HTML/CSS/JS modular (scripts normales, no ES modules)
- Firebase Firestore + Auth (Google popup) — SDK v10 gstatic
- SheetJS CDN `xlsx/0.18.5` para importación/exportación Excel
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
adecuaciones[]: { periodo, empresaPidio, decreto1082, superaGatillo, procede,
                  iopBase, iopActual, basePeriodo, periodoCalculo,
                  factor, total, detalle[] }
gatillo: 10
iopBase: YYYY-MM   ← solo para matriz IOP, NO para calcularEstadoGatillo
nextId: 1
```

### Campos de ítem
- `precio`: precio ofertado — usado en TODOS los cálculos de redeterminación
- `precioOficial`: precio del presupuesto oficial — usado para ponderadores de polinómica en `getIOPConsolidado`

### Anticipo financiero ✅
- `state.obra.anticipoPct` — porcentaje (ej: `25` → 25%)
- `state.obra.anticipoPeriodo` — período desde el que aplica (`YYYY-MM`)
- Se aplica cuando `periodo > anticipoPeriodo` (no `>=`)
- Afecta: `precioRedeterminado`, `precioProvisorio`, `adecuacion`
- NO afecta directamente `ajusteOC` — el efecto ya está incorporado en `precioProvisorio`

### detalle[] por ítem — estructura completa ✅
```
{
  itemId, nombre,
  precioVigente,       ← cv × precioBase
  precioRedeterminado, ← con anticipo: round(precioBase×anticipo + precioBase×factorRedondeado×(1-anticipo), 4)
                          sin anticipo: round(precioBase×factorRedondeado, 4) usando enteros escalados
  precioProvisorio,    ← con anticipo: round(precioBase×anticipo + precioBase×factorProvisorio×(1-anticipo), 4)
                          sin anticipo: round(precioBase×factorProvisorio, 4) usando enteros escalados
  remTeorico, remReal, remAplicado,
  nota, factor,
  adecuacion,          ← round(precioVigente × remAplicado × variacion, 4) × (1-anticipo) si aplica
  ajusteOC,            ← round(cv × remAplicado × (precioProvisorio - precioProvAnterior), 4)
  saldoReintegro       ← round(adecuacion - ajusteOC, 4)
}
```
- `precioBase` = `precioRedeterminado` de adec anterior que procede, o `item.precio`
- `precioProvAnterior` = `precioProvisorio` de adec anterior, o `item.precio`
- `total` = suma de `adecuacion` de todos los ítems

---

## engine.js — funciones clave
| Función | Descripción |
|---|---|
| `cantidadVigente(itemId, periodo)` | Última versión del ítem con fecha <= período |
| `acumPlan(itemId, hasta)` | Suma plan hasta período |
| `acumReal(itemId, hasta)` | Suma real hasta período |
| `remanente(itemId, periodo)` | `{teorico, real, aplicado, nota}` — aplicado = MIN(teorico, real) |
| `calcIopBase(periodo)` | Última adec. que procede antes del período, o `state.iopBase` |
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

### `getIOPConsolidado` — ponderadores ✅
- Usa `precioOficial` para ponderadores (precio presupuesto oficial)
- Si `precioOficial` es 0 o undefined, cae a `precio`
- Normalización de nombres con `normUp()` (quita tildes, mayúsculas)

### Cálculo de factorProvisorio ✅ verificado contra sistema de referencia
```javascript
const factorRedondeado = Math.round(factor * 10000) / 10000;
const variacion = Math.round((factorRedondeado - 1) * 10000) / 10000;

// Si el 4to decimal es 0, usar factor sin redondear (casos borde de redondeo)
const tieneDecimal4Cero = Math.round(factor * 10000) % 10 === 0;
const factorParaFP = (detalleAnterior && tieneDecimal4Cero) ? factor : factorRedondeado;

const factorProvisorio = detalleAnterior
    ? Math.round((1 + (factorParaFP - 1) * FAP) * 10000) / 10000
    : 1 + Math.round(Math.round((factor - 1) * 10000) / 10000 * FAP * 10000) / 10000;
```

---

## estructura.js — flujo de importación

### Flujo correcto
1. **`importarPresupuesto(input)`** — importa oferta, crea ítems con `precio` directo
   - Hoja `Presupuesto` o primera hoja, busca columna `Designación`
   - Crea ítems con `precio` del Excel, `factores: []`
2. **`importarOficialExcel(input)`** — agrega `precioOficial` a ítems existentes
   - Mapea por posición — misma cantidad de ítems que la obra
   - Solo actualiza `item.precioOficial`, no toca `precio`
3. **`importarPolinomica(input)`** — carga factores por ítem

### ⚠️ Advertencia crítica
Si se reimportan los ítems, se borran `state.plan` y `state.real`. Los remanentes darán `1` en todas las adecuaciones causando cálculos incorrectos. Siempre reimportar plan y real después de reimportar ítems.

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

### Bloque de cálculo por ítem ✅ verificado adec 1, 2 y 3
```javascript
const FAP = 0.95;
let adecuacion = 0, saldoReintegro = 0, ajusteOC = 0;
let precioRedeterminado = precioBase, precioProvisorio = precioBase;

if (procede) {
    const anticipo = (state.obra.anticipoPct || 0) / 100;
    const aplicarAnticipo = anticipo > 0 && state.obra.anticipoPeriodo && periodo > state.obra.anticipoPeriodo;

    const factorRedondeado = Math.round(factor * 10000) / 10000;
    const variacion = Math.round((factorRedondeado - 1) * 10000) / 10000;

    const tieneDecimal4Cero = Math.round(factor * 10000) % 10 === 0;
    const factorParaFP = (detalleAnterior && tieneDecimal4Cero) ? factor : factorRedondeado;
    const factorProvisorio = detalleAnterior
        ? Math.round((1 + (factorParaFP - 1) * FAP) * 10000) / 10000
        : 1 + Math.round(Math.round((factor - 1) * 10000) / 10000 * FAP * 10000) / 10000;

    adecuacion = Math.round(precioVigente * rem.aplicado * variacion * 10000) / 10000;

    if (aplicarAnticipo) {
        precioRedeterminado = Math.round((precioBase * anticipo + precioBase * factorRedondeado * (1 - anticipo)) * 10000) / 10000;
        precioProvisorio    = Math.round((precioBase * anticipo + precioBase * factorProvisorio * (1 - anticipo)) * 10000) / 10000;
        adecuacion          = Math.round(adecuacion * (1 - anticipo) * 10000) / 10000;
    } else {
        precioRedeterminado = Math.round(Math.round(precioBase * 10000) * Math.round(factorRedondeado * 10000) / 10000) / 10000;
        precioProvisorio    = Math.round(Math.round(precioBase * 10000) * Math.round(factorProvisorio * 10000) / 10000) / 10000;
    }

    const precioProvAnterior = detalleAnterior?.precioProvisorio ?? item.precio;
    ajusteOC = Math.round((cv * rem.aplicado * (precioProvisorio - precioProvAnterior) + (cv - cv) * precioProvAnterior) * 10000) / 10000;
    saldoReintegro = Math.round((adecuacion - ajusteOC) * 10000) / 10000;
}
total += adecuacion;
```

**Reglas clave:**
1. `remanente` usa `periodoCalculo` (mes anterior), no el período registrado
2. `precioBase` = `precioRedeterminado` de la adecuación anterior que procede, o `item.precio`
3. `precioProvAnterior` = `precioProvisorio` de la adecuación anterior, o `item.precio`
4. `aplicarAnticipo` usa `periodo > anticipoPeriodo` (no `>=`)
5. `ajusteOC` NO se multiplica por `(1 - anticipo)`
6. `(cv - cv)` siempre da 0 — pendiente implementar cv0

### Decreto 1082
- Campo `decreto1082: boolean` en cada adecuación
- Efecto: `penalizado` y `teorico-menor` usan `rem.aplicado = rem.real`
- Nota → `'decreto1082'`

### `renderGatillo()` — tabla horizontal
- Filas: var. acumulada · base activa · estado · acción
- Acción: select empresa + checkbox Dec. 1082 + botón Calcular

### `eliminarAdecuacion(ref)` — acepta string (periodo) o number (índice)

---

## resumen.js — métricas

### grid4 — 4 metrics
| ID | Label | Valor |
|---|---|---|
| `r-contrato` | Contrato original | `totalOrig` |
| `r-vigente` | Nuevo monto de contrato | `totalOrig + totalAjusteOC` |
| `r-adecuado` | Ajuste OC acumulado | `totalAjusteOC` |
| `r-saldo` | Saldo a integrar — definitiva | `totalSaldo` |

---

## plan.js

### `screen-plan` → `renderPlanScreen()` → `renderPlanTable()`
- Sin selects de remanente, sin botón "Cargar período manual"
- Botón "Borrar plan" → `borrarPlan()`
- Validación al importar: bloquea si ítem ya tenía plan y hay adecuaciones calculadas

### `screen-real` → `renderRealScreen()` / `renderRealTable()`
- Sin botón "Cargar período manual"
- `procesarRealExcel()` llama `renderRealTable()` al finalizar

---

## CSS — organización actual

### `base.css` — paleta negro/dorado
- `--bg: #FAF8F2` · `--surface: #FFFFFF` · `--surface2: #F5F2EA`
- `--accent: #0D0D0D` · `--accent-mid: #C9A84C` · `--accent-light: #FEF3D0`
- `.nav-item.active` → `background:#C9A84C; color:#0D0D0D`
- `.main` tiene `overflow-x: hidden`

### `screens.css`
- `.grid-iop`: 3fr + 160px, `align-items:stretch`
- Tablas plan y real: thead sticky, primera columna sticky, `max-height:65vh`
- Inputs numéricos sin flechas, sin scroll con mouse

---

## Pendiente
- Exportar adecuación a Excel (revisar para decreto1082)
- Backup JSON
- Edición inline plan
- `renderIOPEstado()`: agregar variación acumulada correcta
- PDF informe adecuación
- Modo auditoría
- Redeterminación definitiva
- Validación plan sume 100% por ítem
- FAP (0.95) hardcodeado — podría ser configurable por obra
- `(cv - cv)` en fórmula ajusteOC siempre da 0 — implementar cv0 correctamente

---

## Glosario
| Término | Definición |
|---|---|
| VRI | Variación acumulada ponderada por polinómica |
| Gatillo | VRI mínimo para adecuación (default 10%, configurable) |
| FAP | Factor de Adecuación Provisional = 0.95 |
| `periodoCalculo` | Período anterior al registrado |
| `basePeriodo` | Período base activo al momento del cálculo |
| `adecuacion` | Monto redeterminado bruto por ítem |
| `ajusteOC` | Monto a pagar en orden de compra |
| `saldoReintegro` | adecuacion - ajusteOC |
| `precioRedeterminado` | Base para la próxima adecuación |
| `precioProvisorio` | Base para calcular ajusteOC incremental |
| `precio` | Precio de oferta — base para todos los cálculos |
| `precioOficial` | Precio del presupuesto oficial — para ponderadores de polinómica |
| `anticipoPct` | Porcentaje de anticipo financiero |
| `anticipoPeriodo` | Período desde el que aplica el anticipo |
| Rem. aplicado | MIN(teórico, real) — salvo decreto 1082 |
| Decreto 1082 | Penalizados y teorico-menor usan remReal como aplicado |
| fechaApertura | Inicio del cálculo del gatillo |
| fechaReplanteo | Inicio real de obra — base para columnas de plan |
