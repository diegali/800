// ═══════════════════════════════════════════════
// RESUMEN
// ═══════════════════════════════════════════════
function renderResumen() {
    // Info de la obra
    const infoEl = document.getElementById('resumen-obra-info');
    if (infoEl) {
        const o = state.obra || {};
        const partes = [];
        if (o.expediente) partes.push(o.expediente);
        if (o.contratista) partes.push(o.contratista);
        if (o.fechaReplanteo) partes.push(`Replanteo: ${periodoLabel(o.fechaReplanteo)}`);
        if (o.duracionDias) partes.push(`${Math.ceil(o.duracionDias / 30)} meses`);
        infoEl.textContent = partes.join(' · ');
    }
    const totalOrig = state.items.reduce((s, i) => s + i.cantidad * i.precio, 0);
    const totalVig = state.items.reduce((s, i) => {
        const lastPeriodo = Object.keys(window.iopGlobal || {}).sort().pop() || '9999-12';
        return s + cantidadVigente(i.id, lastPeriodo) * i.precio;
    }, 0);
    const totalAdec = state.adecuaciones.filter(a => a.procede).reduce((s, a) => s + a.total, 0);
    document.getElementById('r-contrato').textContent = fmt$(totalOrig);
    document.getElementById('r-vigente').textContent = fmt$(totalVig);
    document.getElementById('r-adecuado').textContent = fmt$(totalAdec);

    // Adecuaciones list
    const adecList = document.getElementById('resumen-adecuaciones-list');
    const adecs = state.adecuaciones.filter(a => a.procede).sort((a, b) => a.periodo.localeCompare(b.periodo));
    if (!adecs.length) {
        adecList.innerHTML = '<div class="empty" style="padding:24px"><div class="empty-sub">Sin adecuaciones calculadas</div></div>';
    } else {
        adecList.innerHTML = adecs.map((a, idx) => {
            const varPct = ((a.iopActual / a.iopBase - 1) * 100).toFixed(1);
            return `<div style="padding:8px 0;border-bottom:1px solid var(--border)">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <span style="font-size:13px;font-weight:500">Adecuación provisoria ${idx + 1}</span>
          <span class="tag tag-ok">Calculada</span>
        </div>
        <div style="font-size:12px;color:var(--text2);margin-top:2px">${periodoLabel(a.periodo)} · ${fmt$(a.total)} · IOP +${varPct}%</div>
      </div>`;
        }).join('');
    }

    // Avance list
    const avList = document.getElementById('resumen-avance-list');
    if (!state.items.length) {
        avList.innerHTML = '<div class="empty" style="padding:24px"><div class="empty-sub">Sin ítems cargados</div></div>';
    } else {
        const lastPer = state.real.length ? [...state.real].sort((a, b) => b.periodo.localeCompare(a.periodo))[0].periodo : null;
        avList.innerHTML = state.items.map(item => {
            let pct = 0;
            if (lastPer) {
                const cv = cantidadVigente(item.id, lastPer);
                const ar = acumReal(item.id, lastPer);
                pct = cv > 0 ? Math.min(1, ar / cv) : 0;
            }
            const cv = lastPer ? cantidadVigente(item.id, lastPer) : item.cantidad;
            const economia = cv === 0;
            const fillClass = pct > 0.8 ? '' : pct > 0.4 ? 'prog-fill-warn' : 'prog-fill-danger';
            return `<div style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;margin-bottom:3px">
          <span style="font-size:12px">${item.nombre}</span>
          <span style="font-size:12px;font-weight:500;font-family:var(--mono)">${economia ? '<span class="tag tag-no" style="font-size:10px">Economía</span>' : (pct * 100).toFixed(1) + '%'}</span>
        </div>
        <div class="prog-bar"><div class="prog-fill ${fillClass}" style="width:${(pct * 100).toFixed(1)}%"></div></div>
      </div>`;
        }).join('');
    }
}