# Variables de entorno removidas por seguridad (se inyectan vía compose/.env)

#STAGE DE TEST: valida el esquema de init.sql con Jest (validator.js)
# Si un test falla, RUN npm test rompe el build completo.
FROM node:18-alpine AS test
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY init.sql validator.js ./
COPY tests ./tests
RUN npm test

#STAGE CREACION DE IMAGEN: MySQL 8 oficial + script de inicialización ya validado
FROM mysql:8 AS runtime

# Copiar el script de inicialización dentro de la imagen (viene del stage test)
# Se ejecuta automáticamente la primera vez que se levante el contenedor
COPY --from=test /app/init.sql /docker-entrypoint-initdb.d/

# Exponer el puerto de MySQL
EXPOSE 3306
