FROM node:20-alpine
RUN apk add --no-cache git bash
WORKDIR /app
COPY server.js /app/server.js
EXPOSE 4000
CMD ["node", "/app/server.js"]
