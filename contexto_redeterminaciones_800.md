# Redeterminaciones 800/16 — Decreto 1082/17 · Adecuaciones provisorias
## Documento de contexto — App web · **Versión 9**
*Provincia de Córdoba*

---

## 1. Propósito de este documento

Describe el contexto, reglas de negocio y arquitectura actual de la app web de redeterminaciones para gestionar adecuaciones provisorias bajo el Decreto 800/16 de la Provincia de Córdoba.

**Cómo usarlo:** al iniciar un nuevo chat, adjuntá este archivo y decile a la IA:
> *"Leíste el documento de contexto de la app Redeterminaciones 800/16 v9. Quiero continuar el desarrollo. [Describí qué querés hacer.]"*

**Nota de trabajo:** el usuario es principiante. Respondé solo con código, sin explicación, listo para copiar y pegar.

---

## 2. Dominio: Decreto 800/16 y 1082/17

### 2.1 Objetivo general
El Decreto 800/16 regula la redeterminación de precios en obras públicas provinciales de Córdoba. Permite actualizar el precio contractual cuando los costos varían por inflación u otros factores.

### 2.2 Estructura de costos (polinómica)
Cada ítem tiene su propia estructura de costos con factores ponderados que deben sumar 100%. El nombre del factor debe coincidir exactamente con el nombre de la columna en el Excel del IOP.

### 2.3 Índice IOP y gatillo
- Se usa el Índice de Obra Pública (IOP) de Córdoba, publicación mensual oficial. 46 factores mensuales.
- **Gatillo:** si la variación acumulada desde la última base supera el umbral configurado (default 10%), puede corresponder una adecuación.
- La empresa contratista debe haber solicitado formalmente la adecuación (condición Sí/No).
- Al registrar una adecuación que procede, ese período IOP pasa a ser la nueva base (**cambio de base dinámico**).

#### Cálculo correcto de la variación acumulada (polinómica ponderada por precio)
La variación acumulada NO usa un único índice global. Se calcula con la polinómica de cada ítem, ponderada por el precio del ítem:

```
peso_factor_global = SUM(precio_item × peso_factor_en_item) / SUM(precio_item)
variación_factor   = peso_factor_global × (índice_actual / índice_base − 1)
variación_acumulada = SUM(variación_factor) para todos los factores
```

- `índice_base`: valor del factor en el período base (última adecuación que procede, o `state.iopBase`).
- `índice_actual`: valor del factor en el período analizado.
- Los pesos se normalizan dividiendo por el precio total de todos los ítems con factores.
- Si un factor no tiene valor en base o actual, se ignora.
- `state.iopBase` se setea manualmente en la pantalla IOP via `recalcIOP()`. Es el período base inicial de la obra. **No usar `fechaApertura` como base.**

#### ⚠️ Bug conocido pendiente de resolver
`getIOPConsolidado()` en `iop.js` ya usa la fórmula ponderada por precio (corregida en v9), pero los números de variación acumulada en la pantalla Adecuaciones aún no dan correctamente. Pendiente de diagnóstico.

### 2.4 Adecuaciones provisorias (Dec. 1082/17)
> **Remanente aplicado = MIN(remanente teórico, remanente real)**

- **Remanente teórico:** calculado en base al plan de avance programado.
- **Remanente real:** calculado en base a lo certificado efectivamente.
- Si el remanente teórico es 0 y el real es mayor → ítem **penalizado**.
- Si la cantidad vigente del ítem es 0 (economía total) → remanente = 0.

### 2.5 Cálculo del remanente

| Variable | Fórmula |
|---|---|
| Cantidad vigente | Última versión del ítem con fecha <= período |
| Acumulado plan | Suma de cantidades planificadas hasta el período |
| Acumulado real | Suma de cantidades certificadas hasta el período |
| Rem. teórico | MAX(0, 1 − acum_plan / cant_vigente) |
| Rem. real | MAX(0, 1 − acum_real / cant_vigente) |
| Rem. aplicado | MIN(rem_teórico, rem_real) |
| Adecuación ítem | Precio vigente × rem_aplicado × (factor_IOP − 1) |

