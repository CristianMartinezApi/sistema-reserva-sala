import app from "./firebase-config.js";
import { monitorAuthState, loginWithGoogle, logout } from "./auth.js";

// Elementos do DOM
const loginModal = document.getElementById("loginModal");
const btnLoginGoogle = document.getElementById("btnLoginGoogle");
const userInfo = document.getElementById("userInfo");
const btnLogout = document.getElementById("btnLogout");
const salaLinks = document.querySelectorAll(".sala-card, a[href^='sala-']");

function setUserUI(user) {
  if (user) {
    if (userInfo) {
      const avatar = user.photoURL
        ? `<img src="${user.photoURL}" alt="avatar" style="width:32px;height:32px;border-radius:50%;margin-right:8px;vertical-align:middle;box-shadow:0 1px 4px #0002;">`
        : `<span style="display:inline-block;width:32px;height:32px;border-radius:50%;background:#667eea;color:#fff;font-weight:700;line-height:32px;text-align:center;margin-right:8px;vertical-align:middle;">${(
            user.displayName ||
            user.email ||
            "?"
          )
            .charAt(0)
            .toUpperCase()}</span>`;
      const nome = user.displayName || user.email.split("@")[0];
      const email = user.email;
      userInfo.innerHTML = `
        <div style="display:inline-flex;align-items:center;gap:8px;">
          ${avatar}
          <span style="font-weight:600;font-size:1.08em;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${email}">${nome}</span>
          <button id="btnLogout" title="Sair" style="margin-left:10px;display:inline-flex;align-items:center;gap:4px;padding:0.38rem 0.95rem;border:none;background:linear-gradient(135deg,#dc3545,#e74c3c);color:#fff;border-radius:6px;cursor:pointer;font-weight:600;font-size:1em;box-shadow:0 2px 8px #dc354522;transition:background 0.2s;">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" style="margin-right:2px;"><path d="M13.5 15L12.09 13.59L14.67 11H7V9H14.67L12.09 6.41L13.5 5L18.5 10L13.5 15ZM5 19C4.45 19 3.979 18.804 3.587 18.412C3.195 18.02 3 17.55 3 17V13H5V17H15V3H5V7H3V3C3 2.45 3.195 1.979 3.587 1.587C3.979 1.195 4.45 1 5 1H15C15.55 1 16.021 1.195 16.413 1.587C16.805 1.979 17 2.45 17 3V17C17 17.55 16.805 18.021 16.413 18.413C16.021 18.805 15.55 19 15 19H5Z" fill="#fff"/></svg>
            Sair
          </button>
        </div>
      `;
      document.getElementById("btnLogout").onclick = () => logout();
      userInfo.style.display = "block";
    }
    salaLinks.forEach((link) => (link.style.pointerEvents = "auto"));
    if (loginModal) loginModal.style.display = "none";
  } else {
    if (userInfo) userInfo.style.display = "none";
    salaLinks.forEach((link) => (link.style.pointerEvents = "none"));
    if (loginModal) loginModal.style.display = "flex";
  }
}

document.addEventListener("DOMContentLoaded", function () {
  // Inicializa UI bloqueando links
  salaLinks.forEach((link) => (link.style.pointerEvents = "none"));
  if (btnLoginGoogle) {
    btnLoginGoogle.onclick = async function () {
      try {
        await loginWithGoogle();
      } catch (e) {
        alert("Erro ao fazer login: " + (e.message || e));
      }
    };
  }
  monitorAuthState(setUserUI);
});
