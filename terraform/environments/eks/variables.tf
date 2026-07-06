variable "aws_region" {
  description = "AWS region where the EKS environment is created."
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Base name used for resources."
  type        = string
}

variable "owner_name" {
  description = "Owner name"
  type        = string
}

variable "environment" {
  description = "Environment name used for tags and resource names."
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  # default     = "10.10.0.0/24" # Cantidad de ips disponibles: 256 (251 utilizables), Divido en 4 subredes de 64 ips cada una
  # default = "10.10.0.0/25" # Cantidad de ips disponibles: 128 (123 utilizables), Divido en 4 subredes de 32 ips cada una
  default = "10.10.0.0/26" # Cantidad de ips disponibles: 64 (59 utilizables), Divido en 4 subredes de 16 ips cada una
  # default = "10.10.0.0/27" # Cantidad de ips disponibles: 32 (27 utilizables), Divido en 4 subredes de 8 ips cada una
  # default = "10.10.0.0/28" # Cantidad de ips disponibles: 16 (11 utilizables), Divido en 4 subredes de 4 ips cada una

}

variable "kubernetes_version" {
  description = "EKS Kubernetes version."
  type        = string
  default     = "1.35"
}

variable "cluster_iam_role_arn" {
  description = "Existing IAM role ARN for the EKS control plane."
  type        = string

  validation {
    condition     = startswith(var.cluster_iam_role_arn, "arn:aws:iam::")
    error_message = "cluster_iam_role_arn must be a valid IAM role ARN."
  }
}

variable "node_iam_role_arn" {
  description = "Existing IAM role ARN for managed node groups."
  type        = string

  validation {
    condition     = startswith(var.node_iam_role_arn, "arn:aws:iam::")
    error_message = "node_iam_role_arn must be a valid IAM role ARN."
  }
}

variable "node_instance_types" {
  description = "EC2 instance types for the EKS managed node group."
  type        = list(string)
  default     = ["t3.large"]
}

variable "node_capacity_type" {
  description = "Capacity type for the managed node group."
  type        = string
  default     = "SPOT"

  validation {
    condition     = contains(["ON_DEMAND", "SPOT"], var.node_capacity_type)
    error_message = "node_capacity_type must be ON_DEMAND or SPOT."
  }
}

variable "image_tag" {
  description = "Container image tag deployed to Kubernetes."
  type        = string
  default     = "eks-v1"
}

variable "mysql_root_password" {
  description = "MySQL root password used by the sample app."
  type        = string
  default     = "admin123"
  sensitive   = true
}