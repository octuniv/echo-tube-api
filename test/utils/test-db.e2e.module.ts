import { dataSourceOptions } from '@/db/data-source';
import { Module, OnApplicationBootstrap } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { runSeeders } from 'typeorm-extension';
import { addTransactionalDataSource } from 'typeorm-transactional';

config({ path: '.env.test' });

const TestE2EDatabaseModule = TypeOrmModule.forRootAsync({
  useFactory() {
    return {
      ...dataSourceOptions,
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
    await runSeeders(this.dataSource);
  }
}
