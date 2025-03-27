import { Test, TestingModule } from '@nestjs/testing';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';

describe('DashboardController', () => {
  let controller: DashboardController;
  let service: DashboardService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        {
          provide: DashboardService,
          useValue: {
            getDashboardSummary: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<DashboardController>(DashboardController);
    service = module.get<DashboardService>(DashboardService);
  });

  it('should return dashboard summary', async () => {
    const mockSummary = {
      visitors: 100,
      popularPosts: [{ id: 1, title: 'Post 1', views: 50 }],
    };
    jest.spyOn(service, 'getDashboardSummary').mockResolvedValue(mockSummary);

    const result = await controller.getSummary();
    expect(result).toEqual(mockSummary);
    expect(service.getDashboardSummary).toHaveBeenCalled();
  });
});
