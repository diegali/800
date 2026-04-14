// ═══════════════════════════════════════════════
// IOP — Índices de Obra Pública Córdoba
//
// Estructura de state.iop:
//   Objeto { "YYYY-MM": { "NombreFactor": valor, ... }, ... }
//
// El Excel oficial tiene:
//   Fila 6 : header — col A=Orden, col B=Factor, col C..=fechas (datetime)
//   Filas 7+: datos  — col A=nro, col B=nombre, col C..=valores numéricos
// ═══════════════════════════════════════════════

// ── Render principal ──────────────────────────

function renderIOP() {
    document.getElementById('gatillo-val').value = state.gatillo || 10;

    // Poblar select de período base con los períodos disponibles
    const baseSelect = document.getElementById('gatillo-base');
    const periodos = Object.keys(state.iop || {}).sort();
    baseSelect.innerHTML = `<option value="">— Sin base —</option>`
        + periodos.map(p => `<option value="${p}" ${p === state.iopBase ? 'selected' : ''}>${periodoLabel(p)}</option>`).join('');

    renderIOPMatriz();
    renderIOPEstado();
}

// ── Importación desde Excel ───────────────────

async function importarIOP() {
    const input = document.getElementById('iop-file');
    const file = input.files[0];
    if (!file) { alert('Seleccioná un archivo'); return; }

    try {
        const data = await file.arrayBuffer();
        // cellDates:false para manejar fechas manualmente via SSF
        const workbook = XLSX.read(data, { type: 'array', cellDates: false });

        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, {
            header: 1,
            raw: true,
            defval: null
        });

        // Encontrar fila header: "Orden" en col 0, "Factor" en col 1
        const headerIdx = rows.findIndex(r =>
            r && String(r[0] || '').trim().toLowerCase() === 'orden' &&
                 String(r[1] || '').trim().toLowerCase() === 'factor'
        );

        if (headerIdx === -1) {
            alert('No se encontró la tabla. Verificá que sea el Excel oficial del IOP Córdoba.');
            return;
        }

        const header = rows[headerIdx];

        // Mapear columnas a período YYYY-MM
        // Las fechas son seriales de Excel (números enteros como 42309 = 2015-11-01)
        const colPeriodo = {};
        for (let col = 2; col < header.length; col++) {
            const cell = header[col];
            if (cell == null) continue;
            let periodo = null;

            if (typeof cell === 'number') {
                // Serial de fecha Excel → fecha JS
                const parsed = XLSX.SSF.parse_date_code(cell);
                if (parsed) {
                    const mes = String(parsed.m).padStart(2, '0');
                    periodo = `${parsed.y}-${mes}`;
                }
            } else if (typeof cell === 'string') {
                const m = cell.match(/^(\d{4})-(\d{2})/);
                if (m) periodo = `${m[1]}-${m[2]}`;
            }

            if (periodo) colPeriodo[col] = periodo;
        }

        if (Object.keys(colPeriodo).length === 0) {
            alert('No se pudieron leer las fechas del encabezado.');
            return;
        }

        // Construir IOP — merge sobre el estado existente
        const nuevoIOP = { ...(state.iop || {}) };
        const periodosExistentes = new Set(Object.keys(state.iop || {}));

        const dataRows = rows.slice(headerIdx + 1);

        for (const fila of dataRows) {
            if (!fila) continue;
            // Col 1 = nombre del factor (col 0 es el número de orden)
            const nombre = fila[1] != null ? String(fila[1]).trim() : null;
            if (!nombre) continue;

            for (const [colStr, periodo] of Object.entries(colPeriodo)) {
                const col = parseInt(colStr);
                const raw = fila[col];
                if (raw == null || raw === '') continue;
                const valor = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(',', '.'));
                if (isNaN(valor)) continue;

                if (!nuevoIOP[periodo]) nuevoIOP[periodo] = {};
                nuevoIOP[periodo][nombre] = valor;
            }
        }

        const periodosNuevos = Object.keys(nuevoIOP).filter(p => !periodosExistentes.has(p)).sort();

        state.iop = nuevoIOP;

        if (!state.iopBase) {
            const primero = Object.keys(nuevoIOP).sort()[0];
            if (primero) state.iopBase = primero;
        }

        await save();
        input.value = '';

        const msg = periodosNuevos.length > 0
            ? `IOP importado.\nPeríodos nuevos: ${periodosNuevos.map(periodoLabel).join(', ')}`
            : 'IOP importado. No se detectaron períodos nuevos (ya estaban cargados).';
        alert(msg);

        renderIOP();

    } catch (err) {
        console.error('Error al importar IOP:', err);
        alert('Error al leer el archivo. Asegurate de que sea el Excel oficial del IOP.');
        document.getElementById('iop-file').value = '';
    }
}

