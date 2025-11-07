# 🧪 Checklist de Teste - Sistema de Reserva de Sala

**Data:** 04/11/2025  
**Versão:** 1.0

---

## 📋 TESTE RÁPIDO (5 minutos)

Execute estes testes básicos para validação rápida:

- [ ] 1. **Abrir a aplicação** - página carrega sem erros
- [ ] 2. **Modal de login aparece** - bloqueia acesso não autenticado
- [ ] 3. **Login com Google** - @pge.sc.gov.br funciona
- [ ] 4. **Ver calendário** - mês atual com dias
- [ ] 5. **Criar uma reserva** - formulário salva corretamente
- [ ] 6. **Calendário atualiza** - dia fica vermelho
- [ ] 7. **Clicar no dia** - mostra reservas
- [ ] 8. **Cancelar reserva** - apenas se for sua
- [ ] 9. **Logout** - volta ao modal de login

**Resultado Esperado:** ✅ Todos os itens funcionando

---

## 🔐 TESTES DE AUTENTICAÇÃO

### Teste 1: Modal de Login

- [ ] **Abrir aplicação sem login**
  - ✅ Modal aparece automaticamente
  - ✅ Não é possível fechar o modal
  - ✅ Botão "Login com Google" visível

### Teste 2: Login Válido (@pge.sc.gov.br)

1. [ ] Clicar em "Login com Google"
2. [ ] Selecionar conta @pge.sc.gov.br
3. [ ] **Verificar:**
   - ✅ Modal fecha
   - ✅ Aparece "Bem-vindo, [Nome]"
   - ✅ Botão "Sair" aparece
   - ✅ Mensagem de sucesso (6s)
   - ✅ Badge "Sincronizando..." aparece e desaparece
   - ✅ Console mostra: `🗂️ [CACHE]` → `📡 [FIREBASE]`

### Teste 3: Login Inválido (outro domínio)

1. [ ] Tentar login com Gmail pessoal
2. [ ] **Verificar:**
   - ✅ Mensagem de erro aparece
   - ✅ Modal mostra erro em vermelho
   - ✅ Logout automático após 100ms
   - ✅ Volta ao modal de login

### Teste 4: Logout

1. [ ] Clicar em "Sair"
2. [ ] **Verificar:**
   - ✅ Mensagem "Logout realizado com sucesso!"
   - ✅ Página recarrega após 500ms
   - ✅ Modal de login reaparece

**Console F12 esperado:**

```
🔐 Log de Segurança: {acao: "USUARIO_AUTENTICADO", ...}
✅ [FIREBASE] X reservas sincronizadas do servidor
```

---

## 📅 TESTES DE CALENDÁRIO

### Teste 5: Renderização do Calendário

- [ ] **Verificar elementos:**
  - ✅ Título do mês/ano correto
  - ✅ Setas de navegação (◀ ▶)
  - ✅ Dias da semana (Dom-Sáb)
  - ✅ Grade com 42 células (6 semanas)
  - ✅ Legenda (tem reunião, hoje, outro mês)

### Teste 6: Navegação entre Meses

1. [ ] Clicar em **▶** (próximo mês)
   - ✅ Título atualiza
   - ✅ Dias renderizam corretamente
2. [ ] Clicar em **◀** (mês anterior)
   - ✅ Volta ao mês anterior
   - ✅ Dias corretos

### Teste 7: Indicadores Visuais

