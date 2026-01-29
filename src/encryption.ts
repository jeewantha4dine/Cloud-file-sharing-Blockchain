import * as crypto from 'crypto';
import * as fs from 'fs';

export class EncryptionService {
  private algorithm = 'aes-256-gcm';
  private keyLength = 32;

  generateKey(): Buffer {
    return crypto.randomBytes(this.keyLength);
  }

  async encryptFile(
    inputPath: string,
    outputPath: string,
    key: Buffer
  ): Promise<{ iv: Buffer; authTag: Buffer }> {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, key, iv);

    const input = fs.createReadStream(inputPath);
    const output = fs.createWriteStream(outputPath);

    return new Promise((resolve, reject) => {
      input.pipe(cipher).pipe(output);
      
      output.on('finish', () => {
        const authTag = cipher.getAuthTag();
        resolve({ iv, authTag });
      });
      
      output.on('error', reject);
      input.on('error', reject);
    });
  }

  async decryptFile(
    inputPath: string,
    outputPath: string,
    key: Buffer,
    iv: Buffer,
    authTag: Buffer
  ): Promise<void> {
    const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
    decipher.setAuthTag(authTag);

    const input = fs.createReadStream(inputPath);
    const output = fs.createWriteStream(outputPath);

    return new Promise((resolve, reject) => {
      input.pipe(decipher).pipe(output);
      
      output.on('finish', resolve);
      output.on('error', reject);
      input.on('error', reject);
    });
  }

  encryptWithPublicKey(data: Buffer, publicKey: string): Buffer {
    return crypto.publicEncrypt(
      {
        key: publicKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      data
    );
  }

  decryptWithPrivateKey(encryptedData: Buffer, privateKey: string): Buffer {
    return crypto.privateDecrypt(
      {
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      encryptedData
    );
  }

  generateKeyPair(): { publicKey: string; privateKey: string } {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
      },
    });

    return { publicKey, privateKey };
  }

  encodeKey(key: Buffer, iv: Buffer, authTag: Buffer): string {
    const combined = Buffer.concat([key, iv, authTag]);
    return combined.toString('base64');
  }

  decodeKey(encoded: string): { key: Buffer; iv: Buffer; authTag: Buffer } {
    const combined = Buffer.from(encoded, 'base64');
    const key = combined.slice(0, 32);
    const iv = combined.slice(32, 48);
    const authTag = combined.slice(48, 64);
    return { key, iv, authTag };
  }
}