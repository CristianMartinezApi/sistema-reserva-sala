import {
  getAuth,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Função para criar helpers de auth para qualquer app Firebase
export function createAuthHelpers(app) {
  const auth = getAuth(app);
  const googleProvider = new GoogleAuthProvider();
  googleProvider.setCustomParameters({ prompt: "select_account" });

  return {
    login: (email, password) =>
      signInWithEmailAndPassword(auth, email, password),
    loginWithGoogle: () => signInWithPopup(auth, googleProvider),
    logout: () => signOut(auth),
    monitorAuthState: (callback) => {
      if (!auth) {
        console.error("❌ Auth não foi inicializado corretamente!");
        return;
      }
      onAuthStateChanged(auth, callback);
    },
  };
}
