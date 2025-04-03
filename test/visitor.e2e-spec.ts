import * as request from 'supertest';
import { TestingModule } from '@nestjs/testing';
import { VisitorModule } from '../src/visitor/visitor.module';
import { VisitorService } from '../src/visitor/visitor.service';
import { Visitor } from '../src/visitor/entities/visitor.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { DbModule } from '@/db/db.module';
import { INestApplication } from '@nestjs/common';
import { setupTestApp, truncateAllTables } from './utils/test.util';

describe('VisitorsController (e2e)', () => {
  let app: INestApplication;
  let module: TestingModule;
  let dataSource: DataSource;
  let visitorRepository: Repository<Visitor>;
  let visitorService: VisitorService;

  beforeAll(async () => {
    const testApp = await setupTestApp({ modules: [VisitorModule, DbModule] });
    ({ app, module, dataSource } = testApp);
    visitorRepository = module.get<Repository<Visitor>>(
      getRepositoryToken(Visitor),
    );
    visitorService = module.get<VisitorService>(VisitorService);
  }, 15000);

  afterEach(async () => {
    await truncateAllTables(dataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  it('/visitors/today (GET) returns 0 when no visitors', async () => {
    const today = new Date().toISOString().split('T')[0];
    await visitorRepository.delete({ date: today }); // Ensure clean state
    const response = await request(app.getHttpServer())
      .get('/visitors/today')
      .expect(200);

    expect(response.body).toMatchObject({
      count: 0,
    });
  });

  it('/visitors/today (GET) returns existing count', async () => {
    const today = new Date().toISOString().split('T')[0];
    await visitorRepository.save({ date: today, count: 5 });
    const response = await request(app.getHttpServer())
      .get('/visitors/today')
      .expect(200);

    expect(response.body).toMatchObject({
      count: 5,
    });
  });

  it('increments visitor count via service', async () => {
    const today = new Date().toISOString().split('T')[0];
    await visitorRepository.save({ date: today, count: 0 });
    await visitorService.upsertVisitorCount('test@test.com');
    const response = await request(app.getHttpServer())
      .get('/visitors/today')
      .expect(200);

    expect(response.body).toMatchObject({
      count: 1,
    });
  });
});
