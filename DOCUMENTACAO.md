# Documentação do Sistema de Reserva de Salas

## Visão Geral

Este sistema permite o agendamento, consulta e cancelamento de reservas para salas de reunião institucionais, integrando autenticação, interface moderna e backend em Firebase/Firestore.

---

## Estrutura de Pastas e Arquivos

### Raiz do Projeto

- **auth.js**: Lógica de autenticação global.
- **CHECKLIST-DEPLOY.md**: Lista de verificação para deploy.
- **DEPLOY.md**: Instruções de deploy.
- **docker-compose.yml / Dockerfile**: Containerização do ambiente.
- **firebase-config.js**: Configuração do Firebase.
- **firebase-script-base.js**: Funções utilitárias para Firestore/Firebase.
- **firebase.json / firestore.indexes.json / firestore.rules**: Configurações do Firebase Hosting, índices e regras de segurança.
- **index.html**: Página inicial/portal do sistema.
- **interface-sala.js**: Lógica compartilhada de interface para páginas de sala.
- **portal-auth.js**: Script de autenticação do portal.
- **README.md**: Documentação principal.
- **RELEASE-NOTES.md**: Notas de versão.
- **ROADMAP.md**: Planejamento do projeto.
- **SECURITY.md**: Políticas de segurança.
- **style.css**: Estilos globais.

### Pasta `public/`

- Assets estáticos (imagens, ícones, logos).

### Pasta `sala-auditorio/`

- **index.html**: Página da sala auditório.
- **firebase-script.js**: Script de integração com Firebase/Firestore.
- **firebase-config.js**: Configuração específica do Firebase (se existir).
- **auth-auditorio.js**: Autenticação da sala auditório.
- **style.css**: Estilos específicos.
- **README.md**: Documentação da sala auditório.

### Pasta `sala-cest/`

- **index.html**: Página da sala CEST/EPPE.
- **firebase-script.js**: Script de integração com Firebase/Firestore.
- **firebase-config.js**: Configuração específica do Firebase (se existir).
- **auth-cest.js**: Autenticação da sala CEST.
- **style.css**: Estilos específicos.
- **README.md**: Documentação da sala CEST.

---

## Fluxo de Funcionamento

1. **Autenticação**: Usuário faz login (Google/Firebase Auth).
2. **Consulta**: Visualização de reservas futuras, calendário e status da sala.
3. **Reserva**: Preenchimento do formulário e gravação no Firestore.
4. **Cancelamento**: Apenas o responsável pode cancelar, via interface.
5. **Sincronização**: Interface atualiza automaticamente via onSnapshot do Firestore.

---

## Tecnologias Utilizadas

- **Frontend**: HTML, CSS, JavaScript (ES Modules)
- **Backend**: Firebase Firestore, Firebase Auth
- **Infraestrutura**: Docker (opcional)

---

## Segurança

- Regras do Firestore para garantir que apenas usuários autenticados possam reservar/cancelar.
- Cancelamento restrito ao responsável pela reserva.
- Validação de dados no frontend e backend.

---

## Deploy

- Siga o `CHECKLIST-DEPLOY.md` e `DEPLOY.md` para publicação.
- Utilize Docker se desejar ambiente isolado.

---

## Contato e Suporte

- Email: eppe@pge.sc.gov.br
- Telefone: (48) 3664-5938

---

## Observações

- Para detalhes de cada sala, consulte os READMEs em `sala-auditorio/` e `sala-cest/`.
- Para customizações, edite os scripts e estilos específicos de cada sala.

---

> Última atualização: 02/12/2025
