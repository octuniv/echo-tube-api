import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VisitorService } from './visitor.service';
import { Visitor } from './entities/visitor.entity';
import { VisitorsController } from './visitor.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Visitor])],
  providers: [VisitorService],
  controllers: [VisitorsController],
  exports: [VisitorService],
})
export class VisitorModule {}
