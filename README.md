# 🏢 Sistema de Reserva de Sala - PGE-SC

Sistema completo para gerenciamento de reservas de salas com interface moderna e recursos de segurança avançados.

## 🚀 Funcionalidades

### ✅ **Reservas**
- Criar reservas com validação completa
- Códigos de cancelamento únicos (10 caracteres)
- Verificação de conflitos em tempo real
- Rate limiting (5 reservas por hora)

### 📊 **Consultas**
- Verificar disponibilidade por data/horário
- Status da sala em tempo real
- Lista de reservas futuras
- Interface responsiva

### 🔐 **Segurança**
- Validação robusta de dados
- Regras de segurança no Firebase
- Logs de auditoria
- Proteção contra spam

## 🛠️ Tecnologias

- **Frontend:** HTML5, CSS3, JavaScript (ES6+)
- **Backend:** Firebase Firestore
- **Hospedagem:** Firebase Hosting
- **Segurança:** Firebase Security Rules

## 📱 Compatibilidade

- ✅ Desktop (Chrome, Firefox, Safari, Edge)
- ✅ Tablet (iOS, Android)
- ✅ Mobile (Responsivo completo)

## 🚀 Como Usar

### 1. **Fazer uma Reserva:**
- Preencha o formulário
- Clique em "Reservar Sala"
- **Guarde o código** que aparece no modal
- Pronto! Reserva confirmada

### 2. **Cancelar Reserva:**
- Encontre sua reserva na lista
- Clique em "Cancelar"
- Digite o código de 10 caracteres
- Confirme o cancelamento

### 3. **Consultar Disponibilidade:**
- Use o formulário de consulta
- Verifique horários livres
- Planeje sua reunião

## ⚙️ Instalação

1. **Clone o repositório:**
```bash
git clone https://github.com/pge-sc/sistema-reserva-sala.git
```

2. **Configure o Firebase:**
   - Crie um projeto no Firebase Console
   - Ative o Firestore
   - Configure as regras de segurança
   - Atualize as credenciais em `firebase-script.js`

3. **Abra o sistema:**
   - Abra `index.html` no navegador
   - Ou hospede em um servidor web

## 🔧 Estrutura do Projeto

```
sistema-reserva-sala/
├── index.html          # Interface principal
├── style.css           # Estilos responsivos
├── firebase-script.js  # Lógica e segurança
└── README.md          # Documentação
```

## 🛡️ Recursos de Segurança

- **Códigos únicos** para cada reserva (10 caracteres)
- **Validação** rigorosa de dados
- **Rate limiting** (máximo 5 reservas por hora)
- **Logs** de auditoria e segurança
- **Regras** do Firebase Firestore
- **Sanitização** de entrada de dados

## 📈 Performance

- ⚡ Carregamento rápido (< 2 segundos)
- 🔄 Sincronização em tempo real
- 📱 Interface 100% responsiva
- 🌐 Compatível com 99% dos navegadores

## 🤝 Contribuição

Desenvolvido para a **Procuradoria Geral do Estado de Santa Catarina (PGE-SC)**.

---

**© 2025 PGE-SC - Sistema de Reserva de Sala**
```
