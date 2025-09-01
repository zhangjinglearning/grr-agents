#!/bin/bash
# User Data Script for MadPlan Application Servers
# This script sets up the EC2 instance with the application and monitoring

set -euo pipefail

# Variables from Terraform
APP_PORT="${app_port}"
REGION="${region}"
LOG_GROUP="${log_group_name}"
ENVIRONMENT="${environment}"

# Logging setup
LOG_FILE="/var/log/user-data.log"
exec > >(tee -a $LOG_FILE)
exec 2>&1

echo "$(date): Starting user data script for MadPlan application server"

# Update system packages
echo "$(date): Updating system packages..."
yum update -y

# Install required packages
echo "$(date): Installing required packages..."
yum install -y \
    docker \
    git \
    curl \
    wget \
    unzip \
    htop \
    amazon-cloudwatch-agent \
    awslogs

# Start and enable Docker
echo "$(date): Starting Docker service..."
systemctl start docker
systemctl enable docker
usermod -a -G docker ec2-user

# Install Docker Compose
echo "$(date): Installing Docker Compose..."
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Install Node.js (for health checks and local tools)
echo "$(date): Installing Node.js..."
curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
yum install -y nodejs

# Create application directory
echo "$(date): Setting up application directory..."
mkdir -p /opt/madplan
chown ec2-user:ec2-user /opt/madplan

# Install AWS CLI v2
echo "$(date): Installing AWS CLI v2..."
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
./aws/install
rm -rf aws awscliv2.zip

# Configure AWS CLI with region
echo "$(date): Configuring AWS CLI..."
aws configure set default.region $REGION
aws configure set default.output json

# Configure CloudWatch Agent
echo "$(date): Configuring CloudWatch Agent..."
cat > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json << EOF
{
  "agent": {
    "metrics_collection_interval": 60,
    "run_as_user": "cwagent"
  },
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/opt/madplan/logs/application.log",
            "log_group_name": "$LOG_GROUP",
            "log_stream_name": "{instance_id}/application.log",
            "timezone": "UTC",
            "timestamp_format": "%Y-%m-%d %H:%M:%S"
          },
          {
            "file_path": "/var/log/docker",
            "log_group_name": "$LOG_GROUP",
            "log_stream_name": "{instance_id}/docker.log",
            "timezone": "UTC"
          },
          {
            "file_path": "/var/log/user-data.log",
            "log_group_name": "$LOG_GROUP",
            "log_stream_name": "{instance_id}/user-data.log",
            "timezone": "UTC"
          }
        ]
      }
    }
  },
  "metrics": {
    "namespace": "MadPlan/Application",
    "metrics_collected": {
      "cpu": {
        "measurement": [
          "cpu_usage_idle",
          "cpu_usage_iowait",
          "cpu_usage_user",
          "cpu_usage_system"
        ],
        "metrics_collection_interval": 60,
        "resources": [
          "*"
        ],
        "totalcpu": false
      },
      "disk": {
        "measurement": [
          "used_percent"
        ],
        "metrics_collection_interval": 60,
        "resources": [
          "*"
        ]
      },
      "diskio": {
        "measurement": [
          "io_time"
        ],
        "metrics_collection_interval": 60,
        "resources": [
          "*"
        ]
      },
      "mem": {
        "measurement": [
          "mem_used_percent"
        ],
        "metrics_collection_interval": 60
      },
      "netstat": {
        "measurement": [
          "tcp_established",
          "tcp_time_wait"
        ],
        "metrics_collection_interval": 60
      },
      "swap": {
        "measurement": [
          "swap_used_percent"
        ],
        "metrics_collection_interval": 60
      }
    }
  }
}
EOF

# Start CloudWatch Agent
echo "$(date): Starting CloudWatch Agent..."
systemctl start amazon-cloudwatch-agent
systemctl enable amazon-cloudwatch-agent

# Create application structure
echo "$(date): Creating application structure..."
mkdir -p /opt/madplan/{logs,config,backups}
chown -R ec2-user:ec2-user /opt/madplan

# Create docker-compose file for the application
echo "$(date): Creating Docker Compose configuration..."
cat > /opt/madplan/docker-compose.yml << EOF
version: '3.8'

