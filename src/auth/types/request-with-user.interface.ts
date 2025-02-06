import { Request } from 'express';
import { User } from '@/users/entities/user.entity';

export interface RequestWithUser extends Request {
  user: User; // 또는 필요한 사용자 데이터 구조로 정의
}
