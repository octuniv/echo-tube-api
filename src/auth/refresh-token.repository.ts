import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RefreshToken } from './entities/refresh-token.entity';

@Injectable()
export class RefreshTokenRepository {
  constructor(
    @InjectRepository(RefreshToken)
    private repo: Repository<RefreshToken>,
  ) {}

  async saveToken(
    userEmail: string,
    token: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.repo.save({ userEmail, token, expiresAt });
  }

  async findValidToken(token: string): Promise<RefreshToken> {
    return this.repo.findOne({
      where: { token, revoked: false },
    });
  }

  async revokeToken(tokenId: string): Promise<void> {
    await this.repo.update(tokenId, { revoked: true });
  }
}
