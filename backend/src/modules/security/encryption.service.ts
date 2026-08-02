import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private algorithm = 'aes-256-gcm';
  private keyLength = 32;
  private ivLength = 16;
  private saltLength = 64;
  private tagLength = 16;
  private tagPosition = this.keyLength + this.ivLength;
  private encryptedPosition = this.tagPosition + this.tagLength;

  private getKey(salt: Buffer): Buffer {
    return crypto.pbkdf2Sync(
      process.env.ENCRYPTION_KEY || 'default-key-change-in-production',
      salt,
      100000,
      this.keyLength,
      'sha512',
    );
  }

  encrypt(text: string): string {
    const salt = crypto.randomBytes(this.saltLength);
    const key = this.getKey(salt);
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipheriv(this.algorithm, key, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return Buffer.concat([salt, iv, tag, encrypted]).toString('base64');
  }

  decrypt(encryptedData: string): string {
    const buffer = Buffer.from(encryptedData, 'base64');
    const salt = buffer.subarray(0, this.saltLength);
    const iv = buffer.subarray(this.saltLength, this.tagPosition);
    const tag = buffer.subarray(this.tagPosition, this.encryptedPosition);
    const encrypted = buffer.subarray(this.encryptedPosition);

    const key = this.getKey(salt);
    const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
    decipher.setAuthTag(tag);

    return decipher.update(encrypted) + decipher.final('utf8');
  }
}
