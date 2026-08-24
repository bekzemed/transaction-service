FROM node:20-alpine AS build
WORKDIR /app

RUN apk add --no-cache openssl libc6-compat

COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci

COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src

# prisma generate reads the URL from prisma.config.ts; no live database is needed.
ENV DATABASE_URL="postgresql://postgres:postgres@localhost:5432/financial_platform"
RUN npx prisma generate && npm run build \
  && npm prune --omit=dev \
  && npm install prisma@7.9.1 --omit=dev --no-save

FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache openssl libc6-compat

ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json
COPY prisma ./prisma
COPY prisma.config.ts ./

RUN mkdir -p /app/uploads && chown -R node:node /app/uploads

USER node
EXPOSE 3000

CMD ["node", "dist/src/main.js"]
