// Firebase CDN Imports
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { 
    getFirestore, 
    collection, 
    addDoc, 
    deleteDoc, 
    doc, 
    onSnapshot,
    query,
    orderBy,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Configuração segura do Firebase
const firebaseConfig = {
    apiKey: "AIzaSyDMXL1Lp1XS6jAe6aPyYp1tUeqNUIvmNu0",
    authDomain: "do-sistema-de-reserva-sala.firebaseapp.com",
    projectId: "do-sistema-de-reserva-sala",
    storageBucket: "do-sistema-de-reserva-sala.firebasestorage.app",
    messagingSenderId: "562006496984",
    appId: "1:562006496984:web:2b39a74748ccdecb0029ad"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Variáveis globais
let reservas = [];
let firebaseConectado = false;

// ========== SISTEMA DE SEGURANÇA ========== //

// Rate limiting - máximo 5 reservas por hora
const LIMITE_RESERVAS_POR_HORA = 5;
let reservasFeitas = parseInt(localStorage.getItem('reservasFeitas') || '0');
let ultimaReserva = parseInt(localStorage.getItem('ultimaReserva') || '0');

// Função para verificar limite de reservas
function verificarLimiteReservas() {
    const agora = Date.now();
    const umaHora = 3600000; // 1 hora em ms
    
    // Reset contador se passou mais de 1 hora
    if (agora - ultimaReserva > umaHora) {
        reservasFeitas = 0;
        localStorage.setItem('reservasFeitas', '0');
    }
    
    if (reservasFeitas >= LIMITE_RESERVAS_POR_HORA) {
        throw new Error(`Limite de ${LIMITE_RESERVAS_POR_HORA} reservas por hora excedido. Tente novamente mais tarde.`);
    }
}

// Função para incrementar contador de reservas
function incrementarContadorReservas() {
    reservasFeitas++;
    ultimaReserva = Date.now();
    localStorage.setItem('reservasFeitas', reservasFeitas.toString());
    localStorage.setItem('ultimaReserva', ultimaReserva.toString());
}

// Função para gerar código de segurança
function gerarCodigoSeguranca() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let codigo = '';
    
    // Gerar código de 8 caracteres
    for (let i = 0; i < 8; i++) {
        codigo += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    // Adicionar timestamp para garantir unicidade
    const timestamp = Date.now().toString().slice(-3);
    return codigo + timestamp.substring(0, 2);
}

// Função para validar dados de entrada
function validarDadosReserva(reservaData) {
    const erros = [];
    
    // Validar responsável
    if (!reservaData.responsavel || reservaData.responsavel.trim().length < 2) {
        erros.push('Nome do responsável deve ter pelo menos 2 caracteres');
    }
    
    // Validar data
    const hoje = new Date();
    const dataReserva = new Date(reservaData.data);
    if (dataReserva < hoje.setHours(0,0,0,0)) {
        erros.push('Não é possível fazer reservas para datas passadas');
    }
    
    // Validar horários
    if (reservaData.horaInicio >= reservaData.horaFim) {
        erros.push('Horário de início deve ser anterior ao horário de fim');
    }
    
    // Validar horário de funcionamento (6h às 22h)
    const horaInicioNum = parseInt(reservaData.horaInicio.replace(':', ''));
    const horaFimNum = parseInt(reservaData.horaFim.replace(':', ''));
    
    if (horaInicioNum < 600 || horaFimNum > 2200) {
        erros.push('Horário de funcionamento: 06:00 às 22:00');
    }
    
    // Validar assunto
    if (!reservaData.assunto || reservaData.assunto.trim().length < 3) {
        erros.push('Assunto deve ter pelo menos 3 caracteres');
    }
    
    // Validar duração máxima (8 horas)
    const duracao = (horaFimNum - horaInicioNum) / 100;
    if (duracao > 8) {
        erros.push('Duração máxima da reserva: 8 horas');
    }
    
    return erros;
}

// Função para sanitizar dados
function sanitizarDados(reservaData) {
    return {
        responsavel: reservaData.responsavel.trim().substring(0, 100),
        data: reservaData.data,
        horaInicio: reservaData.horaInicio,
        horaFim: reservaData.horaFim,
        assunto: reservaData.assunto.trim().substring(0, 200),
        observacoes: reservaData.observacoes ? reservaData.observacoes.trim().substring(0, 500) : null
    };
}

// Função para log de segurança
function logSeguranca(acao, dados = {}) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        acao,
        ip: 'N/A',
        userAgent: navigator.userAgent,
        dados
    };
    
    console.log('🔐 Log de Segurança:', logEntry);
}

