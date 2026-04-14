let obras = [];
let state = obraVacia();
const STORAGE_ACTIVA = 'redeterminaciones_obraActiva'; // Definimos la constante que faltaba

function obraVacia() {
    return {
        id: Date.now(),
        fechaCreacion: new Date().toISOString().slice(0, 7),
        obra: { nombre: '', expediente: '', fecha: '', fechaApertura: '', contratista: '' },
        items: [], versiones: [], plan: [], real: [], iop: [], adecuaciones: [],
        gatillo: 10, iopBase: null, nextId: 1
    };
}

function getObraActivaId() {
    return localStorage.getItem(STORAGE_ACTIVA);
}

function setObraActivaId(id) {
    localStorage.setItem(STORAGE_ACTIVA, String(id));
}

// Función para guardar TODO en la nube (Única fuente de verdad)
async function save() {
    if (state._sinGuardar) return;
    try {
        const user = window.auth.currentUser;
        if (!user) return;
        const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");

        await setDoc(doc(window.db, 'usuarios', user.uid), {
            listaObras: obras,
            activaId: getObraActivaId(),
            ultimaEdicion: new Date().toISOString()
        });
        console.log("Sincronizado");
    } catch (e) { console.error(e); }
}

async function crearNuevaObra(datosObra) {
    const nueva = obraVacia();
    nueva.obra = { ...nueva.obra, ...datosObra };
    delete nueva._sinGuardar;

    // Asegurarse de que el array obras esté inicializado
    if (!Array.isArray(obras)) obras = [];

    obras.push(nueva);
    state = nueva;
    setObraActivaId(nueva.id);

    // 1. Guardar en la nube
    await save();

    // 2. ACTUALIZAR LA INTERFAZ (Esto es lo que falta)
    if (typeof renderSelectorObras === 'function') renderSelectorObras();
    if (typeof renderTopbarObra === 'function') renderTopbarObra();
    if (typeof renderResumen === 'function') renderResumen();

    // Si tenés una función para cerrar el modal desde aquí
    if (typeof closeModal === 'function') closeModal('modal-nueva-obra');

    return nueva;
}

function cambiarObraActiva(id) {
    const obra = obras.find(o => String(o.id) === String(id));
    if (!obra) return false;
    state = obra;
    setObraActivaId(id);
    return true;
}

async function eliminarObra(id) {
    obras = obras.filter(o => String(o.id) !== String(id));
    if (String(getObraActivaId()) === String(id)) {
        if (obras.length > 0) {
            state = obras[0];
            setObraActivaId(state.id);
        } else {
            state = obraVacia();
            state._sinGuardar = true;
        }
    }
    await save(); // Sincronizamos el borrado
    location.reload(); // Recargamos para limpiar la UI
}

async function descargarTodoDeNube() {
    // Si ya hay una obra cargada en memoria, no volvemos a descargar (evita saltos)
    if (window.obras && window.obras.length > 0) return;
    const user = window.auth.currentUser;
    if (!user) return;

    try {
        const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
        const docSnap = await getDoc(doc(window.db, 'usuarios', user.uid));

        // Forzamos que se vea la aplicación apenas detecta al usuario
        const pLogin = document.getElementById('pantalla-login');
        const pApp = document.getElementById('pantalla-app');
        if (pLogin) pLogin.style.display = 'none';
        if (pApp) pApp.style.display = 'block';

        if (docSnap.exists()) {
            const data = docSnap.data();
            obras = data.listaObras || [];
            const activaId = data.activaId;

            if (activaId) {
                state = obras.find(o => String(o.id) === String(activaId)) || obras[0];
                setObraActivaId(activaId);
            } else if (obras.length > 0) {
                state = obras[0];
                setObraActivaId(state.id);
            }

            // Refrescar UI
            if (typeof renderItems === 'function') renderItems();
            if (typeof populateItemSelects === 'function') populateItemSelects();
            if (typeof renderSelectorObras === 'function') renderSelectorObras();
            if (typeof renderTopbarObra === 'function') renderTopbarObra();
            if (typeof renderResumen === 'function') renderResumen();

            console.log("Datos descargados de la nube");
        } else {
            console.log("Usuario nuevo: sin obras en la nube.");
            state = obraVacia();
            state._sinGuardar = true;

            // Refrescar UI básica para usuario nuevo
            if (typeof renderTopbarObra === 'function') renderTopbarObra();
            if (typeof renderSelectorObras === 'function') renderSelectorObras();
        }

        // Quitar clase de carga si existe
        document.body.classList.remove('app-cargando');

    } catch (error) {
        console.error("Error al descargar:", error);
    }
}

// Listener de Auth (Se mantiene igual)
window.addEventListener('load', () => {
    if (window.auth) {
        window.auth.onAuthStateChanged((user) => {
            if (user) descargarTodoDeNube();
            else {
                obras = [];
                state = obraVacia();
                state._sinGuardar = true;
            }
        });
    }
});