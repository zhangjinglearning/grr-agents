# Outputs for Networking Module

output "vpc_id" {
  description = "ID of the VPC"
  value       = aws_vpc.main.id
}

output "vpc_cidr" {
  description = "CIDR block of the VPC"
  value       = aws_vpc.main.cidr_block
}

output "internet_gateway_id" {
  description = "ID of the Internet Gateway"
  value       = aws_internet_gateway.main.id
}

output "public_subnet_ids" {
  description = "IDs of the public subnets"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "IDs of the private subnets"
  value       = aws_subnet.private[*].id
}

output "database_subnet_ids" {
  description = "IDs of the database subnets"
  value       = aws_subnet.database[*].id
}

output "public_subnet_cidrs" {
  description = "CIDR blocks of the public subnets"
  value       = aws_subnet.public[*].cidr_block
}

output "private_subnet_cidrs" {
  description = "CIDR blocks of the private subnets"
  value       = aws_subnet.private[*].cidr_block
}

output "database_subnet_cidrs" {
  description = "CIDR blocks of the database subnets"
  value       = aws_subnet.database[*].cidr_block
}

output "nat_gateway_ids" {
  description = "IDs of the NAT Gateways"
  value       = aws_nat_gateway.main[*].id
}

output "nat_gateway_ips" {
  description = "Public IPs of the NAT Gateways"
  value       = aws_eip.nat[*].public_ip
}

output "public_route_table_id" {
  description = "ID of the public route table"
  value       = aws_route_table.public.id
}

output "private_route_table_ids" {
  description = "IDs of the private route tables"
  value       = aws_route_table.private[*].id
}

output "database_route_table_id" {
  description = "ID of the database route table"
  value       = aws_route_table.database.id
}

output "vpc_flow_log_group_name" {
  description = "Name of the VPC Flow Logs CloudWatch log group"
  value       = aws_cloudwatch_log_group.vpc_flow_logs.name
}

output "vpc_endpoint_s3_id" {
  description = "ID of the S3 VPC endpoint"
  value       = var.enable_vpc_endpoints ? aws_vpc_endpoint.s3[0].id : null
}

output "vpc_endpoint_ec2_id" {
  description = "ID of the EC2 VPC endpoint"
  value       = var.enable_vpc_endpoints ? aws_vpc_endpoint.ec2[0].id : null
}

output "availability_zones" {
  description = "Availability zones used"
  value       = var.availability_zones
}

output "nat_gateway_count" {
  description = "Number of NAT Gateways created"
  value       = length(aws_nat_gateway.main)
}

output "subnet_summary" {
  description = "Summary of subnet configuration"
  value = {
    public_subnets = {
      count = length(aws_subnet.public)
      cidrs = aws_subnet.public[*].cidr_block
      azs   = aws_subnet.public[*].availability_zone
    }
    private_subnets = {
      count = length(aws_subnet.private)
      cidrs = aws_subnet.private[*].cidr_block
      azs   = aws_subnet.private[*].availability_zone
    }
    database_subnets = {
      count = length(aws_subnet.database)
      cidrs = aws_subnet.database[*].cidr_block
      azs   = aws_subnet.database[*].availability_zone
    }
  }
}

output "network_configuration" {
  description = "Complete network configuration summary"
  value = {
    vpc = {
      id   = aws_vpc.main.id
      cidr = aws_vpc.main.cidr_block
    }
    connectivity = {
      internet_gateway = aws_internet_gateway.main.id
      nat_gateways     = length(aws_nat_gateway.main)
      vpc_endpoints    = var.enable_vpc_endpoints
    }
    security = {
      flow_logs_enabled = true
      network_acls      = true
      vpc_endpoints     = var.enable_vpc_endpoints
    }
  }
}