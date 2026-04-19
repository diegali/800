// ═══════════════════════════════════════════════
// IOP — Índices de Obra Pública Córdoba
// ═══════════════════════════════════════════════

function renderIOP() {
    document.getElementById('gatillo-val').value = state.gatillo || 10;

    const periodos = Object.keys(window.iopGlobal || {}).filter(p => p !== '_orden').sort();

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


function getIOPConsolidado(periodo, basePeriodo) {
    const iopActual = window.iopGlobal[periodo];
    const iopBase = basePeriodo ? window.iopGlobal[basePeriodo] : null;
    if (!iopActual || !iopBase) return null;

    const items = state.items || [];

    function normUp(s) {
        return s.trim().toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    }

    // ✅ Usa precioOficial para ponderadores, sino precio
    let totalPrecio = 0;
    for (const item of items) {
        const p = Number(item.precioOficial) || Number(item.precio) || 0;
        totalPrecio += p * (Number(item.cantidad) || 0);
    }

    if (!totalPrecio) return null;

    const pesosPorFactor = {};
    for (const item of items) {
        const p = Number(item.precioOficial) || Number(item.precio) || 0;
        const importe = p * (Number(item.cantidad) || 0);
        if (!importe || !item.factores) continue;

        const ponderadorItem = importe / totalPrecio;

        for (const f of item.factores) {
            const key = f.nombre.trim().toUpperCase();
            const peso = (Number(f.peso) || 0) / 100;
            if (!pesosPorFactor[key]) pesosPorFactor[key] = 0;
            pesosPorFactor[key] += peso * ponderadorItem;
        }
    }

    let total = 0;
    for (const [factor, peso] of Object.entries(pesosPorFactor)) {
        const keyActual = Object.keys(iopActual).find(k => normUp(k) === normUp(factor));
        const keyBase = Object.keys(iopBase).find(k => normUp(k) === normUp(factor));
        if (!keyActual || !keyBase) continue;

        const vActual = iopActual[keyActual];
        const vBase = iopBase[keyBase];
        if (vActual == null || vBase == null) continue;

        total += peso * (vActual / vBase - 1);
    }

    return total;
}

function getFactorItem(item, periodo, basePeriodo) {
    const iopActual = window.iopGlobal[periodo];
    const iopBase = basePeriodo ? window.iopGlobal[basePeriodo] : null;
    if (!iopActual || !iopBase || !item.factores || !item.factores.length) return null;

    function normUp(s) {
        return s.trim().toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    }

    let factor = 0;
    let pesoTotal = 0;

    for (const f of item.factores) {
        const key = f.nombre.trim().toUpperCase();
        const peso = (Number(f.peso) || 0) / 100;

        // ✅ CORREGIDO: busca `key` (nombre del factor), no `factor` (número)
        const keyActual = Object.keys(iopActual).find(k => normUp(k) === normUp(key));
        const keyBase = Object.keys(iopBase).find(k => normUp(k) === normUp(key));

        if (!keyActual || !keyBase) continue;

        const vActual = iopActual[keyActual];
        const vBase = iopBase[keyBase];
        if (vActual == null || vBase == null || vBase === 0) continue;

        factor += peso * (vActual / vBase);
        pesoTotal += peso;
    }

    if (!pesoTotal) return null;
    return 1 + (factor - pesoTotal);
}

function getIOP(periodo, basePeriodo) {
    if (!basePeriodo) return null;
    return getIOPConsolidado(periodo, basePeriodo);
}

function recalcIOP() {
    state.gatillo = parseFloat(document.getElementById('gatillo-val').value) || 10;
    save();
    renderIOP();
}

// 🔥 REEMPLAZAR COMPLETO: renderIOPEstado()

function renderIOPEstado() {
    const el = document.getElementById('iop-estado-cards');
    const periodos = Object.keys(window.iopGlobal || {}).sort();
    const factores = window.iopOrden ? Object.keys(window.iopOrden) : [];
    if (!periodos.length) {
        el.innerHTML = `<div class="empty" style="padding:16px">
            <div class="empty-sub">Importá el IOP para ver el estado</div>
        </div>`;
        return;
    }
    const primero = periodos[0];
    const ultimo = periodos[periodos.length - 1];
    el.innerHTML = `
        <div class="metric" style="margin-bottom:10px;text-align:center">
            <div class="metric-label">Períodos cargados</div>
            <div class="metric-val" style="font-size:20px">${periodos.length}</div>
            <div class="metric-sub">${periodoLabel(primero)} — ${periodoLabel(ultimo)}</div>
        </div>
        <div class="metric" style="margin-bottom:10px;text-align:center">
            <div class="metric-label">Factores cargados</div>
            <div class="metric-val" style="font-size:20px">${factores.length}</div>
        </div>
        <div class="metric" style="text-align:center">
            <div class="metric-label">Último período</div>
            <div class="metric-val" style="font-size:15px">${periodoLabel(ultimo)}</div>
            <div class="metric-sub">Gatillo: ${state.gatillo || 10}%</div>
        </div>`;
}

function renderIOPMatriz() {
    const table = document.getElementById('iop-matrix');
    const periodos = Object.keys(window.iopGlobal || {}).filter(p => p !== '_orden').sort();
    if (!periodos.length) {
        table.innerHTML = `<tbody><tr><td colspan="3" style="text-align:center;padding:48px;color:var(--text3);font-size:13px">
            Sin datos — importá el Excel del IOP para comenzar.
        </td></tr></tbody>`;
        return;
    }
    const orden = window.iopOrden || {};
    const factores = Object.keys(orden).sort((a, b) => orden[a] - orden[b]);
    if (!factores.length) { table.innerHTML = ''; return; }

    const pill = document.getElementById('iop-resumen-pill');
    if (pill) {
        pill.innerHTML = `<span class="tag tag-neutral" style="font-size:11px">${factores.length} factores · ${periodos.length} períodos</span>`;
    }

    let html = '<thead><tr>';
    html += `<th class="sticky-header sticky-col-nro" style="font-size:10px">N°</th>`;
    html += `<th class="sticky-header sticky-col-factor" style="font-size:11px">Factor</th>`;
    periodos.forEach(p => {
        html += `<th class="sticky-header" style="font-size:10px;text-align:right;padding:6px 8px;white-space:nowrap">${periodoLabel(p)}</th>`;
    });
    html += '</tr></thead><tbody>';

    factores.forEach((factor, index) => {
        const bg = index % 2 === 0 ? '' : 'background:var(--surface2)';
        html += `<tr style="${bg}">`;
        html += `<td class="sticky-col-nro" style="${bg};font-size:10px;color:var(--text3)">${index + 1}</td>`;
        html += `<td class="sticky-col-factor" style="${bg};font-size:12px;font-weight:500">${factor}</td>`;
        periodos.forEach(p => {
            const valor = window.iopGlobal[p] ? window.iopGlobal[p][factor] : null;
            html += valor != null
                ? `<td style="text-align:right;font-size:11px;padding:6px 8px;font-family:var(--mono)">${valor.toLocaleString('es-AR', { maximumFractionDigits: 2 })}</td>`
                : `<td style="text-align:center;color:var(--border2);font-size:11px">—</td>`;
        });
        html += '</tr>';
    });
    html += '</tbody>';
    table.innerHTML = html;
}