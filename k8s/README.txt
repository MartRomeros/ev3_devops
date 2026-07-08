Despliegue tienda-perritos en EKS (namespace 'tienda')

1) Configurar kubectl contra tu cluster:
   aws eks update-kubeconfig --region us-east-1 --name <NOMBRE_TU_CLUSTER>

2) Aplicar namespace:
   kubectl apply -f namespace.yaml

3) La base de datos es un RDS MySQL en subnet privada (ver terraform/environments/eks).
   Tras el "terraform apply", copiar el output "rds_address" en:
     - backend-deployment.yaml (env DB_HOST)
     - mysql-init-job.yaml (env DB_HOST)
   Aplicar el secret con las credenciales (debe coincidir con db_username/db_password en terraform):
   kubectl apply -f rds-secret.yaml

   Poblar las tablas (solo la primera vez; si el Job ya existe no se debe reaplicar,
   para no duplicar los datos de ejemplo):
   kubectl apply -f mysql-init-configmap.yaml
   kubectl apply -f mysql-init-job.yaml
   kubectl wait --for=condition=complete job/mysql-init -n tienda --timeout=120s

4) Aplicar backend:
   kubectl apply -f backend-deployment.yaml
   kubectl apply -f backend-service.yaml

5) Aplicar frontend:
   kubectl apply -f frontend-deployment.yaml
   kubectl apply -f frontend-service.yaml

6) Verificar:
   kubectl get pods -n tienda
   kubectl get svc tienda-frontend -n tienda

Copias el EXTERNAL-IP (DNS del ELB) → lo abres en el navegador→ deberías ver la página de Tienda de Perritos ������

Nota: Si te da error, y sale el pod con estado Pending (valida correctamente la configuración de la Actividad 1 – paso 4).

