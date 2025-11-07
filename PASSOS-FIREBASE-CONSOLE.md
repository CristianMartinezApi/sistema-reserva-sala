# 🔧 Guia de Configuração Manual - Firebase Console

## 📋 Checklist Rápido

- [ ] **Passo 1:** Restringir API Key por domínio (5 min)
- [ ] **Passo 2:** Ativar App Check com reCAPTCHA v3 (10 min)
- [ ] **Passo 3:** Remover email de dev das regras (1 min)
- [ ] **Passo 4:** Configurar alertas de uso (5 min)

**Tempo Total Estimado:** ~20 minutos

---

## 🔐 PASSO 1: Restringir API Key por Domínio

### Por que fazer isso?

Impede que outras pessoas usem suas credenciais do Firebase em sites maliciosos.

### Como fazer:

1. **Acesse o Firebase Console:**

   - 🔗 https://console.firebase.google.com
   - Selecione o projeto: `do-sistema-de-reserva-sala`

2. **Vá em Configurações do Projeto:**

   - Clique no ícone de **engrenagem** ⚙️ (canto superior esquerdo)
   - Clique em **Configurações do projeto**

3. **Acesse a aba "Chaves da Web":**

   - Role até a seção **Suas chaves da Web**
   - Localize a chave que começa com `AIzaSyDMXL1Lp1XS...`

4. **Configure as Restrições:**
   - Clique em **Editar** (ícone de lápis) na chave
   - Clique em **Restrições de API**
5. **Adicione Domínios Permitidos:**

   ```
   localhost
   127.0.0.1
   *.firebaseapp.com
   *.web.app
   *.pge.sc.gov.br
   ```

   **OU** adicione o domínio específico onde o sistema será hospedado:

   ```
   do-sistema-de-reserva-sala.web.app
   do-sistema-de-reserva-sala.firebaseapp.com
   seu-dominio-personalizado.com.br
   ```

6. **Salve as alterações**

### ✅ Como Validar:

- Tente acessar o sistema de um domínio não listado
- Deve aparecer erro de API Key restrita

---

## 🛡️ PASSO 2: Ativar Firebase App Check

### Por que fazer isso?

Protege contra bots e tráfego malicioso, garantindo que apenas seu app oficial acesse o Firebase.

### Como fazer:

#### 2.1 - Registrar o App no reCAPTCHA v3

1. **Acesse o Google reCAPTCHA:**

   - 🔗 https://www.google.com/recaptcha/admin
   - Faça login com a mesma conta do Firebase

2. **Crie um novo site:**
   - Clique em **+** (adicionar novo site)
   - **Rótulo:** Sistema Reserva Sala PGE-SC
   - **Tipo:** Selecione **reCAPTCHA v3**
3. **Adicione os Domínios:**

   ```
   localhost
   do-sistema-de-reserva-sala.web.app
   do-sistema-de-reserva-sala.firebaseapp.com
   seu-dominio-personalizado.com.br
   ```

4. **Aceite os termos** e clique em **Enviar**

5. **Copie a Chave do Site:**
   - Após criar, você verá duas chaves
   - **Copie a "Chave do site"** (não a chave secreta)
   - Exemplo: `6Lc...algo...xyz`

#### 2.2 - Configurar App Check no Firebase

1. **Volte ao Firebase Console:**

   - 🔗 https://console.firebase.google.com
   - Projeto: `do-sistema-de-reserva-sala`

2. **Acesse App Check:**

   - No menu lateral, clique em **App Check**
   - Clique em **Começar**

3. **Registre seu App Web:**

   - Clique em **Aplicativos da Web**
   - Selecione seu app (se já estiver listado)
   - OU clique em **Registrar** se for novo

4. **Configure reCAPTCHA v3:**

   - Selecione **reCAPTCHA v3**
   - **Cole a Chave do Site** que você copiou no passo 2.1
   - Clique em **Salvar**

5. **Ative a Aplicação:**
   - Na lista de aplicativos, ative o toggle **Aplicar**
   - **IMPORTANTE:** Deixe em modo "Monitorar" por alguns dias para testar

#### 2.3 - Adicionar Chave no HTML

1. **Abra o arquivo `index.html`**

2. **Localize a linha:**

   ```html
   <meta name="app-check-site-key" content="" />
   ```

3. **Cole sua chave reCAPTCHA:**

   ```html
   <meta name="app-check-site-key" content="6Lc...sua-chave...xyz" />
   ```

4. **Salve o arquivo**

5. **Faça novo deploy:**
   ```bash
   firebase deploy
   ```

### ✅ Como Validar:

- Abra o console do navegador (F12)
- Deve aparecer: `🛡️ Firebase App Check habilitado.`
- No Firebase Console > App Check, verifique se há requisições sendo validadas

---

## 🔧 PASSO 3: Remover Email de Dev das Regras

