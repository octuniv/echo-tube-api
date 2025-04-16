import { Module, OnApplicationBootstrap } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { createNestJSDatasource } from './data-source';
import { DataSource } from 'typeorm';
import { runSeeders } from 'typeorm-extension';
import { addTransactionalDataSource } from 'typeorm-transactional';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const options = createNestJSDatasource(configService);
        return {
          ...options,
          migrationsRun: false,
        };
      },
      async dataSourceFactory(options) {
        if (!options) {
          throw new Error('Invalid options passed');
        }
        return addTransactionalDataSource(new DataSource(options));
      },
    }),
  ],
})
export class DbModule implements OnApplicationBootstrap {
  constructor(private dataSource: DataSource) {}

  async onApplicationBootstrap() {
    if (process.env.NODE_ENV === 'test') {
      await runSeeders(this.dataSource);
    }
  }
}
