#STAGE BASE: dependencias declaradas, compartida por test y build
FROM node:18-alpine AS base
WORKDIR /app
COPY package.json package-lock.json ./

#STAGE DE TEST: instala devDependencies y corre la suite de Jest.
# Si un test falla, RUN npm test rompe el build completo.
FROM base AS test
RUN npm ci
COPY server.js ./
COPY tests ./tests
RUN npm test

#STAGE DE COMPILACION: solo dependencias de producción
FROM base AS build
RUN npm ci --omit=dev

#STAGE CREACION DE IMAGEN: imagen final liviana, sin devDependencies ni tests
FROM node:18-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=test /app/server.js ./server.js
COPY package.json ./
EXPOSE 3001
USER node
CMD ["node","server.js"]
