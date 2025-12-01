import app from "../firebase-config.js";
import { monitorAuthState } from "./auth-auditorio.js";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
  deleteDoc,
  doc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  getAuth,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Inicialização do Firestore
const db = getFirestore(app);

// Função global para atualizar status de conexão
function atualizarStatusConexao(conectado) {
  if (!document.getElementById("statusConexao")) return;
  const statusDiv = document.getElementById("statusConexao");
  if (conectado) {
    statusDiv.innerHTML = "✅ Conectado ao Firebase - Dados sincronizados";
    statusDiv.style.background = "#28a745";
    setTimeout(() => {
      statusDiv.style.display = "none";
    }, 5000);
  } else {
    statusDiv.innerHTML = "❌ Erro de conexão - Verifique sua internet";
    statusDiv.style.background = "#dc3545";
    statusDiv.style.display = "block";
  }
}

// Função para deletar reserva do Auditório
async function deletarReserva(id) {
  try {
    await deleteDoc(doc(db, COLECAO_RESERVAS, id));
    mostrarMensagem("Reserva cancelada com sucesso!", "sucesso");
    // Atualiza interface após exclusão
    setTimeout(() => {
      if (typeof carregarDados === "function") carregarDados();
      else window.location.reload();
    }, 500);
  } catch (error) {
    console.error("Erro ao cancelar reserva:", error);
    mostrarMensagem("Erro ao cancelar reserva. Tente novamente.", "erro");
  }
}

// Função global de cancelamento de reserva
async function cancelarReserva(id) {
  const reserva = reservas.find((r) => r.id === id);
  if (!reserva) return;
  if (!usuarioAutenticado) {
    mostrarMensagem("Você precisa estar autenticado para cancelar.", "erro");
    return;
  }
  if (
    reserva.responsavelEmail &&
    reserva.responsavelEmail !== usuarioAutenticado.email
  ) {
    mostrarMensagem("Apenas o responsável pela reserva pode cancelar.", "erro");
    return;
  }
  const confirmar = confirm(
    `Confirmar cancelamento?\n\n` +
      `📋 Assunto: ${reserva.assunto}\n` +
      `📅 Data: ${reserva.data}\n` +
      `⏰ Horário: ${reserva.horaInicio} às ${reserva.horaFim}`
  );
  if (!confirmar) return;
  try {
    await deletarReserva(id);
  } catch (error) {}
}
window.cancelarReserva = cancelarReserva;
// Função global para mostrar mensagens do sistema
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
  let tempoBase = 6000;
  let tempoExtra = Math.min(texto.length * 50, 8000);
  let tempoTotal =
    tipo === "erro" || tipo === "aviso" ? tempoBase + tempoExtra : tempoBase;
  setTimeout(() => {
    if (mensagem.parentNode) {
      mensagem.style.animation = "slideOutRight 0.3s ease";
      setTimeout(() => mensagem.remove(), 300);
    }
  }, tempoTotal);
}

// Variáveis globais
let reservas = [];
let usuarioAutenticado = null;
let unsubscribeReservas = null;
const COLECAO_RESERVAS = "reservas_auditorio";
const CACHE_CHAVE = "reservas_auditorio";
function pad2(n) {
  return n.toString().padStart(2, "0");
}
function toISODate(d) {
  const ano = d.getFullYear();
  const mes = pad2(d.getMonth() + 1);
  const dia = pad2(d.getDate());
  return `${ano}-${mes}-${dia}`;
}
function construirMapaReservasPorDia(lista) {
  const mapa = new Map();
  for (const r of lista) {
    const chave = r.data;
    if (!mapa.has(chave)) mapa.set(chave, []);
    mapa.get(chave).push(r);
  }
  for (const [k, arr] of mapa.entries()) {
    arr.sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
  }
  return mapa;
}

