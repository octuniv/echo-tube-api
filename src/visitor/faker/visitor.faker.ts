import { faker } from '@faker-js/faker';
import { Visitor } from '../entities/visitor.entity';

export function generateFakeVisitor(): Visitor {
  const visitor = new Visitor();

  const randomDate = faker.date.recent({ days: 30 });
  visitor.date = randomDate.toISOString().split('T')[0];

  visitor.count = faker.number.int({ min: 1, max: 1000 });

  const uniqueVisitorCount = faker.number.int({ min: 1, max: 100 }); // 1 ~ 100명
  visitor.uniqueVisitors = Array.from({ length: uniqueVisitorCount }, () =>
    faker.internet.email(),
  );

  return visitor;
}

export function generateFakeVisitors(count: number): Visitor[] {
  return Array.from({ length: count }, () => generateFakeVisitor());
}
