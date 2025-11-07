import app from "./firebase-config.js";
import {
  getFirestore,
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { monitorAuthState, login, loginWithGoogle } from "./auth.js";
// Importar funções de autenticação para logout
import {
  getAuth,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const db = getFirestore(app);
const auth = getAuth(app); // Inicializa o Auth

// Variáveis globais
let reservas = [];
let firebaseConectado = false;
let usuarioAutenticado = null;
// Unsubscribe do listener de reservas (para evitar escutas antes da autenticação e duplicadas)
let unsubscribeReservas = null;
// Cache local para reduzir tempo de primeira renderização após login
const CACHE_CHAVE = "reservasCache";

// Rate limiting - máximo 5 reservas por hora
const LIMITE_RESERVAS_POR_HORA = 5;
let reservasFeitas = parseInt(localStorage.getItem("reservasFeitas") || "0");
let ultimaReserva = parseInt(localStorage.getItem("ultimaReserva") || "0");

function verificarLimiteReservas() {
  const agora = Date.now();
  const umaHora = 3600000; // 1 hora em ms

  if (agora - ultimaReserva > umaHora) {
    reservasFeitas = 0;
    localStorage.setItem("reservasFeitas", "0");
  }

  if (reservasFeitas >= LIMITE_RESERVAS_POR_HORA) {
    throw new Error(
      `Limite de ${LIMITE_RESERVAS_POR_HORA} reservas por hora excedido. Tente novamente mais tarde.`
    );
  }
}

function incrementarContadorReservas() {
  reservasFeitas++;
  ultimaReserva = Date.now();
  localStorage.setItem("reservasFeitas", reservasFeitas.toString());
  localStorage.setItem("ultimaReserva", ultimaReserva.toString());
}

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

function sanitizarDados(reservaData) {
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

function logSeguranca(acao, dados = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    acao,
    ip: "N/A",
    userAgent: navigator.userAgent,
    dados,
  };
  console.log("🔐 Log de Segurança:", logEntry);

  // ✅ Log persistente no Firestore ativado para auditoria
  logSegurancaPersistente(acao, dados);
}

// Função para salvar logs persistentes no Firestore (opcional)
async function logSegurancaPersistente(acao, dados = {}) {
  try {
    // Só loga se usuário estiver autenticado
    if (!usuarioAutenticado) return;

    await addDoc(collection(db, "security_logs"), {
      acao,
      dados,
      timestamp: serverTimestamp(),
      userId: usuarioAutenticado.uid,
      userEmail: usuarioAutenticado.email,
      userAgent: navigator.userAgent.substring(0, 200),
      // IP será "N/A" no cliente - para obter IP real, usar Cloud Functions
    });
  } catch (error) {
    // Falha silenciosa - não deve impedir operação principal
    console.warn("⚠️ Falha ao salvar log persistente:", error);
  }
}

function elementoExiste(id) {
  return document.getElementById(id) !== null;
}

function atualizarStatusConexao(conectado) {
  if (!elementoExiste("statusConexao")) return;
  const statusDiv = document.getElementById("statusConexao");
  if (conectado) {
    statusDiv.innerHTML = "✅ Conectado ao Firebase - Dados sincronizados";
    statusDiv.style.background = "#28a745";
    firebaseConectado = true;
    setTimeout(() => {
      statusDiv.style.display = "none";
    }, 5000); // Aumentado de 3s para 5s
  } else {
    statusDiv.innerHTML = "❌ Erro de conexão - Verifique sua internet";
    statusDiv.style.background = "#dc3545";
    statusDiv.style.display = "block";
    firebaseConectado = false;
  }
}

function carregarReservasDoCache() {
  try {
    const raw = localStorage.getItem(CACHE_CHAVE);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return false;
    reservas = parsed;
    console.log(
      `🗂️ [CACHE] Carregado do cache local: ${reservas.length} reservas (aguardando dados reais...)`
    );
    // Mostra badge "carregando do servidor" para deixar claro que não são dados finais
    mostrarBadgeSincronizacao("📡 Sincronizando com servidor...");
    atualizarInterface();
    return true;
  } catch (e) {
    console.warn("Falha ao carregar cache local de reservas:", e);
    return false;
  }
}

function verificarStatusAtual() {
  if (!elementoExiste("statusAtual")) {
    console.warn("⚠️ Elemento statusAtual não encontrado");
    return;
  }
  const statusDiv = document.getElementById("statusAtual");
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

function carregarDados() {
  try {
    console.log("🔄 Conectando ao Firestore...");
    logSeguranca("CONEXAO_FIRESTORE_INICIADA");
    const q = query(
      collection(db, "reservas"),
      orderBy("data", "asc"),
      orderBy("horaInicio", "asc")
    );
    // Garante que não existam múltiplos listeners ativos
    if (typeof unsubscribeReservas === "function") {
      try {
        unsubscribeReservas();
      } catch (e) {
        console.warn("⚠️ Falha ao cancelar listener anterior:", e);
      }
      unsubscribeReservas = null;
    }
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        console.log("📡 [FIREBASE] Dados recebidos em tempo real do Firestore");
        reservas = [];
        snapshot.forEach((doc) => {
          reservas.push({
            id: doc.id,
            ...doc.data(),
          });
        });
        console.log(
          `✅ [FIREBASE] ${reservas.length} reservas sincronizadas do servidor`
        );
        logSeguranca("DADOS_CARREGADOS", { quantidade: reservas.length });
        try {
          localStorage.setItem(CACHE_CHAVE, JSON.stringify(reservas));
          console.log("💾 Cache local atualizado com dados do servidor");
        } catch (e) {
          // Cache pode falhar (quota), não é crítico
          console.warn("⚠️ Falha ao salvar cache:", e);
        }
        // Remove badge de sincronização
        removerBadgeSincronizacao();
        atualizarStatusConexao(true);
        atualizarInterface();
      },
      (error) => {
        console.error("❌ Erro ao escutar Firestore:", error);
        logSeguranca("ERRO_FIRESTORE", { erro: error.message });
        atualizarStatusConexao(false);
        if (error?.code === "permission-denied") {
          mostrarMensagem(
            "Permissão negada. Faça login para acessar o sistema.",
            "erro"
          );
        } else {
          mostrarMensagem("Erro ao conectar com o banco de dados", "erro");
        }
      }
    );
    // guarda unsubscribe globalmente e também retorna
    unsubscribeReservas = unsub;
    return unsub;
  } catch (error) {
    console.error("❌ Erro ao configurar Firestore:", error);
    logSeguranca("ERRO_CONFIGURACAO_FIRESTORE", { erro: error.message });
    atualizarStatusConexao(false);
    mostrarMensagem("Erro na configuração do Firebase", "erro");
  }
}

async function adicionarReserva(reservaData) {
  try {
    verificarLimiteReservas();
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
    const docRef = await addDoc(
      collection(db, "reservas"),
      reservaComTimestamp
    );
    incrementarContadorReservas();
    console.log("✅ Reserva salva:", docRef.id);
    logSeguranca("RESERVA_CRIADA", {
      id: docRef.id,
      responsavel: dadosLimpos.responsavel,
      data: dadosLimpos.data,
      horario: `${dadosLimpos.horaInicio}-${dadosLimpos.horaFim}`,
    });
    mostrarMensagem("Reserva realizada com sucesso! 🎉", "sucesso");
    mostrarModalConfirmacao(dadosLimpos);
    return docRef.id;
  } catch (error) {
    console.error("❌ Erro ao salvar reserva:", error);
    logSeguranca("ERRO_CRIAR_RESERVA", { erro: error.message });
    mostrarMensagem(
      error.message || "Erro ao salvar reserva. Verifique sua conexão.",
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

async function deletarReserva(id) {
  try {
    const reserva = reservas.find((r) => r.id === id);
    if (!reserva) {
      throw new Error("Reserva não encontrada");
    }
    // Verificação no cliente para melhor UX (servidor reforça via regras)
    if (!usuarioAutenticado) {
      throw new Error("Você precisa estar autenticado para cancelar.");
    }
    if (
      reserva.responsavelEmail &&
      reserva.responsavelEmail !== usuarioAutenticado.email
    ) {
      throw new Error("Apenas o responsável pela reserva pode cancelar.");
    }
    await deleteDoc(doc(db, "reservas", id));
    console.log("✅ Reserva deletada:", id);
    logSeguranca("RESERVA_CANCELADA", {
      id: id,
      responsavel: reserva.responsavel,
      responsavelEmail: reserva.responsavelEmail || "(indefinido)",
      data: reserva.data,
    });
    mostrarMensagem("Reserva cancelada com sucesso!", "sucesso");
  } catch (error) {
    console.error("❌ Erro ao deletar reserva:", error);
    logSeguranca("ERRO_CANCELAR_RESERVA", {
      erro: error.message,
      reservaId: id,
    });
    mostrarMensagem(
      error.message || "Erro ao cancelar reserva. Tente novamente.",
      "erro"
    );
    throw error;
  }
}

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
let calDataAtual = new Date();
calDataAtual.setDate(1); // sempre o primeiro dia do mês

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

function atualizarInterface() {
  if (elementoExiste("statusAtual")) {
    verificarStatusAtual();
  }
  if (elementoExiste("listaReservas")) {
    renderizarReservas();
  }
  // Re-renderiza o calendário ao atualizar dados
  if (elementoExiste("calGrid")) {
    renderizarCalendario();
  }
}

function definirDataMinima() {
  const hoje = new Date().toISOString().split("T")[0];
  if (elementoExiste("data")) {
    document.getElementById("data").min = hoje;
  }
  if (elementoExiste("consultaData")) {
    document.getElementById("consultaData").min = hoje;
  }
}

// Exibir ou ocultar o modal de login conforme o estado de autenticação
function mostrarModalLogin(mostrar = true) {
  const loginModal = document.getElementById("loginModal");
  if (loginModal) {
    loginModal.style.display = mostrar ? "block" : "none";
  }
}

// Listener para o formulário de login
document.addEventListener("DOMContentLoaded", function () {
  const loginForm = document.getElementById("loginForm");
  const fecharModal = document.getElementById("fecharModal");
  const btnLoginGoogle = document.getElementById("btnLoginGoogle");

  if (loginForm) {
    loginForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      const email = document.getElementById("loginEmail").value;
      const password = document.getElementById("loginPassword").value;
      try {
        // Função login foi importada via auth.js
        await login(email, password);
        mostrarMensagem("Login realizado com sucesso!", "sucesso");
        mostrarModalLogin(false);
        // Atualiza saudação
        document.getElementById(
          "userGreeting"
        ).textContent = `Bem-vindo, ${email}`;
      } catch (error) {
        mostrarMensagem("Erro no login: " + error.message, "erro");
      }
    });
  }

  if (fecharModal) {
    fecharModal.addEventListener("click", function () {
      mostrarModalLogin(false);
    });
  }

  if (btnLoginGoogle) {
    btnLoginGoogle.addEventListener("click", async function () {
      try {
        const result = await loginWithGoogle();
        mostrarMensagem("Login com Google realizado com sucesso!", "sucesso");
        // Use o displayName ou, se ausente, a parte do email antes do '@'
        const userName = result.user.displayName
          ? result.user.displayName
          : result.user.email.split("@")[0];
        document.getElementById(
          "userGreeting"
        ).textContent = `Bem-vindo, ${userName}`;
        mostrarModalLogin(false);
        // Após login bem-sucedido, renderiza cache e inicia listener
        carregarReservasDoCache();
        if (!unsubscribeReservas) carregarDados();
      } catch (error) {
        mostrarMensagem("Erro no login: " + error.message, "erro");
      }
    });
  }
});

// Função para efetuar o logout
function logout() {
  signOut(auth)
    .then(() => {
      mostrarMensagem("Logout realizado com sucesso!", "sucesso");
      // Aguarda um pequeno intervalo e recarrega a página para atualizar a interface
      setTimeout(() => {
        window.location.reload();
      }, 500);
    })
    .catch((error) => {
      mostrarMensagem("Erro ao fazer logout: " + error.message, "erro");
    });
}
window.logout = logout;

// Monitorar estado de autenticação
monitorAuthState((user) => {
  const userGreetingElem = document.getElementById("userGreeting");
  const logoutContainer = document.getElementById("logoutContainer");
  if (user) {
    console.log("Usuário autenticado:", user.email);

    // Limpa mensagem de erro ao abrir modal de login
    const loginModal = document.getElementById("loginModal");
    if (loginModal) {
      loginModal.addEventListener("transitionend", function () {
        const loginErrorMsg = document.getElementById("loginErrorMsg");
        if (loginErrorMsg) loginErrorMsg.style.display = "none";
      });
    }

    usuarioAutenticado = user;
    logSeguranca("USUARIO_AUTENTICADO", { email: user.email, uid: user.uid });

    // Se não houver displayName, extrai a parte antes do '@'
    const userName = user.displayName
      ? user.displayName
      : user.email.split("@")[0];
    userGreetingElem.textContent = `Bem-vindo, ${userName}`;
    if (!document.getElementById("btnLogout")) {
      const btnLogout = document.createElement("button");
      btnLogout.id = "btnLogout";
      btnLogout.textContent = "Sair";
      btnLogout.style.cssText =
        "margin-left: 10px; padding: 0.3rem 0.6rem; border: none; background: #dc3545; color: white; border-radius: 4px; cursor: pointer;";
      logoutContainer.appendChild(btnLogout);
      btnLogout.addEventListener("click", logout);
    }
    mostrarModalLogin(false);
    // Renderiza imediatamente a partir do cache e inicia listener em seguida
    carregarReservasDoCache();
    if (!unsubscribeReservas) carregarDados();
  } else {
    console.log("Nenhum usuário autenticado.");
    logSeguranca("USUARIO_DESAUTENTICADO");
    usuarioAutenticado = null;
    const btnLogout = document.getElementById("btnLogout");
    if (btnLogout) {
      btnLogout.remove();
    }
    // Cancela listener e limpa interface
    if (typeof unsubscribeReservas === "function") {
      try {
        unsubscribeReservas();
      } catch (_) {}
      unsubscribeReservas = null;
    }
    reservas = [];
    atualizarInterface();
    mostrarModalLogin(true);
  }
});

document.addEventListener("DOMContentLoaded", function () {
  console.log("🚀 Iniciando aplicação com segurança...");
  logSeguranca("APLICACAO_INICIADA");
  setTimeout(() => {
    definirDataMinima();
    if (elementoExiste("statusAtual")) {
      setInterval(verificarStatusAtual, 60000);
    }
  }, 100);

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
      try {
        await adicionarReserva(novaReserva);
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
});

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
