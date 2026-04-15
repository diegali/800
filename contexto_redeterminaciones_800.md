# Redeterminaciones 800/16 — Decreto 1082/17 · Adecuaciones provisorias
## Documento de contexto — App web · **Versión 4**
*Provincia de Córdoba*

---

## 1. Propósito de este documento

Describe el contexto, reglas de negocio y arquitectura actual de la app web de redeterminaciones para gestionar adecuaciones provisorias bajo el Decreto 800/16 de la Provincia de Córdoba.

**Cómo usarlo:** al iniciar un nuevo chat, adjuntá este archivo y decile a la IA:
> *"Leíste el documento de contexto de la app Redeterminaciones 800/16 v4. Quiero continuar el desarrollo. [Describí qué querés hacer.]*"

**Nota de trabajo:** el usuario es principiante. No generar archivos completos para descargar. En cambio, indicar exactamente qué cambiar, en qué archivo y en qué parte, paso a paso.

---

## 2. Dominio: Decreto 800/16 y 1082/17

### 2.1 Objetivo general
El Decreto 800/16 regula la redeterminación de precios en obras públicas provinciales de Córdoba. Permite actualizar el precio contractual cuando los costos varían por inflación u otros factores, manteniendo el equilibrio económico del contrato.

### 2.2 Estructura de costos (polinómica)
Cada ítem tiene su propia estructura de costos con factores ponderados que deben sumar 100%. Los factores tienen nombre y peso (%). El nombre del factor debe coincidir exactamente con el nombre de la columna en el Excel del IOP.

### 2.3 Índice IOP y gatillo
- Se usa el Índice de Obra Pública (IOP) de Córdoba, publicación mensual oficial.
- **Gatillo:** si la variación acumulada del IOP consolidado desde la última base supera el umbral configurado (default 10%), puede corresponder una adecuación.
- Además del gatillo, la empresa contratista debe haber solicitado formalmente la adecuación (condición Sí/No en la app).
- Al registrar una adecuación que procede, ese período IOP pasa a ser la nueva base (**cambio de base dinámico**).

### 2.4 Adecuaciones provisorias (Dec. 1082/17)
Las adecuaciones provisorias se calculan mes a mes sobre el remanente pendiente de ejecutar:

> **Remanente aplicado = MIN(remanente teórico, remanente real)**

- **Remanente teórico:** calculado en base al plan de avance programado.
- **Remanente real:** calculado en base a lo certificado efectivamente.
- Si el remanente teórico es 0 y el real es mayor → ítem **penalizado** (atrasado).
- Si la cantidad vigente del ítem es 0 (economía total) → remanente = 0.

### 2.5 Cálculo del remanente

| Variable | Fórmula / Origen |
|---|---|
| Cantidad vigente | Última versión del ítem con fecha <= período |
| Acumulado plan | Suma de cantidades planificadas hasta el período |
| Acumulado real | Suma de cantidades certificadas hasta el período |
| Rem. teórico | MAX(0, 1 − acum_plan / cant_vigente) |
| Rem. real | MAX(0, 1 − acum_real / cant_vigente) |
| Rem. aplicado | MIN(rem_teórico, rem_real) |
| Adecuación ítem | Precio vigente × rem_aplicado × (factor_IOP − 1) |

### 2.6 Modificaciones de obra
Cuando hay economías o demasías, se crea una nueva versión de cantidad del ítem con fecha de inicio. Los cálculos históricos no se modifican; la nueva cantidad aplica solo desde esa fecha. Si la cantidad nueva es 0, el ítem queda anulado y su remanente es 0 para todos los períodos posteriores (evita división por cero).

---

## 3. Arquitectura de la app

### 3.1 Stack tecnológico
- **Estructura:** HTML + CSS + JS modulares (multi-archivo), todos cargados como scripts normales en `index.html` (no ES modules).
- Vanilla HTML + CSS + JavaScript puro, sin frameworks.
- **Persistencia:** Firebase Firestore (nube) como fuente de verdad.
- **Autenticación:** Firebase Auth con Google (via popup).
- Exportación de adecuaciones a archivo **.txt**.
- Importación de ítems/presupuesto desde archivos **.xlsx** (via SheetJS CDN).
- Importación del IOP desde archivo **.xlsx** oficial (via SheetJS CDN).
- Librerías externas:
  - `https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js`
  - Firebase SDK v10 (módulos ES via CDN de gstatic)
- Diseño: tipografía IBM Plex Sans + IBM Plex Mono, paleta neutra sobre blanco/crema.

