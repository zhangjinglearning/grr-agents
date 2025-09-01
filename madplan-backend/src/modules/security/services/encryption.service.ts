import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import { KMSClient, DecryptCommand, EncryptCommand, GenerateDataKeyCommand } from '@aws-sdk/client-kms';

export interface EncryptionResult {
  encryptedData: string;
  dataKey?: string;
  iv?: string;
  tag?: string;
}

export interface DecryptionRequest {
  encryptedData: string;
  dataKey?: string;
  iv?: string;
  tag?: string;
}

export interface FieldEncryptionOptions {
  algorithm?: string;
  keyId?: string;
  context?: Record<string, string>;
  encoding?: BufferEncoding;
}

@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly kmsClient: KMSClient;
  private readonly defaultKeyId: string;
  private readonly userDataKeyId: string;

  constructor(private readonly configService: ConfigService) {
    this.kmsClient = new KMSClient({
      region: this.configService.get('aws.region', 'us-east-1'),
    });
    
    this.defaultKeyId = this.configService.get('security.encryption.defaultKeyId');
    this.userDataKeyId = this.configService.get('security.encryption.userDataKeyId');
  }

  /**
   * Encrypt sensitive user data using KMS with envelope encryption
   */
  async encryptUserData(
    data: string | Buffer,
    options: FieldEncryptionOptions = {}
  ): Promise<EncryptionResult> {
    try {
      const keyId = options.keyId || this.userDataKeyId;
      const algorithm = options.algorithm || 'aes-256-gcm';
      
      // Generate data encryption key
      const generateKeyCommand = new GenerateDataKeyCommand({
        KeyId: keyId,
        KeySpec: 'AES_256',
        EncryptionContext: {
          DataType: 'user-data',
          Algorithm: algorithm,
          ...options.context,
        },
      });
      
      const { Plaintext: dataKey, CiphertextBlob: encryptedDataKey } = 
        await this.kmsClient.send(generateKeyCommand);
      
      if (!dataKey || !encryptedDataKey) {
        throw new Error('Failed to generate data encryption key');
      }
      
      // Encrypt data using data key
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher('aes-256-cbc', dataKey);
      const dataBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
      const encrypted = Buffer.concat([cipher.update(dataBuffer), cipher.final()]);
      
      // Clear the plaintext data key from memory
      dataKey.fill(0);
      
      return {
        encryptedData: encrypted.toString('base64'),
        dataKey: Buffer.from(encryptedDataKey).toString('base64'),
        iv: iv.toString('base64'),
      };
      
    } catch (error) {
      this.logger.error('Failed to encrypt user data', error.stack);
      throw new Error('Encryption failed');
    }
  }

  /**
   * Decrypt sensitive user data using KMS envelope decryption
   */
  async decryptUserData(
    encryptionResult: DecryptionRequest,
    options: FieldEncryptionOptions = {}
  ): Promise<string> {
    try {
      const algorithm = options.algorithm || 'aes-256-gcm';
      
      if (!encryptionResult.dataKey || !encryptionResult.iv || !encryptionResult.tag) {
        throw new Error('Invalid encryption data - missing required fields');
      }
      
      // Decrypt the data key using KMS
      const decryptKeyCommand = new DecryptCommand({
        CiphertextBlob: Buffer.from(encryptionResult.dataKey, 'base64'),
        EncryptionContext: {
          DataType: 'user-data',
          Algorithm: algorithm,
          ...options.context,
        },
      });
      
      const { Plaintext: dataKey } = await this.kmsClient.send(decryptKeyCommand);
      
      if (!dataKey) {
        throw new Error('Failed to decrypt data key');
      }
      
      // Decrypt data using data key
      const encryptedData = Buffer.from(encryptionResult.encryptedData, 'base64');

      const decipher = crypto.createDecipher('aes-256-cbc', dataKey);
      
      const decrypted = Buffer.concat([
        decipher.update(encryptedData),
        decipher.final(),
      ]);
      
      // Clear the plaintext data key from memory
      dataKey.fill(0);
      
      return decrypted.toString('utf8');
      
    } catch (error) {
      this.logger.error('Failed to decrypt user data', error.stack);
      throw new Error('Decryption failed');
    }
  }

  /**
   * Encrypt application data using KMS directly
   */
  async encryptApplicationData(
    data: string | Buffer,
    options: FieldEncryptionOptions = {}
  ): Promise<string> {
    try {
      const keyId = options.keyId || this.defaultKeyId;
      const dataBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
      
      const encryptCommand = new EncryptCommand({
        KeyId: keyId,
        Plaintext: dataBuffer,
        EncryptionContext: {
          DataType: 'application-data',
          Service: 'madplan',
          ...options.context,
        },
      });
      
      const { CiphertextBlob } = await this.kmsClient.send(encryptCommand);
      
      if (!CiphertextBlob) {
        throw new Error('Failed to encrypt application data');
      }
      
      return Buffer.from(CiphertextBlob).toString('base64');
      
    } catch (error) {
      this.logger.error('Failed to encrypt application data', error.stack);
      throw new Error('Application data encryption failed');
    }
  }

  /**
   * Decrypt application data using KMS directly
   */
  async decryptApplicationData(
    encryptedData: string,
    options: FieldEncryptionOptions = {}
  ): Promise<string> {
    try {
      const ciphertextBlob = Buffer.from(encryptedData, 'base64');
      
      const decryptCommand = new DecryptCommand({
        CiphertextBlob: ciphertextBlob,
        EncryptionContext: {
          DataType: 'application-data',
          Service: 'madplan',
          ...options.context,
        },
      });
      
      const { Plaintext } = await this.kmsClient.send(decryptCommand);
      
      if (!Plaintext) {
        throw new Error('Failed to decrypt application data');
      }
      
      return Buffer.from(Plaintext).toString('utf8');
      
    } catch (error) {
      this.logger.error('Failed to decrypt application data', error.stack);
      throw new Error('Application data decryption failed');
    }
  }

  /**
   * Hash passwords using bcrypt with configurable cost
   */
  async hashPassword(password: string, rounds: number = 12): Promise<string> {
    try {
      if (!password) {
        throw new Error('Password cannot be empty');
      }
      
      // Ensure minimum security level
      const saltRounds = Math.max(rounds, 10);
      
      return await bcrypt.hash(password, saltRounds);
      
    } catch (error) {
      this.logger.error('Failed to hash password', error.stack);
      throw new Error('Password hashing failed');
    }
  }

  /**
   * Verify password against hash
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      if (!password || !hash) {
        return false;
      }
      
      return await bcrypt.compare(password, hash);
      
    } catch (error) {
      this.logger.error('Failed to verify password', error.stack);
      return false;
    }
  }

  /**
   * Generate cryptographically secure random tokens
   */
  generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate secure API keys with specific format
   */
  generateApiKey(prefix: string = 'mad'): string {
    const timestamp = Date.now().toString(36);
    const randomBytes = crypto.randomBytes(16).toString('hex');
    const checksum = crypto
      .createHash('sha256')
      .update(timestamp + randomBytes)
      .digest('hex')
      .substring(0, 8);
    
    return `${prefix}_${timestamp}_${randomBytes}_${checksum}`;
  }

  /**
   * Create HMAC signature for API authentication
   */
  createHmacSignature(data: string, secret: string, algorithm: string = 'sha256'): string {
    return crypto.createHmac(algorithm, secret).update(data).digest('hex');
  }

  /**
   * Verify HMAC signature
   */
  verifyHmacSignature(
    data: string,
    signature: string,
    secret: string,
    algorithm: string = 'sha256'
  ): boolean {
    try {
      const expectedSignature = this.createHmacSignature(data, secret, algorithm);
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch (error) {
      this.logger.error('HMAC verification failed', error.stack);
      return false;
    }
  }

  /**
   * Encrypt personally identifiable information (PII)
   */
  async encryptPII(piiData: any): Promise<any> {
    if (!piiData || typeof piiData !== 'object') {
      return piiData;
    }
    
    const encrypted = { ...piiData };
    const piiFields = ['email', 'phone', 'address', 'name', 'ssn', 'creditCard'];
    
    for (const field of piiFields) {
      if (encrypted[field]) {
        encrypted[field] = await this.encryptUserData(encrypted[field], {
          context: { FieldType: field, DataType: 'pii' }
        });
      }
    }
    
    return encrypted;
  }

  /**
   * Decrypt personally identifiable information (PII)
   */
  async decryptPII(encryptedPiiData: any): Promise<any> {
    if (!encryptedPiiData || typeof encryptedPiiData !== 'object') {
      return encryptedPiiData;
    }
    
    const decrypted = { ...encryptedPiiData };
    const piiFields = ['email', 'phone', 'address', 'name', 'ssn', 'creditCard'];
    
    for (const field of piiFields) {
      if (decrypted[field] && typeof decrypted[field] === 'object') {
        try {
          decrypted[field] = await this.decryptUserData(decrypted[field], {
            context: { FieldType: field, DataType: 'pii' }
          });
        } catch (error) {
          this.logger.error(`Failed to decrypt PII field: ${field}`, error.stack);
          // Leave field encrypted if decryption fails
        }
      }
    }
    
    return decrypted;
  }

  /**
   * Encrypt database fields using field-level encryption
   */
  async encryptDatabaseField(
    value: any,
    fieldName: string,
    tableName: string
  ): Promise<EncryptionResult | any> {
    // Only encrypt sensitive fields
    const sensitiveFields = ['password', 'email', 'phone', 'address', 'notes', 'description'];
    
    if (!sensitiveFields.some(field => fieldName.toLowerCase().includes(field))) {
      return value;
    }
    
    if (!value || typeof value !== 'string') {
      return value;
    }
    
    return await this.encryptUserData(value, {
      context: {
        TableName: tableName,
        FieldName: fieldName,
        DataType: 'database-field'
      }
    });
  }

  /**
   * Decrypt database fields using field-level encryption
   */
  async decryptDatabaseField(
    encryptedValue: any,
    fieldName: string,
    tableName: string
  ): Promise<any> {
    if (!encryptedValue || typeof encryptedValue !== 'object') {
      return encryptedValue;
    }
    
    if (!encryptedValue.encryptedData) {
      return encryptedValue;
    }
    
    try {
      return await this.decryptUserData(encryptedValue, {
        context: {
          TableName: tableName,
          FieldName: fieldName,
          DataType: 'database-field'
        }
      });
    } catch (error) {
      this.logger.error(`Failed to decrypt database field: ${tableName}.${fieldName}`, error.stack);
      throw error;
    }
  }

  /**
   * Generate encryption keys for client-side encryption
   */
  async generateClientEncryptionKeys(userId: string): Promise<{
    publicKey: string;
    privateKeyEncrypted: EncryptionResult;
    keyId: string;
  }> {
    try {
      // Generate RSA key pair for client-side encryption
      const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem'
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem'
        }
      });
      
      // Encrypt private key using user-specific context
      const privateKeyEncrypted = await this.encryptUserData(privateKey, {
        context: {
          UserId: userId,
          KeyType: 'client-private-key',
          DataType: 'user-encryption-key'
        }
      });
      
      const keyId = this.generateSecureToken(16);
      
      return {
        publicKey,
        privateKeyEncrypted,
        keyId
      };
      
    } catch (error) {
      this.logger.error('Failed to generate client encryption keys', error.stack);
      throw new Error('Client key generation failed');
    }
  }

  /**
   * Health check for encryption service
   */
  async healthCheck(): Promise<{ status: string; details: any }> {
    try {
      // Test basic encryption/decryption
      const testData = 'health-check-test';
      const encrypted = await this.encryptApplicationData(testData);
      const decrypted = await this.decryptApplicationData(encrypted);
      
      if (decrypted !== testData) {
        throw new Error('Encryption/decryption test failed');
      }
      
      // Test KMS connectivity
      const testKeyCommand = new GenerateDataKeyCommand({
        KeyId: this.defaultKeyId,
        KeySpec: 'AES_256',
      });
      
      await this.kmsClient.send(testKeyCommand);
      
      return {
        status: 'healthy',
        details: {
          kmsConnectivity: 'ok',
          encryptionTest: 'passed',
          timestamp: new Date().toISOString()
        }
      };
      
    } catch (error) {
      this.logger.error('Encryption service health check failed', error.stack);
      return {
        status: 'unhealthy',
        details: {
          error: error.message,
          timestamp: new Date().toISOString()
        }
      };
    }
  }
}