import { faker } from '@faker-js/faker';
import { Visitor } from '../entities/visitor.entity';
import { VisitorEntry } from '../entities/visitor-entry.entity';

export function createVisitorEntry(
  overrides?: Partial<VisitorEntry>,
): VisitorEntry {
  const entry = new VisitorEntry();
  entry.userIdentifier = faker.internet.email();
  entry.date = faker.date.recent({ days: 30 }).toISOString().split('T')[0];
  return Object.assign(entry, overrides);
}

export function createVisitor(overrides?: Partial<Visitor>): Visitor {
  const visitor = new Visitor();

  // 기본 값 생성
  const randomDate = faker.date.recent({ days: 30 });
  visitor.date = randomDate.toISOString().split('T')[0];
  visitor.count = faker.number.int({ min: 1, max: 1000 });

  // VisitorEntry 생성
  const entryCount = faker.number.int({ min: 1, max: 100 });
  visitor.entries = Array.from({ length: entryCount }, () => {
    const entry = new VisitorEntry();
    entry.userIdentifier = faker.internet.email();
    entry.date = visitor.date; // FK 설정
    entry.visitor = visitor; // 관계 설정
    return entry;
  });

  // 재정의 적용
  return Object.assign(visitor, overrides);
}

export function createVisitors(
  count: number,
  overrides?: Partial<Visitor>,
): Visitor[] {
  return Array.from({ length: count }, () => createVisitor(overrides));
}
