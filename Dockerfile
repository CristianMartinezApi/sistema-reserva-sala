FROM node:lts-alpine

# Diretório de trabalho no container
WORKDIR /app

# Copia os arquivos da aplicação
COPY . .

# Move arquivos estáticos para pasta public
RUN mkdir -p /app/public && \
    mv *.png *.jpg *.jpeg *.gif *.svg /app/public/

RUN apk add --no-cache tzdata
ENV TZ=America/Sao_Paulo

# Instala servidor estático
RUN npm install -g http-server

# Porta padrão
EXPOSE 8080

# Comando para iniciar o servidor
CMD ["http-server", ".", "-p", "8080"]
