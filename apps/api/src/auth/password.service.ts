import { Inject, Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';
import { APP_CONFIG, type AppConfig } from '../config/app-config';

@Injectable()
export class PasswordService {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  hash(plain: string): Promise<string> {
    return hash(plain, {
      memoryCost: this.config.argon2.memoryCost,
      timeCost: this.config.argon2.timeCost,
      parallelism: this.config.argon2.parallelism,
    });
  }

  async verify(hashValue: string, plain: string): Promise<boolean> {
    try {
      return await verify(hashValue, plain);
    } catch {
      return false;
    }
  }
}
