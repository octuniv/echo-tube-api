import { Test, TestingModule } from '@nestjs/testing';
import { VisitorService } from './visitor.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Visitor } from './entities/visitor.entity';
import { createMock } from '@golevelup/ts-jest';
import { Repository } from 'typeorm';

describe('VisitorService', () => {
  let service: VisitorService;
  let repository: Repository<Visitor>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VisitorService,
        {
          provide: getRepositoryToken(Visitor),
          useValue: createMock<Repository<Visitor>>(),
        },
      ],
    }).compile();

    service = module.get<VisitorService>(VisitorService);
    repository = module.get(getRepositoryToken(Visitor));
  });

  it('should create new visitor record', async () => {
    const mockDate = '2024-03-20';
    const mockNewvisitor = new Visitor();
    mockNewvisitor.count = 1;
    mockNewvisitor.date = mockDate;

    jest.useFakeTimers().setSystemTime(new Date(mockDate));
    jest.spyOn(repository, 'findOneBy').mockResolvedValue(null);
    jest.spyOn(repository, 'create').mockReturnValue(mockNewvisitor);

    await service.upsertVisitorCount();
    expect(repository.save).toHaveBeenCalledWith(mockNewvisitor);
  });

  it('should increment existing visitor count', async () => {
    const mockVisitor = { date: '2024-03-20', count: 5 };
    jest.spyOn(repository, 'findOneBy').mockResolvedValue(mockVisitor);

    await service.upsertVisitorCount();
    expect(repository.save).toHaveBeenCalledWith({ ...mockVisitor, count: 6 });
  });

  it('should return 0 for no visitors', async () => {
    jest.spyOn(repository, 'findOneBy').mockResolvedValue(null);
    const result = await service.getTodayVisitors();
    expect(result).toEqual(0);
  });
});
