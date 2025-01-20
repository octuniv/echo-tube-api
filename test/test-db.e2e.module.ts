import { TypeOrmModule } from '@nestjs/typeorm';
import { config } from 'dotenv';

config({ path: '.env.test' });
export const TestE2EDbModule = TypeOrmModule.forRoot({
  type: 'postgres',
  host: process.env.DATABASE_HOST,
  port: +process.env.DATABASE_PORT,
  username: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_DBNAME,
  synchronize: true,
  logging: true,
  dropSchema: true,
  autoLoadEntities: true,
});
