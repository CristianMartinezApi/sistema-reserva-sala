import app from "./firebase-config.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// Login com email e senha
export function login(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

// Login com Google
export function loginWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

// Logout
export function logout() {
  return signOut(auth);
}

// Monitorar estado de autenticação
export function monitorAuthState(callback) {
  if (!auth) {
    console.error("❌ Auth não foi inicializado corretamente!");
    return;
  }
  onAuthStateChanged(auth, callback);
}