### 3.2 Estructura de archivos

```
index.html                          ← Entry point principal (incluye config Firebase)
css/
  base.css
  components.css
  screens.css
js/
  config.js                         ← (reservado, cargado antes de state.js)
  state.js                          ← Estado global + multi-obra + sync Firebase
  engine.js                         ← Motor de cálculo (helpers de remanente)
  ui.js                             ← Navegación, modales, selector de obras
  main.js                           ← Init + guardarObra() + listener login
  screens/
    resumen.js
    estructura.js                   ← Ítems + importación Excel + polinómica
    versiones.js                    ← Economías/demasías
    plan.js                         ← Plan, avance real, guardarPlan(), guardarReal()
    iop.js                          ← IOP: importación Excel, getIOP(), gatillo, matriz
    adecuaciones.js
```

**Importante:** `auth.js` existe en el proyecto pero **no debe usarse** — tiene código duplicado y roto. Toda la autenticación está manejada en `state.js` y `main.js`.

### 3.3 Modelo de datos (state)

El estado vive en el objeto `state` en memoria, sincronizado con **Firebase Firestore** bajo `usuarios/{uid}`.

**Estructura Firestore:**
```
usuarios/{uid}
  listaObras: []       ← array completo de obras
  activaId: string     ← ID de la obra activa
  ultimaEdicion: ISO   ← timestamp
```

**Clave localStorage usada:**
- `redeterminaciones_obraActiva` → ID de la obra activa (solo para referencia local)

**Estructura de cada obra (`obraVacia()`):**

| Clave | Tipo | Descripción |
|---|---|---|
| id | Number | Timestamp (Date.now()) |
| fechaCreacion | String | YYYY-MM |
| obra | Objeto | nombre, expediente, fecha, fechaApertura, contratista |
| items[] | Array | id, nombre, unidad, cantidad, precio, factores[] |
| versiones[] | Array | itemId, fecha (YYYY-MM), cantidad, motivo |
| plan[] | Array | itemId, periodo (YYYY-MM), cantidad |
| real[] | Array | itemId, periodo (YYYY-MM), cantidad |
| iop | Objeto | { "YYYY-MM": { "NombreFactor": valor, ... }, ... } |
| adecuaciones[] | Array | periodo, empresaPidio, procede, factor, total, detalle[], iopBase, iopActual |
| gatillo | Number | Porcentaje de gatillo (default: 10) |
| iopBase | String | Período YYYY-MM de la base IOP inicial |
| nextId | Number | Autoincremental para IDs de ítems |

**⚠️ Nota importante sobre `state.iop`:** es un **objeto** (no un array). La clave es el período `"YYYY-MM"` y el valor es otro objeto con los factores: `{ "Aceros": 13467.5, "Albañilería": 10448.2, ... }`. Hay 46 factores por período.

**flag especial:** `state._sinGuardar = true` → obra nueva que todavía no se guardó.

### 3.4 Funciones de gestión multi-obra (state.js)

| Función | Qué hace |
|---|---|
| `obraVacia()` | Retorna objeto obra con valores por defecto |
| `getObraActivaId()` | Lee ID activo desde localStorage |
| `setObraActivaId(id)` | Guarda ID activo en localStorage |
| `save()` | Sincroniza `obras` completo a Firestore (async) |
| `crearNuevaObra(datosObra)` | Crea obra, la activa, sincroniza y refresca UI |
| `cambiarObraActiva(id)` | Cambia `state` y `activaId`; retorna true/false |
| `eliminarObra(id)` | Elimina obra del array, sincroniza y recarga página |
| `descargarTodoDeNube()` | Descarga `listaObras` de Firestore y refresca UI completa |

**Listener de auth:** en `state.js`, `window.addEventListener('load')` registra `onAuthStateChanged`. Si hay usuario → llama `descargarTodoDeNube()`. Si no → resetea state.

**En `main.js`:** `DOMContentLoaded` solo maneja el click del botón de login (signInWithPopup). El listener de auth lo maneja únicamente `state.js`.

### 3.5 Motor de cálculo (engine.js)

**Estas funciones viven en `engine.js` y NO deben duplicarse en otros archivos:**

