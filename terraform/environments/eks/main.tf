locals {
  name_prefix = "${var.project_name}"
  vpc_cidr    = var.vpc_cidr
  azs         = ["us-east-1a", "us-east-1b"]

}

data "aws_caller_identity" "current" {}

module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "6.6.1"

  name = "${local.name_prefix}-vpc"
  cidr = local.vpc_cidr

  azs             = local.azs
  private_subnets = [for i in range(length(local.azs)) : cidrsubnet(local.vpc_cidr, 2, i)]
  public_subnets  = [for i in range(length(local.azs)) : cidrsubnet(local.vpc_cidr, 2, i + length(local.azs))]

  private_subnet_names = [for az in local.azs : "${local.name_prefix}-private-${az}"]
  public_subnet_names  = [for az in local.azs : "${local.name_prefix}-public-${az}"]


  create_igw              = true  # Create Internet Gateway
  enable_nat_gateway      = false # Using custom NAT instance module
  single_nat_gateway      = true  # Group private subnets into one route table
  enable_vpn_gateway      = false # Not using VPN Gateway
  enable_dns_hostnames    = true  # Enable DNS hostnames
  enable_dns_support      = true  # Enable DNS support
  map_public_ip_on_launch = true  # Enable public IP on launch

  public_route_table_tags = {
    Name = "${local.name_prefix}-public-rt"
  }
  private_route_table_tags = {
    Name = "${local.name_prefix}-private-rt"
  }

  public_subnet_tags = {
    "kubernetes.io/cluster/${local.name_prefix}-eks" = "shared"
    "kubernetes.io/role/elb"                         = "1"
  }

  private_subnet_tags = {
    "kubernetes.io/cluster/${local.name_prefix}-eks" = "shared"
    "kubernetes.io/role/internal-elb"                = "1"
  }
}

module "nat_instance" {
  source = "git::https://github.com/franciscobrioneslavados/terraform-aws-nat-instance.git//.?ref=v1.3.0"

  vpc_id               = module.vpc.vpc_id
  public_subnet_ids    = module.vpc.public_subnets
  private_subnet_cidrs = module.vpc.private_subnets_cidr_blocks
  route_table_ids      = module.vpc.private_route_table_ids
  project_name         = "${local.name_prefix}-nat"
  environment          = var.environment
  owner_name           = var.owner_name
  instance_type        = "t3.micro"
  ssh_allowed_cidrs    = []
  os_type              = "amazon-linux-2" # or "ubuntu"

  depends_on = [module.vpc]
}

resource "aws_ecr_repository" "app" {
  for_each = toset(["frontend", "backend", "db"])

  name                 = "${local.name_prefix}-${each.key}"
  image_tag_mutability = "MUTABLE"
  force_delete         = true

  encryption_configuration {
    encryption_type = "AES256"
  }
}

resource "aws_eks_cluster" "this" {
  name     = "${local.name_prefix}-eks"
  role_arn = var.cluster_iam_role_arn
  version  = var.kubernetes_version

  access_config {
    authentication_mode                         = "API_AND_CONFIG_MAP"
    bootstrap_cluster_creator_admin_permissions = true
  }

  enabled_cluster_log_types = [
    "api",
    "audit",
    "authenticator",
    "controllerManager",
    "scheduler",
  ]

  vpc_config {
    endpoint_private_access = true
    endpoint_public_access  = true
    subnet_ids              = module.vpc.public_subnets
  }

  depends_on = [
    module.nat_instance,
  ]
}

resource "aws_eks_node_group" "app" {
  cluster_name    = aws_eks_cluster.this.name
  node_group_name = "${local.name_prefix}-nodes"
  node_role_arn   = var.node_iam_role_arn
  subnet_ids      = module.vpc.private_subnets

  ami_type       = "AL2023_x86_64_STANDARD"
  capacity_type  = var.node_capacity_type
  instance_types = var.node_instance_types

  scaling_config {
    desired_size = 1
    max_size     = 3
    min_size     = 1
  }

  update_config {
    max_unavailable = 1
  }

  depends_on = [
    aws_eks_cluster.this,
  ]
}

resource "aws_eks_addon" "this" {
  for_each = toset([
    "vpc-cni",
    "kube-proxy",
    "coredns",
    "metrics-server",
  ])

  cluster_name                = aws_eks_cluster.this.name
  addon_name                  = each.key
  resolve_conflicts_on_create = "OVERWRITE"
  resolve_conflicts_on_update = "OVERWRITE"

  depends_on = [
    aws_eks_node_group.app,
  ]
}
