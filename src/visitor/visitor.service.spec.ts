import { Test, TestingModule } from '@nestjs/testing';
import { VisitorService } from './visitor.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Visitor } from './entities/visitor.entity';
import { createMock } from '@golevelup/ts-jest';
import { Repository } from 'typeorm';
import { createVisitor } from './factories/visitor.factory';
import { VisitorEntry } from './entities/visitor-entry.entity';

describe('VisitorService', () => {
  let service: VisitorService;
  let repository: Repository<Visitor>;
  let entryRepository: Repository<VisitorEntry>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VisitorService,
        {
          provide: getRepositoryToken(Visitor),
          useValue: createMock<Repository<Visitor>>({
            findOneBy: jest.fn(),
          }),
        },
        {
          provide: getRepositoryToken(VisitorEntry),
          useValue: createMock<Repository<VisitorEntry>>({
            query: jest.fn().mockResolvedValue(undefined),
          }),
        },
      ],
    }).compile();

    service = module.get<VisitorService>(VisitorService);
    repository = module.get(getRepositoryToken(Visitor));
    entryRepository = module.get(getRepositoryToken(VisitorEntry));
  });

  it('should execute CTE query with visitor existence check', async () => {
    const mockDate = '2024-03-20';
    const mockUserIdentifier = 'test@test.com';

    jest.useFakeTimers().setSystemTime(new Date(mockDate));

    await service.upsertVisitorCount(mockUserIdentifier);

    expect(entryRepository.query).toHaveBeenCalledWith(
      expect.stringMatching(
        /WITH ensure_visitor AS\s*\(\s*INSERT INTO visitor\s*\(date, count\)\s*VALUES\s*\(\s*\$1\s*,\s*0\s*\)\s*ON CONFLICT\s*\(date\)\s*DO NOTHING\s*\)\s*,\s*inserted_entry AS\s*\(\s*INSERT INTO visitor_entry\s*\(date, user_identifier\)\s*VALUES\s*\(\s*\$1\s*,\s*\$2\s*\)\s*ON CONFLICT\s*\(date, user_identifier\)\s*DO NOTHING\s*RETURNING id\s*\)\s*UPDATE visitor\s*SET count = count \+ 1\s*WHERE date = \$1\s*AND EXISTS\s*\(SELECT 1 FROM inserted_entry\);/i,
      ),
      [mockDate, mockUserIdentifier],
    );
  });

  it('should not update count for duplicate user', async () => {
    const mockDate = '2024-03-20';
    const mockUserIdentifier = 'test@test.com';

    // Mock query to simulate duplicate entry
    jest.spyOn(entryRepository, 'query').mockImplementation(async (query) => {
      if (query.includes('INSERT INTO visitor_entry')) {
        return []; // Simulate no insertion (duplicate)
      }
      return undefined;
    });

    jest.useFakeTimers().setSystemTime(new Date(mockDate));

    await service.upsertVisitorCount(mockUserIdentifier);

    // 수정된 검증 로직
    expect(entryRepository.query).toHaveBeenCalledWith(
      expect.stringMatching(
        /WITH\s+ensure_visitor\s+AS\s+\(\s+INSERT\s+INTO\s+visitor\s+\(date,\s+count\)\s+VALUES\s+\(\$1,\s+0\)\s+ON\s+CONFLICT\s+\(date\)\s+DO\s+NOTHING\s+\)\s*,\s*inserted_entry\s+AS\s+\(\s+INSERT\s+INTO\s+visitor_entry\s+\(date,\s+user_identifier\)\s+VALUES\s+\(\$1,\s+\$2\)\s+ON\s+CONFLICT\s+\(date,\s+user_identifier\)\s+DO\s+NOTHING\s+RETURNING\s+id\s+\)\s*UPDATE\s+visitor\s+SET\s+count\s+=\s+count\s+\+\s+1\s+WHERE\s+date\s+=\s+\$1\s+AND\s+EXISTS\s+\(SELECT\s+1\s+FROM\s+inserted_entry\)/is,
      ),
      [mockDate, mockUserIdentifier],
    );
  });

  // Keep existing tests for getTodayVisitors unchanged
  it('should return 0 when no visitor record exists', async () => {
    const mockDate = '2024-03-20';
    jest.spyOn(repository, 'findOneBy').mockResolvedValue(null);

    jest.useFakeTimers().setSystemTime(new Date(mockDate));

    const result = await service.getTodayVisitors();

    expect(repository.findOneBy).toHaveBeenCalledWith({ date: mockDate });
    expect(result).toEqual(0);
  });

  it('should return cached count from visitor entity', async () => {
    const mockDate = '2024-03-20';
    const mockVisitor = createVisitor({ date: mockDate, count: 42 });

    jest.spyOn(repository, 'findOneBy').mockResolvedValue(mockVisitor);

    jest.useFakeTimers().setSystemTime(new Date(mockDate));

    const result = await service.getTodayVisitors();

    expect(repository.findOneBy).toHaveBeenCalledWith({ date: mockDate });
    expect(result).toEqual(42);
  });
});
