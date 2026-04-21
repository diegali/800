Aquí está el contexto actualizado con todos los cambios aplicados en esta sesión:

---

# Redeterminaciones 800/16 — Decreto 1082/17
## Contexto técnico — v21
*Provincia de Córdoba*

---

## Inicio rápido
Al iniciar chat nuevo:
> *"Leíste el contexto de la app Redeterminaciones 800/16 v21. Quiero continuar el desarrollo. [describí qué querés hacer]"*

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
| `window.iopOrden` | `{nombreFactor: nroOrden}` |

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
gatillo: 10
iopBase: YYYY-MM
nextId: 1
```

⚠️ `state.versiones[]` eliminado — reemplazado por `state.modificaciones[]`

Compatibilidad:
```javascript
if (!state.modificaciones) state.modificaciones = [];
if (!state.planMod) state.planMod = [];
if (!state.realMod) state.realMod = [];
```

---

## Módulo Modificaciones de Obra

### Estructura de una modificación
```javascript
{
  id,           // timestamp
  nombre,
  periodo,      // YYYY-MM — fecha de aplicación
  items: [
    {
      id,
      itemIdBase,   // id del ítem base (null si es nuevo)
      nombre, unidad,
      cantidad,     // + demasía / − economía
      precio, precioOficial, factores,
      esNuevo
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

### Estructura adecuación con modificaciones
```javascript
adecuaciones[]: {
  ...campos actuales...,
  detalle[],       // ítems obra base
  detalleMod[]: [  // ítems de modificaciones
    { modId, modNombre, itemId, nombre,
      precioVigente, precioRedeterminado, precioProvisorio,
      remTeorico, remReal, remAplicado, nota, factor,
      adecuacion, ajusteOC, saldoReintegro }
  ],
  totalMod
}
```

---

## engine.js

### `cantidadVigente(itemId, periodo)`
```javascript
function cantidadVigente(itemId, periodo) {
    const item = state.items.find(i => i.id === itemId);
    if (!item) return 0;
    let cantidad = item.cantidad;
    for (const mod of (state.modificaciones || [])) {
        if (mod.periodo > periodo) continue;
        for (const mi of (mod.items || [])) {
            if (mi.itemIdBase === itemId)
                cantidad = Math.round((cantidad + mi.cantidad) * 10000) / 10000;
        }
    }
    return cantidad;
}
```

⚠️ `cantidadVigente` NO se usa para calcular `cv` en redeterminaciones de obra base ni en `remanente()` — siempre se usa `item.cantidad` para mantener separados los cálculos de obra base y modificaciones.

### `remanente(itemId, periodo)`
```javascript
function remanente(itemId, periodo) {
    const item = state.items.find(i => i.id === itemId);
    const cv = item ? item.cantidad : 0;  // ← cantidad ORIGINAL, no vigente
    if (cv === 0) return { teorico: 0, real: 0, aplicado: 0, nota: 'economia' };
    const ap = acumPlan(itemId, periodo);
    const ar = acumReal(itemId, periodo);
    const teorico = Math.max(0, 1 - ap / cv);
    const real = Math.max(0, 1 - ar / cv);
    const aplicado = Math.min(teorico, real);
    let nota = 'ok';
    if (teorico === 0 && real > 0) nota = 'penalizado';
    else if (real < teorico) nota = 'real-menor';
    else if (teorico < real) nota = 'teorico-menor';
    return { teorico, real, aplicado, nota };
}
```

### `getFactorItem(item, periodo, basePeriodo)`
```javascript
// Retorna factor ponderado por polinómica del ítem
// CORRECTO: return factor / pesoTotal  (NO: 1 + (factor - pesoTotal))
return factor / pesoTotal;
```

### Funciones engine
| Función | Descripción |
|---|---|
| `acumPlan(itemId, hasta)` | Suma plan base |
| `acumReal(itemId, hasta)` | Suma real base |
| `acumPlanMod(modId, itemId, hasta)` | Suma planMod de una modificación |
| `acumRealMod(modId, itemId, hasta)` | Suma realMod de una modificación |
| `remanente(itemId, periodo)` | `{teorico, real, aplicado, nota}` — usa `item.cantidad` original |
| `remanenteMod(mod, itemMod, periodo)` | Remanente para ítem de modificación |
| `calcIopBase(periodo)` | Última adec. que procede antes del período |
| `periodoLabel(p)` | `YYYY-MM` → `"Mes YYYY"` |
| `fmt$(n)` / `fmtPct(n)` | Formateo moneda AR / porcentaje |

---

## iop.js

### `getIOPConsolidado` — ponderadores
- Usa `precioOficial` (cae a `precio` si es 0)
- Normalización con `normUp()`

### Cálculo factorProvisorio ✅
```javascript
const factorRedondeado = Math.round(factor * 10000) / 10000;
const variacion = Math.round((factorRedondeado - 1) * 10000) / 10000;
const tieneDecimal4Cero = Math.round(factor * 10000) % 10 === 0;
const factorParaFP = (detalleAnterior && tieneDecimal4Cero) ? factor : factorRedondeado;
const factorProvisorio = detalleAnterior
    ? Math.round((1 + (factorParaFP - 1) * FAP) * 10000) / 10000
    : 1 + Math.round(Math.round((factor - 1) * 10000) / 10000 * FAP * 10000) / 10000;
```

---

## adecuaciones.js

### Separación obra base / modificaciones ⚠️
- Obra base y modificaciones se redeterminan **por separado**
- En obra base: `cv = item.cantidad` (cantidad original, nunca `cantidadVigente`)
- En modificaciones: `cv = itemMod.cantidad` (con signo — negativo para economías)
- El botón "+ Mod." aparece siempre que haya modificaciones, independientemente de su período

### Anticipo financiero en modificaciones
- **Demasías e ítems nuevos** (`itemMod.cantidad > 0`): aplican anticipo
- **Economías** (`itemMod.cantidad < 0`): NO aplican anticipo
```javascript
const aplicarAnticipoMod = anticipo > 0 && state.obra.anticipoPeriodo 
    && periodo > state.obra.anticipoPeriodo && itemMod.cantidad > 0;
```

### `registrarAdecuacionDirecta` — flujo
1. Calcula obra base normalmente
2. **NO calcula `detalleMod`** — lo deja vacío `[]` para que el usuario use "↺ Mod."
3. El usuario debe clickear "+ Mod." / "↺ Mod." para calcular modificaciones

### Bloque de cálculo por ítem obra base ✅
```javascript
const FAP = 0.95;
const anticipo = (state.obra.anticipoPct || 0) / 100;
const aplicarAnticipo = anticipo > 0 && state.obra.anticipoPeriodo && periodo > state.obra.anticipoPeriodo;
// cv = item.cantidad  (NO cantidadVigente)
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
ajusteOC = Math.round(cv * rem.aplicado * (precioProvisorio - precioProvAnterior) * 10000) / 10000;
saldoReintegro = Math.round((adecuacion - ajusteOC) * 10000) / 10000;
```

**Reglas:**
1. `remanente` usa `periodoCalculo` (mes anterior)
2. `precioBase` = `precioRedeterminado` adec anterior, o `item.precio`
3. `precioProvAnterior` = `precioProvisorio` adec anterior, o `item.precio`
4. `aplicarAnticipo`: `periodo > anticipoPeriodo` (no `>=`)
5. `ajusteOC` NO se multiplica por `(1 - anticipo)`
6. `cv = item.cantidad` siempre para obra base

### Modificaciones en adecuaciones
- `registrarAdecuacionDirecta` guarda `detalleMod: []` — sin calcular
- `recalcularConMod(periodo)` — calcula el `detalleMod` cuando el usuario lo pide
- `guardarAdecuacion` (modal) también calcula `detalleMod` completo
- Botón **"+ Mod."** / **"↺ Mod."** visible cuando `state.modificaciones.length > 0`
- Factor del ítem de mod: usa `getFactorItem` del ítem base si existe, si no del ítem de la modificación
- `detalleAnteriorMod` = busca en `adecAnterior.detalleMod` por `modId + itemId`
- `cv = itemMod.cantidad` (con signo) para modificaciones

### Decreto 1082
- Campo `decreto1082: boolean` en cada adecuación
- Efecto: `penalizado` y `teorico-menor` usan `rem.aplicado = rem.real`

### `renderGatillo()` — tabla horizontal
- Filas: var. acumulada · base activa · estado · acción
- Acción: select empresa + checkbox Dec. 1082 + botón Calcular

### `mostrarDetalle(idx)`
- Tabla obra base (`adec-detalle-tbody`)
- Sección modificaciones (`adec-detalle-mod-section`) — div fuera de la tabla, agrupa por mod
- Totales: ajuste OC base + mod por separado, luego resumen general combinado

---

## versiones.js — Pantalla Modificaciones

### UI
- Cards por modificación con resumen: demasías / economías / nuevos
- Click en card header → abre modal para editar ítems
- Dentro de cada card (inline): tablas de plan y avance real
- Botones plantilla + importar plan y real por card

### Funciones principales
| Función | Descripción |
|---|---|
| `renderVersiones()` | Renderiza cards con tablas inline de plan y real |
| `nuevaModificacion()` | Abre modal crear |
| `crearModificacion()` | Persiste en `state.modificaciones` |
| `abrirDetalleMod(id)` | Abre modal editar ítems |
| `agregarItemMod()` | Agrega ítem a la mod activa |
| `eliminarItemMod(itemId)` | Elimina ítem de la mod activa |
| `eliminarModificacion()` | Borra mod + planMod/realMod asociados |
| `descargarPlantillaPlanMod(modId)` | Excel solo demasías/nuevos |
| `handlePlanModExcel(event, modId)` | Lee Excel de plan |
| `procesarPlanModExcel(data, modId)` | Procesa e importa planMod |
| `descargarPlantillaRealMod(modId)` | Excel para avance real |
| `handleRealModExcel(event, modId)` | Lee Excel de real |
| `procesarRealModExcel(data, modId)` | Procesa e importa realMod |

---

## plan.js
- `renderPlanTable()` — sin selects de remanente
- `cv = item.cantidad` (cantidad original, no `cantidadVigente`)
- `borrarPlan()` → `state.plan = []; save(); renderPlanTable()`
- Validación al importar: bloquea si ítem ya tenía plan y hay adecuaciones calculadas

## plan.js / real.js — tablas
- `cv = item.cantidad` para % ejecutado (no `cantidadVigente`)
- El avance de modificaciones se gestiona por separado en `versiones.js`

---

## resumen.js — grid4
| ID | Label |
|---|---|
| `r-contrato` | Contrato original |
| `r-vigente` | Nuevo monto de contrato |
| `r-adecuado` | Ajuste OC acumulado |
| `r-saldo` | Saldo a integrar |

---

## CSS
### `base.css` — paleta negro/dorado
- `--bg: #FAF8F2` · `--surface: #FFFFFF` · `--accent-mid: #C9A84C`
- `.nav-item.active` → `background:#C9A84C; color:#0D0D0D`

### `screens.css`
- `.grid-iop`: 3fr + 160px
- Tablas plan/real: thead sticky, primera columna sticky, `max-height:65vh`

---

## Pendiente
- Exportar adecuación a Excel (revisar decreto1082 y detalleMod)
- Backup JSON
- `renderIOPEstado()`: variación acumulada correcta
- PDF informe adecuación
- Modo auditoría
- Redeterminación definitiva
- FAP (0.95) hardcodeado
- Validación plan sume 100% por ítem
- Resumen en `resumen.js` aún no incluye `totalMod` de adecuaciones

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
| `anticipoPeriodo` | Período desde que aplica anticipo (`periodo > anticipoPeriodo`) |
| Rem. aplicado | MIN(teórico, real) — salvo decreto 1082 |
| Decreto 1082 | Penalizados/teorico-menor usan remReal |
| Demasía | Aumento de cantidad en modificación |
| Economía | Disminución de cantidad (negativa) en modificación |
| `planMod[]` | Plan de avance de demasías/nuevos |
| `realMod[]` | Avance real de demasías/nuevos |
| `detalleMod[]` | Detalle de adecuación para ítems de modificaciones |
| fechaApertura | Inicio del cálculo del gatillo |
| fechaReplanteo | Inicio real de obra |