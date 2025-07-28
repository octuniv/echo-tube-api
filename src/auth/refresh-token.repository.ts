import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RefreshToken } from './entities/refresh-token.entity';
import { Transactional } from 'typeorm-transactional';

@Injectable()
export class RefreshTokenRepository {
  constructor(
    @InjectRepository(RefreshToken)
    private repo: Repository<RefreshToken>,
  ) {}

  @Transactional()
  async saveToken(
    userEmail: string,
    token: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.repo.save({ userEmail, token, expiresAt });
  }

  @Transactional()
  async findValidToken(token: string): Promise<RefreshToken> {
    return this.repo.findOne({
      where: { token, revoked: false },
      lock: { mode: 'pessimistic_write' },
    });
  }

  @Transactional()
  async revokeToken(tokenId: string): Promise<void> {
    await this.repo.update(tokenId, { revoked: true });
  }
}
