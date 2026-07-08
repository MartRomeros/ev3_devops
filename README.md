pasos para desplegar las cosas en el eks

aws eks update-kubeconfig --region us-east-1 --name eks-lab-ev3-eks --alias eks-lab-ev3-eks

kubectl get nodes

aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 811745260722.dkr.ecr.us-east-1.amazonaws.com

# Backend

docker build -t 811745260722.dkr.ecr.us-east-1.amazonaws.com/eks-lab-ev3-backend:latest ./backend
docker push 811745260722.dkr.ecr.us-east-1.amazonaws.com/eks-lab-ev3-backend:latest


# Frontend

docker build -t 811745260722.dkr.ecr.us-east-1.amazonaws.com/eks-lab-ev3-frontend:latest ./frontend
docker push 811745260722.dkr.ecr.us-east-1.amazonaws.com/eks-lab-ev3-frontend:latest


# BD (RDS MySQL, provisionado con Terraform en terraform/environments/eks)
# Tras "terraform apply", copiar el output "rds_address" en:
#   - k8s/backend-deployment.yaml (env DB_HOST)
#   - k8s/mysql-init-job.yaml (env DB_HOST)

# Kubernetes

kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/rds-secret.yaml

# Poblar tablas (una sola vez, no reaplicar si el Job ya corrió)
kubectl apply -f k8s/mysql-init-configmap.yaml
kubectl apply -f k8s/mysql-init-job.yaml
kubectl wait --for=condition=complete job/mysql-init -n tienda --timeout=120s

kubectl apply -f k8s/backend-service.yaml
kubectl apply -f k8s/frontend-service.yaml
kubectl apply -f k8s/backend-hpa.yaml
kubectl apply -f k8s/frontend-hpa.yaml

# 5. Aplicar los deployments (image incorrecta, se sobreescribe después)
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/frontend-deployment.yaml
