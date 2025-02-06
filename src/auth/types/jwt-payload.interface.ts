import { UserRole } from '@/users/entities/user-role.enum';

export interface jwtPayloadInterface {
  id: number;
  email: string;
  role: UserRole;
}

export interface jwtValidatedOutputInterface {
  id: number;
  email: string;
  role: UserRole;
}
