// Atualiza o status da sala (ocupada/disponível/próxima reunião)
function atualizarStatusSala(reservas) {
  const statusDiv = document.getElementById("statusSala");
  if (!statusDiv) return;
  const agora = new Date();
  const dataHoje = agora.toISOString().split("T")[0];
  const horaAtual = agora.toTimeString().split(" ")[0].substring(0, 5);
  // Reserva atual: está acontecendo agora
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
    // Próxima reserva do dia
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
// interface-sala.js
// Lógica de interface compartilhada para páginas de sala (calendário, formulário, eventos, etc.)
// Copiado/adaptado de sala-cest/firebase-script.js

// Variáveis globais para reservas e usuário
window.reservas = [];
window.usuarioAutenticado = null;

// Funções utilitárias
function pad2(n) {
  return n.toString().padStart(2, "0");
}
function toISODate(d) {
  const ano = d.getFullYear();
  const mes = pad2(d.getMonth() + 1);
  const dia = pad2(d.getDate());
  return `${ano}-${mes}-${dia}`;
}
function formatarData(data) {
  return new Date(data + "T00:00:00").toLocaleDateString("pt-BR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
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

// Calendário visual mensal
window.calDataAtual = new Date();
window.renderizarCalendario = function () {
  const grid = document.getElementById("calGrid");
  if (!grid) return;
  const titulo = document.getElementById("calTitle");
  if (titulo) {
    const opcoes = { month: "long", year: "numeric" };
    const texto = calDataAtual.toLocaleDateString("pt-BR", opcoes);
    titulo.textContent = texto.charAt(0).toUpperCase() + texto.slice(1);
  }
  const hoje = new Date();
  const inicioMes = new Date(
    calDataAtual.getFullYear(),
    calDataAtual.getMonth(),
    1
  );
  const inicioGrid = new Date(inicioMes);
  inicioGrid.setDate(inicioMes.getDate() - inicioMes.getDay());
  const totalCelulas = 42;
  // Só considera reservas futuras para o calendário
  const agora = new Date();
  const reservasFuturas = window.reservas.filter((r) => {
    if (!r.data || !r.horaFim) return false;
    const dataHoraFim = new Date(r.data + "T" + r.horaFim);
    return dataHoraFim > agora;
  });
  const mapa = construirMapaReservasPorDia(reservasFuturas);
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
      window.mostrarReservasDoDia && window.mostrarReservasDoDia(iso);
      const resultado = document.getElementById("resultadoConsulta");
      if (resultado && typeof resultado.scrollIntoView === "function") {
        resultado.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
    grid.appendChild(div);
  }
};

// Consulta rápida do dia
window.mostrarReservasDoDia = function (dataISO) {
  const resultado = document.getElementById("resultadoConsulta");
  if (!resultado) return;
  const agora = new Date();
  const reservasDoDia = window.reservas
    .filter(
      (r) => r.data === dataISO && new Date(r.data + "T" + r.horaFim) > agora
    )
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
};

// Navegação do calendário
window.addEventListener("DOMContentLoaded", function () {
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

// Atualização de reservas (chamada pelo script de dados)
window.atualizarReservasInterface = function (reservas) {
  console.log("[RESERVAS] Dados recebidos:", reservas);
  // Filtra reservas excluídas e só mostra reservas futuras (data > hoje) ou de hoje com horaFim > agora
  const agora = new Date();
  const hojeISO = agora.toISOString().split("T")[0];
  // Filtro robusto para reservas futuras
  const reservasValidas = reservas
    .filter((r) => {
      if (r.excluida === true) return false;
      if (!r.data || !r.horaFim) return false;
      // Cria objeto Date para data da reserva
      const dataReserva = new Date(r.data + "T" + r.horaFim);
      // Reserva futura: data da reserva (com horaFim) > agora
      return dataReserva > agora;
    })
    .sort((a, b) => {
      // Ordena por data, depois horaInicio
      if (a.data !== b.data) return a.data.localeCompare(b.data);
      return a.horaInicio.localeCompare(b.horaInicio);
    });
  window.reservas = reservasValidas;
  renderizarCalendario();
  atualizarStatusSala(reservasValidas);

  // Atualizar lista de reservas futuras
  const lista = document.getElementById("listaReservas");
  const contador = document.getElementById("contadorReservas");
  if (!lista || !contador) return;
  // Filtra novamente para garantir que só reservas futuras sejam exibidas
  const reservasFuturas = reservasValidas;
  if (!reservasFuturas || reservasFuturas.length === 0) {
    lista.innerHTML =
      '<div class="no-reservas">Nenhuma reserva agendada.</div>';
    contador.textContent = "0 reservas";
    return;
  }
  contador.textContent = `${reservasFuturas.length} reserva${
    reservasFuturas.length !== 1 ? "s" : ""
  }`;
  lista.innerHTML = reservasFuturas
    .map((r) => {
      const podeCancelar =
        window.usuarioAutenticado &&
        window.usuarioAutenticado.email === r.responsavelEmail;
      return `
    <div class="reserva-item" data-id="${r.id}">
      <div class="reserva-info">
        <h3>${r.assunto}</h3>
        <p><strong>👤 Responsável:</strong> ${r.responsavel}</p>
        <p><strong>📅 Data:</strong> ${r.data}</p>
        <p><strong>⏰ Horário:</strong> ${r.horaInicio} às ${r.horaFim}</p>
        ${
          r.observacoes
            ? `<p><strong>📝 Observações:</strong> ${r.observacoes}</p>`
            : ""
        }
      </div>
      ${
        podeCancelar
          ? `<div style="display:flex;justify-content:flex-end;"><button class="btn-cancelar" style="padding:8px 18px;font-size:1em;border-radius:7px;background:#dc3545;color:#fff;border:none;cursor:pointer;font-weight:600;transition:background 0.2s;min-width:90px;max-width:140px;white-space:nowrap;">🗑️ Cancelar</button></div>`
          : ""
      }
    </div>
  `;
    })
    .join("");

  // Adiciona event listener para todos os botões cancelar
  lista.querySelectorAll(".btn-cancelar").forEach((btn) => {
    const reservaDiv = btn.closest(".reserva-item");
    const reservaId = reservaDiv ? reservaDiv.getAttribute("data-id") : null;
    if (reservaId) {
      btn.addEventListener("click", () => window.cancelarReserva(reservaId));
    }
  });

  // Função global para cancelar reserva
  window.cancelarReserva = async function (id) {
    const reserva = reservasFuturas.find((r) => r.id === id);
    if (!reserva) return;
    if (
      !window.usuarioAutenticado ||
      window.usuarioAutenticado.email !== reserva.responsavelEmail
    ) {
      alert("Apenas o responsável pode cancelar esta reserva.");
      return;
    }
    if (
      !confirm(
        `Confirmar cancelamento da reserva?\n\nAssunto: ${reserva.assunto}\nData: ${reserva.data}\nHorário: ${reserva.horaInicio} às ${reserva.horaFim}`
      )
    )
      return;
    try {
      // Atualiza campo excluida no Firestore
      const { getFirestore, doc, updateDoc } = await import(
        "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js"
      );
      const db = getFirestore();
      await updateDoc(doc(db, "reservas", id), { excluida: true });
      alert("Reserva cancelada com sucesso!");
    } catch (error) {
      alert("Erro ao cancelar reserva: " + (error.message || error));
    }
  };
};
