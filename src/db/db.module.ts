import { Module, OnApplicationBootstrap } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { dataSourceOptions } from './data-source';
import { DataSource } from 'typeorm';
import { runSeeders } from 'typeorm-extension';

@Module({
  imports: [TypeOrmModule.forRoot(dataSourceOptions)],
})
export class DbModule implements OnApplicationBootstrap {
  constructor(private dataSource: DataSource) {}

  async onApplicationBootstrap() {
    await runSeeders(this.dataSource);
  }
}