### Por que fazer isso?

Em produção, apenas emails @pge.sc.gov.br devem ter acesso. O email de dev é apenas para testes.

### Como fazer:

1. **Abra o arquivo `firestore.rules`**

2. **Localize estas linhas:**

   ```javascript
   function isPgeEmail() {
     return (
       request.auth != null &&
       request.auth.token.email != null &&
       (request.auth.token.email.matches(".*@pge\\.sc\\.gov\\.br$") ||
         // ⚠️ ATENÇÃO PRODUÇÃO: Remover linha abaixo antes do deploy final
         request.auth.token.email == "fernandesribe04@gmail.com")
     ); // DEV ONLY
   }
   ```

3. **Remova a linha do Gmail:**

   ```javascript
   function isPgeEmail() {
     return (
       request.auth != null &&
       request.auth.token.email != null &&
       request.auth.token.email.matches(".*@pge\\.sc\\.gov\\.br$")
     );
   }
   ```

4. **Salve o arquivo**

5. **Faça deploy das regras:**
   ```bash
   firebase deploy --only firestore:rules
   ```

### ✅ Como Validar:

- Tente fazer login com `fernandesribe04@gmail.com`
- Deve ser bloqueado e aparecer erro de domínio

---

## 📊 PASSO 4: Configurar Alertas de Uso

### Por que fazer isso?

Monitora uso anormal e possíveis tentativas de abuso.

### Como fazer:

1. **Acesse Firebase Console > Usage and Billing:**

   - 🔗 https://console.firebase.google.com
   - Menu lateral: **Usage and billing**

2. **Configure Alertas de Orçamento:**

   - Clique em **Details & settings**
   - Clique em **Set budget alert**
   - **Orçamento mensal:** R$ 50 (ou conforme necessário)
   - **Alertas em:** 50%, 90%, 100%
   - **Email:** seu-email@pge.sc.gov.br

3. **Ative Monitoramento de Uso:**

   - Vá em **Usage** (menu lateral)
   - Ative gráficos para:
     - ✅ Firestore reads/writes
     - ✅ Authentication sign-ins
     - ✅ Hosting bandwidth

4. **Configure Notificações:**
   - Menu: **Project settings** > **Integrations**
   - Ative **Cloud Monitoring** se disponível

### ✅ Como Validar:

- Você deve receber um email de confirmação
- Verifique se os gráficos estão sendo populados

---

## 📝 PASSO 5 (OPCIONAL): Ativar Logs Persistentes

### Se quiser salvar logs de segurança no Firestore:

1. **Abra `firebase-script.js`**

2. **Localize a linha ~128:**

   ```javascript
   console.log("🔐 Log de Segurança:", logEntry);

   // Opcional: Salvar log persistente no Firestore (descomente para ativar)
   // logSegurancaPersistente(acao, dados);
   ```

3. **Remova o `//` para descomentar:**

   ```javascript
   console.log("🔐 Log de Segurança:", logEntry);

   // Opcional: Salvar log persistente no Firestore (descomente para ativar)
   logSegurancaPersistente(acao, dados);
   ```

4. **Salve e faça deploy:**

   ```bash
   firebase deploy
   ```

5. **Verifique no Firestore Console:**
   - Acesse: Firestore Database
   - Deve aparecer coleção `security_logs`

---

## 🎯 RESUMO DE LINKS ÚTEIS

| Ação             | Link Direto                              |
| ---------------- | ---------------------------------------- |
| Firebase Console | https://console.firebase.google.com      |
| Google reCAPTCHA | https://www.google.com/recaptcha/admin   |
| Firestore Rules  | Console > Firestore Database > Rules     |
| App Check        | Console > App Check                      |
| Usage & Billing  | Console > Usage and billing              |
| API Keys         | Console > Settings ⚙️ > Project settings |

---

## ✅ Checklist Final de Produção

Antes de considerar o sistema 100% pronto para produção:

- [ ] ✅ API Key restrita por domínio
- [ ] ✅ App Check ativado (modo "Aplicar")
- [ ] ✅ Email de dev removido das rules
- [ ] ✅ Alertas de uso configurados
- [ ] ✅ Deploy completo realizado: `firebase deploy`
- [ ] ✅ Testado com usuário @pge.sc.gov.br real
- [ ] ✅ Testado bloqueio de emails externos
- [ ] ✅ Backup do Firestore configurado (opcional)

---

## 🆘 Suporte

**Em caso de problemas:**

1. **Verifique o console do navegador** (F12) para erros
2. **Verifique Firebase Console > Usage** para limites atingidos
3. **Entre em contato:**
   - 📧 Email: eppe@pge.sc.gov.br
   - 📱 Telefone: (48) 3664-5938

---

**Última Atualização:** 04/11/2025  
**Versão:** 1.0
