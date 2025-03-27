import { Test, TestingModule } from '@nestjs/testing';
import { VisitorsController } from './visitor.controller';
import { VisitorService } from './visitor.service';

describe('VisitorsController', () => {
  let controller: VisitorsController;
  let service: VisitorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VisitorsController],
      providers: [
        {
          provide: VisitorService,
          useValue: {
            getTodayVisitors: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<VisitorsController>(VisitorsController);
    service = module.get<VisitorService>(VisitorService);
  });

  it('should return today visitors count', async () => {
    jest.spyOn(service, 'getTodayVisitors').mockResolvedValue(42);
    const result = await controller.getTodayVisitors();
    expect(result).toEqual({ count: 42 });
  });
});
