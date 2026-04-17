// ═══════════════════════════════════════════════
// IOP — Índices de Obra Pública Córdoba
// ═══════════════════════════════════════════════

function renderIOP() {
    document.getElementById('gatillo-val').value = state.gatillo || 10;

    const baseSelect = document.getElementById('gatillo-base');
    const periodos = Object.keys(window.iopGlobal || {}).filter(p => p !== '_orden').sort();
    baseSelect.innerHTML = `<option value="">— Sin base —</option>`
        + periodos.map(p => `<option value="${p}" ${p === state.iopBase ? 'selected' : ''}>${periodoLabel(p)}</option>`).join('');

    renderIOPMatriz();
    renderIOPEstado();
}

async function importarIOP() {
    const input = document.getElementById('iop-file');
    const file = input.files[0];
    if (!file) { alert('Seleccioná un archivo'); return; }

    try {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array', cellDates: false });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });

        const headerIdx = rows.findIndex(r =>
            r && String(r[0] || '').trim().toLowerCase() === 'orden' &&
            String(r[1] || '').trim().toLowerCase() === 'factor'
        );

        if (headerIdx === -1) {
            alert('No se encontró la tabla. Verificá que sea el Excel oficial del IOP Córdoba.');
            return;
        }

        const header = rows[headerIdx];
        const colPeriodo = {};
        for (let col = 2; col < header.length; col++) {
            const cell = header[col];
            if (cell == null) continue;
            let periodo = null;
            if (typeof cell === 'number') {
                const parsed = XLSX.SSF.parse_date_code(cell);
                if (parsed) periodo = `${parsed.y}-${String(parsed.m).padStart(2, '0')}`;
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

        window.iopGlobal = window.iopGlobal || {};
        window.iopOrden = window.iopOrden || {};
        const periodosExistentes = new Set(Object.keys(window.iopGlobal));

        const dataRows = rows.slice(headerIdx + 1);
        for (const fila of dataRows) {
            if (!fila) continue;
            const orden = fila[0] != null ? parseInt(fila[0]) : null;
            const nombre = fila[1] != null ? String(fila[1]).trim() : null;
            if (!nombre) continue;

            for (const [colStr, periodo] of Object.entries(colPeriodo)) {
                const col = parseInt(colStr);
                const raw = fila[col];
                if (raw == null || raw === '') continue;
                const valor = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(',', '.'));
                if (isNaN(valor)) continue;

                if (!window.iopGlobal[periodo]) window.iopGlobal[periodo] = {};
                window.iopGlobal[periodo][nombre] = valor;
                if (!window.iopOrden[nombre] && orden != null) window.iopOrden[nombre] = orden;
            }
        }

        const periodosNuevos = Object.keys(window.iopGlobal).filter(p => !periodosExistentes.has(p)).sort();

        if (!state.iopBase) {
            const primero = Object.keys(window.iopGlobal).sort()[0];
            if (primero) {
                state.iopBase = primero;
                await save();
            }
        }

        await saveIOP();
        input.value = '';

        const msg = periodosNuevos.length > 0
            ? `IOP importado.\nPeríodos nuevos: ${periodosNuevos.map(periodoLabel).join(', ')}`
            : 'IOP importado. No se detectaron períodos nuevos.';
        alert(msg);

        renderIOP();

    } catch (err) {
        console.error('Error al importar IOP:', err);
        alert('Error al leer el archivo.');
        document.getElementById('iop-file').value = '';
    }
}

function getIOPFactores(periodo) {
    if (!window.iopGlobal || !window.iopGlobal[periodo]) return null;
    return window.iopGlobal[periodo];
}

function getIOPConsolidado(periodo) {
    // Devuelve el valor ABSOLUTO del IOP ponderado para un período.
    // NO compara con ninguna base — eso lo hace calcularEstadoGatillo().
    const factores = getIOPFactores(periodo);
    if (!factores) return null;

    const pesosPorFactor = {};
    let totalPrecio = 0;

    for (const item of (state.items || [])) {
        if (!item.factores || !item.factores.length) continue;
        const precio = item.precio || 0;
        totalPrecio += precio;
        for (const f of item.factores) {
            if (!pesosPorFactor[f.nombre]) pesosPorFactor[f.nombre] = 0;
            pesosPorFactor[f.nombre] += f.peso * precio;
        }
    }

    if (!totalPrecio) {
        // Fallback: promedio simple si no hay polinómica cargada
        const vals = Object.values(factores).filter(v => typeof v === 'number' && !isNaN(v));
        if (!vals.length) return null;
        return vals.reduce((a, b) => a + b, 0) / vals.length;
    }

    // IOP ponderado = SUM( peso_i * IOP_i ) / totalPrecio
    let iopPonderado = 0;
    for (const [nombre, pesoPrecio] of Object.entries(pesosPorFactor)) {
        const v = factores[nombre];
        if (v == null) continue;
        const pesoNorm = pesoPrecio / totalPrecio;
        iopPonderado += pesoNorm * v;
    }

    return iopPonderado;
}

function getIOP(periodo) {
    return getIOPConsolidado(periodo);
}

function getIOP(periodo) {
    return getIOPConsolidado(periodo);
}

function recalcIOP() {
    state.gatillo = parseFloat(document.getElementById('gatillo-val').value) || 10;
    state.iopBase = document.getElementById('gatillo-base').value || null;
    save();
    renderIOP();
}

function renderIOPEstado() {
    const el = document.getElementById('iop-estado-cards');
    const gatillo = state.gatillo || 10;

    const periodos = Object.keys(window.iopGlobal || {}).sort();
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
            <div class="metric-sub">IOP ${vBase != null ? vBase.toLocaleString('es-AR', { maximumFractionDigits: 2 }) : '—'}</div>
        </div>
        <div class="metric" style="margin-bottom:10px">
            <div class="metric-label">Último período cargado</div>
            <div class="metric-val" style="font-size:15px">${periodoLabel(lastPeriodo)}</div>
            <div class="metric-sub">IOP ${vActual != null ? vActual.toLocaleString('es-AR', { maximumFractionDigits: 2 }) : '—'}</div>
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

    const periodos = Object.keys(window.iopGlobal || {}).sort();
    if (!periodos.length) {
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

function renderIOPMatriz() {
    const table = document.getElementById('iop-matrix');
    const periodos = Object.keys(window.iopGlobal || {}).filter(p => p !== '_orden').sort();

    if (!periodos.length) {
        table.innerHTML = `<tbody><tr><td colspan="3" style="text-align:center;padding:32px;color:var(--text-2);font-size:13px">
            Sin datos. Importá el Excel del IOP para comenzar.
        </td></tr></tbody>`;
        return;
    }

    const orden = window.iopOrden || {};
    const factores = Object.keys(orden).sort((a, b) => orden[a] - orden[b]);
    if (!factores.length) { table.innerHTML = ''; return; }

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
            const valor = window.iopGlobal[p] ? window.iopGlobal[p][factor] : null;
            html += valor != null
                ? `<td>${valor.toLocaleString('es-AR', { maximumFractionDigits: 2 })}</td>`
                : `<td style="color:#ccc;text-align:center">—</td>`;
        });
        html += '</tr>';
    });

    html += '</tbody>';
    table.innerHTML = html;
}