### 2.6 Modificaciones de obra
Nueva versión de cantidad del ítem con fecha de inicio. Los cálculos históricos no se modifican. Si cantidad nueva es 0, remanente = 0 para todos los períodos posteriores.

---

## 3. Arquitectura de la app

### 3.1 Stack tecnológico
- HTML + CSS + JS modulares, cargados como scripts normales en `index.html` (no ES modules).
- Vanilla JS sin frameworks.
- **Persistencia:** Firebase Firestore (nube).
- **Autenticación:** Firebase Auth con Google (popup).
- Exportación de adecuaciones a **.txt**.
- Importación de ítems/presupuesto desde **.xlsx** (SheetJS CDN).
- Importación del IOP desde **.xlsx** oficial (SheetJS CDN).
- Librerías: `https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js`, Firebase SDK v10 (gstatic).

### 3.2 Estructura de archivos
```
index.html
css/
  base.css
  components.css
  screens.css
js/
  config.js
  state.js
  engine.js
  ui.js
  main.js
  screens/
    resumen.js
    estructura.js
    versiones.js
    plan.js
    iop.js
    adecuaciones.js
```

`auth.js` existe pero no se usa — tiene código duplicado y roto.

### 3.3 Estructura Firestore
```
usuarios/{uid}/obras/{obraId}   ← datos de cada obra (sin IOP)
usuarios/{uid}/iop/cordoba      ← IOP del usuario { datos: {YYYY-MM: {factor: valor}}, ultimaEdicion }
```

### 3.4 Variables globales clave

| Variable | Descripción |
|---|---|
| `window.state` | Obra activa en memoria |
| `window.obras` | Array de todas las obras del usuario |
| `window.iopGlobal` | Objeto `{YYYY-MM: {factor: valor}}` — IOP separado de las obras |
| `window.iopOrden` | Objeto `{nombreFactor: nroOrden}` para ordenar la matriz |

**⚠️ `state.iop` ya NO existe.** Todo el IOP vive en `window.iopGlobal`.

### 3.5 Estructura de cada obra (`obraVacia()`)

| Clave | Tipo | Descripción |
|---|---|---|
| id | Number | Timestamp (Date.now()) |
| fechaCreacion | String | YYYY-MM |
| obra | Objeto | nombre, expediente, fecha, fechaApertura, contratista, **fechaReplanteo**, **duracionDias** |
| items[] | Array | id, nombre, unidad, cantidad, precio, factores[] |
| versiones[] | Array | itemId, fecha (YYYY-MM), cantidad, motivo |
| plan[] | Array | itemId, periodo (YYYY-MM), cantidad |
| real[] | Array | itemId, periodo (YYYY-MM), cantidad |
| adecuaciones[] | Array | periodo, empresaPidio, procede, factor, total, detalle[], iopBase, iopActual |
| gatillo | Number | default 10 |
| iopBase | String | Período YYYY-MM de la base IOP inicial |
| nextId | Number | Autoincremental para IDs de ítems |

**Nota:** `fechaReplanteo` (YYYY-MM) y `duracionDias` (Number) son campos de `state.obra` — se usan en la pantalla Plan para generar columnas de períodos reales en la plantilla Excel.

### 3.6 Funciones de state.js

| Función | Qué hace |
|---|---|
| `obraVacia()` | Retorna objeto obra con valores por defecto (sin iop) |
| `getObraActivaId()` | Lee ID activo desde localStorage |
| `setObraActivaId(id)` | Guarda ID activo en localStorage |
| `save()` | Guarda `window.state` en `usuarios/{uid}/obras/{obraId}` |
| `saveIOP()` | Guarda `window.iopGlobal` en `usuarios/{uid}/iop/cordoba` |
| `crearNuevaObra(datosObra)` | Crea obra, la activa, sincroniza y refresca UI |
| `cambiarObraActiva(id)` | Cambia `state` y `window.state`; retorna true/false |
| `eliminarObra(id)` | Borra doc Firestore, filtra array, recarga página |
| `descargarTodoDeNube()` | Carga obras (subcolección) + IOP global; hidrata `window.obras`, `window.state`, `window.iopGlobal` |