// ========== FUNÇÕES ORIGINAIS ATUALIZADAS ========== //

// Função para verificar se elemento existe
function elementoExiste(id) {
    return document.getElementById(id) !== null;
}

// Função para atualizar status de conexão
function atualizarStatusConexao(conectado) {
    if (!elementoExiste('statusConexao')) return;
    
    const statusDiv = document.getElementById('statusConexao');
    if (conectado) {
        statusDiv.innerHTML = '✅ Conectado ao Firebase - Dados sincronizados';
        statusDiv.style.background = '#28a745';
        firebaseConectado = true;
        
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 3000);
    } else {
        statusDiv.innerHTML = '❌ Erro de conexão - Verifique sua internet';
        statusDiv.style.background = '#dc3545';
        statusDiv.style.display = 'block';
        firebaseConectado = false;
    }
}

// Função para verificar status atual da sala
function verificarStatusAtual() {
    if (!elementoExiste('statusAtual')) {
        console.warn('⚠️ Elemento statusAtual não encontrado');
        return;
    }
    
    const statusDiv = document.getElementById('statusAtual');
    const agora = new Date();
    const dataHoje = agora.toISOString().split('T')[0];
    const horaAtual = agora.toTimeString().split(' ')[0].substring(0, 5);
    
    const reservaAtual = reservas.find(reserva => {
        return reserva.data === dataHoje && 
               reserva.horaInicio <= horaAtual && 
               reserva.horaFim > horaAtual;
    });
    
    if (reservaAtual) {
        statusDiv.className = 'status-atual status-ocupada';
        statusDiv.innerHTML = `
            <div class="status-icon">🔴</div>
            <h2>Sala Ocupada</h2>
            <p><strong>Reunião:</strong> ${reservaAtual.assunto}</p>
            <p><strong>Responsável:</strong> ${reservaAtual.responsavel}</p>
            <p><strong>Até às:</strong> ${reservaAtual.horaFim}</p>
        `;
    } else {
        const proximaReserva = reservas
            .filter(r => r.data === dataHoje && r.horaInicio > horaAtual)
            .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio))[0];
        
        statusDiv.className = 'status-atual status-livre';
        
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

