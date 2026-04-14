// ═══════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════
const screenTitles = {
    resumen: ['Resumen de obra', state.obra.nombre || ''],
    estructura: ['Ítems y estructura de costos', 'Polinómica por ítem'],
    versiones: ['Modificaciones de obra', 'Economías, demasías y cambios de plan'],
    plan: ['Plan de avance y avance real', 'En cantidades'],
    iop: ['Índices IOP', 'IOP Córdoba — control de gatillo'],
    adecuaciones: ['Adecuaciones provisorias', 'Dec. 1082/17']
};

function navigate(screen) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('screen-' + screen).classList.add('active');
    document.querySelector(`[onclick="navigate('${screen}')"]`).classList.add('active');
    const t = screenTitles[screen];
    document.getElementById('topbar-title').textContent = t[0];
    document.getElementById('topbar-sub').textContent = t[1];
    renderScreen(screen);
}

function renderScreen(screen) {
    if (screen === 'resumen') renderResumen();
    if (screen === 'estructura') renderItems();
    if (screen === 'versiones') renderVersiones();
    if (screen === 'plan') renderPlanScreen();
    if (screen === 'iop') renderIOP();
    if (screen === 'adecuaciones') renderAdecuaciones();
}

function populateItemSelects() {
    const opts = state.items.map(i => `<option value="${i.id}">${i.nombre}</option>`).join('');
    ['mod-item-select', 'plan-item-modal', 'real-item-modal', 'plan-item-select'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = opts;
    });
}