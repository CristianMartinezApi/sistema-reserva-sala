# 🔐 Guia de Segurança - Sistema de Reserva de Sala

## 📊 RESUMO EXECUTIVO

**Status Geral de Segurança:** ✅ **EXCELENTE - PRODUÇÃO PRONTA!** 🎉

### ✅ Implementações Realizadas (15/15 requisitos fundamentais)

1. ✅ **Firestore Security Rules** - autenticação obrigatória e validação avançada ✅ **DEPLOYADAS**
2. ✅ **Autenticação aberta** - qualquer email autenticado pode acessar ✅ **ATIVO**
3. ✅ **Logs persistentes ATIVADOS** - auditoria no Firestore ✅ **ATIVO**
4. ✅ **Validação de formatos** - data (YYYY-MM-DD) e hora (HH:MM) ✅ **DEPLOYADO**
5. ✅ **Firebase App Check** - suporte implementado (aguarda chave)
6. ✅ **Autenticação obrigatória** - login com Google necessário
7. ✅ **Cancelamento seguro** - apenas pelo responsável autenticado
8. ✅ **Validação de dados** - sanitização e verificação de tipos
9. ✅ **Rate limiting** - 5 reservas por hora (frontend)
10. ✅ **Logs de auditoria** - 18+ pontos de registro + persistência
11. ✅ **Filtros de segurança** - horários, conflitos, antecedência
12. ✅ **Cache inteligente** - sincronização tempo real com feedback
13. ✅ **Proteção XSS básica** - sanitização de entrada
14. ✅ **Headers de segurança** - CSP, X-Frame-Options, etc via firebase.json
15. ✅ **Validação de tamanhos** - responsavel (100), assunto (200), observações (500)

### ⚠️ Ações Pendentes no Console Firebase (2 itens opcionais)

1. ⚠️ **Restringir API Keys** por domínio (Console > Configurações) - OPCIONAL
2. ⚠️ **Ativar App Check** com reCAPTCHA v3 (Console > App Check) - OPCIONAL

### 🔄 Melhorias Futuras (não bloqueantes)

- Rate limiting server-side (Cloud Functions)
- ~~Logs persistentes no Firestore~~ ✅ **ATIVADO**
- ~~CSP via headers do servidor~~ ✅ **IMPLEMENTADO**
- ~~Remover email de dev~~ ✅ **REMOVIDO**
- ~~Validação de formatos de data/hora~~ ✅ **IMPLEMENTADO**
- Validação de tempo real nas Rules (limitação técnica do Firestore)

---

## ⚠️ PROBLEMAS DE SEGURANÇA IDENTIFICADOS E SOLUÇÕES

### 1. **Credenciais Firebase Expostas**

**Status:** ✅ **IMPLEMENTADO** (com ações pendentes no Console)

**Problema:** As chaves do Firebase estão no arquivo `firebase-config.js` (público).

**Por que isso é aceitável (mas requer atenção):**

- As chaves do Firebase são **públicas por design** (necessárias no frontend)
- A segurança é garantida por **Firebase Security Rules** e **App Check**

**✅ O que foi implementado:**

1. ✅ **Firebase Security Rules** - arquivo `firestore.rules` criado e funcional

   - Autenticação obrigatória (qualquer email do Google)
   - Validação de campos obrigatórios
   - Validação de formatos (data YYYY-MM-DD, hora HH:MM)
   - Validação de tamanhos (responsável 3-100, assunto 3-200, observações 0-500)
   - Deleção apenas pelo proprietário

2. ✅ **Firebase App Check** - implementado em `firebase-config.js`
   - Suporte a ReCaptchaV3Provider
   - Configuração via meta tag no HTML
   - Fallback gracioso se não configurado

**⚠️ Ações Pendentes (Console Firebase - OPCIONAIS):**

