import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  initializeAppCheck,
  ReCaptchaV3Provider,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app-check.js";

const firebaseConfig = {
  apiKey: "AIzaSyDMXL1Lp1XS6jAe6aPyYp1tUeqNUIvmNu0",
  authDomain: "do-sistema-de-reserva-sala.firebaseapp.com",
  projectId: "do-sistema-de-reserva-sala",
  storageBucket: "do-sistema-de-reserva-sala.appspot.com",
  messagingSenderId: "562006496984",
  appId: "1:562006496984:web:2b39a74748ccdecb0029ad",
};

const app = initializeApp(firebaseConfig);

// Inicializa App Check (opcional) se houver chave definida em meta tag
try {
  const meta =
    typeof document !== "undefined"
      ? document.querySelector('meta[name="app-check-site-key"]')
      : null;
  const siteKey = meta && meta.content ? meta.content.trim() : "";
  const disabledValues = new Set(["", "DISABLED", "disabled", "SEU_SITE_KEY"]);
  if (!disabledValues.has(siteKey)) {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
    console.log("🛡️ Firebase App Check habilitado.");
  } else {
    // Modo opcional: sem chave, não inicializa e não polui o console com warnings em dev
    console.info(
      '🛡️ App Check desativado (sem chave). Para habilitar em produção, defina <meta name="app-check-site-key" content="SUA_CHAVE_SITE"> no index.html.'
    );
  }
} catch (e) {
  console.warn("Falha ao inicializar App Check (continuando sem):", e);
}
// Removido. Usar ../firebase-config.js da raiz.
