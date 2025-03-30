// visitors/services/visitors.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Visitor } from './entities/visitor.entity';
import { VisitorEntry } from './entities/visitor-entry.entity';

@Injectable()
export class VisitorService {
  constructor(
    @InjectRepository(Visitor)
    private visitorsRepository: Repository<Visitor>,
    @InjectRepository(VisitorEntry) // VisitorEntry 레포지토리 추가
    private entriesRepository: Repository<VisitorEntry>,
  ) {}

  async upsertVisitorCount(userIdentifier: string) {
    const today = new Date().toISOString().split('T')[0];
    await this.entriesRepository.query(
      `
      WITH ensure_visitor AS (
        INSERT INTO visitor (date, count)
        VALUES ($1, 0)
        ON CONFLICT (date) DO NOTHING
      ),
      inserted_entry AS (
        INSERT INTO visitor_entry (date, user_identifier)
        VALUES ($1, $2)
        ON CONFLICT (date, user_identifier) DO NOTHING
        RETURNING id
      )
      UPDATE visitor
      SET count = count + 1
      WHERE date = $1
      AND EXISTS (SELECT 1 FROM inserted_entry);
      `,
      [today, userIdentifier],
    );
  }

  async getTodayVisitors(): Promise<number> {
    const today = new Date().toISOString().split('T')[0];
    const visitor = await this.visitorsRepository.findOneBy({ date: today });
    return visitor?.count || 0;
  }
}