| Función | Qué hace |
|---|---|
| `cantidadVigente(itemId, periodo)` | Última versión del ítem con fecha <= periodo |
| `acumPlan(itemId, hasta)` | Suma cantidades del plan hasta el período |
| `acumReal(itemId, hasta)` | Suma cantidades reales hasta el período |
| `remanente(itemId, periodo)` | Retorna {teorico, real, aplicado, nota} |
| `calcIopBase(periodo)` | Base IOP activa: última adecuación que procede antes del período, o iopBase inicial |
| `variacionIOP(periodo)` | Variación acumulada del IOP respecto a la base |
| `fmt$(n)` | Formatea número como moneda AR |
| `fmtPct(n)` | Formatea número como porcentaje |
| `periodoLabel(p)` | Convierte YYYY-MM a "Mes YYYY" |

**Estas funciones viven en `iop.js` y NO deben duplicarse en `engine.js`:**

| Función | Qué hace |
|---|---|
| `getIOP(periodo)` | IOP consolidado para un período (llama a getIOPConsolidado) |
| `getIOPConsolidado(periodo)` | Ponderado por polinómica de ítems; fallback a promedio simple |
| `getIOPFactores(periodo)` | Retorna el objeto `{factor: valor}` crudo para un período |

**Valores del campo `nota` en remanente:**

| Valor | Significado |
|---|---|
| economia | Cantidad vigente = 0. Remanente forzado a 0. |
| penalizado | Rem. teórico = 0 y rem. real > 0. Ítem atrasado. |
| real-menor | Se aplica rem. real (es menor al teórico). |
| teorico-menor | Se aplica rem. teórico (es menor al real). |
| ok | Normal, sin condición especial. |

### 3.6 UI (ui.js)

| Función | Qué hace |
|---|---|
| `navigate(screen)` | Cambia pantalla activa, actualiza topbar con nombre de obra, dispara render |
| `renderScreen(screen)` | Llama al render de la pantalla correspondiente |
| `populateItemSelects()` | Actualiza todos los `<select>` de ítems |
| `openModal(id)` / `closeModal(id)` | Abre/cierra modales |
| `renderSelectorObras()` | Renderiza lista de obras como botones en `#sidebar-obras` (div, no select) |
| `seleccionarObra(id)` | Llama `cambiarObraActiva()`, refresca topbar y navega a resumen |
| `verEstructura(id)` | Abre modal de factores para el ítem dado |
| `cerrarYGuardarFactores()` | Valida suma = 100%, guarda factores en el ítem y sincroniza |
| `validarSumaTotal()` | Feedback visual en tiempo real de la suma de factores |

---

## 4. Pantalla IOP (iop.js) — detalle

### 4.1 Flujo de importación
- El usuario importa el Excel oficial del IOP Córdoba (hoja `IOP-Cba`).
- El Excel tiene: fila 6 = header (col A=Orden, col B=Factor, col C..=fechas como seriales Excel), filas 7..52 = 46 factores con valores desde Nov-2015 en adelante.
- Cada mes el usuario descarga el Excel actualizado con una columna nueva y lo reimporta.
- La importación hace **merge**: agrega períodos nuevos sin borrar los anteriores.
- No hay carga manual de IOP — solo importación desde Excel.

### 4.2 Cálculo del IOP consolidado
`getIOPConsolidado(periodo)` calcula el IOP de un período como promedio ponderado de los factores según los pesos de la polinómica de los ítems. Si no hay ítems con factores definidos, hace promedio simple de todos los factores como fallback.

### 4.3 Pantalla
- Tabla de matriz (solo lectura): filas = factores, columnas = períodos. La columna base se resalta.
- Panel derecho: parámetros del gatillo (% y período base como select dinámico) + estado del gatillo (3 cards: base activa, último período, variación acumulada).
- Pill en el topbar: muestra el estado del IOP en todo momento.

---

## 5. Otras pantallas

| Pantalla | Funcionalidad |
|---|---|
| Resumen | Métricas globales (contrato original, monto vigente, total adecuado, avance real), historial de adecuaciones, avance por ítem con barra de progreso. |
| Ítems y estructura | Visualización de ítems con total oferta calculado dinámicamente. Importación desde Excel (dos formatos). Gestión de polinómica por ítem via modal con validación en tiempo real. |
| Modificaciones | Registro de economías/demasías con fecha. Versiones del plan de avance. |
| Plan y avance | Carga del plan en cantidades (`guardarPlan()`). Carga de avance real (`guardarReal()`). Cálculo de remanentes por ítem y período. |
| Adecuaciones | Control de condiciones (gatillo + pedido empresa). Cálculo detallado por ítem. Exportación a TXT. |

---

## 6. Principios de diseño a mantener

