// visitors/services/visitors.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Visitor } from './entities/visitor.entity';

@Injectable()
export class VisitorService {
  constructor(
    @InjectRepository(Visitor)
    private visitorsRepository: Repository<Visitor>,
  ) {}

  async upsertVisitorCount() {
    const today = new Date().toISOString().split('T')[0];

    const visitor = await this.visitorsRepository.findOneBy({ date: today });
    if (visitor) {
      visitor.count += 1;
      return this.visitorsRepository.save(visitor);
    }

    const newVisitor = this.visitorsRepository.create({
      date: today,
      count: 1,
    });
    return this.visitorsRepository.save(newVisitor);
  }

  async getTodayVisitors(): Promise<number> {
    const today = new Date().toISOString().split('T')[0];
    const visitor = await this.visitorsRepository.findOneBy({ date: today });
    return visitor?.count || 0;
  }
}
