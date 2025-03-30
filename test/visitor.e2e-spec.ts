import * as request from 'supertest';
import { Test } from '@nestjs/testing';
import { VisitorModule } from '../src/visitor/visitor.module';
import { VisitorService } from '../src/visitor/visitor.service';
import { Visitor } from '../src/visitor/entities/visitor.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { DbModule } from '@/db/db.module';
import { TestDbModule } from './test-db.e2e.module';
import { INestApplication } from '@nestjs/common';
import {
  initializeTransactionalContext,
  StorageDriver,
} from 'typeorm-transactional';

const truncateAllTable = async (dataSource: DataSource) => {
  const entities = dataSource.entityMetadatas;
  for (const entity of entities) {
    const repository = dataSource.getRepository(entity.name);
    await repository.query(
      `TRUNCATE ${entity.tableName} RESTART IDENTITY CASCADE;`,
    );
  }
};

describe('VisitorsController (e2e)', () => {
  let app: INestApplication;
  let visitorRepository: Repository<Visitor>;
  let visitorService: VisitorService;
  let dataSource: DataSource;

  beforeAll(async () => {
    initializeTransactionalContext({ storageDriver: StorageDriver.AUTO });
    const moduleFixture = await Test.createTestingModule({
      imports: [VisitorModule, DbModule],
    })
      .overrideModule(DbModule)
      .useModule(TestDbModule)
      .compile();

    app = moduleFixture.createNestApplication();
    visitorRepository = moduleFixture.get<Repository<Visitor>>(
      getRepositoryToken(Visitor),
    );
    visitorService = moduleFixture.get<VisitorService>(VisitorService);
    dataSource = moduleFixture.get<DataSource>(DataSource);
    await app.init();
  });

  afterEach(async () => {
    await truncateAllTable(dataSource);
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