// ── Getters del IOP ───────────────────────────

// Retorna el objeto { factor: valor } para un período
function getIOPFactores(periodo) {
    if (!state.iop || !state.iop[periodo]) return null;
    return state.iop[periodo];
}

// IOP consolidado para un período:
// Ponderado por los factores de la polinómica de los ítems si están definidos,
// o promedio simple de todos los factores como fallback.
function getIOPConsolidado(periodo) {
    const factores = getIOPFactores(periodo);
    if (!factores) return null;

    let pesoTotal = 0;
    let sumaTotal = 0;
    let tienePesos = false;

    for (const item of (state.items || [])) {
        if (!item.factores || !item.factores.length) continue;
        for (const f of item.factores) {
            const valorFactor = factores[f.nombre];
            if (valorFactor == null) continue;
            sumaTotal += valorFactor * f.peso;
            pesoTotal += f.peso;
            tienePesos = true;
        }
    }

    if (tienePesos && pesoTotal > 0) {
        return sumaTotal / pesoTotal;
    }

    // Fallback: promedio simple
    const valores = Object.values(factores).filter(v => typeof v === 'number' && !isNaN(v));
    if (!valores.length) return null;
    return valores.reduce((a, b) => a + b, 0) / valores.length;
}

// getIOP es el punto de entrada usado por engine.js y adecuaciones.js
function getIOP(periodo) {
    return getIOPConsolidado(periodo);
}

// ── Parámetros del gatillo ────────────────────

function recalcIOP() {
    state.gatillo = parseFloat(document.getElementById('gatillo-val').value) || 10;
    state.iopBase = document.getElementById('gatillo-base').value || null;
    save();
    renderIOP();
}

// ── Estado del gatillo ────────────────────────

function renderIOPEstado() {
    const el = document.getElementById('iop-estado-cards');
    const gatillo = state.gatillo || 10;

    const periodos = Object.keys(state.iop || {}).sort();
    if (!periodos.length || !state.iopBase) {
        el.innerHTML = `<div class="empty" style="padding:16px">
            <div class="empty-sub">Importá el IOP y definí el período base</div>
        </div>`;
        updateIOPStatusPill();
        return;
    }

    const lastPeriodo = periodos[periodos.length - 1];
    const base = calcIopBase(lastPeriodo);
    const vBase = base ? getIOP(base) : null;
    const vActual = getIOP(lastPeriodo);
    const varAcum = (vBase && vActual) ? (vActual / vBase - 1) : null;
    const supera = varAcum !== null && varAcum * 100 >= gatillo;
    const falta = varAcum !== null ? Math.max(0, gatillo / 100 - varAcum) : null;

    el.innerHTML = `
        <div class="metric" style="margin-bottom:10px">
            <div class="metric-label">Base activa</div>
            <div class="metric-val" style="font-size:15px">${periodoLabel(base)}</div>
            <div class="metric-sub">IOP ${vBase != null ? vBase.toLocaleString('es-AR', {maximumFractionDigits:2}) : '—'}</div>
        </div>
        <div class="metric" style="margin-bottom:10px">
            <div class="metric-label">Último período cargado</div>
            <div class="metric-val" style="font-size:15px">${periodoLabel(lastPeriodo)}</div>
            <div class="metric-sub">IOP ${vActual != null ? vActual.toLocaleString('es-AR', {maximumFractionDigits:2}) : '—'}</div>
        </div>
        <div class="metric" style="background:${supera ? 'var(--ok-bg)' : 'var(--warn-bg)'}">
            <div class="metric-label" style="color:${supera ? 'var(--ok)' : 'var(--warn)'}">Variación acumulada</div>
            <div class="metric-val" style="font-size:20px;color:${supera ? 'var(--ok)' : 'var(--warn)'}">
                ${varAcum !== null ? (varAcum >= 0 ? '+' : '') + (varAcum * 100).toFixed(2) + '%' : '—'}
            </div>
            <div class="metric-sub" style="color:${supera ? 'var(--ok)' : 'var(--warn)'}">
                ${supera
                    ? '✓ Gatillo superado — procede adecuación'
                    : falta !== null
                        ? 'Falta +' + (falta * 100).toFixed(2) + '% para el gatillo de ' + gatillo + '%'
                        : ''}
            </div>
        </div>`;

    updateIOPStatusPill();
}

