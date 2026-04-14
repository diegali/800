// ═══════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════
function fmt$(n) {
    return '$' + Math.round(n).toLocaleString('es-AR');
}
function fmtPct(n) {
    return (n * 100).toFixed(2) + '%';
}
function periodoLabel(p) {
    if (!p) return '—';
    const [y, m] = p.split('-');
    const meses = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return meses[parseInt(m)] + ' ' + y;
}
function cantidadVigente(itemId, periodo) {
    const item = state.items.find(i => i.id === itemId);
    if (!item) return 0;
    const vers = state.versiones
        .filter(v => v.itemId === itemId && v.fecha <= periodo)
        .sort((a, b) => b.fecha.localeCompare(a.fecha));
    return vers.length ? vers[0].cantidad : item.cantidad;
}
function acumPlan(itemId, hasta) {
    return state.plan
        .filter(p => p.itemId === itemId && p.periodo <= hasta)
        .reduce((s, p) => s + p.cantidad, 0);
}
function acumReal(itemId, hasta) {
    return state.real
        .filter(r => r.itemId === itemId && r.periodo <= hasta)
        .reduce((s, r) => s + r.cantidad, 0);
}
function remanente(itemId, periodo) {
    const cv = cantidadVigente(itemId, periodo);
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

// IOP helpers
function getIOP(periodo) {
    const entry = state.iop.find(i => i.periodo === periodo);
    return entry ? entry.valor : null;
}
function calcIopBase(periodo) {
    // Find the active base: last adecuacion before this period, or gatillo-base
    const adecAntes = state.adecuaciones
        .filter(a => a.periodo < periodo && a.procede)
        .sort((a, b) => b.periodo.localeCompare(a.periodo));
    if (adecAntes.length) return adecAntes[0].periodo;
    return state.iopBase;
}
function variacionIOP(periodo) {
    const base = calcIopBase(periodo);
    if (!base) return null;
    const vBase = getIOP(base);
    const vActual = getIOP(periodo);
    if (!vBase || !vActual) return null;
    return vActual / vBase - 1;
}