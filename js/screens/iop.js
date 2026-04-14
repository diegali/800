// ═══════════════════════════════════════════════
// IOP
// ═══════════════════════════════════════════════
function renderIOP() {
    const gatillo = state.gatillo || 10;
    document.getElementById('gatillo-val').value = gatillo;
    document.getElementById('gatillo-base').value = state.iopBase || '';

    const sorted = [...state.iop].sort((a, b) => a.periodo.localeCompare(b.periodo));
    const tbody = document.getElementById('iop-tbody');
    const empty = document.getElementById('iop-empty');

    if (!sorted.length) { tbody.innerHTML = ''; empty.style.display = 'block'; renderIOPEstado(); return; }
    empty.style.display = 'none';

    tbody.innerHTML = sorted.map(row => {
        const base = calcIopBase(row.periodo);
        const vBase = base ? getIOP(base) : null;
        const varAcum = vBase ? (row.valor / vBase - 1) : null;
        const supera = varAcum !== null && varAcum >= gatillo / 100;
        const esBase = row.periodo === state.iopBase;
        const esNuevaBase = state.adecuaciones.some(a => a.procede && a.periodo === row.periodo);
        let tag = '';
        if (esBase) tag = '<span class="tag tag-info">Base inicial</span>';
        else if (esNuevaBase) tag = '<span class="tag tag-info">Nueva base</span>';
        else if (supera) tag = '<span class="tag tag-ok">Gatillo activado</span>';
        return `<tr>
      <td>${periodoLabel(row.periodo)}</td>
      <td class="num">${row.valor.toLocaleString('es-AR')}</td>
      <td class="num text-muted">${base ? periodoLabel(base) : '—'}</td>
      <td class="num ${supera ? 'text-ok fw6' : ''}">
        ${varAcum !== null ? (varAcum >= 0 ? '+' : '') + (varAcum * 100).toFixed(1) + '%' : '—'}
      </td>
      <td>${tag}</td>
      <td><button class="btn btn-sm btn-danger" onclick="eliminarIOP('${row.periodo}')">×</button></td>
    </tr>`;
    }).join('');

    renderIOPEstado();
    updateIOPStatusPill();
}

function renderIOPEstado() {
    const el = document.getElementById('iop-estado-cards');
    const gatillo = state.gatillo || 10;
    const sorted = [...state.iop].sort((a, b) => a.periodo.localeCompare(b.periodo));
    if (!sorted.length || !state.iopBase) {
        el.innerHTML = '<div class="empty" style="padding:16px"><div class="empty-sub">Cargá al menos un índice y definí el período base</div></div>';
        return;
    }
    const last = sorted[sorted.length - 1];
    const base = calcIopBase(last.periodo);
    const vBase = base ? getIOP(base) : null;
    const varAcum = vBase ? (last.valor / vBase - 1) : null;
    const supera = varAcum !== null && varAcum >= gatillo / 100;
    const falta = varAcum !== null ? Math.max(0, gatillo / 100 - varAcum) : null;

    el.innerHTML = `
    <div class="metric" style="margin-bottom:10px">
      <div class="metric-label">Base activa</div>
      <div class="metric-val" style="font-size:15px">${periodoLabel(base)}</div>
      <div class="metric-sub">IOP ${vBase ? vBase.toLocaleString('es-AR') : '—'}</div>
    </div>
    <div class="metric" style="margin-bottom:10px">
      <div class="metric-label">Último período cargado</div>
      <div class="metric-val" style="font-size:15px">${periodoLabel(last.periodo)}</div>
      <div class="metric-sub">IOP ${last.valor.toLocaleString('es-AR')}</div>
    </div>
    <div class="metric" style="background:${supera ? 'var(--ok-bg)' : 'var(--warn-bg)'}">
      <div class="metric-label" style="color:${supera ? 'var(--ok)' : 'var(--warn)'}">Variación acumulada</div>
      <div class="metric-val" style="font-size:20px;color:${supera ? 'var(--ok)' : 'var(--warn)'}">
        ${varAcum !== null ? (varAcum >= 0 ? '+' : '') + (varAcum * 100).toFixed(2) + '%' : '—'}
      </div>
      <div class="metric-sub" style="color:${supera ? 'var(--ok)' : 'var(--warn)'}">
        ${supera ? 'Gatillo superado — procede adecuación' : falta !== null ? 'Falta +' + (falta * 100).toFixed(2) + '% para gatillo' : ''}
      </div>
    </div>`;
}

function updateIOPStatusPill() {
    const pill = document.getElementById('iop-status-pill');
    const sorted = [...state.iop].sort((a, b) => a.periodo.localeCompare(b.periodo));
    if (!sorted.length || !state.iopBase) { pill.textContent = 'Sin índices IOP'; pill.className = 'tag tag-neutral'; return; }
    const last = sorted[sorted.length - 1];
    const base = calcIopBase(last.periodo);
    const vBase = base ? getIOP(base) : null;
    const varAcum = vBase ? (last.valor / vBase - 1) : null;
    const gatillo = state.gatillo || 10;
    if (varAcum === null) { pill.textContent = 'IOP sin base'; pill.className = 'tag tag-neutral'; return; }
    if (varAcum >= gatillo / 100) {
        pill.textContent = 'IOP acum. +' + (varAcum * 100).toFixed(1) + '% — gatillo activado';
        pill.className = 'tag tag-ok';
    } else {
        const falta = gatillo / 100 - varAcum;
        pill.textContent = 'IOP acum. +' + (varAcum * 100).toFixed(1) + '% — falta +' + (falta * 100).toFixed(1) + '%';
        pill.className = 'tag tag-warn';
    }
}

function recalcIOP() {
    state.gatillo = parseFloat(document.getElementById('gatillo-val').value) || 10;
    state.iopBase = document.getElementById('gatillo-base').value || null;
    save(); renderIOP();
}