### 3.7 Funciones de engine.js

| Función | Qué hace |
|---|---|
| `cantidadVigente(itemId, periodo)` | Última versión del ítem con fecha <= período |
| `acumPlan(itemId, hasta)` | Suma cantidades planificadas hasta el período |
| `acumReal(itemId, hasta)` | Suma cantidades reales hasta el período |
| `remanente(itemId, periodo)` | Retorna {teorico, real, aplicado, nota} |
| `calcIopBase(periodo)` | Base IOP activa para el período (última adec. que procede antes del período, o `state.iopBase`) |
| `fmt$(n)` | Formatea número como moneda AR |
| `fmtPct(n)` | Formatea número como porcentaje |
| `periodoLabel(p)` | Convierte YYYY-MM a "Mes YYYY". Soporta prefijo "MES-N" para períodos sin fecha real |

**⚠️ `variacionIOP(periodo)` aparece documentada en v5 pero NO está implementada en ningún archivo.** Usar `getIOP` y `calcIopBase` directamente.

**Estas funciones viven en `iop.js` y NO deben duplicarse:**

| Función | Qué hace |
|---|---|
| `getIOP(periodo)` | Llama a getIOPConsolidado |
| `getIOPConsolidado(periodo)` | Variación acumulada ponderada por precio de ítem: `SUM(precio_item × peso_factor) / SUM(precio_item)`. Sin fallback promedio simple |
| `getIOPFactores(periodo)` | Retorna `window.iopGlobal[periodo]` |

### 3.8 UI (ui.js)

| Función | Qué hace |
|---|---|
| `navigate(screen)` | Cambia pantalla activa, actualiza topbar, dispara render |
| `renderScreen(screen)` | Llama al render de la pantalla correspondiente |
| `populateItemSelects()` | Actualiza todos los `<select>` de ítems |
| `openModal(id)` / `closeModal(id)` | Abre/cierra modales |
| `renderSelectorObras()` | Renderiza lista de obras en `#sidebar-obras` (div con botones) |
| `seleccionarObra(id)` | Llama `cambiarObraActiva()`, refresca topbar y navega a resumen |
| `verEstructura(id)` | Abre modal de factores para el ítem dado |
| `cerrarYGuardarFactores()` | Valida suma = 100%, guarda factores en el ítem y sincroniza |

---

## 4. Pantalla IOP (iop.js)

- Importación desde Excel oficial: busca fila con encabezado `orden / factor` (no fila hardcodeada 6).
- Merge: agrega períodos nuevos sin borrar anteriores.
- Lee y escribe en `window.iopGlobal` y `window.iopOrden`.
- Llama a `saveIOP()` al importar (no `save()`).
- Tabla matriz solo lectura: filas = factores, columnas = períodos. Columna base resaltada.
- Panel derecho: parámetros del gatillo + estado (3 cards): base activa, último período cargado, variación acumulada.
- Pill en topbar: estado del IOP.
- `recalcIOP()`: guarda `state.gatillo` y `state.iopBase` (período YYYY-MM seleccionado en `#gatillo-base`), llama `save()` y `renderIOP()`.
- `updateIOPStatusPill()`: muestra estado en topbar. Si no hay períodos, muestra "Sin índices IOP". Calcula variación acumulada usando `calcIopBase()` y `getIOP()`.
- `calcIopBase(periodo)` en `engine.js`: retorna la última adecuación que procede antes del período, o `state.iopBase`. **No usa `fechaApertura`.**

---

## 5. Pantallas Plan de avance y Avance real (plan.js)

### Pantallas separadas en el menú
- `screen-plan` → "Plan de avance" — `navigate('plan')` → `renderPlanScreen()`
- `screen-real` → "Avance real" — `navigate('real')` → `renderRealScreen()`

