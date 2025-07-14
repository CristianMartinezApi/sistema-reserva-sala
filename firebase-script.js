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

// Configuração do Firebase
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

// ========== NOVA FUNÇÃO: GERAR CÓDIGO DE SEGURANÇA ==========
function gerarCodigoSeguranca() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let codigo = '';
    for (let i = 0; i < 6; i++) {
        codigo += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return codigo;
}

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
            atualizarStatusConexao(true);
            atualizarInterface();
            
        }, (error) => {
            console.error('❌ Erro ao escutar Firestore:', error);
            atualizarStatusConexao(false);
            mostrarMensagem('Erro ao conectar com o banco de dados', 'erro');
        });
        
    } catch (error) {
        console.error('❌ Erro ao configurar Firestore:', error);
        atualizarStatusConexao(false);
        mostrarMensagem('Erro na configuração do Firebase', 'erro');
    }
}

// ========== FUNÇÃO MODIFICADA: ADICIONAR RESERVA COM CÓDIGO ==========
async function adicionarReserva(reservaData) {
    try {
        const btnReservar = document.getElementById('btnReservar');
        if (btnReservar) {
            btnReservar.textContent = '⏳ Salvando...';
            btnReservar.disabled = true;
        }
        
        // Gerar código de segurança
        const codigoSeguranca = gerarCodigoSeguranca();
        
        const reservaComTimestamp = {
            ...reservaData,
            codigoSeguranca: codigoSeguranca, // NOVO: Adicionar código
            criadaEm: serverTimestamp()
        };
        
        const docRef = await addDoc(collection(db, 'reservas'), reservaComTimestamp);
        console.log('✅ Reserva salva:', docRef.id);
        
        // NOVO: Mostrar modal com código - ÚNICA VEZ
        mostrarModalCodigo(reservaData, codigoSeguranca);
        
        mostrarMensagem('Reserva realizada com sucesso! 🎉', 'sucesso');
        
        return docRef.id;
        
    } catch (error) {
        console.error('❌ Erro ao salvar reserva:', error);
        mostrarMensagem('Erro ao salvar reserva. Verifique sua conexão.', 'erro');
        throw error;
    } finally {
        const btnReservar = document.getElementById('btnReservar');
        if (btnReservar) {
            btnReservar.textContent = '✅ Reservar Sala';
            btnReservar.disabled = false;
        }
    }
}

