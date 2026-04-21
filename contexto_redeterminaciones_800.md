Aquí está el contexto actualizado:

---

# Redeterminaciones 800/16 — Decreto 1082/17
## Contexto técnico — v22
*Provincia de Córdoba*

---

## Inicio rápido
Al iniciar chat nuevo:
> *"Leíste el contexto de la app Redeterminaciones 800/16 v22. Quiero continuar el desarrollo. [describí qué querés hacer]"*

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
licencias/{uid}                   ← { activa: bool, vencimiento: "YYYY-MM-DD", plan: "pro" }
```

### Reglas de seguridad
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /usuarios/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
    match /licencias/{uid} {
      allow read: if request.auth != null && request.auth.uid == uid;
    }
  }
}
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
- `vencimiento` se guarda como string `"YYYY-MM-DD"` en Firestore (no Timestamp)
- Para activar: crear doc en Firebase Console con ID = UID del usuario
- En caso de error de lectura → bloquea acceso (no deja pasar)

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

---

## engine.js

### `cantidadVigente(itemId, periodo)`
⚠️ NO se usa para `cv` en redeterminaciones de obra base ni en `remanente()`. Solo se usa para mostrar cantidad actual en tablas.

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

### `getFactorItem`
```javascript
return factor / pesoTotal;  // NO: 1 + (factor - pesoTotal)
```

### Funciones engine
| Función | Descripción |
|---|---|
| `acumPlan(itemId, hasta)` | Suma plan base |
| `acumReal(itemId, hasta)` | Suma real base |
| `acumPlanMod(modId, itemId, hasta)` | Suma planMod de una modificación |
| `acumRealMod(modId, itemId, hasta)` | Suma realMod de una modificación |
| `remanente(itemId, periodo)` | usa `item.cantidad` original |
| `remanenteMod(mod, itemMod, periodo)` | Remanente para ítem de modificación |
| `calcIopBase(periodo)` | Última adec. que procede antes del período |
| `periodoLabel(p)` | `YYYY-MM` → `"Mes YYYY"` |
| `fmt$(n)` / `fmtPct(n)` | Formateo moneda AR / porcentaje |

---

## adecuaciones.js

### Separación obra base / modificaciones ⚠️
- Obra base y modificaciones se redeterminan **por separado**
- En obra base: `cv = item.cantidad` (cantidad original, nunca `cantidadVigente`)
- En modificaciones: `cv = itemMod.cantidad` (con signo — negativo para economías)
- El botón "+ Mod." aparece siempre que haya modificaciones (`state.modificaciones.length > 0`)

### Anticipo financiero en modificaciones
- **Economías** (`itemMod.cantidad < 0`): aplican anticipo
- **Demasías e ítems nuevos** (`itemMod.cantidad > 0`): NO aplican anticipo
```javascript
const aplicarAnticipoMod = anticipo > 0 && state.obra.anticipoPeriodo
    && periodo > state.obra.anticipoPeriodo && itemMod.cantidad < 0;
```

### `calcularDetalleMod(periodo, periodoCalculo, basePeriodo, factorGlobal, adecAnterior, procede, decreto1082, anticipo)`
Función centralizada que calcula el `detalleMod` de modificaciones. Usada por:
- `guardarAdecuacion` — calcula automáticamente al guardar desde modal
- `recalcularConMod` — recalcula cuando el usuario clickea "+ Mod." / "↺ Mod."
- `registrarAdecuacionDirecta` — NO la usa, deja `detalleMod: []` vacío

### Flujo de cálculo
- **Tabla de gatillo** → `registrarAdecuacionDirecta` → obra base calculada, `detalleMod` vacío → usuario clickea "+ Mod."
- **Modal** → `guardarAdecuacion` → obra base + `detalleMod` calculados automáticamente
- **Botón "+ Mod." / "↺ Mod."** → `recalcularConMod` → recalcula solo `detalleMod`

### Tabla de control de adecuaciones
Columnas: Período · Variación · Gatillo · Pedida · Procede · **Ajuste OC base** · **Ajuste OC mod.** · **Ajuste OC total** · Acciones

### Decreto 1082
- Campo `decreto1082: boolean` en cada adecuación
- Efecto: `penalizado` y `teorico-menor` usan `rem.aplicado = rem.real`

---

## plan.js / real.js
- `cv = item.cantidad` para % ejecutado (no `cantidadVigente`)
- El avance de modificaciones se gestiona por separado en `versiones.js`

## resumen.js — grid4
| ID | Label |
|---|---|
| `r-contrato` | Contrato original |
| `r-vigente` | Nuevo monto de contrato |
| `r-adecuado` | Ajuste OC acumulado |
| `r-saldo` | Saldo a integrar |

---

## sidebar — obras
```javascript
background: activa ? 'var(--accent-mid)' : 'transparent'
color: activa ? '#0D0D0D' : 'rgba(255,255,255,0.6)'
```

---

## CSS
### `base.css` — paleta negro/dorado
- `--bg: #FAF8F2` · `--surface: #FFFFFF` · `--accent-mid: #C9A84C`
- `.nav-item.active` → `background:#C9A84C; color:#0D0D0D`

---

## Pendiente
- Exportar adecuación a Excel — incluir detalleMod y totales combinados
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