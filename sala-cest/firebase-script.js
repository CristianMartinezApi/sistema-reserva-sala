// Função utilitária global para checar existência de elemento no DOM
function elementoExiste(id) {
  return !!document.getElementById(id);
}
// Importa interface compartilhada para calendário, reservas e funções globais
import "../interface-sala.js";
// Dummy logSeguranca para evitar erro caso não esteja implementado
function logSeguranca(evento, dados) {
  // Você pode implementar logging real aqui, se desejar
  if (window && window.console) {
    console.log(`[LOG-SEGURANCA] ${evento}`, dados || "");
  }
}
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

const SALA_ID = "cest";

let unsubscribeReservas = null;
let usuarioAutenticado = null;

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
    usuarioAutenticado = user;
    let nome = "";
    let email = null;
    if (user) {
      email = user.email || null;
      nome = user.displayName || (email ? email.split("@")[0] : "");
    }
    // Removido: status da sala é atualizado por interface-sala.js
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
  // Garante que o status da sala seja atualizado mesmo sem reservas
  if (window.atualizarStatusSala) {
    window.atualizarStatusSala([]);
  }
});

function mostrarModalConfirmacao(dadosReserva) {
  // Remove modal anterior, se existir
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
      <div><strong>📅 Data:</strong> ${formatarData(dadosReserva.data)}</div>
      <div><strong>⏰ Horário:</strong> ${dadosReserva.horaInicio} às ${
    dadosReserva.horaFim
  }</div>
      <div><strong>🧑‍💼 Responsável:</strong> ${dadosReserva.responsavel}</div>
      <div><strong>📝 Assunto:</strong> ${dadosReserva.assunto}</div>
    </div>
    <div style="display:flex;gap:10px;justify-content:center;margin-top:10px;">
      <button id="btnFecharConfirmacao" style="background:#28a745;color:#fff;border:none;border-radius:8px;padding:10px 18px;font-weight:600;cursor:pointer;">✅ Entendi</button>
    </div>
  `;

  overlay.appendChild(card);
  document.body.appendChild(overlay);
  document.body.style.overflow = "hidden";

  // Fechar: botão, clique fora e ESC
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

// expõe para o HTML inline (caso existente)
window.fecharModalConfirmacao = fecharModalConfirmacao;

function formatarData(data) {
  return new Date(data + "T00:00:00").toLocaleDateString("pt-BR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// Calendário visual mensal

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
  const mapa = new Map(); // key: YYYY-MM-DD -> array de reservas
  for (const r of lista) {
    const chave = r.data; // já está em YYYY-MM-DD
    if (!mapa.has(chave)) mapa.set(chave, []);
    mapa.get(chave).push(r);
  }
  // Ordena por hora de início para visual mais consistente
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
  // Capitaliza a primeira letra do mês (alguns navegadores já fazem)
  titulo.textContent = texto.charAt(0).toUpperCase() + texto.slice(1);
}

function renderizarCalendario() {
  const grid = document.getElementById("calGrid");
  if (!grid) return; // Calendário não está na página

  atualizarTituloCalendario();

  const hoje = new Date();
  const inicioMes = new Date(
    calDataAtual.getFullYear(),
    calDataAtual.getMonth(),
    1
  );
  const fimMes = new Date(
    calDataAtual.getFullYear(),
    calDataAtual.getMonth() + 1,
    0
  );

  // Começar no domingo da semana do primeiro dia do mês
  const inicioGrid = new Date(inicioMes);
  inicioGrid.setDate(inicioMes.getDate() - inicioMes.getDay()); // getDay(): 0=Dom ... 6=Sáb

  // Terminamos no sábado da última semana a ser exibida (6 semanas = 42 dias)
  const totalCelulas = 42;

  // Mapa de reservas por dia
  const mapa = construirMapaReservasPorDia(reservas);

  // Limpa grid
  grid.innerHTML = "";

  for (let i = 0; i < totalCelulas; i++) {
    const diaAtual = new Date(inicioGrid);
    diaAtual.setDate(inicioGrid.getDate() + i);
    const iso = toISODate(diaAtual);

    const div = document.createElement("div");
    div.className = "cal-day";
    div.setAttribute("data-date", iso);

    // Outro mês
    if (
      diaAtual.getMonth() !== calDataAtual.getMonth() ||
      diaAtual.getFullYear() !== calDataAtual.getFullYear()
    ) {
      div.classList.add("other-month");
    }

    // Hoje
    if (
      diaAtual.getFullYear() === hoje.getFullYear() &&
      diaAtual.getMonth() === hoje.getMonth() &&
      diaAtual.getDate() === hoje.getDate()
    ) {
      div.classList.add("today");
    }

    // Cabeçalho com número do dia
    const numero = document.createElement("div");
    numero.className = "date-num";
    numero.textContent = diaAtual.getDate();
    div.appendChild(numero);

    // Indicadores de reservas
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

    // Clique no dia: seleciona data e mostra reservas do dia
    div.addEventListener("click", () => {
      // Remove a classe 'selected' de todos os dias
      const todosDias = grid.querySelectorAll(".cal-day");
      todosDias.forEach((d) => d.classList.remove("selected"));

      // Adiciona a classe 'selected' ao dia clicado
      div.classList.add("selected");

      // Se o input existir (cenário antigo), atualiza. Mas mostramos sempre o resultado.
      const inputData = document.getElementById("consultaData");
      if (inputData) inputData.value = iso;

      mostrarReservasDoDia(iso);

      // Foco suave na área de resultado
      const resultado = document.getElementById("resultadoConsulta");
      if (resultado && typeof resultado.scrollIntoView === "function") {
        resultado.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });

    grid.appendChild(div);
  }
}

function mostrarReservasDoDia(dataISO) {
  if (!elementoExiste("resultadoConsulta")) return;
  const resultado = document.getElementById("resultadoConsulta");
  const reservasDoDia = reservas
    .filter((r) => r.data === dataISO)
    .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));

  if (reservasDoDia.length === 0) {
    resultado.innerHTML = `
      <div class="consulta-result disponivel">
        ✅ <strong>Dia totalmente livre!</strong><br>
        <small>📅 ${formatarData(dataISO)}</small><br>
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

function verificarConflito(data, horaInicio, horaFim, excludeId = null) {
  return reservas.filter((reserva) => {
    if (excludeId && reserva.id === excludeId) return false;
    if (reserva.data !== data) return false;
    // NOVO: Verifica conflito apenas para a mesma sala
    if (salaAtual && reserva.salaId && reserva.salaId !== salaAtual.id)
      return false;
    return horaInicio < reserva.horaFim && horaFim > reserva.horaInicio;
  });
}

// Função para criar ícone de calendário SVG com data dinâmica
function criarIconeCalendario(dataString) {
  const data = new Date(dataString + "T00:00:00");
  const dia = data.getDate();
  const mes = data
    .toLocaleDateString("pt-BR", { month: "short" })
    .toUpperCase()
    .replace(".", "");

  return `
    <svg class="calendar-icon" width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
      <!-- Fundo do calendário -->
      <rect x="5" y="10" width="50" height="45" rx="4" fill="#fff" stroke="#667eea" stroke-width="2"/>
      
      <!-- Cabeçalho vermelho -->
      <rect x="5" y="10" width="50" height="15" rx="4" fill="#dc3545"/>
      <rect x="5" y="20" width="50" height="5" fill="#dc3545"/>
      
      <!-- Argolas do calendário -->
      <circle cx="15" cy="12" r="2" fill="#fff"/>
      <circle cx="30" cy="12" r="2" fill="#fff"/>
      <circle cx="45" cy="12" r="2" fill="#fff"/>
      
      <!-- Dia (grande) -->
      <text x="30" y="43" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#333" text-anchor="middle">${dia}</text>
      
      <!-- Mês (pequeno) -->
      <text x="30" y="52" font-family="Arial, sans-serif" font-size="8" fill="#666" text-anchor="middle">${mes}</text>
    </svg>
  `;
}

function renderizarReservas() {
  if (!elementoExiste("listaReservas") || !elementoExiste("contadorReservas")) {
    console.warn("⚠️ Elementos da lista de reservas não encontrados");
    return;
  }
  const lista = document.getElementById("listaReservas");
  const contador = document.getElementById("contadorReservas");
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
                ${criarIconeCalendario(reserva.data)}
            </div>
            <div class="reserva-info">
                <h3>${reserva.assunto}</h3>
                <p><strong>👤 Responsável:</strong> ${reserva.responsavel}</p>
                <p><strong>📅 Data:</strong> ${formatarData(reserva.data)}</p>
                <p><strong>⏰ Horário:</strong> ${reserva.horaInicio} às ${
        reserva.horaFim
      }</p>
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

async function cancelarReserva(id) {
  const reserva = reservas.find((r) => r.id === id);
  if (!reserva) return;
  logSeguranca("TENTATIVA_CANCELAMENTO_INICIADA", { reservaId: id });
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
      `📅 Data: ${formatarData(reserva.data)}\n` +
      `⏰ Horário: ${reserva.horaInicio} às ${reserva.horaFim}`
  );
  if (!confirmar) {
    logSeguranca("CANCELAMENTO_ABORTADO_PELO_USUARIO", { reservaId: id });
    return;
  }
  try {
    await deletarReserva(id);
  } catch (error) {
    console.error("Erro ao cancelar reserva:", error);
  }
}

window.cancelarReserva = cancelarReserva;

function mostrarBadgeSincronizacao(texto) {
  removerBadgeSincronizacao(); // Remove anterior se existir
  const badge = document.createElement("div");
  badge.id = "badgeSincronizacao";
  badge.textContent = texto;
  badge.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 0.6rem 1rem;
    background: linear-gradient(135deg, #17a2b8, #3498db);
    color: white;
    border-radius: 20px;
    font-size: 0.85rem;
    font-weight: 600;
    z-index: 999;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    animation: pulse 1.5s ease-in-out infinite;
  `;
  document.body.appendChild(badge);
}

function removerBadgeSincronizacao() {
  const badge = document.getElementById("badgeSincronizacao");
  if (badge) badge.remove();
}

function mostrarMensagem(texto, tipo = "info") {
  const mensagemAnterior = document.querySelector(".mensagem-sistema");
  if (mensagemAnterior) {
    mensagemAnterior.remove();
  }
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

  // Adiciona tooltip para indicar que é clicável
  mensagem.title = "Clique para fechar";

  // Permite fechar clicando na mensagem
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

  // Tempo de exibição baseado no tipo e tamanho da mensagem
  const tempoBase = 6000; // Base de 6 segundos (aumentado de 4s)
  const tempoExtra = Math.min(texto.length * 30, 4000); // Até 4s extras para mensagens longas
  const tempoTotal =
    tipo === "erro" || tipo === "aviso" ? tempoBase + tempoExtra : tempoBase;

  setTimeout(() => {
    if (mensagem.parentNode) {
      mensagem.style.animation = "slideOutRight 0.3s ease";
      setTimeout(() => mensagem.remove(), 300);
    }
  }, tempoTotal);
}

// ========== FUNÇÕES DE RENDERIZAÇÃO DE SALAS ==========

/**
 * Renderiza o seletor de salas (dropdown)
 */
function renderizarSeletorSalas() {
  const dropdownButton = document.getElementById("dropdownButton");
  const dropdownSelected = document.getElementById("dropdownSelected");
  const dropdownMenu = document.getElementById("dropdownMenu");

  if (!dropdownButton || !dropdownSelected || !dropdownMenu) {
    console.warn("⚠️ Elementos do dropdown não encontrados");
    return;
  }

  if (salas.length === 0) {
    dropdownSelected.innerHTML = `
      <span class="selected-icon">⏳</span>
      <span class="selected-text">Carregando salas...</span>
    `;
    return;
  }

  // Atualiza o botão com a sala atual
  if (salaAtual) {
    dropdownSelected.innerHTML = `
      <span class="selected-icon">${salaAtual.icone}</span>
      <span class="selected-text">${salaAtual.nome}</span>
    `;
  }

  // Renderiza as opções do menu (simplificado - só título)
  const itemsHtml = salas
    .map((sala) => {
      const isSelected = salaAtual && salaAtual.id === sala.id;

      return `
        <div class="dropdown-item ${
          isSelected ? "selected" : ""
        }" data-sala-id="${sala.id}">
          <div class="item-icon">${sala.icone}</div>
          <div class="item-content">
            <div class="item-title">${sala.nome}</div>
          </div>
        </div>
      `;
    })
    .join("");

  dropdownMenu.innerHTML = itemsHtml;

  // Configura eventos
  configurarSeletor();

  console.log(`✅ ${salas.length} salas renderizadas no dropdown`);
}

/**
 * Configura o comportamento do seletor
 */

function configurarSeletor() {
  const dropdownButton = document.getElementById("dropdownButton");
  const dropdownMenu = document.getElementById("dropdownMenu");

  if (!dropdownButton || !dropdownMenu) {
    console.warn("⚠️ Elementos do dropdown não encontrados");
    return;
  }

  // Só configura uma vez
  if (seletorConfigurado) return;

  console.log("🔧 Configurando seletor de salas...");

  // Toggle do dropdown
  dropdownButton.addEventListener("click", function (e) {
    e.stopPropagation();
    const isOpen = dropdownMenu.classList.contains("show");
    if (isOpen) {
      dropdownButton.classList.remove("active");
      dropdownMenu.classList.remove("show");
    } else {
      dropdownButton.classList.add("active");
      dropdownMenu.classList.add("show");
    }
  });

  // Click nas opções - USA EVENT DELEGATION
  dropdownMenu.addEventListener("click", function (e) {
    e.stopPropagation();
    e.preventDefault();
    console.log(
      "🖱️ Click no menu! Target:",
      e.target.tagName,
      e.target.className
    );
    const item = e.target.closest(".dropdown-item");
    if (item) {
      // ...existing code...
      // (Removido: lógica de logoutContainer e btnLogout centralizada no portal)
    }
  });
} // fechamento correto da função configurarSeletor

document.addEventListener("DOMContentLoaded", function () {
  console.log("🚀 Iniciando aplicação com segurança...");
  logSeguranca("APLICACAO_INICIADA");

  // NOVO: Verifica URL para sala específica
  const urlParams = new URL(window.location).searchParams;
  const salaIdUrl = urlParams.get("sala");
  if (salaIdUrl) {
    const salaEncontrada = salas.find((s) => s.id === salaIdUrl);
    if (salaEncontrada) {
      salaAtual = salaEncontrada;
      salvarSalaPadrao(salaIdUrl);
    }
  }

  setTimeout(() => {}, 100);

  // Configuração do calendário: navegação e render inicial
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
    // Render inicial após montar listeners
    renderizarCalendario();
  }
  const reservaForm = document.getElementById("reservaForm");
  if (reservaForm) {
    reservaForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      if (!usuarioAutenticado) {
        mostrarMensagem(
          "Você precisa estar autenticado para reservar a sala. Acesse o login atualizando a pagina",
          "erro"
        );
        return;
      }
      const responsavelEmail = usuarioAutenticado.email;
      const responsavelNome =
        usuarioAutenticado.displayName || responsavelEmail.split("@")[0];
      const data = document.getElementById("data").value;
      const horaInicio = document.getElementById("horaInicio").value;
      const horaFim = document.getElementById("horaFim").value;
      const assunto = document.getElementById("assunto").value.trim();
      const observacoes = document.getElementById("observacoes").value.trim();
      const agora = new Date();
      const dataReserva = new Date(data + "T" + horaInicio);
      const margemMinutos = 30 * 60 * 1000;
      if (dataReserva.getTime() <= agora.getTime() + margemMinutos) {
        const minutosRestantes = Math.ceil(
          (dataReserva.getTime() - agora.getTime()) / (60 * 1000)
        );
        if (minutosRestantes <= 0) {
          mostrarMensagem(
            "⚠️ Não é possível fazer reservas para horários que já passaram!",
            "erro"
          );
          return;
        } else {
          mostrarMensagem(
            `⚠️ Reservas devem ser feitas com pelo menos 30 minutos de antecedência (faltam ${minutosRestantes} min)`,
            "erro"
          );
          return;
        }
      }
      if (horaInicio >= horaFim) {
        mostrarMensagem(
          "⚠️ A hora de início deve ser anterior à hora de fim!",
          "erro"
        );
        return;
      }
      const horaInicioNum = parseInt(horaInicio.replace(":", ""));
      const horaFimNum = parseInt(horaFim.replace(":", ""));
      if (horaInicioNum < 600 || horaFimNum > 2200) {
        mostrarMensagem("⚠️ Horário de funcionamento: 06:00 às 22:00", "aviso");
        return;
      }
      const conflitos = verificarConflito(data, horaInicio, horaFim);
      if (conflitos.length > 0) {
        let mensagemConflito = "❌ Já existe uma reserva neste horário:\n\n";
        conflitos.forEach((conflito) => {
          mensagemConflito += `• ${conflito.horaInicio} às ${conflito.horaFim} - ${conflito.assunto}\n`;
        });
        mostrarMensagem("Conflito de horário detectado!", "erro");
        alert(mensagemConflito);
        return;
      }
      const novaReserva = {
        // Para UI legada, mantemos 'responsavel' como nome exibível
        responsavel: responsavelNome,
        // Campos de segurança para regras do Firestore
        responsavelEmail,
        responsavelNome,
        data,
        horaInicio,
        horaFim,
        assunto,
        observacoes: observacoes || null,
      };

      // 🔍 DEBUG: Verificar dados antes de enviar
      console.log("📝 [DEBUG] Dados da reserva:", novaReserva);
      console.log("👤 [DEBUG] Usuário autenticado:", {
        email: usuarioAutenticado?.email,
        uid: usuarioAutenticado?.uid,
        displayName: usuarioAutenticado?.displayName,
      });

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
          criadaEm: (
            await import(
              "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js"
            )
          ).serverTimestamp(),
        };
        const { addDoc, collection } = await import(
          "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js"
        );
        await addDoc(collection(db, "reservas"), reserva);
        mostrarMensagem("Reserva realizada com sucesso! 🎉", "sucesso");
        this.reset();
        if (elementoExiste("responsavel")) {
          document.getElementById("responsavel").value = responsavelNome;
        }
      } catch (error) {
        console.error("Erro ao salvar reserva:", error);
      }
    });
  }
  const consultaForm = document.getElementById("consultaForm");
  if (consultaForm) {
    consultaForm.addEventListener("submit", function (e) {
      e.preventDefault();
      const data = document.getElementById("consultaData").value;
      const horaInicio = document.getElementById("consultaInicio").value;
      const horaFim = document.getElementById("consultaFim").value;
      if (!elementoExiste("resultadoConsulta")) return;
      const resultado = document.getElementById("resultadoConsulta");
      const reservasDoDia = reservas.filter((r) => r.data === data);
      if (horaInicio && horaFim) {
        if (horaInicio >= horaFim) {
          resultado.innerHTML =
            '<div class="consulta-result ocupada">⚠️ Horário inválido!</div>';
          return;
        }
        const agora = new Date();
        const dataConsulta = new Date(data + "T" + horaInicio);
        const margemMinutos = 30 * 60 * 1000;
        if (dataConsulta.getTime() <= agora.getTime() + margemMinutos) {
          const minutosRestantes = Math.ceil(
            (dataConsulta.getTime() - agora.getTime()) / (60 * 1000)
          );
          if (minutosRestantes <= 0) {
            resultado.innerHTML =
              '<div class="consulta-result ocupada">⚠️ Horário já passou!</div>';
            return;
          } else {
            resultado.innerHTML = `<div class="consulta-result ocupada">⚠️ Horário muito próximo! (faltam ${minutosRestantes} min - mínimo 30 min)</div>`;
            return;
          }
        }
        const conflitos = verificarConflito(data, horaInicio, horaFim);
        if (conflitos.length === 0) {
          resultado.innerHTML = `
                        <div class="consulta-result disponivel">
                            ✅ <strong>Horário disponível!</strong><br>
                            <small>📅 ${formatarData(data)}</small><br>
                            <small>⏰ ${horaInicio} às ${horaFim}</small>
                        </div>
                    `;
        } else {
          let listaConflitos = conflitos
            .map(
              (c) =>
                `<div class="conflito-item">⏰ ${c.horaInicio} às ${c.horaFim} - ${c.assunto}</div>`
            )
            .join("");
          resultado.innerHTML = `
                        <div class="consulta-result ocupada">
                            ❌ <strong>Horário ocupado!</strong>
                            <div class="conflito-lista">${listaConflitos}</div>
                        </div>
                    `;
        }
      } else {
        if (reservasDoDia.length === 0) {
          resultado.innerHTML = `
                        <div class="consulta-result disponivel">
                            ✅ <strong>Dia totalmente livre!</strong><br>
                            <small>📅 ${formatarData(data)}</small><br>
                            <small>🎯 Perfeito para agendar sua reunião!</small>
                        </div>
                    `;
        } else {
          let listaReservas = reservasDoDia
            .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio))
            .map(
              (r) =>
                `<div class="conflito-item">⏰ ${r.horaInicio} às ${r.horaFim} - ${r.assunto}</div>`
            )
            .join("");
          resultado.innerHTML = `
                        <div class="consulta-result ocupada">
                            📅 <strong>Reservas do dia:</strong>
                            <div class="conflito-lista">${listaReservas}</div>
                        </div>
                    `;
        }
      }
      logSeguranca("CONSULTA_REALIZADA", { data, horaInicio, horaFim });
    });
  }
  const consultaData = document.getElementById("consultaData");
  if (consultaData) {
    consultaData.addEventListener("change", function () {
      if (elementoExiste("resultadoConsulta")) {
        document.getElementById("resultadoConsulta").innerHTML = "";
      }
    });
  }
  const horaInicioElem = document.getElementById("horaInicio");
  if (horaInicioElem) {
    horaInicioElem.addEventListener("change", function () {
      const horaFim = document.getElementById("horaFim");
      if (horaFim && !horaFim.value && this.value) {
        const [hora, minuto] = this.value.split(":");
        const novaHora = parseInt(hora) + 1;
        if (novaHora <= 22) {
          horaFim.value = `${novaHora.toString().padStart(2, "0")}:${minuto}`;
        }
      }
    });
  }

  // Fim do script principal
});

// Bloco de estilos animados para mensagens e modais
const style = document.createElement("style");
style.textContent = `
  @keyframes slideInRight {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  @keyframes slideOutRight {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
  }
  @keyframes fadeOut {
    from { opacity: 1; }
    to { opacity: 0; }
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.8; transform: scale(1.05); }
  }
`;
document.head.appendChild(style);