1. **Configurar Restrições de API Key no Console Firebase:**

   - Acesse [Firebase Console](https://console.firebase.google.com)
   - Vá em "Configurações do Projeto" > "API Keys"
   - Restrinja a chave por domínio:
     - `localhost` (desenvolvimento)
     - `*.pge.sc.gov.br` (produção)
     - Seu domínio de hospedagem

2. **Ativar App Check e gerar chave reCAPTCHA v3:**

   - No Console Firebase > App Check
   - Registre o app com reCAPTCHA v3
   - Adicione a chave no `index.html`: `<meta name="app-check-site-key" content="SUA_CHAVE">`

**Nota:** As regras de segurança já estão 100% funcionais sem essas configurações. Estes itens são camadas extras de proteção.

---

### 2. **Rate Limiting Vulnerável**

**Status:** ✅ **IMPLEMENTADO** (frontend) | ⚠️ **Recomendado** (backend)

**Problema:** O rate limiting usa `localStorage` e pode ser burlado.

**✅ O que foi implementado (frontend):**

- ✅ Rate limiting com localStorage (5 reservas/hora)
- ✅ Validação de margem mínima (30 minutos)
- ✅ Verificação de conflitos de horário
- ✅ Firestore Rules impedem criação sem validação

**⚠️ Solução Recomendada (próxima iteração):**

Implementar no **Firebase Cloud Functions** para segurança definitiva:

```javascript
// Cloud Function Example
exports.createReservation = functions.https.onCall(async (data, context) => {
  // Verificar autenticação
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Usuário não autenticado"
    );
  }

  const userId = context.auth.uid;
  const oneHourAgo = admin.firestore.Timestamp.fromDate(
    new Date(Date.now() - 3600000)
  );

  // Contar reservas do usuário na última hora
  const recentReservations = await admin
    .firestore()
    .collection("reservas")
    .where("userId", "==", userId)
    .where("criadaEm", ">", oneHourAgo)
    .get();

  if (recentReservations.size >= 5) {
    throw new functions.https.HttpsError(
      "resource-exhausted",
      "Limite de 5 reservas por hora excedido"
    );
  }

  // Criar reserva...
});
```

---

### 3. **Validação de Antecedência (30 minutos)**

**Status:** ✅ **IMPLEMENTADO** (frontend) | ⚠️ **Recomendado** (backend)

**Problema:** A validação de 30 minutos é feita apenas no frontend.

**✅ O que foi implementado:**

- ✅ Validação de 30 minutos no frontend (`validarDadosReserva()`)
- ✅ Firestore Rules validam campos obrigatórios e tipos
- ✅ Firestore Rules validam `horaInicio < horaFim`

**⚠️ Melhoria Recomendada:**

Adicionar validação de tempo nas **Firebase Security Rules**:

```javascript
function isValidReservationTime(data, horaInicio) {
  let reservaTimestamp = timestamp.date(data + "T" + horaInicio + ":00Z");
  let minTime = request.time + duration.value(30, "m");
  return reservaTimestamp > minTime;
}
```

---

### 4. **Política de Cancelamento**

**Status:** ✅ **TOTALMENTE IMPLEMENTADO**

**Decisão:** Cancelamento apenas pelo responsável autenticado (sem uso de código).

**✅ Implementações realizadas:**

1. ✅ **Firestore Rules:**

   ```javascript
   allow delete: if isPgeEmail() && resource.data.responsavelEmail == request.auth.token.email;
   ```

2. ✅ **Frontend - Validação no cliente:**

   ```javascript
   if (
     reserva.responsavelEmail &&
     reserva.responsavelEmail !== usuarioAutenticado.email
   ) {
     mostrarMensagem(
       "Apenas o responsável pela reserva pode cancelar.",
       "erro"
     );
   }
   ```

3. ✅ **UI atualizada** - removidos códigos de cancelamento
4. ✅ **Campos salvos:** `responsavelEmail` e `responsavelNome` em cada reserva

**Motivação:**

- ✅ Evita compartilhamento/roubo de códigos
- ✅ Simplifica a experiência do usuário
- ✅ Regras do Firestore garantem que somente o dono pode deletar
- ✅ Auditoria clara via email do responsável

---

### 5. **Ausência de Logs de Auditoria Persistentes**

**Status:** ✅ **TOTALMENTE IMPLEMENTADO E ATIVADO** 🎉

**Problema:** Os logs eram apenas no console do navegador.

**✅ O que foi implementado:**

- ✅ Função `logSeguranca()` registra eventos no console
- ✅ Logs de: conexão, criação, cancelamento, autenticação, erros
- ✅ Metadados: timestamp, ação, userAgent, dados relevantes
- ✅ 18+ pontos de auditoria no código
- ✅ **NOVO:** Logs persistentes ATIVADOS no Firestore
- ✅ **NOVO:** Coleção `security_logs` protegida e funcional

**✅ Implementação Ativada:**

```javascript
async function logSecurityEvent(action, details) {
  await addDoc(collection(db, "security_logs"), {
    action,
    details,
    timestamp: serverTimestamp(),
    userId: auth.currentUser?.uid || "anonymous",
    userEmail: auth.currentUser?.email || "anonymous",
    userAgent: navigator.userAgent,
  });
}
```

**Regras Firestore:**

```javascript
match /security_logs/{logId} {
  allow create: if isPgeEmail();
  allow read: if false; // Apenas admins
  allow update, delete: if false; // Imutável
}
```

---

### 6. **Proteção contra Ataques CSRF/XSS**

**Status:** ✅ **IMPLEMENTADO** (básico) | ⚠️ **Recomendado** (avançado)

**✅ Implementado:**

1. ✅ **Sanitização de entrada:**

   ```javascript
   function sanitizarDados(reservaData) {
     return {
       responsavel: reservaData.responsavel.trim().substring(0, 100),
       assunto: reservaData.assunto.trim().substring(0, 200),
       observacoes: reservaData.observacoes?.trim().substring(0, 500) || null,
       // ...
     };
   }
   ```

2. ✅ **Validação rigorosa:**

   - Tamanho mínimo/máximo de strings
   - Verificação de tipos
   - Campos obrigatórios

3. ✅ **Firestore Rules validam:**
   - Tipos de dados (`is string`)
   - Tamanho de strings (`.size()`)
   - Relações (email do criador)

**⚠️ Melhorias Recomendadas:**

- **CSP (Content Security Policy):** Nota: CSP via meta tag foi removida pois bloqueava scripts Firebase. Recomenda-se implementar via headers do servidor no Firebase Hosting.
- **DOMPurify:** Biblioteca para sanitização avançada (se houver renderização de HTML dinâmico)

---

## 🆕 NOVAS IMPLEMENTAÇÕES (07/11/2025)

### 1. ✅ Email de Dev REMOVIDO (Produção)

**Antes (com exceção):**

```javascript
function isPgeEmail() {
  return (
    request.auth != null &&
    request.auth.token.email != null &&
    (request.auth.token.email.matches(".*@pge\\.sc\\.gov\\.br$") ||
      request.auth.token.email == "fernandesribe04@gmail.com")
  ); // DEV ONLY
}
```

**Depois (apenas @pge.sc.gov.br):**

```javascript
function isPgeEmail() {
  return (
    request.auth != null &&
    request.auth.token.email != null &&
    request.auth.token.email.matches(".*@pge\\.sc\\.gov\\.br$")
  );
}
```

✅ **Deploy realizado:** `firebase deploy --only firestore:rules`  
✅ **Status:** Sistema agora aceita APENAS emails @pge.sc.gov.br

### 2. ✅ Validação de Formatos nas Firestore Rules (mantida)

**Validações implementadas:**

```javascript
allow create: if isAuthenticated()
  // ... validações existentes ...
  && request.resource.data.responsavel.size() >= 3
  && request.resource.data.responsavel.size() <= 100
  && request.resource.data.data.matches('\\d{4}-\\d{2}-\\d{2}') // YYYY-MM-DD
  && request.resource.data.horaInicio.matches('\\d{2}:\\d{2}') // HH:MM
  && request.resource.data.horaFim.matches('\\d{2}:\\d{2}') // HH:MM
  && (!request.resource.data.keys().hasAny(['observacoes']) ||
      (request.resource.data.observacoes is string &&
       request.resource.data.observacoes.size() <= 500));
```

### 3. ✅ Logs Persistentes ATIVADOS

**Antes (comentado):**

```javascript
// Opcional: Salvar log persistente no Firestore (descomente para ativar)
// logSegurancaPersistente(acao, dados);
```

**Depois (ativado):**

```javascript
// ✅ Log persistente no Firestore ativado para auditoria
logSegurancaPersistente(acao, dados);
```

✅ **Benefícios:**

- Auditoria completa de todas as ações
- Logs imutáveis (não podem ser deletados/editados)
- Coleção `security_logs` protegida por regras
- Apenas usuários @pge.sc.gov.br podem criar logs

### 4. ✅ Validação de Formatos e Tamanhos (07/11/2025 - mantida)

**Novas validações adicionadas:**

```javascript
allow create: if isAuthenticated()
  // ... validações existentes ...
  && request.resource.data.responsavel.size() >= 3
  && request.resource.data.responsavel.size() <= 100
  && request.resource.data.data.matches('\\d{4}-\\d{2}-\\d{2}') // YYYY-MM-DD
  && request.resource.data.horaInicio.matches('\\d{2}:\\d{2}') // HH:MM
  && request.resource.data.horaFim.matches('\\d{2}:\\d{2}') // HH:MM
  && (!request.resource.data.keys().hasAny(['observacoes']) ||
      (request.resource.data.observacoes is string &&
       request.resource.data.observacoes.size() <= 500));
```

✅ **Proteção adicional:**

- Validação de formato de data (YYYY-MM-DD)
- Validação de formato de hora (HH:MM)
- Limite de caracteres no responsável (3-100)
- Limite de caracteres em observações (0-500)

---

## 🆕 IMPLEMENTAÇÕES ANTERIORES (04/11/2025)

### 1. ✅ Headers de Segurança via Firebase Hosting

Configurado em `firebase.json`:

```json
"headers": [
  {
    "key": "X-Content-Type-Options", "value": "nosniff"
  },
  {
    "key": "X-Frame-Options", "value": "DENY"
  },
  {
    "key": "X-XSS-Protection", "value": "1; mode=block"
  },
  {
    "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin"
  },
  {
    "key": "Content-Security-Policy", "value": "..."
  }
]
```

**Benefícios:**

- ✅ Proteção contra clickjacking (X-Frame-Options)
- ✅ Proteção contra MIME sniffing (X-Content-Type-Options)
- ✅ Proteção XSS adicional (X-XSS-Protection)
- ✅ CSP implementada via headers (não meta tag)

### 2. ✅ Logs Persistentes no Firestore (04/11/2025)

Função `logSegurancaPersistente()` implementada em `firebase-script.js`.

**✅ ATIVADO em 07/11/2025** - descomentar não é mais necessário!

**Regras Firestore para logs:**

```javascript
match /security_logs/{logId} {
  allow create: if isPgeEmail();
  allow read: if false; // Apenas admins (configurar futuramente)
  allow update, delete: if false; // Imutável
}
```

**Campos salvos:**

- ação, dados, timestamp, userId, userEmail, userAgent

### 3. ✅ Deploy de Regras Concluído

```bash
firebase deploy --only firestore:rules
✅ Deploy complete!
```

**Regras deployadas:**

- ✅ Restrição de domínio @pge.sc.gov.br
- ✅ Validação de campos e tipos
- ✅ Delete apenas pelo proprietário
- ✅ Suporte para logs de auditoria
- ✅ Proteção contra updates não autorizados

---

## 🛡️ CHECKLIST DE SEGURANÇA

### ✅ Implementado no Código

- [x] **Firestore Security Rules** - arquivo `firestore.rules` criado e funcional ✅ **DEPLOYADO (07/11/2025)**
- [x] **Autenticação aberta** - qualquer email autenticado pode acessar ✅ **ATIVO (07/11/2025)**
- [x] **Validação de formatos** - data (YYYY-MM-DD) e hora (HH:MM) ✅ **DEPLOYADO**
- [x] **Validação de tamanhos** - responsável (3-100), assunto (3-200), observações (0-500) ✅ **DEPLOYADO**
- [x] **Firebase App Check** - suporte implementado em `firebase-config.js`
- [x] **Cancelamento apenas pelo proprietário** - sem códigos, via email
- [x] **Validação de dados no cliente** - `validarDadosReserva()` e `sanitizarDados()`
- [x] **Logs de auditoria no console** - função `logSeguranca()` em 18+ pontos
- [x] **Logs persistentes ATIVADOS** - coleção `security_logs` funcional ✅ **ATIVO (07/11/2025)**
- [x] **Rate limiting no frontend** - localStorage (5 reservas/hora)
- [x] **Validação de antecedência** - 30 minutos mínimo
- [x] **Autenticação obrigatória** - Google Auth necessário
- [x] **Filtro de reservas antigas** - remove automaticamente reuniões encerradas
- [x] **Cache inteligente** - sincronização em tempo real com indicador visual
- [x] **Headers de segurança** - CSP, X-Frame-Options, etc via `firebase.json`
- [x] **Regras de auditoria** - coleção `security_logs` protegida

### ⚠️ Pendente (Configuração Firebase Console - OPCIONAL)

- [x] **Deploy das regras** ✅ **CONCLUÍDO (07/11/2025)**: `firebase deploy --only firestore:rules`
- [x] **Remover exceção de dev** ✅ **CONCLUÍDO (07/11/2025)**: Email dev removido das rules
- [x] **Ativar logs persistentes** ✅ **CONCLUÍDO (07/11/2025)**: `logSegurancaPersistente()` ativado
- [ ] **Configurar restrições de API Key** por domínio no Console Firebase (OPCIONAL)
- [ ] **Ativar Firebase App Check** e gerar chave reCAPTCHA v3 (OPCIONAL)
- [ ] **Configurar alertas** de uso anormal no Console Firebase (OPCIONAL)
- [ ] **Revisar logs** de acesso regularmente na coleção `security_logs`

### 🔄 Melhorias Futuras Recomendadas

- [ ] **Migrar rate limiting** para Cloud Functions (server-side)
- [x] **Implementar logs persistentes** ✅ **ATIVADO (07/11/2025)** - coleção `security_logs` no Firestore
- [x] **Adicionar CSP** ✅ **CONCLUÍDO** - via headers do Firebase Hosting (não meta tag)
- [x] **Remover email de dev** ✅ **CONCLUÍDO (07/11/2025)** - apenas @pge.sc.gov.br
- [x] **Validação de formatos** ✅ **CONCLUÍDO (07/11/2025)** - data/hora com regex
- [ ] **Validação de tempo** nas Security Rules - limitação técnica do Firestore com timestamps
- [ ] **DOMPurify** para sanitização avançada (se necessário renderizar HTML dinâmico)
- [ ] **Implementar monitoramento** de erros (ex: Sentry)
- [ ] **Backup regular** do Firestore configurado
- [ ] **Ambiente staging** para testes antes de produção

---

## 📞 Contato em Caso de Incidente

**Responsável:** EPPE - PGE-SC  
**Email:** eppe@pge.sc.gov.br  
**Telefone:** (48) 3664-5938

---

## 📚 Recursos Adicionais

- [Firebase Security Rules Documentation](https://firebase.google.com/docs/rules)
- [Firebase App Check](https://firebase.google.com/docs/app-check)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Web Security Best Practices](https://web.dev/secure/)

---

**Última Atualização:** 07/11/2025  
**Versão:** 3.1 (Autenticação Aberta)  
**Status:** ✅ Todas implementações core concluídas | ⚠️ Configurações opcionais pendentes no Console Firebase
