# Tienda de Perritos

Aplicación de ejemplo (e-commerce de alimento para perros) usada como laboratorio de DevOps: contenedores, CI/CD con GitHub Actions, Kubernetes sobre AWS EKS e infraestructura como código con Terraform (VPC, EKS, RDS).

**Integrantes:** Andrés Romero · Gonzalo Carvajal · Martín Romero

## Arquitectura

```
                        ┌──────────────┐
   internet ──────────▶ │  frontend    │  nginx + HTML/JS estático
                        │  (LoadBalancer/NLB) │
                        └──────┬───────┘
                               │ HTTP :3001
                        ┌──────▼───────┐
                        │  backend     │  Node.js + Express + mysql2
                        │  (ClusterIP) │
                        └──────┬───────┘
                               │ TCP :3306
                        ┌──────▼───────┐
                 local: │  db (MySQL)  │  contenedor, docker compose
                   AWS: │  RDS MySQL   │  subnet privada, EKS
                        └──────────────┘
```

- **frontend/**: HTML/JS estático servido por NGINX (`Dockerfile` multi-stage: corre tests con Jest antes de construir la imagen final).
- **backend/**: API REST en Express (`/api/productos`, `/api/health`) usando `mysql2`.
- **db/**: `init.sql` (esquema + datos semilla) y `validator.js`, validados con Jest.
- **k8s/**: manifests de Kubernetes para el namespace `tienda`.
- **terraform/environments/eks/**: VPC, EKS (cluster + node group), RDS MySQL, repositorios ECR.
- **.github/workflows/**: pipelines de CI (build & push a ECR) y CD (deploy a EKS).

## Requisitos previos

| Para... | Necesitas |
|---|---|
| Despliegue local | Docker + Docker Compose |
| Despliegue en AWS | Terraform ≥ 1.5, AWS CLI v2, kubectl, cuenta de AWS Academy activa |

---

## Despliegue local (Docker Compose)

1. Verificar el archivo `.env` en la raíz del repo (ya incluido para el entorno de laboratorio):
   ```env
   DB_HOST=db
   DB_USER=root
   DB_PASSWORD=admin123
   DB_NAME=tienda_perritos
   DB_PORT=3306

   MYSQL_ROOT_PASSWORD=admin123
   MYSQL_DATABASE=tienda_perritos
   MYSQL_USER=alumno
   MYSQL_PASSWORD=alumno123
   ```

2. Levantar todo el stack:
   ```bash
   docker compose up --build
   ```
   Esto construye y corre 3 servicios (ver `compose.yaml`):
   - `db`: MySQL 8, con `db/init.sql` ejecutado automáticamente al primer arranque (vía `/docker-entrypoint-initdb.d`).
   - `tienda-backend`: API en `http://localhost:3001`, espera a que `db` esté healthy.
   - `frontend`: sitio en `http://localhost:80`, espera a que el backend esté healthy.

3. Verificar:
   ```bash
   curl http://localhost:3001/api/health
   curl http://localhost:3001/api/productos
   ```
   Abrir `http://localhost` en el navegador para ver la tienda.

4. Apagar y limpiar:
   ```bash
   docker compose down          # conserva el volumen db_data
   docker compose down -v       # borra también los datos de MySQL
   ```

### Correr los tests sin Docker (opcional)

Cada componente tiene su propia suite Jest:
```bash
cd backend && npm ci && npm test
cd frontend && npm ci && npm test
cd db && npm ci && npm test
```

---

## Despliegue en AWS Academy (EKS + RDS)

### 1. Iniciar el Lab y obtener credenciales
1. En AWS Academy: **Start Lab** → esperar a que el círculo se ponga verde.
2. **AWS Details → AWS CLI** → copiar `aws_access_key_id`, `aws_secret_access_key`, `aws_session_token`.

> Las credenciales expiran cada ~4 h. Si `terraform apply` o el pipeline fallan con `ExpiredToken`, vuelve a este paso.

### 2. Configurar credenciales

**Local** (para correr Terraform):
```bash
export AWS_ACCESS_KEY_ID="..."
export AWS_SECRET_ACCESS_KEY="..."
export AWS_SESSION_TOKEN="..."
export AWS_DEFAULT_REGION="us-east-1"
```

**GitHub Actions** (para que CI/CD funcione): Repo → **Settings → Secrets and variables → Actions**, actualizar:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_SESSION_TOKEN`

### 3. Provisionar infraestructura con Terraform
```bash
cd terraform/environments/eks
terraform init      # solo la primera vez o si cambian módulos/providers
terraform plan
terraform apply
```
Crea VPC, NAT instance, cluster EKS + node group, RDS MySQL (subnet privada) y repositorios ECR (`frontend`, `backend`). Tarda ~15–20 min.

Revisar los outputs:
```bash
terraform output
```
Anotar `cluster_name` y `rds_address` (el pipeline de CD ya los resuelve automáticamente, pero sirven para verificar).

### 4. Conectar kubectl
```bash
aws eks update-kubeconfig --region us-east-1 --name eks-lab-ev3-eks
kubectl get nodes
```

### 5. Desplegar la aplicación

**Opción A — Pipeline (recomendado):**
```bash
git push origin master
```
- `ci.yaml` valida `db/init.sql` con Jest y construye/sube a ECR las imágenes de `frontend` y `backend`.
- `cd.yaml` se dispara automáticamente al terminar CI (o manual vía *Actions → Run workflow*) y:
  1. Resuelve el endpoint del RDS con `aws rds describe-db-instances` e inyecta el valor en los manifests (no requiere editar nada a mano).
  2. Aplica `namespace`, `rds-secret`, services y HPAs.
  3. Corre el Job `mysql-init` **solo si no existe** (puebla la tabla `productos` una única vez, evita duplicar datos en despliegues siguientes).
  4. Crea/actualiza los Deployments de `backend` y `frontend` con la imagen recién publicada y espera el rollout.

**Opción B — Manual (`k8s/README.txt` tiene el detalle paso a paso):**
```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/rds-secret.yaml
kubectl apply -f k8s/mysql-init-configmap.yaml
kubectl apply -f k8s/mysql-init-job.yaml
kubectl wait --for=condition=complete job/mysql-init -n tienda --timeout=120s
kubectl apply -f k8s/backend-service.yaml
kubectl apply -f k8s/frontend-service.yaml
kubectl apply -f k8s/backend-hpa.yaml
kubectl apply -f k8s/frontend-hpa.yaml
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/frontend-deployment.yaml
```

### 6. Verificar
```bash
kubectl get pods -n tienda
kubectl get jobs -n tienda                  # mysql-init debe estar Completed
kubectl get svc tienda-frontend -n tienda   # copiar el EXTERNAL-IP (DNS del NLB)
```
Abrir el `EXTERNAL-IP` en el navegador.

### Notas específicas de AWS Academy
- **Sesión expirada a mitad de un `apply`**: reinicia el Lab, refresca credenciales (paso 2) y reintenta — Terraform retoma desde el state.
- **Los recursos persisten entre sesiones**: parar/reiniciar el Lab solo rota las credenciales, no borra EKS/RDS.
- **Password del RDS**: por defecto `admin123` (debe coincidir entre `terraform.tfvars`/`variables.tf` y `k8s/rds-secret.yaml`, codificado en base64). Es un valor de laboratorio, no usar en producción.
- **Reintentar el seed**: si el Job `mysql-init` falla, bórralo para que el próximo CD lo recree: `kubectl delete job mysql-init -n tienda`.

## Destruir la infraestructura de AWS
```bash
cd terraform/environments/eks
terraform destroy
```
