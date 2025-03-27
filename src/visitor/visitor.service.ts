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

  async upsertVisitorCount(userIdentifier: string) {
    const today = new Date().toISOString().split('T')[0];

    let visitor = await this.visitorsRepository.findOneBy({ date: today });
    if (!visitor) {
      // 오늘 처음 방문한 경우
      visitor = this.visitorsRepository.create({
        date: today,
        count: 1,
        uniqueVisitors: [userIdentifier], // 유저 식별자를 배열로 저장
      });
    } else {
      // 이미 방문 데이터가 있는 경우
      if (!visitor.uniqueVisitors.includes(userIdentifier)) {
        // 중복되지 않은 유저인 경우
        visitor.count += 1;
        visitor.uniqueVisitors.push(userIdentifier); // 유저 식별자를 추가
      } else {
        return;
      }
    }
    return this.visitorsRepository.save(visitor);
  }

  async getTodayVisitors(): Promise<number> {
    const today = new Date().toISOString().split('T')[0];
    const visitor = await this.visitorsRepository.findOneBy({ date: today });
    return visitor?.count || 0;
  }
}
