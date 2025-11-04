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

// ========== SISTEMA DE SEGURANÇA ========== //

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

function gerarCodigoSeguranca() {
  // Usar crypto.randomUUID() se disponível, caso contrário fallback
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    // Gera UUID e pega primeiros 10 caracteres (mais seguro)
    return crypto.randomUUID().replace(/-/g, "").substring(0, 10).toUpperCase();
  }

  // Fallback para navegadores antigos (menos seguro)
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let codigo = "";
  for (let i = 0; i < 8; i++) {
    codigo += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const timestamp = Date.now().toString().slice(-3);
  return codigo + timestamp.substring(0, 2);
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
  return {
    responsavel: reservaData.responsavel.trim().substring(0, 100),
    data: reservaData.data,
    horaInicio: reservaData.horaInicio,
    horaFim: reservaData.horaFim,
    assunto: reservaData.assunto.trim().substring(0, 200),
    observacoes: reservaData.observacoes
      ? reservaData.observacoes.trim().substring(0, 500)
      : null,
  };
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
}

// ========== FUNÇÕES ORIGINAIS ATUALIZADAS ========== //

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
    }, 3000);
  } else {
    statusDiv.innerHTML = "❌ Erro de conexão - Verifique sua internet";
    statusDiv.style.background = "#dc3545";
    statusDiv.style.display = "block";
    firebaseConectado = false;
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
    onSnapshot(
      q,
      (snapshot) => {
        console.log("📡 Dados recebidos do Firebase");
        reservas = [];
        snapshot.forEach((doc) => {
          reservas.push({
            id: doc.id,
            ...doc.data(),
          });
        });
        console.log(`✅ ${reservas.length} reservas carregadas`);
        logSeguranca("DADOS_CARREGADOS", { quantidade: reservas.length });
        atualizarStatusConexao(true);
        atualizarInterface();
      },
      (error) => {
        console.error("❌ Erro ao escutar Firestore:", error);
        logSeguranca("ERRO_FIRESTORE", { erro: error.message });
        atualizarStatusConexao(false);
        mostrarMensagem("Erro ao conectar com o banco de dados", "erro");
      }
    );
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
    const codigoSeguranca = gerarCodigoSeguranca();
    const reservaComTimestamp = {
      ...dadosLimpos,
      codigo: codigoSeguranca,
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
    mostrarModalCodigo(codigoSeguranca, dadosLimpos);
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

async function deletarReserva(id, codigoInformado) {
  try {
    const reserva = reservas.find((r) => r.id === id);
    if (!reserva) {
      throw new Error("Reserva não encontrada");
    }
    if (!codigoInformado || codigoInformado.trim() === "") {
      throw new Error("Código de cancelamento é obrigatório");
    }
    if (reserva.codigo !== codigoInformado.trim().toUpperCase()) {
      logSeguranca("TENTATIVA_CANCELAMENTO_CODIGO_INVALIDO", {
        reservaId: id,
        codigoTentativa: codigoInformado.substring(0, 3) + "***",
      });
      throw new Error("Código de cancelamento inválido");
    }
    await deleteDoc(doc(db, "reservas", id));
    console.log("✅ Reserva deletada:", id);
    logSeguranca("RESERVA_CANCELADA", {
      id: id,
      responsavel: reserva.responsavel,
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

function mostrarModalCodigo(codigo, dadosReserva) {
  const modalAnterior = document.getElementById("modalCodigo");
  if (modalAnterior) {
    modalAnterior.remove();
  }
  const modal = document.createElement("div");
  modal.id = "modalCodigo";
  modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        display: flex;
        justify-content: center;
        align-items: flex-start;
        z-index: 10000;
        backdrop-filter: blur(5px);
        overflow-y: auto;
        padding: 20px 10px;
        box-sizing: border-box;
    `;
  modal.innerHTML = `
        <div style="
            background: white;
            padding: 0;
            border-radius: 12px;
            max-width: 500px;
            width: 100%;
            max-height: 90vh;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            overflow: hidden;
            margin: auto;
            position: relative;
        ">
            <div style="
                background: linear-gradient(135deg, #28a745, #20c997);
                color: white;
                padding: 1.5rem;
                text-align: center;
                position: sticky;
                top: 0;
                z-index: 1;
            ">
                <h2 style="margin: 0; font-size: 1.3rem;">🎉 Reserva Confirmada!</h2>
            </div>
            <div style="
                padding: 1.5rem;
                overflow-y: auto;
                max-height: calc(90vh - 100px);
            ">
                <div style="
                    background: #f8f9fa;
                    padding: 1rem;
                    border-radius: 8px;
                    margin-bottom: 1.5rem;
                    border-left: 4px solid #28a745;
                ">
                    <p style="margin: 0; font-size: 0.9rem; color: #666; line-height: 1.4;">
                        <strong>📅 ${formatarData(
                          dadosReserva.data
                        )}</strong><br>
                        <strong>⏰ ${dadosReserva.horaInicio} às ${
    dadosReserva.horaFim
  }</strong><br>
                        <strong>📋 ${dadosReserva.assunto}</strong>
                    </p>
                </div>
                <div style="
                    background: #fff3cd;
                    border: 2px solid #ffc107;
                    padding: 1.5rem;
                    border-radius: 8px;
                    text-align: center;
                    margin-bottom: 1.5rem;
                ">
                    <h3 style="
                        margin: 0 0 1rem 0;
                        color: #856404;
                        font-size: 1.1rem;
                    ">🔐 Código de Cancelamento</h3>
                    <div style="
                        background: white;
                        padding: 1rem;
                        border-radius: 6px;
                        border: 2px dashed #ffc107;
                        margin-bottom: 1rem;
                        overflow-wrap: break-word;
                    ">
                        <div style="
                            font-family: 'Courier New', monospace;
                            font-size: clamp(1.5rem, 4vw, 2rem);
                            font-weight: bold;
                            color: #dc3545;
                            letter-spacing: 2px;
                            text-align: center;
                            word-break: break-all;
                        ">${codigo}</div>
                    </div>
                    <button onclick="copiarCodigo('${codigo}')" style="
                        background: #ffc107;
                        color: #000;
                        border: none;
                        padding: 0.8rem 1.5rem;
                        border-radius: 6px;
                        font-weight: bold;
                        cursor: pointer;
                        margin-bottom: 1rem;
                        transition: all 0.3s;
                        width: 100%;
                        max-width: 200px;
                        font-size: 0.9rem;
                    " onmouseover="this.style.background='#e0a800'" onmouseout="this.style.background='#ffc107'">
                        📋 Copiar Código
                    </button>
                    <p style="
                        margin: 0;
                        font-size: 0.85rem;
                        color: #856404;
                        line-height: 1.4;
                    ">
                        ⚠️ <strong>IMPORTANTE:</strong> Guarde este código com segurança!<br>
                        Você precisará dele para cancelar a reserva.
                    </p>
                </div>
                <div style="text-align: center; padding-bottom: 1rem;">
                    <button onclick="fecharModalCodigo()" style="
                        background: #28a745;
                        color: white;
                        border: none;
                        padding: 1rem 2rem;
                        border-radius: 6px;
                        font-weight: bold;
                        cursor: pointer;
                        font-size: 1rem;
                        transition: all 0.3s;
                        width: 100%;
                        max-width: 250px;
                    " onmouseover="this.style.background='#218838'" onmouseout="this.style.background='#28a745'">
                        ✅ Entendi, Fechar
                    </button>
                </div>
            </div>
        </div>
    `;
  document.body.appendChild(modal);
  // Clicar fora do conteúdo fecha o modal normalmente
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      fecharModalCodigo();
    }
  });
  document.body.style.overflow = "hidden";
  const fecharOriginal = window.fecharModalCodigo;
  window.fecharModalCodigo = function () {
    document.body.style.overflow = "auto";
    fecharOriginal();
  };
}

function copiarCodigo(codigo) {
  navigator.clipboard
    .writeText(codigo)
    .then(() => {
      mostrarMensagem(
        "📋 Código copiado para a área de transferência!",
        "sucesso"
      );
      logSeguranca("CODIGO_COPIADO");
    })
    .catch(() => {
      const textArea = document.createElement("textarea");
      textArea.value = codigo;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      mostrarMensagem("📋 Código copiado!", "sucesso");
    });
}

function fecharModalCodigo() {
  const modal = document.getElementById("modalCodigo");
  if (modal) {
    modal.style.animation = "fadeOut 0.3s ease";
    setTimeout(() => {
      modal.remove();
      document.body.style.overflow = "auto";
    }, 300);
  }
}

window.copiarCodigo = copiarCodigo;
window.fecharModalCodigo = fecharModalCodigo;

function formatarData(data) {
  return new Date(data + "T00:00:00").toLocaleDateString("pt-BR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// ========== CALENDÁRIO (visual) ========== //
// Estado do calendário: mês atualmente exibido
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
                <p><strong>🔐 Status:</strong> <span style="color: #28a745;">Protegida por código</span></p>
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
  const codigo = prompt(
    `🔐 CÓDIGO DE CANCELAMENTO NECESSÁRIO\n\n` +
      `📋 Assunto: ${reserva.assunto}\n` +
      `📅 Data: ${formatarData(reserva.data)}\n` +
      `⏰ Horário: ${reserva.horaInicio} às ${reserva.horaFim}\n` +
      `👤 Responsável: ${reserva.responsavel}\n\n` +
      `Digite o código de cancelamento:`
  );
  if (codigo === null) {
    logSeguranca("CANCELAMENTO_ABORTADO_PELO_USUARIO", { reservaId: id });
    return;
  }
  if (!codigo || codigo.trim() === "") {
    mostrarMensagem("❌ Código de cancelamento é obrigatório!", "erro");
    return;
  }
  try {
    await deletarReserva(id, codigo);
  } catch (error) {
    console.error("Erro ao cancelar reserva:", error);
  }
}

window.cancelarReserva = cancelarReserva;

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
    `;
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
  }, 4000);
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

    // Regra: apenas emails @pge.sc.gov.br podem acessar
    const userDomain = user.email.split("@")[1];
    if (userDomain !== "pge.sc.gov.br") {
      // Mostra mensagem de acesso negado no modal
      const loginErrorMsg = document.getElementById("loginErrorMsg");
      if (loginErrorMsg) {
        loginErrorMsg.textContent =
          "Acesso negado. Apenas usuários com email @pge.sc.gov.br podem acessar este sistema.";
        loginErrorMsg.style.display = "block";
      }
      mostrarMensagem(
        "❌ Acesso negado! Apenas emails @pge.sc.gov.br são permitidos.",
        "erro"
      );
      setTimeout(() => {
        logout();
      }, 100);
      return;
    }
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
  } else {
    console.log("Nenhum usuário autenticado.");
    logSeguranca("USUARIO_DESAUTENTICADO");
    usuarioAutenticado = null;
    const btnLogout = document.getElementById("btnLogout");
    if (btnLogout) {
      btnLogout.remove();
    }
    mostrarModalLogin(true);
  }
});

document.addEventListener("DOMContentLoaded", function () {
  console.log("🚀 Iniciando aplicação com segurança...");
  logSeguranca("APLICACAO_INICIADA");
  setTimeout(() => {
    carregarDados();
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
      const responsavel =
        usuarioAutenticado.displayName || usuarioAutenticado.email;
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
        responsavel,
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
          document.getElementById("responsavel").value = responsavel;
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
`;
document.head.appendChild(style);

console.log("🛡️ Sistema de Reservas carregado com segurança aprimorada!");
console.log("🔐 Recursos de segurança ativos:");
console.log("   • Rate limiting (5 reservas/hora)");
console.log("   • Códigos de cancelamento seguros");
console.log("   • Validação de dados robusta");
console.log("   • Logs de segurança");
console.log("   • Sanitização de entrada");
console.log("   • ⏰ Margem de 30 minutos para reservas");
