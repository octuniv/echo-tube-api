import { ApiProperty } from '@nestjs/swagger';
import { Request } from 'express';
import { User } from '@/users/entities/user.entity';

export class RequestWithUser extends Request {
  @ApiProperty({ type: () => User })
  user: User;
}