- [ ] **Dia de hoje:**
  - ✅ Fundo azul (#007bff)
  - ✅ Texto branco e negrito
- [ ] **Dia com reserva:**
  - ✅ Borda/fundo vermelho
  - ✅ Contador de reservas aparece
- [ ] **Outro mês:**
  - ✅ Texto cinza claro
  - ✅ Não é clicável

### Teste 8: Clique no Dia

1. [ ] Clicar em um dia **sem** reservas
   - ✅ Scroll suave até #resultadoConsulta
   - ✅ Mensagem: "Dia totalmente livre!"
2. [ ] Clicar em um dia **com** reservas
   - ✅ Lista de reservas aparece
   - ✅ Horários ordenados
   - ✅ Scroll suave até lista

**Console esperado:**

```
🔐 Log de Segurança: {acao: "CONSULTA_REALIZADA", data: "2025-11-04"}
```

---

## ➕ TESTES DE CRIAÇÃO DE RESERVA

### Teste 9: Validação de Campos Obrigatórios

1. [ ] Tentar enviar formulário vazio
   - ✅ HTML5 validation impede
2. [ ] Preencher apenas alguns campos
   - ✅ Mensagem de campo obrigatório

### Teste 10: Validação de Antecedência (30 min)

1. [ ] Tentar reservar para **daqui a 15 minutos**
   - ✅ Erro: "mínimo 30 minutos de antecedência"
   - ✅ Mensagem mostra tempo restante
2. [ ] Tentar reservar para **horário já passado**
   - ✅ Erro: "horários que já passaram"

### Teste 11: Validação de Horário

1. [ ] Hora início >= Hora fim
   - ✅ Erro: "início deve ser anterior ao fim"
2. [ ] Fora do horário de funcionamento (06:00-22:00)
   - ✅ Erro: "Horário de funcionamento: 06:00 às 22:00"

### Teste 12: Validação de Conflitos

1. [ ] Criar reserva 10:00-11:00
2. [ ] Tentar criar 10:30-11:30
   - ✅ Erro: "Já existe uma reserva neste horário"
   - ✅ Alert mostra horários conflitantes

### Teste 13: Criação com Sucesso

1. [ ] Preencher todos os campos válidos:
   - Data: amanhã
   - Hora início: 10:00
   - Hora fim: 11:00
   - Assunto: "Teste de Reunião"
2. [ ] Clicar "Reservar Sala"
3. [ ] **Verificar:**
   - ✅ Botão muda para "⏳ Salvando..."
   - ✅ Modal de confirmação aparece
   - ✅ Mensagem "Reserva realizada com sucesso! 🎉"
   - ✅ Calendário atualiza (dia fica vermelho)
   - ✅ Aparece na lista "Próximas Reservas"
   - ✅ Formulário limpa

**Console esperado:**

```
✅ Reserva salva: [ID]
🔐 Log de Segurança: {acao: "RESERVA_CRIADA", ...}
💾 Cache local atualizado com dados do servidor
```

### Teste 14: Rate Limiting

1. [ ] Criar **5 reservas** seguidas
2. [ ] Tentar criar a **6ª reserva**
   - ✅ Erro: "Limite de 5 reservas por hora excedido"

---

## 🗑️ TESTES DE CANCELAMENTO

### Teste 15: Cancelar Própria Reserva

1. [ ] Localizar reserva que você criou
2. [ ] Clicar em "🗑️ Cancelar"
3. [ ] **Verificar:**
   - ✅ Alert de confirmação aparece
   - ✅ Mostra detalhes da reserva
4. [ ] Confirmar cancelamento
   - ✅ Reserva removida da lista
   - ✅ Calendário atualiza (dia pode ficar sem vermelho)
   - ✅ Mensagem "Reserva cancelada com sucesso!"

**Console esperado:**

```
✅ Reserva deletada: [ID]
🔐 Log de Segurança: {acao: "RESERVA_CANCELADA", ...}
```

### Teste 16: Tentar Cancelar Reserva de Outro

1. [ ] Fazer login com conta A
2. [ ] Criar uma reserva
3. [ ] Fazer logout
4. [ ] Fazer login com conta B
5. [ ] Tentar cancelar a reserva da conta A
   - ✅ Erro: "Apenas o responsável pela reserva pode cancelar."

---

## 🔄 TESTES DE SINCRONIZAÇÃO EM TEMPO REAL

### Teste 17: Múltiplas Abas

1. [ ] Abrir sistema em **2 abas** (mesmo navegador)
2. [ ] Fazer login em ambas
3. [ ] Na **aba 1**: criar uma reserva
4. [ ] **Verificar na aba 2:**
   - ✅ Reserva aparece automaticamente (sem F5)
   - ✅ Calendário atualiza
   - ✅ Lista de reservas atualiza

### Teste 18: Cache e Reload

1. [ ] Criar uma reserva
2. [ ] Recarregar a página (F5)
3. [ ] **Verificar:**
   - ✅ Reserva aparece imediatamente (cache)
   - ✅ Badge "Sincronizando..." aparece
   - ✅ Dados confirmados do servidor

**Console esperado:**

```
🗂️ [CACHE] Carregado do cache local: X reservas (aguardando dados reais...)
📡 Sincronizando com servidor...
📡 [FIREBASE] Dados recebidos em tempo real do Firestore
✅ [FIREBASE] X reservas sincronizadas do servidor
💾 Cache local atualizado
```

---

## 📱 TESTES DE INTERFACE (UX)

### Teste 19: Mensagens do Sistema

- [ ] **Mensagem de sucesso:**
  - ✅ Fundo verde, 6 segundos
  - ✅ Clicável para fechar
  - ✅ Tooltip "Clique para fechar"
- [ ] **Mensagem de erro:**
  - ✅ Fundo vermelho, até 10 segundos
  - ✅ Clicável para fechar
- [ ] **Mensagem de aviso:**
  - ✅ Fundo amarelo, texto preto, até 10 segundos

### Teste 20: Status da Sala

- [ ] **Durante uma reunião:**
  - ✅ Ícone 🔴
  - ✅ "Sala Ocupada"
  - ✅ Detalhes da reunião atual
- [ ] **Fora de reunião:**
  - ✅ Ícone 🟢
  - ✅ "Sala Disponível"
  - ✅ Info da próxima reunião (se houver)

### Teste 21: Lista de Reservas

- [ ] **Verificar:**
  - ✅ Mostra apenas reservas futuras
  - ✅ Ordenadas por data/hora
  - ✅ Contador correto "X reservas"
  - ✅ Badge de horário
  - ✅ Botão de cancelar visível

---

## 🔒 TESTES DE SEGURANÇA

### Teste 22: Firestore Rules

1. [ ] **Teste via Console Firestore:**
   - Tentar criar documento sem auth → ❌ Bloqueado
   - Tentar deletar reserva de outro → ❌ Bloqueado

### Teste 23: Sanitização de Dados

1. [ ] Assunto: `<script>alert('XSS')</script>`
   - ✅ Salvo como texto puro (sem executar)
2. [ ] Assunto com 500 caracteres
   - ✅ Truncado para 200 caracteres

### Teste 24: Validação de Tipos

1. [ ] Tentar manipular via DevTools
2. [ ] Enviar data inválida
   - ✅ Firestore Rules bloqueiam

---

## 🌐 TESTES RESPONSIVOS

### Teste 25: Mobile (< 768px)

- [ ] **Verificar:**
  - ✅ Layout em coluna única
  - ✅ Calendário ocupa largura total
  - ✅ Formulário legível
  - ✅ Botões clicáveis (min 44px)

### Teste 26: Tablet (768px - 1024px)

- [ ] **Verificar:**
  - ✅ Grade de 2 colunas
  - ✅ Calendário e formulário lado a lado

### Teste 27: Desktop (> 1024px)

- [ ] **Verificar:**
  - ✅ Layout completo
  - ✅ Logos no header
  - ✅ Todos os elementos visíveis

---

## 📊 RESULTADO FINAL

### Resumo de Testes

| Categoria     | Total  | Passou | Falhou |
| ------------- | ------ | ------ | ------ |
| Autenticação  | 4      | \_\_\_ | \_\_\_ |
| Calendário    | 4      | \_\_\_ | \_\_\_ |
| Criação       | 6      | \_\_\_ | \_\_\_ |
| Cancelamento  | 2      | \_\_\_ | \_\_\_ |
| Sincronização | 2      | \_\_\_ | \_\_\_ |
| Interface     | 3      | \_\_\_ | \_\_\_ |
| Segurança     | 3      | \_\_\_ | \_\_\_ |
| Responsivo    | 3      | \_\_\_ | \_\_\_ |
| **TOTAL**     | **27** | \_\_\_ | \_\_\_ |

### Critério de Aprovação

- ✅ **100% dos testes:** Sistema PRONTO para produção
- ⚠️ **90-99%:** Pequenos ajustes necessários
- ❌ **< 90%:** Revisão necessária

---

## 🐛 BUGS ENCONTRADOS

### Bug #1

- **Descrição:**
- **Passos para reproduzir:**
- **Comportamento esperado:**
- **Comportamento atual:**
- **Prioridade:** 🔴 Alta | 🟡 Média | 🟢 Baixa

---

## 📝 OBSERVAÇÕES

**Notas do Teste:**

-
-

**Ambiente de Teste:**

- Navegador:
- OS:
- Data:
- Testador:

---

**Status Final:** [ ] ✅ Aprovado | [ ] ⚠️ Com Ressalvas | [ ] ❌ Reprovado