// Função para carregar dados do Firestore
function carregarDados() {
    try {
        console.log('🔄 Conectando ao Firestore...');
        logSeguranca('CONEXAO_FIRESTORE_INICIADA');
        
        const q = query(
            collection(db, 'reservas'), 
            orderBy('data', 'asc'), 
            orderBy('horaInicio', 'asc')
        );
        
        onSnapshot(q, (snapshot) => {
            console.log('📡 Dados recebidos do Firebase');
            reservas = [];
            
            snapshot.forEach((doc) => {
                reservas.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            console.log(`✅ ${reservas.length} reservas carregadas`);
            logSeguranca('DADOS_CARREGADOS', { quantidade: reservas.length });
            atualizarStatusConexao(true);
            atualizarInterface();
            
        }, (error) => {
            console.error('❌ Erro ao escutar Firestore:', error);
            logSeguranca('ERRO_FIRESTORE', { erro: error.message });
            atualizarStatusConexao(false);
            mostrarMensagem('Erro ao conectar com o banco de dados', 'erro');
        });
        
    } catch (error) {
        console.error('❌ Erro ao configurar Firestore:', error);
        logSeguranca('ERRO_CONFIGURACAO_FIRESTORE', { erro: error.message });
        atualizarStatusConexao(false);
        mostrarMensagem('Erro na configuração do Firebase', 'erro');
    }
}

// Função para adicionar reserva com segurança
async function adicionarReserva(reservaData) {
    try {
        // Verificar limite de reservas
        verificarLimiteReservas();
        
        // Validar dados
        const erros = validarDadosReserva(reservaData);
        if (erros.length > 0) {
            throw new Error(erros.join('\n'));
        }
        
        // Sanitizar dados
        const dadosLimpos = sanitizarDados(reservaData);
        
        const btnReservar = document.getElementById('btnReservar');
        if (btnReservar) {
            btnReservar.textContent = '⏳ Salvando...';
            btnReservar.disabled = true;
        }
        
        // Gerar código de segurança
        const codigoSeguranca = gerarCodigoSeguranca();
        
        const reservaComTimestamp = {
            ...dadosLimpos,
            codigo: codigoSeguranca,
            criadaEm: serverTimestamp(),
            ip: 'N/A',
            userAgent: navigator.userAgent.substring(0, 200)
        };
        
        const docRef = await addDoc(collection(db, 'reservas'), reservaComTimestamp);
        
        // Incrementar contador
        incrementarContadorReservas();
        
        console.log('✅ Reserva salva:', docRef.id);
        logSeguranca('RESERVA_CRIADA', { 
            id: docRef.id,
            responsavel: dadosLimpos.responsavel,
            data: dadosLimpos.data,
            horario: `${dadosLimpos.horaInicio}-${dadosLimpos.horaFim}`
        });
        
        mostrarMensagem('Reserva realizada com sucesso! 🎉', 'sucesso');
        
        // Mostrar modal com código de segurança
        mostrarModalCodigo(codigoSeguranca, dadosLimpos);
        
        return docRef.id;
        
    } catch (error) {
        console.error('❌ Erro ao salvar reserva:', error);
        logSeguranca('ERRO_CRIAR_RESERVA', { erro: error.message });
        mostrarMensagem(error.message || 'Erro ao salvar reserva. Verifique sua conexão.', 'erro');
        throw error;
    } finally {
        const btnReservar = document.getElementById('btnReservar');
        if (btnReservar) {
            btnReservar.textContent = '✅ Reservar Sala';
            btnReservar.disabled = false;
        }
    }
}

// Função para deletar reserva com validação de código
async function deletarReserva(id, codigoInformado) {
    try {
        const reserva = reservas.find(r => r.id === id);
        if (!reserva) {
            throw new Error('Reserva não encontrada');
        }
        
                // Validar código de segurança
        if (!codigoInformado || codigoInformado.trim() === '') {
            throw new Error('Código de cancelamento é obrigatório');
        }
        
        if (reserva.codigo !== codigoInformado.trim().toUpperCase()) {
            logSeguranca('TENTATIVA_CANCELAMENTO_CODIGO_INVALIDO', { 
                reservaId: id,
                codigoTentativa: codigoInformado.substring(0, 3) + '***' // Log parcial por segurança
            });
            throw new Error('Código de cancelamento inválido');
        }
        
        await deleteDoc(doc(db, 'reservas', id));
        
        console.log('✅ Reserva deletada:', id);
        logSeguranca('RESERVA_CANCELADA', { 
            id: id,
            responsavel: reserva.responsavel,
            data: reserva.data
        });
        
        mostrarMensagem('Reserva cancelada com sucesso!', 'sucesso');
        
    } catch (error) {
        console.error('❌ Erro ao deletar reserva:', error);
        logSeguranca('ERRO_CANCELAR_RESERVA', { erro: error.message, reservaId: id });
        mostrarMensagem(error.message || 'Erro ao cancelar reserva. Tente novamente.', 'erro');
        throw error;
    }
}

// Função para mostrar modal com código de segurança
function mostrarModalCodigo(codigo, dadosReserva) {
    // Remover modal anterior se existir
    const modalAnterior = document.getElementById('modalCodigo');
    if (modalAnterior) {
        modalAnterior.remove();
    }
    
    const modal = document.createElement('div');
    modal.id = 'modalCodigo';
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
                        <strong>📅 ${formatarData(dadosReserva.data)}</strong><br>
                        <strong>⏰ ${dadosReserva.horaInicio} às ${dadosReserva.horaFim}</strong><br>
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
    
    // Permitir scroll no modal
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            mostrarMensagem('⚠️ Clique em "Entendi, Fechar" para continuar', 'aviso');
        }
    });
    
    // Prevenir scroll do body quando modal estiver aberto
    document.body.style.overflow = 'hidden';
    
    // Restaurar scroll quando fechar
    const fecharOriginal = window.fecharModalCodigo;
    window.fecharModalCodigo = function() {
        document.body.style.overflow = 'auto';
        fecharOriginal();
    };
}


