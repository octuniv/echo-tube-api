import { dataSourceOptions } from '@/db/data-source';
import { Module, OnApplicationBootstrap } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { runSeeders } from 'typeorm-extension';

config({ path: '.env.test' });

const TestE2EDatabaseModule = TypeOrmModule.forRoot({
  ...dataSourceOptions,
  logging: false,
  autoLoadEntities: true,
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
