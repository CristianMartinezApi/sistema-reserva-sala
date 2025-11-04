# 🚀 Guia de Deploy - Sistema de Reserva de Sala

## 📋 Pré-requisitos

- Conta Firebase ativa
- Firebase CLI instalado (`npm install -g firebase-tools`)
- Node.js 18+ (para Docker)
- Docker e Docker Compose (opcional)
- Git configurado

---

## 🔧 Configuração Inicial

### 1. **Clonar o Repositório**

```bash
git clone https://github.com/CristianMartinezApi/sistema-reserva-sala.git
cd sistema-reserva-sala
```

### 2. **Configurar Firebase**

#### 2.1. Criar Projeto no Firebase Console

1. Acesse [Firebase Console](https://console.firebase.google.com)
2. Clique em "Adicionar projeto"
3. Nomeie o projeto (ex: `reserva-sala-pge-sc`)
4. Ative Google Analytics (opcional)
5. Crie o projeto

#### 2.2. Ativar Serviços Necessários

**Firestore Database:**

1. No menu lateral, clique em "Firestore Database"
2. Clique em "Criar banco de dados"
3. Escolha modo "Produção"
4. Selecione a localização (`southamerica-east1` - São Paulo)

**Authentication:**

1. No menu lateral, clique em "Authentication"
2. Aba "Sign-in method"
3. Ative "Google" como provedor
4. Configure domínios autorizados

**Firebase Hosting (Opcional):**

1. No menu lateral, clique em "Hosting"
2. Clique em "Começar"

#### 2.3. Obter Credenciais do Firebase

1. Vá em "Configurações do Projeto" (⚙️)
2. Role até "Seus aplicativos"
3. Clique em "Adicionar app" > "Web" (</> ícone)
4. Registre o app
5. **Copie as credenciais do Firebase**

#### 2.4. Atualizar `firebase-config.js`

Substitua as credenciais no arquivo `firebase-config.js`:

```javascript
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_PROJECT_ID.firebaseapp.com",
  projectId: "SEU_PROJECT_ID",
  storageBucket: "SEU_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "SEU_MESSAGING_SENDER_ID",
  appId: "SEU_APP_ID",
};
```

---

## 🔐 Configurar Segurança

### 3. **Implementar Firebase Security Rules**

#### 3.1. Fazer login no Firebase CLI

```bash
firebase login
```

#### 3.2. Inicializar Firebase no projeto

```bash
firebase init
```

Selecione:

- ☑️ Firestore
- ☑️ Hosting (opcional)

#### 3.3. Deploy das Security Rules

```bash
firebase deploy --only firestore:rules
```

#### 3.4. Configurar Restrições de API Key

1. Acesse [Google Cloud Console](https://console.cloud.google.com)
2. Selecione seu projeto Firebase
3. Vá em "APIs e Serviços" > "Credenciais"
4. Clique na API Key do Firebase
5. Em "Restrições da aplicação", selecione "Referenciadores HTTP"
6. Adicione seus domínios:
   ```
   localhost:*
   *.pge.sc.gov.br/*
   seu-dominio.com/*
   ```

---

## 🌐 Deploy

### Opção 1: Firebase Hosting (Recomendado)

#### Vantagens:

- HTTPS automático
- CDN global
- Fácil integração com Firebase

#### Passos:

```bash
# 1. Build (se houver processo de build)
# npm run build

# 2. Deploy
firebase deploy --only hosting
```

Seu site estará disponível em:

```
https://SEU_PROJECT_ID.web.app
```

#### Configurar domínio customizado:

1. No Firebase Console, vá em "Hosting"
2. Clique em "Adicionar domínio personalizado"
3. Digite seu domínio (ex: `reservas.pge.sc.gov.br`)
4. Siga as instruções para configurar DNS

---

### Opção 2: Docker (Para servidor próprio)

#### 4.1. Criar arquivo `.env`

```bash
cp .env.example .env
```

Edite `.env` conforme necessário.

#### 4.2. Build da imagem

```bash
docker build -t reserva-sala:latest .
```

#### 4.3. Rodar com Docker Compose

```bash
docker-compose up -d
```

O sistema estará disponível em:

```
http://localhost:8088
```

#### 4.4. Para produção (com nginx reverso proxy):

Crie arquivo `nginx.conf`:

```nginx
server {
    listen 80;
    server_name reservas.pge.sc.gov.br;

    # Redirecionar para HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name reservas.pge.sc.gov.br;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:8088;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

### Opção 3: Servidor Web Tradicional (Apache/Nginx)

#### Requisitos:

- Servidor web (Apache 2.4+ ou Nginx 1.18+)
- HTTPS configurado (Let's Encrypt recomendado)

#### Passos:

1. **Copiar arquivos para o servidor:**

```bash
scp -r * usuario@servidor:/var/www/reserva-sala/
```

2. **Configurar virtual host (Apache):**

```apache
<VirtualHost *:80>
    ServerName reservas.pge.sc.gov.br
    DocumentRoot /var/www/reserva-sala

    <Directory /var/www/reserva-sala>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>

    # Redirecionar para HTTPS
    Redirect permanent / https://reservas.pge.sc.gov.br/
</VirtualHost>

<VirtualHost *:443>
    ServerName reservas.pge.sc.gov.br
    DocumentRoot /var/www/reserva-sala

    SSLEngine on
    SSLCertificateFile /path/to/cert.pem
    SSLCertificateKeyFile /path/to/key.pem

    <Directory /var/www/reserva-sala>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>
</VirtualHost>
```

3. **Habilitar site:**

```bash
sudo a2ensite reserva-sala.conf
sudo systemctl reload apache2
```

---

## ✅ Pós-Deploy

### 5. **Validação**

#### 5.1. Testar Funcionalidades

- [ ] Login com Google funciona
- [ ] Criar reserva funciona
- [ ] Status da sala atualiza em tempo real
- [ ] Cancelar reserva com código funciona
- [ ] Verificar disponibilidade funciona
- [ ] Interface responsiva (mobile/tablet/desktop)

#### 5.2. Testar Segurança

- [ ] Não é possível reservar sem autenticação
- [ ] Rate limiting está ativo
- [ ] Códigos de cancelamento são únicos
- [ ] Firebase Rules bloqueiam acesso não autorizado
- [ ] HTTPS está ativo e funcionando

#### 5.3. Monitoramento

**Firebase Console:**

- Monitore uso de Firestore (leituras/escritas)
- Configure alertas de uso anormal
- Revise logs de Authentication

**Logs de Aplicação:**

```bash
# Se usando Docker
docker-compose logs -f reserva-sala
```

---

## 🔄 Atualizações

### Deploy de Atualizações

**Firebase Hosting:**

```bash
git pull origin main
firebase deploy
```

**Docker:**

```bash
git pull origin main
docker-compose down
docker-compose build
docker-compose up -d
```

---

## 🆘 Troubleshooting

### Problema: "Permission denied" no Firestore

**Solução:**

1. Verifique se Firebase Rules foram deployadas:
   ```bash
   firebase deploy --only firestore:rules
   ```
2. Confira se usuário está autenticado

### Problema: Login não funciona

**Solução:**

1. Verifique se domínio está autorizado no Firebase Console:
   - Authentication > Settings > Authorized domains
2. Adicione seu domínio à lista

### Problema: "Rate limiting não funciona"

**Solução:**

- Rate limiting atual é no frontend (localStorage)
- Para produção, implemente no backend (ver `SECURITY.md`)

### Problema: Docker não inicia

**Solução:**

```bash
# Ver logs
docker-compose logs

# Rebuild completo
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
```

---

## 📞 Suporte

**Email:** eppe@pge.sc.gov.br  
**Telefone:** (48) 3664-5938  
**Repositório:** https://github.com/CristianMartinezApi/sistema-reserva-sala

---

## 📚 Recursos Adicionais

- [Documentação Firebase](https://firebase.google.com/docs)
- [Firebase Hosting Guide](https://firebase.google.com/docs/hosting)
- [Docker Documentation](https://docs.docker.com)
- [Let's Encrypt (HTTPS gratuito)](https://letsencrypt.org)

---

**Última Atualização:** 04/11/2025  
**Versão:** 1.0
