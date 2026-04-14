// ═══════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════
let state = {
    obra: { nombre: 'Edificio Municipal', expediente: '', fecha: '', contratista: '' },
    items: [],
    versiones: [],    // { itemId, fecha, cantidad, motivo }
    plan: [],         // { itemId, periodo, cantidad }
    real: [],         // { itemId, periodo, cantidad }
    iop: [],          // { periodo, valor }
    adecuaciones: [], // { periodo, empresaPidio, detalle[], total, iopBase, iopActual }
    gatillo: 10,
    iopBase: null,    // periodo de base actual
    nextId: 1
};

// Load from localStorage if exists
try {
    const saved = localStorage.getItem('redeterminaciones_800');
    if (saved) state = JSON.parse(saved);
} catch (e) { }

function save() {
    try { localStorage.setItem('redeterminaciones_800', JSON.stringify(state)); } catch (e) { }
}