FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache docker-cli docker-cli-compose

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

COPY package*.json ./
RUN npm ci --omit=dev

COPY --chown=nodejs:nodejs . .

USER nodejs

ENV NODE_ENV=production

CMD ["node", "main.js"]