let calDataAtual = new Date();
calDataAtual.setDate(1);
function atualizarTituloCalendario() {
  const titulo = document.getElementById("calTitle");
  if (!titulo) return;
  const opcoes = { month: "long", year: "numeric" };
  const texto = calDataAtual.toLocaleDateString("pt-BR", opcoes);
  titulo.textContent = texto.charAt(0).toUpperCase() + texto.slice(1);
}
function renderizarCalendario() {
  const grid = document.getElementById("calGrid");
  if (!grid) return;
  atualizarTituloCalendario();
  const hoje = new Date();
  const inicioMes = new Date(
    calDataAtual.getFullYear(),
    calDataAtual.getMonth(),
    1
  );
  const inicioGrid = new Date(inicioMes);
  inicioGrid.setDate(inicioMes.getDate() - inicioMes.getDay());
  const totalCelulas = 42;
  const mapa = construirMapaReservasPorDia(reservas);
  grid.innerHTML = "";
  for (let i = 0; i < totalCelulas; i++) {
    const diaAtual = new Date(inicioGrid);
    diaAtual.setDate(inicioGrid.getDate() + i);
    const iso = toISODate(diaAtual);
    const div = document.createElement("div");
    div.className = "cal-day";
    div.setAttribute("data-date", iso);
    if (
      diaAtual.getMonth() !== calDataAtual.getMonth() ||
      diaAtual.getFullYear() !== calDataAtual.getFullYear()
    ) {
      div.classList.add("other-month");
    }
    if (
      diaAtual.getFullYear() === hoje.getFullYear() &&
      diaAtual.getMonth() === hoje.getMonth() &&
      diaAtual.getDate() === hoje.getDate()
    ) {
      div.classList.add("today");
    }
    const numero = document.createElement("div");
    numero.className = "date-num";
    numero.textContent = diaAtual.getDate();
    div.appendChild(numero);
    const reservasDoDia = mapa.get(iso) || [];
    if (reservasDoDia.length > 0) {
      div.classList.add("has-reserva");
      const dots = document.createElement("div");
      dots.className = "dots";
      const count = Math.min(reservasDoDia.length, 3);
      for (let j = 0; j < count; j++) {
        const d = document.createElement("span");
        d.className = "dot";
        d.title = `${reservasDoDia[j].horaInicio}–${reservasDoDia[j].horaFim} ${reservasDoDia[j].assunto}`;
        dots.appendChild(d);
      }
      div.appendChild(dots);
      if (reservasDoDia.length > 3) {
        const badge = document.createElement("span");
        badge.className = "count-badge";
        badge.textContent = `+${reservasDoDia.length - 3}`;
        div.appendChild(badge);
      }
    }
    div.addEventListener("click", () => {
      const todosDias = grid.querySelectorAll(".cal-day");
      todosDias.forEach((d) => d.classList.remove("selected"));
      div.classList.add("selected");
      const inputData = document.getElementById("consultaData");
      if (inputData) inputData.value = iso;
      mostrarReservasDoDia(iso);
      const resultado = document.getElementById("resultadoConsulta");
      if (resultado && typeof resultado.scrollIntoView === "function") {
        resultado.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
    grid.appendChild(div);
  }
}
function renderizarReservas() {
  const lista = document.getElementById("listaReservas");
  const contador = document.getElementById("contadorReservas");
  if (!lista || !contador) return;
  if (reservas.length === 0) {
    lista.innerHTML =
      '<div class="no-reservas">Nenhuma reserva agendada. Faça a primeira reserva! 🎯</div>';
    contador.textContent = "0 reservas";
    return;
  }
  const hojeISO = toISODate(new Date());
  const reservasFuturas = reservas
    .filter((reserva) => {
      const resultado = reserva.data >= hojeISO;
      return resultado;
    })
    .sort((a, b) => {
      const dataA = new Date(a.data + "T" + a.horaInicio);
      const dataB = new Date(b.data + "T" + b.horaInicio);
      return dataA - dataB;
    });
  contador.textContent = `${reservasFuturas.length} reserva${
    reservasFuturas.length !== 1 ? "s" : ""
  }`;
  if (reservasFuturas.length === 0) {
    lista.innerHTML =
      '<div class="no-reservas">Nenhuma reserva futura encontrada. 📅</div>';
    return;
  }
  lista.innerHTML = reservasFuturas
    .map(
      (reserva) => `
              <div class="reserva-item">
                      <div class="calendar-icon-container">
                          📅
                      </div>
                      <div class="reserva-info">
                          <h3>${reserva.assunto}</h3>
                          <p><strong>👤 Responsável:</strong> ${
                            reserva.responsavel
                          }</p>
                          <p><strong>📅 Data:</strong> ${reserva.data}</p>
                          <p><strong>⏰ Horário:</strong> ${
                            reserva.horaInicio
                          } às ${reserva.horaFim}</p>
                          ${
                            reserva.observacoes
                              ? `<p><strong>📝 Observações:</strong> ${reserva.observacoes}</p>`
                              : ""
                          }
                          <p><strong>🔒 Cancelamento:</strong> <span style="color: #28a745;">Apenas o responsável autenticado</span></p>
                      </div>
                      <div class="reserva-actions">
                          <span class="horario-badge">${reserva.horaInicio} - ${
        reserva.horaFim
      }</span>
                          <button class="btn-danger" onclick="cancelarReserva('${
                            reserva.id
                          }')">
                              🗑️ Cancelar
                          </button>
                      </div>
              </div>
          `
    )
    .join("");
}
function verificarStatusAtual() {
  const statusDiv = document.getElementById("statusAtual");
  if (!statusDiv) return;
  const agora = new Date();
  const dataHoje = agora.toISOString().split("T")[0];
  const horaAtual = agora.toTimeString().split(" ")[0].substring(0, 5);
  const reservaAtual = reservas.find((reserva) => {
    return (
      reserva.data === dataHoje &&
      reserva.horaInicio <= horaAtual &&
      reserva.horaFim > horaAtual
    );
  });
  if (reservaAtual) {
    statusDiv.className = "status-atual status-ocupada";
    statusDiv.innerHTML = `
          <div class="status-icon">🔴</div>
          <h2>Sala Ocupada</h2>
          <p><strong>Reunião:</strong> ${reservaAtual.assunto}</p>
          <p><strong>Responsável:</strong> ${reservaAtual.responsavel}</p>
          <p><strong>Até às:</strong> ${reservaAtual.horaFim}</p>
      `;
  } else {
    const proximaReserva = reservas
      .filter((r) => r.data === dataHoje && r.horaInicio > horaAtual)
      .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio))[0];
    statusDiv.className = "status-atual status-livre";
    if (proximaReserva) {
      statusDiv.innerHTML = `
              <div class="status-icon">🟢</div>
              <h2>Sala Disponível</h2>
              <p>Próxima reunião às ${proximaReserva.horaInicio}</p>
              <p><em>${proximaReserva.assunto}</em></p>
          `;
    } else {
      statusDiv.innerHTML = `
              <div class="status-icon">🟢</div>
              <h2>Sala Disponível</h2>
              <p>Nenhuma reunião agendada para hoje</p>
              <p><em>Você pode reservar agora!</em></p>
          `;
    }
  }
}

function atualizarInterface() {
  if (document.getElementById("statusAtual")) {
    verificarStatusAtual();
  }
  if (document.getElementById("listaReservas")) {
    renderizarReservas();
  }
  if (document.getElementById("calGrid")) {
    renderizarCalendario();
  }
}

monitorAuthState((user) => {
  usuarioAutenticado = user;
  if (user) {
    carregarReservasDoCache();
    if (!unsubscribeReservas) carregarDados();
    if (typeof window.toggleNovaReserva === "function") {
      window.toggleNovaReserva(usuarioAutenticado?.email);
    }
    if (typeof window.hidePageLoader === "function") window.hidePageLoader();
  } else {
    usuarioAutenticado = null;
    if (typeof window.toggleNovaReserva === "function") {
      window.toggleNovaReserva(null);
    }
    if (typeof unsubscribeReservas === "function") {
      try {
        unsubscribeReservas();
      } catch (_) {}
      unsubscribeReservas = null;
    }
    reservas = [];
    atualizarInterface();
    window.location.href = "/index.html";
  }
});
// ...código existente...
// Função para validar dados da reserva (igual CEST)
function validarDadosReserva(reservaData) {
  const erros = [];
  if (!reservaData.responsavel || reservaData.responsavel.trim().length < 2) {
    erros.push("Nome do responsável deve ter pelo menos 2 caracteres");
  }
  const agora = new Date();
  const dataReserva = new Date(reservaData.data + "T" + reservaData.horaInicio);
  const margemMinutos = 30 * 60 * 1000;
  if (dataReserva.getTime() <= agora.getTime() + margemMinutos) {
    const minutosRestantes = Math.ceil(
      (dataReserva.getTime() - agora.getTime()) / (60 * 1000)
    );
    if (minutosRestantes <= 0) {
      erros.push("Não é possível fazer reservas para horários que já passaram");
    } else {
      erros.push(
        `Reservas devem ser feitas com pelo menos 30 minutos de antecedência (faltam ${minutosRestantes} min)`
      );
    }
  }
  if (reservaData.horaInicio >= reservaData.horaFim) {
    erros.push("Horário de início deve ser anterior ao horário de fim");
  }
  const horaInicioNum = parseInt(reservaData.horaInicio.replace(":", ""));
  const horaFimNum = parseInt(reservaData.horaFim.replace(":", ""));
  if (horaInicioNum < 600 || horaFimNum > 2200) {
    erros.push("Horário de funcionamento: 06:00 às 22:00");
  }
  if (!reservaData.assunto || reservaData.assunto.trim().length < 3) {
    erros.push("Assunto deve ter pelo menos 3 caracteres");
  }
  const duracao = (horaFimNum - horaInicioNum) / 100;
  if (duracao > 8) {
    erros.push("Duração máxima da reserva: 8 horas");
  }
  return erros;
}

// Função para adicionar reserva (igual CEST)
async function adicionarReserva(reservaData) {
  let docRef = null;
  try {
    const erros = validarDadosReserva(reservaData);
    if (erros.length > 0) {
      throw new Error(erros.join("\n"));
    }
    const dadosLimpos = sanitizarDados(reservaData);
    const btnReservar = document.getElementById("btnReservar");
    if (btnReservar) {
      btnReservar.textContent = "⏳ Salvando...";
      btnReservar.disabled = true;
    }
    const reservaComTimestamp = {
      ...dadosLimpos,
      criadaEm: serverTimestamp(),
      ip: "N/A",
      userAgent: navigator.userAgent.substring(0, 200),
    };
    docRef = await addDoc(
      collection(db, COLECAO_RESERVAS),
      reservaComTimestamp
    );
    if (!docRef || !docRef.id) {
      throw new Error(
        "[ERRO] addDoc não retornou ID. Reserva pode não ter sido salva."
      );
    }
    atualizarInterface();
    mostrarMensagem("Reserva realizada com sucesso! 🎉", "sucesso");
    mostrarModalConfirmacao(dadosLimpos);
    return docRef.id;
  } catch (error) {
    mostrarMensagem(
      (error && error.message) || "Erro ao salvar reserva.",
      "erro"
    );
    throw error;
  } finally {
    const btnReservar = document.getElementById("btnReservar");
    if (btnReservar) {
      btnReservar.textContent = "✅ Reservar Sala";
      btnReservar.disabled = false;
    }
  }
}

// Modal de confirmação (igual CEST)
function mostrarModalConfirmacao(dadosReserva) {
  const antigo = document.getElementById("modalConfirmacaoReserva");
  if (antigo) antigo.remove();
  const overlay = document.createElement("div");
  overlay.id = "modalConfirmacaoReserva";
  overlay.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
      `;
  const card = document.createElement("div");
  card.style.cssText = `
        width: min(520px, 92vw);
        background: linear-gradient(180deg, rgba(232,245,233,0.95), rgba(255,255,255,0.95));
        border: 1px solid #28a745;
        border-radius: 12px;
        padding: 20px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.25);
        animation: slideInRight 0.25s ease;
      `;
  card.innerHTML = `
        <div style="background:#e8f5e9;border:2px solid #28a745;padding:12px;border-radius:8px;text-align:center;color:#155724;margin-bottom:12px;">
          <strong>✔ Sua reserva foi registrada.</strong><br>
          <small>Cancelamento: apenas pelo responsável autenticado.</small>
        </div>
        <div style="display:grid;gap:8px;margin:12px 0;color:#1b1e22;">
          <div><strong>📅 Data:</strong> ${dadosReserva.data}</div>
          <div><strong>⏰ Horário:</strong> ${dadosReserva.horaInicio} às ${dadosReserva.horaFim}</div>
          <div><strong>👤 Responsável:</strong> ${dadosReserva.responsavel}</div>
          <div><strong>📝 Assunto:</strong> ${dadosReserva.assunto}</div>
        </div>
        <div style="display:flex;gap:10px;justify-content:center;margin-top:10px;">
          <button id="btnFecharConfirmacao" style="background:#28a745;color:#fff;border:none;border-radius:8px;padding:10px 18px;font-weight:600;cursor:pointer;">✅ Entendi</button>
        </div>
      `;
  overlay.appendChild(card);
  document.body.appendChild(overlay);
  document.body.style.overflow = "hidden";
  const fechar = () => fecharModalConfirmacao();
  card.querySelector("#btnFecharConfirmacao").addEventListener("click", fechar);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) fechar();
  });
  const onEsc = (e) => {
    if (e.key === "Escape") fechar();
  };
  window.addEventListener("keydown", onEsc, { once: true });
}
function fecharModalConfirmacao() {
  const overlay = document.getElementById("modalConfirmacaoReserva");
  if (!overlay) return;
  overlay.style.animation = "fadeOut 0.2s ease";
  setTimeout(() => {
    overlay.remove();
    document.body.style.overflow = "auto";
  }, 200);
}
window.fecharModalConfirmacao = fecharModalConfirmacao;

// Lógica de submit do formulário de reserva (igual CEST)
document.addEventListener("DOMContentLoaded", function () {
  const reservaForm = document.getElementById("reservaForm");
  if (reservaForm) {
    reservaForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      if (!usuarioAutenticado) {
        window.location.href = "/index.html";
        return;
      }
      // Restringe reserva apenas ao e-mail autorizado
      const responsavelEmail = usuarioAutenticado.email;
      const emailAutorizado = "cristianmartinez@pge.sc.gov.br";
      if (responsavelEmail.toLowerCase() !== emailAutorizado) {
        mostrarMensagem(
          "Nesta sala, apenas pessoas autorizadas podem fazer reservas.\n" +
            "\nPara solicitar agendamento, entre em contato com o setor responsável:\n" +
            "Email: eppe@pge.sc.gov.br\n" +
            "Telefone: (48) 3664-5938",
          "erro"
        );
        return;
      }
      const responsavelNome =
        usuarioAutenticado.displayName || responsavelEmail.split("@")[0];
      const data = document.getElementById("data").value;
      const horaInicio = document.getElementById("horaInicio").value;
      const horaFim = document.getElementById("horaFim").value;
      const assunto = document.getElementById("assunto").value.trim();
      const observacoes = document.getElementById("observacoes").value.trim();
      const novaReserva = {
        responsavel: responsavelNome,
        responsavelEmail,
        data,
        horaInicio,
        horaFim,
        assunto,
        observacoes: observacoes || null,
      };
      try {
        await adicionarReserva(novaReserva);
        this.reset();
        if (document.getElementById("responsavel")) {
          document.getElementById("responsavel").value = responsavelNome;
        }
      } catch (error) {}
    });
  }
});

function sanitizarDados(reservaData) {
  // Removido bloco duplicado de declaração de 'base'.
  const base = {
    responsavel: (reservaData.responsavel || "").trim().substring(0, 100),
    data: reservaData.data,
    horaInicio: reservaData.horaInicio,
    horaFim: reservaData.horaFim,
    assunto: reservaData.assunto.trim().substring(0, 200),
    observacoes: reservaData.observacoes
      ? reservaData.observacoes.trim().substring(0, 500)
      : null,
  };
  if (reservaData.responsavelEmail) {
    base.responsavelEmail = reservaData.responsavelEmail.trim();
  }
  if (reservaData.responsavelNome) {
    base.responsavelNome = reservaData.responsavelNome.trim().substring(0, 100);
  }
  return base;
}

function carregarReservasDoCache() {
  try {
    const raw = localStorage.getItem(CACHE_CHAVE);
    let loaded = false;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        reservas = parsed;
        loaded = true;
      }
    }
    atualizarInterface();
    setTimeout(() => {
      if (typeof window.hidePageLoader === "function") {
        window.hidePageLoader();
      } else {
        console.warn("window.hidePageLoader não está definida!");
      }
    }, 50);
    return loaded;
  } catch (e) {
    atualizarInterface();
    if (typeof window.hidePageLoader === "function") window.hidePageLoader();
    return false;
  }
}

function carregarDados() {
  let q;
  try {
    q = query(
      collection(db, COLECAO_RESERVAS),
      orderBy("data", "asc"),
      orderBy("horaInicio", "asc")
    );
    if (typeof unsubscribeReservas === "function") {
      try {
        unsubscribeReservas();
      } catch (e) {}
      unsubscribeReservas = null;
    }
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const docs = [];
        snapshot.forEach((doc) => {
          docs.push({ id: doc.id, ...doc.data() });
        });
        reservas = docs;
        try {
          localStorage.setItem(CACHE_CHAVE, JSON.stringify(reservas));
        } catch (e) {}
        atualizarStatusConexao(true);
        atualizarInterface();
        setTimeout(() => {
          if (typeof window.hidePageLoader === "function") {
            window.hidePageLoader();
          } else {
            console.warn("window.hidePageLoader não está definida!");
          }
        }, 50);
      },
      (error) => {
        console.error("[DEBUG] Erro no onSnapshot:", error);
        atualizarStatusConexao(false);
        if (typeof window.hidePageLoader === "function")
          window.hidePageLoader();
      }
    );
    unsubscribeReservas = unsub;
    return unsub;
  } catch (error) {
    atualizarStatusConexao(false);
    if (typeof window.hidePageLoader === "function") {
      window.hidePageLoader();
    }
  }

  function renderizarReservas() {
    const lista = document.getElementById("listaReservas");
    const contador = document.getElementById("contadorReservas");
    if (!lista || !contador) return;
    if (reservas.length === 0) {
      lista.innerHTML =
        '<div class="no-reservas">Nenhuma reserva agendada. Faça a primeira reserva! 🎯</div>';
      contador.textContent = "0 reservas";
      return;
    }
    const agora = new Date();
    const reservasFuturas = reservas
      .filter((reserva) => {
        const dataReserva = new Date(reserva.data + "T" + reserva.horaFim);
        return dataReserva > agora;
      })
      .sort((a, b) => {
        const dataA = new Date(a.data + "T" + a.horaInicio);
        const dataB = new Date(b.data + "T" + b.horaInicio);
        return dataA - dataB;
      });
    contador.textContent = `${reservasFuturas.length} reserva${
      reservasFuturas.length !== 1 ? "s" : ""
    }`;
    if (reservasFuturas.length === 0) {
      lista.innerHTML =
        '<div class="no-reservas">Nenhuma reserva futura encontrada. 📅</div>';
      return;
    }
    lista.innerHTML = reservasFuturas
      .map(
        (reserva) => `
                <div class="reserva-item">
                        <div class="calendar-icon-container">
                            📅
                        </div>
                        <div class="reserva-info">
                            <h3>${reserva.assunto}</h3>
                            <p><strong>👤 Responsável:</strong> ${
                              reserva.responsavel
                            }</p>
                            <p><strong>📅 Data:</strong> ${reserva.data}</p>
                            <p><strong>⏰ Horário:</strong> ${
                              reserva.horaInicio
                            } às ${reserva.horaFim}</p>
                            ${
                              reserva.observacoes
                                ? `<p><strong>📝 Observações:</strong> ${reserva.observacoes}</p>`
                                : ""
                            }
                            <p><strong>🔒 Cancelamento:</strong> <span style="color: #28a745;">Apenas o responsável autenticado</span></p>
                        </div>
                        <div class="reserva-actions">
                            <span class="horario-badge">${
                              reserva.horaInicio
                            } - ${reserva.horaFim}</span>
                            <button class="btn-danger" onclick="cancelarReserva('${
                              reserva.id
                            }')">
                                🗑️ Cancelar
                            </button>
                        </div>
                </div>
            `
      )
      .join("");
  }

  let calDataAtual = new Date();
  calDataAtual.setDate(1);

  function pad2(n) {
    return n.toString().padStart(2, "0");
  }

  function toISODate(d) {
    const ano = d.getFullYear();
    const mes = pad2(d.getMonth() + 1);
    const dia = pad2(d.getDate());
    return `${ano}-${mes}-${dia}`;
  }

  function construirMapaReservasPorDia(lista) {
    const mapa = new Map();
    for (const r of lista) {
      const chave = r.data;
      if (!mapa.has(chave)) mapa.set(chave, []);
      mapa.get(chave).push(r);
    }
    for (const [k, arr] of mapa.entries()) {
      arr.sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
    }
    return mapa;
  }

  function atualizarTituloCalendario() {
    const titulo = document.getElementById("calTitle");
    if (!titulo) return;
    const opcoes = { month: "long", year: "numeric" };
    const texto = calDataAtual.toLocaleDateString("pt-BR", opcoes);
    titulo.textContent = texto.charAt(0).toUpperCase() + texto.slice(1);
  }

  function renderizarCalendario() {
    const grid = document.getElementById("calGrid");
    if (!grid) return;
    atualizarTituloCalendario();
    const hoje = new Date();
    const inicioMes = new Date(
      calDataAtual.getFullYear(),
      calDataAtual.getMonth(),
      1
    );
    const inicioGrid = new Date(inicioMes);
    inicioGrid.setDate(inicioMes.getDate() - inicioMes.getDay());
    const totalCelulas = 42;
    const mapa = construirMapaReservasPorDia(reservas);
    grid.innerHTML = "";
    for (let i = 0; i < totalCelulas; i++) {
      const diaAtual = new Date(inicioGrid);
      diaAtual.setDate(inicioGrid.getDate() + i);
      const iso = toISODate(diaAtual);
      const div = document.createElement("div");
      div.className = "cal-day";
      div.setAttribute("data-date", iso);
      if (
        diaAtual.getMonth() !== calDataAtual.getMonth() ||
        diaAtual.getFullYear() !== calDataAtual.getFullYear()
      ) {
        div.classList.add("other-month");
      }
      if (
        diaAtual.getFullYear() === hoje.getFullYear() &&
        diaAtual.getMonth() === hoje.getMonth() &&
        diaAtual.getDate() === hoje.getDate()
      ) {
        div.classList.add("today");
      }
      const numero = document.createElement("div");
      numero.className = "date-num";
      numero.textContent = diaAtual.getDate();
      div.appendChild(numero);
      const reservasDoDia = mapa.get(iso) || [];
      if (reservasDoDia.length > 0) {
        div.classList.add("has-reserva");
        const dots = document.createElement("div");
        dots.className = "dots";
        const count = Math.min(reservasDoDia.length, 3);
        for (let j = 0; j < count; j++) {
          const d = document.createElement("span");
          d.className = "dot";
          d.title = `${reservasDoDia[j].horaInicio}–${reservasDoDia[j].horaFim} ${reservasDoDia[j].assunto}`;
          dots.appendChild(d);
        }
        div.appendChild(dots);
        if (reservasDoDia.length > 3) {
          const badge = document.createElement("span");
          badge.className = "count-badge";
          badge.textContent = `+${reservasDoDia.length - 3}`;
          div.appendChild(badge);
        }
      }
      div.addEventListener("click", () => {
        const todosDias = grid.querySelectorAll(".cal-day");
        todosDias.forEach((d) => d.classList.remove("selected"));
        div.classList.add("selected");
        const inputData = document.getElementById("consultaData");
        if (inputData) inputData.value = iso;
        mostrarReservasDoDia(iso);
        const resultado = document.getElementById("resultadoConsulta");
        if (resultado && typeof resultado.scrollIntoView === "function") {
          resultado.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
      grid.appendChild(div);
    }
  }

  function mostrarReservasDoDia(dataISO) {
    const resultado = document.getElementById("resultadoConsulta");
    if (!resultado) return;
    const reservasDoDia = reservas
      .filter((r) => r.data === dataISO)
      .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
    if (reservasDoDia.length === 0) {
      resultado.innerHTML = `
              <div class="consulta-result disponivel">
                  ✅ <strong>Dia totalmente livre!</strong><br>
                  <small>📅 ${dataISO}</small><br>
                  <small>🎯 Perfeito para agendar sua reunião!</small>
              </div>
          `;
    } else {
      const lista = reservasDoDia
        .map(
          (r) =>
            `<div class="conflito-item">⏰ ${r.horaInicio} às ${r.horaFim} - ${r.assunto}</div>`
        )
        .join("");
      resultado.innerHTML = `
              <div class="consulta-result ocupada">
                  📅 <strong>Reservas do dia:</strong>
                  <div class="conflito-lista">${lista}</div>
              </div>
          `;
    }
  }

  // Eventos para navegação do calendário e render inicial
  document.addEventListener("DOMContentLoaded", function () {
    setTimeout(() => {
      if (document.getElementById("statusAtual")) {
        setInterval(verificarStatusAtual, 60000);
      }
    }, 100);
    const btnPrev = document.getElementById("calPrev");
    const btnNext = document.getElementById("calNext");
    if (btnPrev && btnNext) {
      btnPrev.addEventListener("click", () => {
        calDataAtual.setMonth(calDataAtual.getMonth() - 1);
        renderizarCalendario();
      });
      btnNext.addEventListener("click", () => {
        calDataAtual.setMonth(calDataAtual.getMonth() + 1);
        renderizarCalendario();
      });
      renderizarCalendario();
    }
  });
}
