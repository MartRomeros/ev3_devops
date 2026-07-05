#STAGE BASE: dependencias declaradas
FROM node:18-alpine AS base
WORKDIR /app
COPY package.json package-lock.json ./

#STAGE DE TEST: instala jest/jsdom y corre la suite sobre app.js.
# Si un test falla, RUN npm test rompe el build completo.
FROM base AS test
RUN npm ci
COPY app.js ./
COPY tests ./tests
RUN npm test

#STAGE CREACION DE IMAGEN: solo NGINX sirviendo estáticos, sin Node ni tests
FROM nginx:alpine AS runtime

# Copiar configuración de NGINX
COPY default.conf /etc/nginx/conf.d/default.conf

# Copiar archivos estáticos (app.js viene del stage test ya validado)
COPY index.html /usr/share/nginx/html/
COPY --from=test /app/app.js /usr/share/nginx/html/app.js

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
