// ═══════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════
function fmt$(valor) {
    if (valor === undefined || valor === null || isNaN(valor)) return '$ 0,00';
    return Number(valor).toLocaleString('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}
function fmtPct(n) {
    return (n * 100).toFixed(2) + '%';
}
function periodoLabel(p) {
    if (!p) return '—';
    if (p.startsWith('MES-')) return 'Mes ' + p.split('-')[1];
    const [y, m] = p.split('-');
    const meses = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return meses[parseInt(m)] + ' ' + y;
}

function cantidadVigente(itemId, periodo) {
    const item = state.items.find(i => i.id === itemId);
    if (!item) return 0;
    // Buscar en todas las modificaciones los cambios que afectan este ítem
    const cambios = [];
    (state.modificaciones || []).forEach(mod => {
        const cambio = (mod.items || []).find(i => i.itemIdBase === itemId);
        if (cambio && mod.periodo <= periodo) {
            cambios.push({ periodo: mod.periodo, cantidad: cambio.cantidad });
        }
    });
    if (!cambios.length) return item.cantidad;
    cambios.sort((a, b) => b.periodo.localeCompare(a.periodo));
    // La cantidad vigente es la original más la suma de todos los cambios aplicados
    const totalCambios = cambios.reduce((s, c) => s + c.cantidad, 0);
    return Math.round((item.cantidad + totalCambios) * 10000) / 10000;
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

function calcIopBase(periodo) {
    // Busca la última adecuación que procede con período < al dado
    // y devuelve el período ANTERIOR a esa adecuación (regla de base correcta)
    const adecuaciones = (state.adecuaciones || [])
        .filter(a => a.procede && a.periodo < periodo)
        .sort((a, b) => a.periodo.localeCompare(b.periodo));

    if (adecuaciones.length > 0) {
        const ultimaAdec = adecuaciones[adecuaciones.length - 1];
        // La base es el período anterior al gatillo, no el del gatillo mismo
        const todosLosPeriodos = Object.keys(window.iopGlobal || {}).sort();
        const idx = todosLosPeriodos.indexOf(ultimaAdec.periodo);
        if (idx > 0) return todosLosPeriodos[idx - 1];
        return ultimaAdec.periodo;
    }

    return state.iopBase || null;
}