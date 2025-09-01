import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SecretConfig {
  name: string;
  value: string;
  encrypted?: boolean;
  lastUpdated?: Date;
}

@Injectable()
export class SecretsManagerService {
  private readonly logger = new Logger(SecretsManagerService.name);
  private readonly secrets = new Map<string, SecretConfig>();

  constructor(private readonly configService: ConfigService) {
    this.initializeSecrets();
  }

  private initializeSecrets() {
    // Initialize with environment variables
    const secrets = [
      'JWT_SECRET',
      'DATABASE_URL',
      'REDIS_URL',
      'SENTRY_DSN',
      'DATADOG_API_KEY',
      'AWS_ACCESS_KEY_ID',
      'AWS_SECRET_ACCESS_KEY',
    ];

    secrets.forEach(secretName => {
      const value = this.configService.get<string>(secretName);
      if (value) {
        this.secrets.set(secretName, {
          name: secretName,
          value,
          encrypted: false,
          lastUpdated: new Date(),
        });
      }
    });

    this.logger.log(`Initialized ${this.secrets.size} secrets`);
  }

  async getSecret(name: string): Promise<string | null> {
    const secret = this.secrets.get(name);
    if (!secret) {
      this.logger.warn(`Secret '${name}' not found`);
      return null;
    }

    return secret.value;
  }

  async setSecret(name: string, value: string, encrypted = false): Promise<void> {
    this.secrets.set(name, {
      name,
      value,
      encrypted,
      lastUpdated: new Date(),
    });

    this.logger.log(`Secret '${name}' updated`);
  }

  async deleteSecret(name: string): Promise<boolean> {
    const deleted = this.secrets.delete(name);
    if (deleted) {
      this.logger.log(`Secret '${name}' deleted`);
    } else {
      this.logger.warn(`Secret '${name}' not found for deletion`);
    }
    return deleted;
  }

  async listSecrets(): Promise<string[]> {
    return Array.from(this.secrets.keys());
  }

  async rotateSecret(name: string, newValue: string): Promise<void> {
    const existing = this.secrets.get(name);
    if (!existing) {
      throw new Error(`Secret '${name}' not found`);
    }

    await this.setSecret(name, newValue, existing.encrypted);
    this.logger.log(`Secret '${name}' rotated`);
  }

  async validateSecrets(): Promise<{ valid: boolean; missing: string[] }> {
    const requiredSecrets = ['JWT_SECRET', 'DATABASE_URL'];
    const missing: string[] = [];

    for (const secretName of requiredSecrets) {
      if (!this.secrets.has(secretName)) {
        missing.push(secretName);
      }
    }

    const valid = missing.length === 0;
    if (!valid) {
      this.logger.error(`Missing required secrets: ${missing.join(', ')}`);
    }

    return { valid, missing };
  }

  async getSecretMetadata(name: string): Promise<Omit<SecretConfig, 'value'> | null> {
    const secret = this.secrets.get(name);
    if (!secret) {
      return null;
    }

    return {
      name: secret.name,
      encrypted: secret.encrypted,
      lastUpdated: secret.lastUpdated,
    };
  }
}
