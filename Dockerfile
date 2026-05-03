FROM node:18.15-alpine AS development

WORKDIR /myapp
COPY package*.json tsconfig.json nest-cli.json ./
RUN npm install
COPY . .
CMD ["npm", "run", "start:dev"]

FROM node:18.15-alpine AS builder

WORKDIR /myapp
COPY package*.json tsconfig.json nest-cli.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:18.15-alpine AS production

WORKDIR /myapp
COPY package*.json tsconfig.json nest-cli.json ./
RUN npm install --omit=dev
COPY --from=builder /myapp/dist ./dist
CMD ["node", "dist/main.js"]
