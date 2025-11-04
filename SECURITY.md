# 🔐 Guia de Segurança - Sistema de Reserva de Sala

## ⚠️ PROBLEMAS DE SEGURANÇA IDENTIFICADOS E SOLUÇÕES

### 1. **Credenciais Firebase Expostas**

**Status:** ⚠️ Atenção Necessária

**Problema:** As chaves do Firebase estão no arquivo `firebase-config.js` (público).

**Por que isso é aceitável (mas requer atenção):**

- As chaves do Firebase são **públicas por design** (necessárias no frontend)
- A segurança é garantida por **Firebase Security Rules** e **App Check**

**Ações Necessárias:**

1. **Configurar Firebase Security Rules** (arquivo `firestore.rules` já criado)

   ```bash
   firebase deploy --only firestore:rules
   ```

2. **Configurar Restrições de API Key no Console Firebase:**

   - Acesse [Firebase Console](https://console.firebase.google.com)
   - Vá em "Configurações do Projeto" > "API Keys"
   - Restrinja a chave por domínio:
     - `localhost` (desenvolvimento)
     - `*.pge.sc.gov.br` (produção)
     - Seu domínio de hospedagem

3. **Implementar Firebase App Check:**

   ```javascript
   import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

   const appCheck = initializeAppCheck(app, {
     provider: new ReCaptchaV3Provider("YOUR-RECAPTCHA-SITE-KEY"),
     isTokenAutoRefreshEnabled: true,
   });
   ```

---

### 2. **Rate Limiting Vulnerável**

**Status:** 🔴 Crítico

**Problema:** O rate limiting usa `localStorage` e pode ser burlado.

**Solução Recomendada:**

Implementar no **Firebase (Firestore ou Cloud Functions)**:

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

**Status:** 🟡 Médio

**Problema:** A validação de 30 minutos é feita apenas no frontend.

**Solução:**

Adicionar nas **Firebase Security Rules** (já implementado em `firestore.rules`):

```javascript
function isValidReservationTime(data, horaInicio) {
  let reservaTimestamp = timestamp.date(data + "T" + horaInicio + ":00Z");
  let minTime = request.time + duration.value(30, "m");
  return reservaTimestamp > minTime;
}
```

---

### 4. **Código de Cancelamento Previsível**

**Status:** 🟡 Médio

**Problema:** Código gerado no cliente pode ser previsível.

**Solução:**

**Opção 1:** Usar `crypto.randomUUID()`:

```javascript
function gerarCodigoSeguranca() {
  // Gera UUID e pega primeiros 10 caracteres
  return crypto.randomUUID().replace(/-/g, "").substring(0, 10).toUpperCase();
}
```

**Opção 2:** Gerar no servidor (Cloud Functions):

```javascript
const crypto = require("crypto");

function generateSecureCode() {
  return crypto.randomBytes(5).toString("hex").toUpperCase();
}
```

---

### 5. **Ausência de Logs de Auditoria Persistentes**

**Status:** 🟡 Médio

**Problema:** Os logs são apenas no console do navegador.

**Solução:**

Implementar coleção de logs no Firestore:

```javascript
async function logSecurityEvent(action, details) {
  await addDoc(collection(db, "security_logs"), {
    action,
    details,
    timestamp: serverTimestamp(),
    userId: auth.currentUser?.uid || "anonymous",
    userEmail: auth.currentUser?.email || "anonymous",
    userAgent: navigator.userAgent,
    ip: "SERVER_SIDE", // Obter via Cloud Functions
  });
}
```

---

### 6. **Proteção contra Ataques CSRF/XSS**

**Status:** ✅ Parcial

**Implementado:**

- Sanitização básica de entrada
- Limitação de tamanho de strings

**Melhorias Recomendadas:**

- Usar biblioteca como DOMPurify para sanitização avançada
- Implementar Content Security Policy (CSP)

```html
<!-- Adicionar ao index.html -->
<meta
  http-equiv="Content-Security-Policy"
  content="default-src 'self'; 
               script-src 'self' https://www.gstatic.com https://apis.google.com; 
               style-src 'self' 'unsafe-inline';
               img-src 'self' data: https:;
               connect-src 'self' https://*.firebaseio.com https://*.googleapis.com"
/>
```

---

## 🛡️ CHECKLIST DE SEGURANÇA

### Firebase Console

- [ ] Configurar restrições de API Key por domínio
- [ ] Ativar Firebase App Check
- [ ] Implementar Firebase Security Rules (arquivo fornecido)
- [ ] Configurar alertas de uso anormal
- [ ] Revisar logs de acesso regularmente

### Código

- [ ] Migrar rate limiting para servidor
- [ ] Implementar logs de auditoria persistentes
- [ ] Adicionar CSP (Content Security Policy)
- [ ] Usar código de cancelamento mais seguro
- [ ] Validar dados também no servidor

### Deploy

- [ ] Usar HTTPS obrigatório
- [ ] Configurar CORS adequadamente
- [ ] Implementar monitoramento de erros (ex: Sentry)
- [ ] Fazer backup regular do Firestore
- [ ] Testar em ambiente staging antes de produção

### Documentação

- [ ] Documentar processo de recuperação de desastres
- [ ] Criar política de privacidade
- [ ] Definir responsáveis por cada sistema
- [ ] Manter changelog de alterações de segurança

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

**Última Atualização:** 04/11/2025  
**Versão:** 1.0
