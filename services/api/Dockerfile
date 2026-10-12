FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json* ./
COPY services/api/package.json ./services/api/package.json
RUN npm install --omit=dev
COPY services/api ./services/api
RUN npm --workspace @skillheed/api run db:generate
WORKDIR /app/services/api
EXPOSE 4000
USER node
CMD ["node", "src/server.js"]
