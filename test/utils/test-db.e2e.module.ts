import { createNestJSDatasource } from '@/db/data-source';
import { Module, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { runSeeders } from 'typeorm-extension';
import { addTransactionalDataSource } from 'typeorm-transactional';

config({ path: '.env.test' });

const TestE2EDatabaseModule = TypeOrmModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: async (configService: ConfigService) => {
    const options = createNestJSDatasource(configService);
    return {
      ...options,
      logging: false,
      autoLoadEntities: true,
    };
  },
  async dataSourceFactory(options) {
    if (!options) {
      throw new Error('Invalid options passed');
    }
    return addTransactionalDataSource(new DataSource(options));
  },
});

@Module({
  imports: [TestE2EDatabaseModule],
})
export class TestDbModule implements OnApplicationBootstrap {
  constructor(private dataSource: DataSource) {}

  async onApplicationBootstrap() {
    if (process.env.NODE_ENV === 'test') {
      await runSeeders(this.dataSource);
    }
  }
}