- Estructura multi-archivo. No mezclar responsabilidades entre archivos.
- Todo el estado en el objeto `state`; sincronizado con Firestore via `save()` (async).
- El motor de cálculo **nunca modifica datos históricos**, solo lee y computa.
- Siempre trabajar en **cantidades**; los porcentajes son solo para mostrar.
- Ante economía (cantidad vigente = 0): remanente = 0, sin división por cero.
- El cambio de base IOP es automático al guardar una adecuación que procede.
- Sin frameworks JS. CDN permitidos: Google Fonts, SheetJS, Firebase SDK v10.
- Un solo `onAuthStateChanged` en `state.js`. No duplicar en otros archivos.
- **No duplicar funciones entre archivos.** Si una función ya existe en un archivo, no recrearla en otro.

---

## 7. Estado del roadmap

### ✅ Completado
- Soporte para múltiples obras (selector en sidebar como lista de botones).
- Importación de ítems desde Excel (dos formatos).
- Autenticación con Google via Firebase Auth.
- Persistencia en Firebase Firestore (reemplaza localStorage).
- Total oferta calculado dinámicamente en pantalla de estructura.
- Gestión de polinómica por ítem con validación suma = 100%.
- `guardarPlan()` y `guardarReal()` en `plan.js`.
- `cambiarObraActiva()` en `state.js`.
- `renderSelectorObras()` apunta a `#sidebar-obras` (div con botones).
- Eliminado listener duplicado de auth en `main.js`.
- Modal `modal-nueva-obra` corregido.
- **Pantalla IOP reescrita (v4):**
  - Parser del Excel corregido (detecta header por contenido, lee seriales de fecha con SSF).
  - `state.iop` es objeto `{periodo: {factor: valor}}`, no array.
  - IOP consolidado ponderado por polinómica de ítems.
  - Tabla de matriz solo lectura con columna base resaltada.
  - Select dinámico de período base.
  - Importación hace merge (no reemplaza todo).
  - Eliminadas funciones `guardarIOP()`, `eliminarIOP()`, `getIOPPromedio()`.
  - `getIOP()`, `getIOPConsolidado()`, `getIOPFactores()` viven en `iop.js`.
  - `getIOP()`, `calcIopBase()`, `variacionIOP()` eliminadas de `engine.js` (estaban duplicadas).
  - `adecuaciones.js` corregido: usa `Object.keys(state.iop)` en lugar de `state.iop.map(...)`.

### ⏳ Pendiente
- CSS: corregir posicionamiento de modales (`position: fixed`, `z-index: 9999`) para evitar que aparezcan alineados a la izquierda al pie de página.
- Eliminar o ignorar `auth.js` (tiene código duplicado y roto — no se referencia desde ningún lado idealmente).
- Exportar adecuación a Excel (.xlsx) con formato de tabla.
- Importar/exportar backup completo en JSON.
- Edición inline de ítems y plan (sin modal).
- Vincular factores de polinómica con cálculo de adecuación por ítem (actualmente `guardarAdecuacion()` usa un único `factor = iopActual / iopBase` para todos los ítems — debería calcular el factor ponderado por la polinómica de cada ítem individualmente).
- Comparación automática contra sistema externo.
- Informe PDF de la adecuación.
- Modo auditoría.
- Soporte para redeterminación definitiva.
- Validación visual de que el plan sume 100% por ítem.

---

## 8. Glosario

| Término | Definición |
|---|---|
| Redeterminación | Ajuste del precio contractual por variación de costos (definitivo). |
| Adecuación provisoria | Ajuste mensual parcial a cuenta de la redeterminación definitiva. |
| IOP | Índice de Obra Pública de Córdoba, publicado mensualmente. Tiene 46 factores (Aceros, Albañilería, Asfaltos, etc.). |
| Gatillo | Variación mínima del IOP consolidado para habilitar adecuación (default 10%). |
| Cambio de base | Al aprobar una adecuación, el IOP de ese período pasa a ser la nueva base. |
| Polinómica | Estructura de costos de un ítem: factores ponderados que suman 100%. El nombre del factor debe coincidir con el Excel del IOP. |
| Versión de ítem | Nueva cantidad vigente desde una fecha. Se crea al registrar economía o demasía. |
| Economía | Reducción de cantidad de un ítem por modificación de obra. |
| Demasía | Aumento de cantidad de un ítem por modificación de obra. |
| Rem. teórico | Fracción pendiente según el plan programado. |
| Rem. real | Fracción pendiente según lo efectivamente ejecutado. |
| Rem. aplicado | MIN(teórico, real). El que se usa para calcular la adecuación. |
| Penalización | Rem. teórico = 0 y real > 0: ítem atrasado, no se reconoce para adecuación. |
