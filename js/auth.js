import { auth } from './index.html'; // Importamos la auth que configuramos
import { GoogleAuthProvider, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const provider = new GoogleAuthProvider();

document.getElementById('btn-login').addEventListener('click', () => {
    signInWithPopup(auth, provider).then((result) => {
        // ¡Login exitoso!
        cargarDesdeFirebase();
        console.log("Usuario:", result.user.displayName);
        actualizarUI(result.user);
    });
});

function actualizarUI(user) {
    if (user) {
        document.getElementById('btn-login').style.display = 'none';
        document.getElementById('user-info').style.display = 'block';
        document.getElementById('user-name').textContent = user.displayName;
    }
}

// Detecta cuando el estado de autenticación cambia
window.auth.onAuthStateChanged((user) => {
    const loginScreen = document.getElementById('login-screen');
    const appContainer = document.getElementById('app-container');

    if (user) {
        // Usuario logueado: mostramos la app
        loginScreen.style.display = 'none';
        appContainer.style.display = 'block';
        descargarTodoDeNube(); // Esta función ya la tenés en state.js
    } else {
        // Usuario fuera: mostramos el login
        loginScreen.style.display = 'block';
        appContainer.style.display = 'none';
    }
});

// Lógica del botón (asegurate de que el ID sea 'btn-login')
document.getElementById('btn-login').addEventListener('click', () => {
    signInWithPopup(window.auth, window.googleProvider)
        .catch((error) => console.error("Error en login:", error));
});

// Importamos signInWithPopup desde el SDK de Firebase
import { signInWithPopup } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const btnLogin = document.getElementById('btn-login');
const pantallaLogin = document.getElementById('pantalla-login');
const pantallaApp = document.getElementById('pantalla-app');

// 1. Escuchar cambios de sesión
window.auth.onAuthStateChanged((user) => {
    if (user) {
        // Usuario logueado: Ocultar login, mostrar app
        pantallaLogin.style.display = 'none';
        pantallaApp.style.display = 'block';

        // Disparamos la carga de datos de Firebase
        descargarTodoDeNube();
    } else {
        // Usuario deslogueado: Mostrar login, ocultar app
        pantallaLogin.style.display = 'flex';
        pantallaApp.style.display = 'none';
    }
});

// 2. Acción del botón
btnLogin.addEventListener('click', () => {
    signInWithPopup(window.auth, window.googleProvider)
        .catch((error) => console.error("Error al loguear:", error));
});