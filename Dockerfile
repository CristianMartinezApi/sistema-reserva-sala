FROM node:lts-alpine

# Diretório de trabalho no container
WORKDIR /app

# Copia os arquivos da aplicação
COPY . .

# Instala servidor estático
RUN npm install -g http-server

# Porta padrão
EXPOSE 8080

# Comando para iniciar o servidor
CMD ["http-server", ".", "-p", "8080"]
