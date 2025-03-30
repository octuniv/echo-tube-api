import { Test, TestingModule } from '@nestjs/testing';
import { VisitorService } from './visitor.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Visitor } from './entities/visitor.entity';
import { createMock } from '@golevelup/ts-jest';
import { Repository } from 'typeorm';
import { createVisitor } from './factories/visitor.factory';

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

  it('should create new visitor record when no record exists for today', async () => {
    const mockDate = '2024-03-20';
    const mockUserIdentifier = 'test@test.com';

    // Mock 데이터 설정
    jest.spyOn(repository, 'findOneBy').mockResolvedValue(null); // 오늘의 방문자 데이터가 없는 경우
    jest
      .spyOn(repository, 'create')
      .mockImplementation((data) => data as Visitor);

    // 시스템 시간을 고정
    jest.useFakeTimers().setSystemTime(new Date(mockDate));

    // 테스트 실행
    await service.upsertVisitorCount(mockUserIdentifier);

    // 검증
    expect(repository.findOneBy).toHaveBeenCalledWith({ date: mockDate });
    expect(repository.create).toHaveBeenCalledWith({
      date: mockDate,
      count: 1,
      uniqueVisitors: [mockUserIdentifier], // 새로운 유저 식별자가 포함되어야 함
    });
    expect(repository.save).toHaveBeenCalled();
  });

  it('should increment existing visitor count when user is not a duplicate', async () => {
    const mockDate = '2024-03-20';
    const mockUserIdentifier = 'test@test.com';
    const mockVisitor = createVisitor();
    mockVisitor.date = mockDate;
    mockVisitor.count = 1;
    mockVisitor.uniqueVisitors = ['existing-user@example.com']; // 이미 존재하는 유저 식별자

    // Mock 데이터 설정
    jest.spyOn(repository, 'findOneBy').mockResolvedValue(mockVisitor);

    // 시스템 시간을 고정
    jest.useFakeTimers().setSystemTime(new Date(mockDate));
    // 테스트 실행
    await service.upsertVisitorCount(mockUserIdentifier);

    // 검증
    expect(repository.findOneBy).toHaveBeenCalledWith({ date: mockDate });
    expect(repository.save).toHaveBeenCalledWith({
      ...mockVisitor,
      count: 2, // 방문자 수 증가
      uniqueVisitors: ['existing-user@example.com', mockUserIdentifier], // 새로운 유저 식별자 추가
    });
  });

  it('should not increment visitor count when user is a duplicate', async () => {
    const mockDate = '2024-03-20';
    const mockUserIdentifier = 'test@test.com';
    const mockVisitor = createVisitor();
    mockVisitor.date = mockDate;
    mockVisitor.uniqueVisitors = [mockUserIdentifier]; // 이미 존재하는 유저 식별자

    // Mock 데이터 설정
    jest.spyOn(repository, 'findOneBy').mockResolvedValue(mockVisitor);

    // 시스템 시간을 고정
    jest.useFakeTimers().setSystemTime(new Date(mockDate));

    // 테스트 실행
    await service.upsertVisitorCount(mockUserIdentifier);

    // 검증
    expect(repository.findOneBy).toHaveBeenCalledWith({ date: mockDate });
    expect(repository.save).not.toHaveBeenCalled(); // 중복 유저인 경우 저장되지 않음
  });

  it('should return 0 for no visitors', async () => {
    const mockDate = '2024-03-20';

    // Mock 데이터 설정
    jest.spyOn(repository, 'findOneBy').mockResolvedValue(null); // 오늘의 방문자 데이터가 없는 경우

    // 시스템 시간을 고정
    jest.useFakeTimers().setSystemTime(new Date(mockDate));

    // 테스트 실행
    const result = await service.getTodayVisitors();

    // 검증
    expect(repository.findOneBy).toHaveBeenCalledWith({ date: mockDate });
    expect(result).toEqual(0); // 방문자 데이터가 없으므로 0 반환
  });

  it('should return the correct visitor count for today', async () => {
    const mockDate = '2024-03-20';
    const mockVisitor = createVisitor();
    mockVisitor.date = mockDate;
    mockVisitor.count = 42; // 임의의 방문자 수

    // Mock 데이터 설정
    jest.spyOn(repository, 'findOneBy').mockResolvedValue(mockVisitor);

    // 시스템 시간을 고정
    jest.useFakeTimers().setSystemTime(new Date(mockDate));

    // 테스트 실행
    const result = await service.getTodayVisitors();

    // 검증
    expect(repository.findOneBy).toHaveBeenCalledWith({ date: mockDate });
    expect(result).toEqual(mockVisitor.count); // 저장된 방문자 수와 일치해야 함
  });
});
