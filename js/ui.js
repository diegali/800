// ═══════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════

function navigate(screen) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    const target = document.getElementById('screen-' + screen);
    if (target) target.classList.add('active');

    const btn = document.querySelector(`[onclick="navigate('${screen}')"]`);
    if (btn) btn.classList.add('active');

    const titles = {
        resumen: 'Resumen de obra',
        estructura: 'Ítems y estructura de costos',
        versiones: 'Modificaciones de obra',
        plan: 'Plan de avance',
        real: 'Avance real',
        iop: 'Índices IOP',
        adecuaciones: 'Adecuaciones provisorias'
    };
    document.getElementById('topbar-title').textContent = titles[screen] || '';

    // Mantener el nombre de la obra siempre visible
    const sub = document.getElementById('topbar-sub');
    if (sub) {
        sub.textContent = (state && state.obra && state.obra.nombre)
            ? state.obra.nombre
            : 'Sin obra seleccionada';
    }

    renderScreen(screen);
}

function renderScreen(screen) {
    if (screen === 'resumen') renderResumen();
    if (screen === 'estructura') renderItems();
    if (screen === 'versiones') renderVersiones();
    if (screen === 'plan') renderPlanScreen();
    if (screen === 'real') renderRealScreen();
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

// ═══════════════════════════════════════════════
// MODALS
// ═══════════════════════════════════════════════
function openModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('open');
}

function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('open');
}

// ═══════════════════════════════════════════════
// SELECTOR DE OBRAS (sidebar)
// ═══════════════════════════════════════════════
function renderSelectorObras() {
    const selector = document.getElementById('sidebar-obras');
    if (!selector) return;

    const misObras = (typeof obras !== 'undefined') ? obras : [];

    if (!misObras.length) {
        selector.innerHTML = `<div style="font-size:11px;color:var(--text-2);padding:4px 0">Sin obras guardadas</div>`;
        return;
    }

    selector.innerHTML = misObras.map(o => {
        const activa = String(o.id) === String(getObraActivaId());
        return `<button onclick="seleccionarObra(${o.id})" style="
            width:100%;text-align:left;padding:6px 8px;margin-bottom:2px;border-radius:6px;
            border:none;cursor:pointer;font-size:12px;line-height:1.3;
            background:${activa ? 'var(--accent)' : 'transparent'};
            color:${activa ? 'white' : 'var(--text-1)'};
            font-family:var(--sans)">
            <div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${o.obra.nombre || 'Sin nombre'}</div>
            <div style="font-size:10px;opacity:0.75">${o.obra.expediente || 'Sin expediente'}</div>
        </button>`;
    }).join('');
}

function seleccionarObra(id) {
    if (!cambiarObraActiva(id)) return;
    renderTopbarObra();
    renderSelectorObras();
    navigate('resumen');
}

// ═══════════════════════════════════════════════
// MODAL ESTRUCTURA DE COSTOS
// ═══════════════════════════════════════════════
let itemIdEdicionActual = null;

function verEstructura(id) {
    itemIdEdicionActual = id;
    renderFactores();
    openModal('modal-ver-estructura');
}

function validarSumaTotal() {
    const inputs = document.querySelectorAll('.input-peso');
    let suma = 0;

    inputs.forEach(input => {
        suma += parseFloat(input.value) || 0;
    });

    const aviso = document.getElementById('suma-factores-aviso');
    const btnGuardar = document.getElementById('btn-guardar-factores');

    if (!aviso) return;

    aviso.textContent = `Total acumulado: ${suma.toFixed(2)}%`;

    const ok = Math.abs(suma - 100) < 0.01;

    // colores
    if (ok) {
        aviso.style.color = "green";
    } else {
        aviso.style.color = suma > 100 ? "red" : "orange";
    }

    // 🔒 bloquear botón
    if (btnGuardar) {
        btnGuardar.disabled = !ok;
        btnGuardar.style.opacity = ok ? "1" : "0.5";
    }
}

async function cerrarYGuardarFactores() {
    const inputs = document.querySelectorAll('.input-peso');
    const nuevosFactores = [];
    let suma = 0;

    inputs.forEach(input => {
        const peso = parseFloat(input.value) || 0;

        suma += peso;

        if (peso > 0) {
            nuevosFactores.push({ nombre: input.dataset.nombre, peso });
        }
    });

    if (Math.abs(suma - 100) > 0.01) {
        alert("La suma debe ser exactamente 100%");
        return;
    }

    const item = state.items.find(i => i.id === itemIdEdicionActual);
    item.factores = nuevosFactores;

    try {
        await save();
        closeModal('modal-ver-estructura');
        renderItems();
    } catch (e) {
        console.error(e);
        alert("Error al guardar. Verificá tu conexión.");
    }
}

async function quitarFactor(index) {
    const item = state.items.find(i => i.id === itemIdEdicionActual);
    item.factores.splice(index, 1);

    renderFactores();
    if (typeof renderItems === 'function') renderItems();
    await save();
}

function onInputFactor(input) {
    const valor = parseFloat(input.value) || 0;
    const tr = input.closest('tr');

    if (valor > 0) {
        tr.style.backgroundColor = '#e8f5e9';
    } else {
        tr.style.backgroundColor = 'transparent';
    }

    validarSumaTotal();
}