### Funciones implementadas

| Función | Qué hace |
|---|---|
| `renderPlanScreen()` | Llama a `populateItemSelects`, `renderPlanTable`, `renderRemCards` |
| `renderPlanTable()` | Tabla compacta ítems × períodos. Solo plan (sin real). Períodos de `state.plan`. Columna "%" coloreada |
| `renderRemCards()` | 4 cards: cantidad vigente, rem. teórico, rem. real, rem. aplicado |
| `guardarPlan()` | Guarda período de plan desde modal. Convierte `MES-N` → `YYYY-MM` si hay `fechaReplanteo` |
| `descargarPlantilla()` | Excel plan con períodos reales desde `fechaReplanteo` + `duracionDias` |
| `cargarPlanExcel(event)` | Lee `#plan-file` |
| `procesarPlanExcel(data)` | Limpia plan previo de ítems importados, luego agrega. Convierte headers a `YYYY-MM` usando `fechaReplanteo` si no son fecha |
| `renderRealScreen()` | Llama a `renderRealTable()` |
| `renderRealTable()` | Tabla editable inline. Valores con 4 decimales. Celdas `<input>` con `onchange="guardarRealInline(this)"`. Períodos de `state.real`. Columna "%" coloreada |
| `guardarRealInline(input)` | Guarda/elimina registro en `state.real` desde edición inline. Llama `save()` y `renderRealTable()` |
| `descargarPlantillaReal()` | Excel avance real con "Total real" y "% ejecutado", hoja "Avance Real" |
| `cargarRealExcel(event)` | Lee `#real-file` |
| `procesarRealExcel(data)` | Análogo a `procesarPlanExcel` pero en `state.real`. Busca columna `Total real`. Limpia real previo antes de agregar |

### Reglas de conversión de períodos
- Siempre `YYYY-MM` cuando hay `fechaReplanteo`.
- `MES-N` solo como fallback sin `fechaReplanteo`.
- Al agregar `fechaReplanteo` en `guardarEdicionObra()`, los `MES-N` en `state.plan` y `state.real` se remapean automáticamente.

### Botones del toolbar — Plan (`screen-plan`)
- `↓ Descargar plantilla` → `descargarPlantilla()`
- `↑ Importar plan Excel` → `#plan-file` → `cargarPlanExcel(event)`
- `+ Cargar período manual` → `openModal('modal-cargar-plan')`

### Botones del toolbar — Avance real (`screen-real`)
- `↓ Descargar plantilla` → `descargarPlantillaReal()`
- `↑ Importar real Excel` → `#real-file` → `cargarRealExcel(event)`
- `+ Cargar período manual` → `openModal('modal-cargar-avance')`

### Modales
- `#modal-cargar-plan`: campos `#plan-item-modal`, `#plan-periodo-modal`, `#plan-cantidad-modal`
- `#modal-cargar-avance`: campos `#real-item-modal`, `#real-periodo-modal`, `#real-cantidad-modal`

### ⚠️ Pendiente en esta pantalla
- Edición inline de celdas del plan

---

## 6. Otras pantallas

| Pantalla | Funcionalidad |
|---|---|
| Resumen | Métricas globales. Usa `window.iopGlobal` para calcular último período (no `state.iop`). Muestra contrato original, monto vigente, total adecuado, barras de avance por ítem. Botón "Editar obra" llama `abrirEditarObra()`. |
| Ítems y estructura | Visualización de ítems. Importación Excel (2 formatos). Gestión de polinómica por ítem. Funciones: `descargarPlantillaPresupuesto()`, `descargarPlantillaEstructura()` (nombres distintos a `descargarPlantilla` de plan.js). |
| Modificaciones | Economías/demasías con fecha. |
| Adecuaciones | Control de condiciones. Cálculo por ítem. Exportación TXT. |

---

## 7. Principios de diseño