// ========== NOVA FUNÇÃO: MODAL PARA MOSTRAR CÓDIGO (ÚNICA VEZ) ==========
function mostrarModalCodigo(reservaData, codigo) {
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
        background: rgba(0,0,0,0.9);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 3000;
        animation: fadeIn 0.3s ease;
    `;
    
    modal.innerHTML = `
        <div style="
            background: white;
            padding: 2.5rem;
            border-radius: 15px;
            max-width: 550px;
            width: 90%;
            text-align: center;
            box-shadow: 0 15px 40px rgba(0,0,0,0.4);
            border: 3px solid #ffc107;
        ">
            <div style="
                background: linear-gradient(135deg, #28a745, #20c997);
                color: white;
                padding: 1.5rem;
                border-radius: 10px;
                margin-bottom: 2rem;
            ">
                <h2 style="margin: 0; font-size: 1.8rem;">🎉 Reserva Confirmada!</h2>
            </div>
            
            <div style="
                background: #f8f9fa;
                padding: 1.5rem;
                border-radius: 10px;
                margin-bottom: 2rem;
                text-align: left;
                border-left: 4px solid #007bff;
            ">
                <p style="margin: 0.7rem 0; font-size: 16px;"><strong>📋 Assunto:</strong> ${reservaData.assunto}</p>
                <p style="margin: 0.7rem 0; font-size: 16px;"><strong>👤 Responsável:</strong> ${reservaData.responsavel}</p>
                <p style="margin: 0.7rem 0; font-size: 16px;"><strong>📅 Data:</strong> ${formatarData(reservaData.data)}</p>
                <p style="margin: 0.7rem 0; font-size: 16px;"><strong>⏰ Horário:</strong> ${reservaData.horaInicio} às ${reservaData.horaFim}</p>
                ${reservaData.observacoes ? `<p style="margin: 0.7rem 0; font-size: 16px;"><strong>📝 Observações:</strong> ${reservaData.observacoes}</p>` : ''}
            </div>
            
            <div style="
                background: linear-gradient(135deg, #fff3cd, #ffeaa7);
                border: 3px solid #ffc107;
                padding: 2rem;
                border-radius: 12px;
                margin-bottom: 2rem;
                box-shadow: 0 5px 15px rgba(255,193,7,0.3);
            ">
                <h3 style="
                    margin: 0 0 1rem 0; 
                    color: #856404; 
                    font-size: 1.4rem;
                    text-transform: uppercase;
                ">🔐 Código de Cancelamento</h3>
                
                <div style="
                    background: white;
                    padding: 1.5rem;
                    border-radius: 8px;
                    border: 2px dashed #ffc107;
                    margin-bottom: 1.5rem;
                ">
                    <div style="
                        font-size: 42px;
                        font-weight: bold;
                        color: #dc3545;
                        letter-spacing: 8px;
                        font-family: 'Courier New', monospace;
                        text-shadow: 2px 2px 4px rgba(0,0,0,0.1);
                    ">
                        ${codigo}
                    </div>
                </div>
                
                <div style="
                    background: #dc3545;
                    color: white;
                    padding: 1rem;
                    border-radius: 8px;
                    margin-bottom: 1rem;
                ">
                    <p style="
                        margin: 0;
                        font-weight: bold;
                        font-size: 16px;
                    ">
                        ⚠️ ATENÇÃO: ANOTE ESTE CÓDIGO AGORA!
                    </p>
                </div>
                
                <p style="
                    margin: 0;
                    color: #856404;
                    font-weight: bold;
                    font-size: 14px;
                    line-height: 1.4;
                ">
                    • Este código será necessário para cancelar a reserva<br>
                    • Ele NÃO aparecerá novamente em lugar nenhum<br>
                    • Guarde em local seguro ou tire uma foto
                </p>
            </div>
            
            <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
                <button onclick="copiarCodigo('${codigo}')" style="
                    background: linear-gradient(135deg, #17a2b8, #138496);
                    color: white;
                    border: none;
                    padding: 1rem 2rem;
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: bold;
                    font-size: 16px;
                    box-shadow: 0 4px 10px rgba(23,162,184,0.3);
                ">
                    📋 Copiar Código
                </button>
                
                <button onclick="fecharModalCodigo()" style="
                    background: linear-gradient(135deg, #28a745, #20c997);
                    color: white;
                    border: none;
                    padding: 1rem 2rem;
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: bold;
                    font-size: 16px;
                    box-shadow: 0 4px 10px rgba(40,167,69,0.3);
                ">
                    ✅ Anotei o Código
                </button>
            </div>
            
            <p style="
                margin-top: 1.5rem;
                font-size: 13px;
                color: #6c757d;
                font-style: italic;
            ">
                💡 Dica: Salve o código no seu celular ou agenda
            </p>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// ========== NOVA FUNÇÃO: COPIAR CÓDIGO ==========
function copiarCodigo(codigo) {
    navigator.clipboard.writeText(codigo).then(() => {
        mostrarMensagem('📋 Código copiado! Cole em local seguro.', 'sucesso');
    }).catch(() => {
        // Fallback para navegadores mais antigos
        const textArea = document.createElement('textarea');
        textArea.value = codigo;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        mostrarMensagem('📋 Código copiado!', 'sucesso');
    });
}

// ========== NOVA FUNÇÃO: FECHAR MODAL COM CONFIRMAÇÃO ==========
function fecharModalCodigo() {
    const confirmacao = confirm(
        '⚠️ CONFIRMAÇÃO IMPORTANTE\n\n' +
        'Você anotou o código de cancelamento?\n\n' +
        '• Este código NÃO aparecerá novamente\n' +
        '• Será necessário para cancelar a reserva\n\n' +
        'Confirma que anotou o código?'
    );
    
    if (confirmacao) {
        const modal = document.getElementById('modalCodigo');
        if (modal) {
            modal.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => {
                modal.remove();
            }, 300);
        }
    } else {
        mostrarMensagem('⚠️ Anote o código antes de continuar!', 'aviso');
    }
}

// Função para deletar reserva
async function deletarReserva(id) {
    try {
        await deleteDoc(doc(db, 'reservas', id));
        console.log('✅ Reserva deletada:', id);
        mostrarMensagem('Reserva cancelada com sucesso!', 'sucesso');
    } catch (error) {
        console.error('❌ Erro ao deletar reserva:', error);
        mostrarMensagem('Erro ao cancelar reserva. Tente novamente.', 'erro');
        throw error;
    }
}

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

// Função para renderizar reservas
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

// ========== FUNÇÃO MODIFICADA: CANCELAR COM CÓDIGO ==========
async function cancelarReserva(id) {
    const reserva = reservas.find(r => r.id === id);
    if (!reserva) {
        mostrarMensagem('❌ Reserva não encontrada!', 'erro');
        return;
    }
    
    // Solicitar código de cancelamento
    const codigoInformado = prompt(
        '🔐 CANCELAMENTO DE RESERVA\n\n' +
        `📋 Assunto: ${reserva.assunto}\n` +
        `👤 Responsável: ${reserva.responsavel}\n` +
        `📅 Data: ${formatarData(reserva.data)}\n` +
        `⏰ Horário: ${reserva.horaInicio} às ${reserva.horaFim}\n\n` +
        'Digite o código de cancelamento:'
    );
    
    // Verificar se usuário cancelou ou não digitou nada
    if (!codigoInformado) {
        mostrarMensagem('❌ Código necessário para cancelamento', 'aviso');
        return;
    }
    
    // Verificar se código está correto
    if (codigoInformado.toUpperCase().trim() !== reserva.codigoSeguranca) {
        mostrarMensagem('❌ Código inválido! Verifique e tente novamente.', 'erro');
        return;
    }
    
    // Confirmação final
    const confirmacao = confirm(
        '✅ CÓDIGO VÁLIDO!\n\n' +
        `Confirma o cancelamento da reserva?\n\n` +
        `📋 ${reserva.assunto}\n` +
        `👤 ${reserva.responsavel}\n` +
        `📅 ${formatarData(reserva.data)}\n` +
        `⏰ ${reserva.horaInicio} às ${reserva.horaFim}`
    );
    
    if (confirmacao) {
        try {
            await deletarReserva(id);
            mostrarMensagem('✅ Reserva cancelada com sucesso!', 'sucesso');
        } catch (error) {
            console.error('Erro ao cancelar reserva:', error);
            mostrarMensagem('❌ Erro ao cancelar reserva. Tente novamente.', 'erro');
        }
    }
}

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
    console.log('🚀 Iniciando aplicação...');
    
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
            
            // Validações
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

// ========== TORNAR FUNÇÕES GLOBAIS ==========
window.cancelarReserva = cancelarReserva;
window.copiarCodigo = copiarCodigo;
window.fecharModalCodigo = fecharModalCodigo;

console.log('🎉 Sistema de Reservas carregado com sistema de códigos de segurança!');