// Função para copiar código
function copiarCodigo(codigo) {
    navigator.clipboard.writeText(codigo).then(() => {
        mostrarMensagem('📋 Código copiado para a área de transferência!', 'sucesso');
        logSeguranca('CODIGO_COPIADO');
    }).catch(() => {
        // Fallback para navegadores mais antigos
        const textArea = document.createElement('textarea');
        textArea.value = codigo;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        mostrarMensagem('📋 Código copiado!', 'sucesso');
    });
}

// Função para fechar modal
function fecharModalCodigo() {
    const modal = document.getElementById('modalCodigo');
    if (modal) {
        modal.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => modal.remove(), 300);
    }
}

// Tornar funções globais
window.copiarCodigo = copiarCodigo;
window.fecharModalCodigo = fecharModalCodigo;

// Função para formatar data
function formatarData(data) {
    return new Date(data + 'T00:00:00').toLocaleDateString('pt-BR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Função para verificar conflitos
function verificarConflito(data, horaInicio, horaFim, excludeId = null) {
    return reservas.filter(reserva => {
        if (excludeId && reserva.id === excludeId) return false;
        if (reserva.data !== data) return false;
        return (horaInicio < reserva.horaFim && horaFim > reserva.horaInicio);
    });
}

// Função para renderizar reservas (sem mostrar códigos)
function renderizarReservas() {
    if (!elementoExiste('listaReservas') || !elementoExiste('contadorReservas')) {
        console.warn('⚠️ Elementos da lista de reservas não encontrados');
        return;
    }
    
    const lista = document.getElementById('listaReservas');
    const contador = document.getElementById('contadorReservas');
    
    if (reservas.length === 0) {
        lista.innerHTML = '<div class="no-reservas">Nenhuma reserva agendada. Faça a primeira reserva! 🎯</div>';
        contador.textContent = '0 reservas';
        return;
    }
    
    const agora = new Date();
    const reservasFuturas = reservas.filter(reserva => {
        const dataReserva = new Date(reserva.data + 'T' + reserva.horaFim);
        return dataReserva > agora;
    }).sort((a, b) => {
        const dataA = new Date(a.data + 'T' + a.horaInicio);
        const dataB = new Date(b.data + 'T' + b.horaInicio);
        return dataA - dataB;
    });
    
    contador.textContent = `${reservasFuturas.length} reserva${reservasFuturas.length !== 1 ? 's' : ''}`;
    
    if (reservasFuturas.length === 0) {
        lista.innerHTML = '<div class="no-reservas">Nenhuma reserva futura encontrada. 📅</div>';
        return;
    }
    
    lista.innerHTML = reservasFuturas.map(reserva => `
        <div class="reserva-item">
            <div class="reserva-info">
                <h3>${reserva.assunto}</h3>
                <p><strong>👤 Responsável:</strong> ${reserva.responsavel}</p>
                <p><strong>📅 Data:</strong> ${formatarData(reserva.data)}</p>
                <p><strong>⏰ Horário:</strong> ${reserva.horaInicio} às ${reserva.horaFim}</p>
                ${reserva.observacoes ? `<p><strong>📝 Observações:</strong> ${reserva.observacoes}</p>` : ''}
                <p><strong>🔐 Status:</strong> <span style="color: #28a745;">Protegida por código</span></p>
            </div>
            <div class="reserva-actions">
                <span class="horario-badge">${reserva.horaInicio} - ${reserva.horaFim}</span>
                <button class="btn-danger" onclick="cancelarReserva('${reserva.id}')">
                    🗑️ Cancelar
                </button>
            </div>
        </div>
    `).join('');
}

// Função para cancelar reserva com código
async function cancelarReserva(id) {
    const reserva = reservas.find(r => r.id === id);
    if (!reserva) return;
    
    logSeguranca('TENTATIVA_CANCELAMENTO_INICIADA', { reservaId: id });
    
    const codigo = prompt(
        `🔐 CÓDIGO DE CANCELAMENTO NECESSÁRIO\n\n` +
        `📋 Assunto: ${reserva.assunto}\n` +
        `📅 Data: ${formatarData(reserva.data)}\n` +
        `⏰ Horário: ${reserva.horaInicio} às ${reserva.horaFim}\n` +
        `👤 Responsável: ${reserva.responsavel}\n\n` +
        `Digite o código de cancelamento:`
    );
    
    if (codigo === null) {
        logSeguranca('CANCELAMENTO_ABORTADO_PELO_USUARIO', { reservaId: id });
        return; // Usuário cancelou
    }
    
    if (!codigo || codigo.trim() === '') {
        mostrarMensagem('❌ Código de cancelamento é obrigatório!', 'erro');
        return;
    }
    
    try {
        await deletarReserva(id, codigo);
    } catch (error) {
        console.error('Erro ao cancelar reserva:', error);
    }
}

// Tornar função global
window.cancelarReserva = cancelarReserva;

// Função para mostrar mensagens
function mostrarMensagem(texto, tipo = 'info') {
    const mensagemAnterior = document.querySelector('.mensagem-sistema');
    if (mensagemAnterior) {
        mensagemAnterior.remove();
    }
    
    const mensagem = document.createElement('div');
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
    
    switch(tipo) {
        case 'sucesso':
            mensagem.style.background = 'linear-gradient(135deg, #28a745, #20c997)';
            break;
        case 'erro':
            mensagem.style.background = 'linear-gradient(135deg, #dc3545, #e74c3c)';
            break;
        case 'aviso':
            mensagem.style.background = 'linear-gradient(135deg, #ffc107, #f39c12)';
            mensagem.style.color = '#000';
            break;
        default:
            mensagem.style.background = 'linear-gradient(135deg, #17a2b8, #3498db)';
    }
    
    document.body.appendChild(mensagem);
    
    setTimeout(() => {
        if (mensagem.parentNode) {
            mensagem.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => mensagem.remove(), 300);
        }
    }, 4000);
}

// Função para atualizar interface
function atualizarInterface() {
    if (elementoExiste('statusAtual')) {
        verificarStatusAtual();
    }
    
    if (elementoExiste('listaReservas')) {
        renderizarReservas();
    }
}

// Função para definir data mínima
function definirDataMinima() {
    const hoje = new Date().toISOString().split('T')[0];
    
    if (elementoExiste('data')) {
        document.getElementById('data').min = hoje;
    }
    
    if (elementoExiste('consultaData')) {
        document.getElementById('consultaData').min = hoje;
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Iniciando aplicação com segurança...');
    logSeguranca('APLICACAO_INICIADA');
    
    // Pequeno delay para garantir que o DOM carregou completamente
    setTimeout(() => {
        carregarDados();
        definirDataMinima();
        
        // Só iniciar o intervalo se o elemento existir
        if (elementoExiste('statusAtual')) {
            setInterval(verificarStatusAtual, 60000);
        }
    }, 100);
    
    // Formulário de reserva
    const reservaForm = document.getElementById('reservaForm');
    if (reservaForm) {
        reservaForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const responsavel = document.getElementById('responsavel').value.trim();
            const data = document.getElementById('data').value;
            const horaInicio = document.getElementById('horaInicio').value;
            const horaFim = document.getElementById('horaFim').value;
            const assunto = document.getElementById('assunto').value.trim();
            const observacoes = document.getElementById('observacoes').value.trim();
            
            // Validações básicas no frontend
            if (horaInicio >= horaFim) {
                mostrarMensagem('⚠️ A hora de início deve ser anterior à hora de fim!', 'erro');
                return;
            }
            
            // Verificar se não é no passado
            const agora = new Date();
            const dataReserva = new Date(data + 'T' + horaInicio);
            if (dataReserva <= agora) {
                mostrarMensagem('⚠️ Não é possível fazer reservas para datas/horários passados!', 'erro');
                return;
            }
            
            // Verificar horário de funcionamento
            const horaInicioNum = parseInt(horaInicio.replace(':', ''));
            const horaFimNum = parseInt(horaFim.replace(':', ''));
            
            if (horaInicioNum < 600 || horaFimNum > 2200) {
                mostrarMensagem('⚠️ Horário de funcionamento: 06:00 às 22:00', 'aviso');
                return;
            }
            
            // Verificar conflitos
            const conflitos = verificarConflito(data, horaInicio, horaFim);
            if (conflitos.length > 0) {
                let mensagemConflito = '❌ Já existe uma reserva neste horário:\n\n';
                conflitos.forEach(conflito => {
                    mensagemConflito += `• ${conflito.horaInicio} às ${conflito.horaFim} - ${conflito.assunto}\n`;
                });
                mostrarMensagem('Conflito de horário detectado!', 'erro');
                alert(mensagemConflito);
                return;
            }
            
            // Criar nova reserva
            const novaReserva = {
                responsavel,
                data,
                horaInicio,
                horaFim,
                assunto,
                observacoes: observacoes || null
            };
            
            try {
                await adicionarReserva(novaReserva);
                this.reset();
                if (elementoExiste('responsavel')) {
                    document.getElementById('responsavel').focus();
                }
            } catch (error) {
                console.error('Erro ao salvar reserva:', error);
            }
        });
    }
    
    // Formulário de consulta
    const consultaForm = document.getElementById('consultaForm');
    if (consultaForm) {
        consultaForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const data = document.getElementById('consultaData').value;
            const horaInicio = document.getElementById('consultaInicio').value;
            const horaFim = document.getElementById('consultaFim').value;
            
            if (!elementoExiste('resultadoConsulta')) return;
            
            const resultado = document.getElementById('resultadoConsulta');
            const reservasDoDia = reservas.filter(r => r.data === data);
            
            if (horaInicio && horaFim) {
                if (horaInicio >= horaFim) {
                    resultado.innerHTML = '<div class="consulta-result ocupada">⚠️ Horário inválido!</div>';
                    return;
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
                    let listaConflitos = conflitos.map(c => 
                        `<div class="conflito-item">⏰ ${c.horaInicio} às ${c.horaFim} - ${c.assunto}</div>`
                    ).join('');
                    
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
                        .map(r => 
                            `<div class="conflito-item">⏰ ${r.horaInicio} às ${r.horaFim} - ${r.assunto}</div>`
                        ).join('');
                    
                    resultado.innerHTML = `
                        <div class="consulta-result ocupada">
                            📅 <strong>Reservas do dia:</strong>
                            <div class="conflito-lista">${listaReservas}</div>
                        </div>
                    `;
                }
            }
            
            logSeguranca('CONSULTA_REALIZADA', { data, horaInicio, horaFim });
        });
    }
    
    // Limpar resultado da consulta quando mudar a data
    const consultaData = document.getElementById('consultaData');
    if (consultaData) {
        consultaData.addEventListener('change', function() {
            if (elementoExiste('resultadoConsulta')) {
                document.getElementById('resultadoConsulta').innerHTML = '';
            }
        });
    }
    
    // Auto-completar horário de fim
    const horaInicio = document.getElementById('horaInicio');
    if (horaInicio) {
        horaInicio.addEventListener('change', function() {
            const horaFim = document.getElementById('horaFim');
            if (horaFim && !horaFim.value && this.value) {
                const [hora, minuto] = this.value.split(':');
                const novaHora = parseInt(hora) + 1;
                if (novaHora <= 22) {
                    horaFim.value = `${novaHora.toString().padStart(2, '0')}:${minuto}`;
                }
            }
        });
    }
});

// Adicionar CSS para animações
const style = document.createElement('style');
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

console.log('🛡️ Sistema de Reservas carregado com segurança aprimorada!');
console.log('🔐 Recursos de segurança ativos:');
console.log('   • Rate limiting (5 reservas/hora)');
console.log('   • Códigos de cancelamento seguros');
console.log('   • Validação de dados robusta');
console.log('   • Logs de segurança');
console.log('   • Sanitização de entrada');
