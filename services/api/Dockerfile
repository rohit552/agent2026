FROM node:20-alpine AS build
WORKDIR /app
COPY package.json ./
COPY apps/website/package.json ./apps/website/package.json
COPY apps/admin/package.json ./apps/admin/package.json
COPY services/api/package.json ./services/api/package.json
RUN npm install
COPY services/api ./services/api
RUN npm --workspace @skillheed/api run db:generate
RUN npm prune --omit=dev

FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app /app
WORKDIR /app/services/api
EXPOSE 4000
USER node
CMD ["node", "src/server.js"]
