locals {
  name_prefix = "${var.project_name}"
  vpc_cidr    = var.vpc_cidr
  azs         = ["us-east-1a", "us-east-1b"]

  # aws_db_instance identifiers reject underscores (unlike the EKS cluster name), so sanitize it here.
  db_identifier = replace(local.name_prefix, "_", "-")
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

resource "aws_db_subnet_group" "this" {
  name       = "${local.name_prefix}-db-subnet-group"
  subnet_ids = module.vpc.private_subnets

  tags = {
    Name = "${local.name_prefix}-db-subnet-group"
  }
}

resource "aws_security_group" "rds" {
  name_prefix = "${local.name_prefix}-rds-"
  description = "Allows MySQL traffic from the EKS cluster to the RDS instance."
  vpc_id      = module.vpc.vpc_id

  ingress {
    description     = "MySQL from EKS nodes/pods"
    from_port       = 3306
    to_port         = 3306
    protocol        = "tcp"
    security_groups = [aws_eks_cluster.this.vpc_config[0].cluster_security_group_id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${local.name_prefix}-rds-sg"
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_db_instance" "this" {
  identifier = "${local.db_identifier}-db"

  engine         = "mysql"
  engine_version = var.db_engine_version
  instance_class = var.db_instance_class

  allocated_storage = var.db_allocated_storage
  storage_type      = "gp3"

  db_name  = var.db_name
  username = var.db_username
  password = var.db_password
  port     = 3306

  db_subnet_group_name   = aws_db_subnet_group.this.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false # RDS vive en subnet privada, sin acceso desde internet

  multi_az                = false
  backup_retention_period = 1
  skip_final_snapshot     = true # Laboratorio: no se requiere snapshot final al destruir
  deletion_protection     = false
  apply_immediately       = true

  depends_on = [module.vpc]
}

resource "aws_ecr_repository" "app" {
  for_each = toset(["frontend", "backend"]) # "db" retirado: la BD ahora es RDS, no un pod con imagen propia

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
