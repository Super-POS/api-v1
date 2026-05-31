FROM node:20-alpine AS development

WORKDIR /myapp
COPY package*.json tsconfig.json nest-cli.json ./
RUN npm ci
COPY . .
EXPOSE 3000
CMD ["npm", "run", "start:dev"]

FROM node:20-alpine AS builder

WORKDIR /myapp
COPY package*.json tsconfig.json nest-cli.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS production

WORKDIR /myapp
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=builder /myapp/dist ./dist
# Runtime require from dist/app/services (../../../scripts/badge.json)
COPY --from=builder /myapp/scripts/badge.json ./scripts/badge.json
EXPOSE 3000
CMD ["node", "dist/main.js"]