- Multi-archivo. No mezclar responsabilidades.
- Todo el estado en `window.state`; sincronizado con Firestore via `save()`.
- El IOP en `window.iopGlobal`; sincronizado via `saveIOP()`.
- Motor de cálculo nunca modifica datos históricos.
- Siempre trabajar en cantidades; porcentajes solo para mostrar.
- Economía (cantidad = 0): remanente = 0, sin división por cero.
- Cambio de base IOP automático al guardar adecuación que procede.
- Sin frameworks. CDN: Google Fonts, SheetJS, Firebase SDK v10.
- Un solo `onAuthStateChanged` en `state.js`.
- No duplicar funciones entre archivos.

---

## 8. Estado del roadmap

### ✅ Completado
- Múltiples obras (selector en sidebar).
- Importación de ítems desde Excel (dos formatos).
- Autenticación Google via Firebase Auth.
- Persistencia en Firestore: cada obra en su propio documento.
- IOP separado de las obras, compartido entre obras del mismo usuario.
- `guardarObra()` en `main.js` siempre crea obra nueva (no pisa la activa).
- `window.obras`, `window.state`, `window.iopGlobal` como variables globales sincronizadas.
- Total oferta calculado dinámicamente.
- Gestión de polinómica por ítem con validación suma = 100%.
- Pantalla IOP: parser Excel, IOP consolidado ponderado por precio de ítem, matriz solo lectura, select dinámico de base, merge en importación.
- Campos `fechaReplanteo` y `duracionDias` en `state.obra` (formularios crear/editar obra).
- Pantallas separadas: Plan de avance (`screen-plan`) y Avance real (`screen-real`).
- Plan: tabla compacta solo-plan, descarga plantilla Excel, importación Excel, carga manual por modal, cards de remanente.
- Avance real: tabla editable inline con 4 decimales, descarga plantilla Excel, importación Excel, carga manual por modal.
- Remapeo automático `MES-N` → `YYYY-MM` al agregar `fechaReplanteo` en `guardarEdicionObra()`.
- `calcIopBase()` usa `state.iopBase` como fallback (no `fechaApertura`).
- `getIOPConsolidado()` pondera factores por precio de ítem (no promedio simple).

### ⏳ Pendiente
- CSS: corregir posicionamiento de modales (`position: fixed`, `z-index: 9999`).
- Exportar adecuación a Excel (.xlsx).
- Importar/exportar backup completo en JSON.
- Edición inline de celdas del plan.
- Vincular polinómica de cada ítem con el cálculo de adecuación (hoy usa polinómica global).
- **Bug:** variación acumulada en pantalla Adecuaciones no da valores correctos — pendiente de diagnóstico.
- Informe PDF de la adecuación.
- Modo auditoría.
- Soporte redeterminación definitiva.
- Validación visual de que el plan sume 100% por ítem.

---

## 9. Glosario

| Término | Definición |
|---|---|
| Redeterminación | Ajuste del precio contractual por variación de costos (definitivo). |
| Adecuación provisoria | Ajuste mensual parcial a cuenta de la redeterminación definitiva. |
| IOP | Índice de Obra Pública de Córdoba, 46 factores mensuales. |
| Gatillo | Variación mínima del IOP consolidado para habilitar adecuación (default 10%). |
| Cambio de base | Al aprobar una adecuación, el IOP de ese período pasa a ser la nueva base. |
| Polinómica | Estructura de costos de un ítem: factores ponderados que suman 100%. |
| Versión de ítem | Nueva cantidad vigente desde una fecha (economía o demasía). |
| Rem. teórico | Fracción pendiente según el plan programado. |
| Rem. real | Fracción pendiente según lo efectivamente ejecutado. |
| Rem. aplicado | MIN(teórico, real). El que se usa para calcular la adecuación. |
| Penalización | Rem. teórico = 0 y real > 0: ítem atrasado, no se reconoce para adecuación. |
| fechaReplanteo | Período YYYY-MM de inicio real de la obra. Base para generar columnas de plan. |
| duracionDias | Duración contractual en días. Se convierte a meses con `Math.ceil(dias/30)`. |
