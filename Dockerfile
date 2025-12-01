FROM node:20-alpine3.19

# Diretório de trabalho no container
WORKDIR /app

# Copia todos os arquivos da aplicação
COPY . .

# Garante que a pasta public exista (caso queira servir assets separados)
RUN mkdir -p /app/public

# Instala timezone e define fuso horário
RUN apk add --no-cache tzdata
ENV TZ=America/Sao_Paulo

# Instala servidor estático
RUN npm install -g http-server

# Porta padrão
EXPOSE 8080

# Serve a pasta 'public' se existir, senão a raiz
CMD ["sh", "-c", "if [ -d ./public ]; then http-server ./public -p 8080; else http-server . -p 8080; fi"]
