import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { runSeeders } from 'typeorm-extension';
import { createStandaloneDataSource } from './data-source';

const envFile = `.env.${process.env.NODE_ENV || 'development'}`;
dotenv.config({ path: envFile });

const dataSourceOptions = createStandaloneDataSource();

const run = async () => {
  const dataSource = new DataSource(dataSourceOptions);
  await dataSource.initialize();
  await runSeeders(dataSource);
  await dataSource.destroy();
};

run().catch((error) => {
  console.error('Error running seeders:', error);
  process.exit(1);
});
