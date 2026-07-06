output "cluster_name" {
  description = "EKS cluster name."
  value       = aws_eks_cluster.this.name
}

output "cluster_endpoint" {
  description = "EKS cluster API endpoint."
  value       = aws_eks_cluster.this.endpoint
}

output "ecr_repository_urls" {
  description = "ECR repositories for the application images."
  value       = { for name, repo in aws_ecr_repository.app : name => repo.repository_url }
}

output "kubectl_update_kubeconfig" {
  description = "Command to configure kubectl."
  value       = "aws eks update-kubeconfig --region ${var.aws_region} --name ${aws_eks_cluster.this.name} --alias ${aws_eks_cluster.this.name}"
}

output "frontend_service_lookup" {
  description = "Command to inspect the public Kubernetes Service."
  value       = "kubectl get svc tienda-frontend -n tienda"
}