function updateIOPStatusPill() {
    const pill = document.getElementById('iop-status-pill');
    if (!pill) return;

    const periodos = Object.keys(state.iop || {}).sort();
    if (!periodos.length || !state.iopBase) {
        pill.textContent = 'Sin índices IOP';
        pill.className = 'tag tag-neutral';
        return;
    }

    const last = periodos[periodos.length - 1];
    const base = calcIopBase(last);
    const vBase = base ? getIOP(base) : null;
    const vActual = getIOP(last);
    const varAcum = (vBase && vActual) ? (vActual / vBase - 1) : null;
    const gatillo = state.gatillo || 10;

    if (varAcum === null) {
        pill.textContent = 'IOP sin base';
        pill.className = 'tag tag-neutral';
        return;
    }

    if (varAcum * 100 >= gatillo) {
        pill.textContent = 'IOP acum. +' + (varAcum * 100).toFixed(1) + '% — gatillo activado';
        pill.className = 'tag tag-ok';
    } else {
        const falta = gatillo / 100 - varAcum;
        pill.textContent = 'IOP acum. +' + (varAcum * 100).toFixed(1) + '% — falta +' + (falta * 100).toFixed(1) + '%';
        pill.className = 'tag tag-warn';
    }
}

// ── Tabla de la matriz (solo lectura) ─────────

function renderIOPMatriz() {
    const table = document.getElementById('iop-matrix');
    const periodos = Object.keys(state.iop || {}).sort();

    if (!periodos.length) {
        table.innerHTML = `<tbody><tr><td colspan="3" style="text-align:center;padding:32px;color:var(--text-2);font-size:13px">
            Sin datos. Importá el Excel del IOP para comenzar.
        </td></tr></tbody>`;
        return;
    }

    // Lista de factores: del primer período con datos
    const primerPeriodo = periodos.find(p => Object.keys(state.iop[p] || {}).length > 0);
    if (!primerPeriodo) { table.innerHTML = ''; return; }

    const factores = Object.keys(state.iop[primerPeriodo]).sort();

    let html = '<thead><tr>';
    html += `<th class="sticky-header sticky-col-nro">N°</th>`;
    html += `<th class="sticky-header sticky-col-factor">Factor</th>`;

    periodos.forEach(p => {
        const esBase = p === state.iopBase;
        html += `<th class="sticky-header" style="${esBase ? 'background:#e8f0fe;color:var(--accent)' : ''}">`
              + periodoLabel(p)
              + (esBase ? '<br><span style="font-size:9px;font-weight:400;opacity:.8">BASE</span>' : '')
              + '</th>';
    });
    html += '</tr></thead><tbody>';

    factores.forEach((factor, index) => {
        html += '<tr>';
        html += `<td class="sticky-col-nro">${index + 1}</td>`;
        html += `<td class="sticky-col-factor">${factor}</td>`;
        periodos.forEach(p => {
            const valor = state.iop[p] ? state.iop[p][factor] : null;
            html += valor != null
                ? `<td>${valor.toLocaleString('es-AR', {maximumFractionDigits: 2})}</td>`
                : `<td style="color:#ccc;text-align:center">—</td>`;
        });
        html += '</tr>';
    });

    html += '</tbody>';
    table.innerHTML = html;
}
