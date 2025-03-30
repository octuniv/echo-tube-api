import { DataSource } from 'typeorm';
import { runSeeders } from 'typeorm-extension';
import { dataSourceOptions } from './data-source';

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