services:
  app:
    image: ghcr.io/zhangjinglearning/grr-agents/madplan-backend:latest
    container_name: madplan-backend
    restart: unless-stopped
    ports:
      - "$APP_PORT:3000"
    environment:
      - NODE_ENV=$ENVIRONMENT
      - PORT=3000
    env_file:
      - .env
    volumes:
      - ./logs:/app/logs
      - ./config:/app/config
    healthcheck:
      test: ["CMD", "node", "dist/scripts/health-check.js"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
    labels:
      - "traefik.enable=true"
      - "app.name=madplan-backend"
      - "app.environment=$ENVIRONMENT"

  # Redis for caching (optional)
  redis:
    image: redis:7-alpine
    container_name: madplan-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

volumes:
  redis_data:
    driver: local
EOF

# Create environment file placeholder
echo "$(date): Creating environment file..."
cat > /opt/madplan/.env << EOF
# MadPlan Application Environment Variables
# These will be populated by the deployment process

NODE_ENV=$ENVIRONMENT
PORT=3000

# Database (will be populated by deployment)
MONGODB_URI=

# Authentication (will be populated by deployment)
JWT_SECRET=

# Redis
REDIS_URL=redis://redis:6379

# Logging
LOG_LEVEL=info

# Application
APP_NAME=MadPlan Backend
APP_VERSION=latest
EOF

# Create application management scripts
echo "$(date): Creating application management scripts..."

# Health check script
cat > /opt/madplan/health-check.sh << 'EOF'
#!/bin/bash
set -e

APP_PORT="${APP_PORT:-3000}"
HEALTH_URL="http://localhost:$APP_PORT/api/health"

echo "Checking application health at $HEALTH_URL..."

if curl -f -s --max-time 10 "$HEALTH_URL" > /dev/null 2>&1; then
    echo "✅ Application is healthy"
    exit 0
else
    echo "❌ Application health check failed"
    exit 1
fi
EOF

# Application start script
cat > /opt/madplan/start-app.sh << 'EOF'
#!/bin/bash
set -e

cd /opt/madplan

echo "Starting MadPlan application..."

# Pull latest image
docker-compose pull

# Start services
docker-compose up -d

# Wait for health check
sleep 30

# Verify application is running
if ./health-check.sh; then
    echo "✅ Application started successfully"
else
    echo "❌ Application failed to start properly"
    docker-compose logs
    exit 1
fi
EOF

# Application stop script
cat > /opt/madplan/stop-app.sh << 'EOF'
#!/bin/bash
set -e

cd /opt/madplan

echo "Stopping MadPlan application..."

# Stop services gracefully
docker-compose down --timeout 30

echo "✅ Application stopped"
EOF

# Make scripts executable
chmod +x /opt/madplan/*.sh
chown ec2-user:ec2-user /opt/madplan/*.sh

# Create systemd service for the application
echo "$(date): Creating systemd service..."
cat > /etc/systemd/system/madplan.service << EOF
[Unit]
Description=MadPlan Application
Requires=docker.service
After=docker.service

[Service]
Type=forking
RemainAfterExit=yes
WorkingDirectory=/opt/madplan
ExecStart=/opt/madplan/start-app.sh
ExecStop=/opt/madplan/stop-app.sh
TimeoutStartSec=0
User=ec2-user
Group=ec2-user

[Install]
WantedBy=multi-user.target
EOF

# Enable the service (but don't start yet - will be started by deployment)
systemctl daemon-reload
systemctl enable madplan.service

# Setup log rotation
echo "$(date): Setting up log rotation..."
cat > /etc/logrotate.d/madplan << EOF
/opt/madplan/logs/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    create 0644 ec2-user ec2-user
    postrotate
        /usr/bin/systemctl reload madplan.service > /dev/null 2>&1 || true
    endscript
}
EOF

# Install security updates
echo "$(date): Installing security updates..."
yum update -y --security

# Configure automatic security updates
echo "$(date): Configuring automatic security updates..."
yum install -y yum-cron
systemctl start yum-cron
systemctl enable yum-cron

# Set up basic firewall rules
echo "$(date): Configuring firewall..."
yum install -y firewalld
systemctl start firewalld
systemctl enable firewalld

# Allow application port
firewall-cmd --permanent --add-port=$APP_PORT/tcp
firewall-cmd --permanent --add-service=ssh
firewall-cmd --reload

# Create monitoring user for external monitoring
echo "$(date): Creating monitoring user..."
useradd -r -s /bin/false monitoring
echo "monitoring ALL=(ALL) NOPASSWD: /opt/madplan/health-check.sh" >> /etc/sudoers

# Setup CloudWatch custom metrics
echo "$(date): Setting up custom metrics..."
cat > /opt/madplan/send-metrics.sh << 'EOF'
#!/bin/bash

# Send custom application metrics to CloudWatch
NAMESPACE="MadPlan/Application"
INSTANCE_ID=$(curl -s http://169.254.169.254/latest/meta-data/instance-id)

# Application specific metrics
if ./health-check.sh; then
    aws cloudwatch put-metric-data --namespace "$NAMESPACE" --metric-data MetricName=HealthCheck,Value=1,Unit=None,Dimensions=InstanceId=$INSTANCE_ID
else
    aws cloudwatch put-metric-data --namespace "$NAMESPACE" --metric-data MetricName=HealthCheck,Value=0,Unit=None,Dimensions=InstanceId=$INSTANCE_ID
fi

# Docker container metrics
RUNNING_CONTAINERS=$(docker ps -q | wc -l)
aws cloudwatch put-metric-data --namespace "$NAMESPACE" --metric-data MetricName=RunningContainers,Value=$RUNNING_CONTAINERS,Unit=Count,Dimensions=InstanceId=$INSTANCE_ID
EOF

chmod +x /opt/madplan/send-metrics.sh

# Add custom metrics to cron
echo "*/5 * * * * ec2-user /opt/madplan/send-metrics.sh > /dev/null 2>&1" >> /etc/crontab

# Signal that user data script has completed
echo "$(date): User data script completed successfully"

# Create completion marker
touch /opt/madplan/user-data-complete

# Send success metric
aws cloudwatch put-metric-data \
    --namespace "MadPlan/Deployment" \
    --metric-data MetricName=UserDataSuccess,Value=1,Unit=None,Dimensions=InstanceId=$(curl -s http://169.254.169.254/latest/meta-data/instance-id)

echo "$(date): MadPlan application server setup complete!"
echo "$(date): Instance is ready for deployment"