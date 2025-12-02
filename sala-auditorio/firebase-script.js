import {
  addDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
// Função para mostrar mensagem de sistema
function mostrarMensagem(texto, tipo = "info") {
  const mensagemAnterior = document.querySelector(".mensagem-sistema");
  if (mensagemAnterior) mensagemAnterior.remove();
  const mensagem = document.createElement("div");
  mensagem.className = `mensagem-sistema ${tipo}`;
  mensagem.textContent = texto;
  mensagem.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 1rem 1.5rem;
    border-radius: 8px;
    color: white;
    font-weight: 600;
    z-index: 1000;
    max-width: 350px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    animation: slideInRight 0.3s ease;
    cursor: pointer;
  `;
  mensagem.title = "Clique para fechar";
  mensagem.addEventListener("click", () => {
    mensagem.style.animation = "slideOutRight 0.3s ease";
    setTimeout(() => mensagem.remove(), 300);
  });
  switch (tipo) {
    case "sucesso":
      mensagem.style.background = "linear-gradient(135deg, #28a745, #20c997)";
      break;
    case "erro":
      mensagem.style.background = "linear-gradient(135deg, #dc3545, #e74c3c)";
      break;
    case "aviso":
      mensagem.style.background = "linear-gradient(135deg, #ffc107, #f39c12)";
      mensagem.style.color = "#000";
      break;
    default:
      mensagem.style.background = "linear-gradient(135deg, #17a2b8, #3498db)";
  }
  document.body.appendChild(mensagem);
  setTimeout(() => {
    if (mensagem.parentNode) {
      mensagem.style.animation = "slideOutRight 0.3s ease";
      setTimeout(() => mensagem.remove(), 300);
    }
  }, 6000);
}
// Handler de submit do formulário de reserva
document.addEventListener("DOMContentLoaded", function () {
  const reservaForm = document.getElementById("reservaForm");
  if (reservaForm) {
    reservaForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      if (!window.usuarioAutenticado) {
        mostrarMensagem(
          "Você precisa estar autenticado para reservar.",
          "erro"
        );
        return;
      }
      const responsavelNome =
        window.usuarioAutenticado.displayName ||
        (window.usuarioAutenticado.email
          ? window.usuarioAutenticado.email.split("@")[0]
          : "");
      const responsavelEmail = window.usuarioAutenticado.email;
      const data = document.getElementById("data").value;
      const horaInicio = document.getElementById("horaInicio").value;
      const horaFim = document.getElementById("horaFim").value;
      const assunto = document.getElementById("assunto").value.trim();
      const observacoes = document.getElementById("observacoes").value.trim();
      if (!data || !horaInicio || !horaFim || !assunto) {
        mostrarMensagem("Preencha todos os campos obrigatórios.", "aviso");
        return;
      }
      try {
        const db = getFirestore(app);
        const reserva = {
          salaId: SALA_ID,
          responsavel: responsavelNome,
          responsavelEmail,
          data,
          horaInicio,
          horaFim,
          assunto,
          observacoes: observacoes || null,
          criadaEm: serverTimestamp(),
        };
        await addDoc(collection(db, "reservas"), reserva);
        mostrarMensagem("Reserva realizada com sucesso! 🎉", "sucesso");
        reservaForm.reset();
        if (document.getElementById("responsavel")) {
          document.getElementById("responsavel").value = responsavelNome;
        }
      } catch (error) {
        mostrarMensagem(error.message || "Erro ao salvar reserva.", "erro");
      }
    });
  }
});
import app from "../firebase-config.js";
import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const SALA_ID = "auditorio";

let unsubscribeReservas = null;
let usuarioAutenticado = null;

function atualizarStatusConectado(email) {
  const statusAtual = document.getElementById("statusAtual");
  if (statusAtual) {
    statusAtual.innerHTML = `
      <div class="status-icon">
        <i data-lucide="check-circle" color="#28a745" style="width: 1.2em; height: 1.2em"></i>
      </div>
      <h2>Conectado</h2>
      <p>Bem-vindo${email ? ", " + email : ""}!</p>
    `;
    if (window.lucide) lucide.createIcons();
  }
}

function atualizarUserGreeting(email) {
  const el = document.getElementById("userGreeting");
  if (el) {
    let nome = "";
    if (usuarioAutenticado) {
      nome =
        usuarioAutenticado.displayName ||
        (usuarioAutenticado.email
          ? usuarioAutenticado.email.split("@")[0]
          : "");
    } else if (email) {
      nome = email.split("@")[0];
    }
    el.textContent = nome ? `Usuário: ${nome}` : "";
  }
  window.toggleNovaReserva && window.toggleNovaReserva(email);
}

function hideLoaderIfReady() {
  if (window.hidePageLoader) window.hidePageLoader();
}

function listenAuthAndReservas() {
  const auth = getAuth(app);
  onAuthStateChanged(auth, (user) => {
    window.usuarioAutenticado = user;
    let nome = "";
    let email = null;
    if (user) {
      email = user.email || null;
      nome = user.displayName || (email ? email.split("@")[0] : "");
    }
    atualizarStatusConectado(nome);
    atualizarUserGreeting(email);
    // Listen to reservas if authenticated
    if (unsubscribeReservas) unsubscribeReservas();
    if (user) {
      const db = getFirestore(app);
      // Query: apenas filtro por salaId, ordenação por data/horaInicio
      const q = query(
        collection(db, "reservas"),
        where("salaId", "==", SALA_ID),
        orderBy("data"),
        orderBy("horaInicio")
      );
      unsubscribeReservas = onSnapshot(q, (snap) => {
        const reservas = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        if (window.atualizarReservasInterface) {
          window.atualizarReservasInterface(reservas);
        }
        hideLoaderIfReady();
      });
    } else {
      if (window.atualizarReservasInterface) {
        window.atualizarReservasInterface([]);
      }
      hideLoaderIfReady();
    }
  });
}

// Start listeners on DOMContentLoaded
document.addEventListener("DOMContentLoaded", () => {
  listenAuthAndReservas();
});
