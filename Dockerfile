FROM node:20-alpine

WORKDIR /app

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

COPY --chown=nodejs:nodejs . .

RUN npm ci --only=production

USER nodejs

ENV NODE_ENV=production

CMD ["node", "main.js"]