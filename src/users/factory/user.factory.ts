import { faker } from '@faker-js/faker';
import { UpdateUserPasswordRequest } from '@/users/dto/update-user-password.dto';
import { CreateUserDto } from '@/users/dto/create-user.dto';
import { User } from '../entities/user.entity';
import * as bcrypt from 'bcryptjs';
import { UserRole } from '../entities/user-role.enum';
import { UpdateUserNicknameRequest } from '../dto/update-user-nickname.dto';

export const createUserDto = (): CreateUserDto => ({
  name: faker.person.fullName(),
  nickname: faker.person.firstName(),
  email: faker.internet.email(),
  password: faker.internet.password({ length: 20 }),
});

export const updateUserPasswordDto = (): UpdateUserPasswordRequest => ({
  password: faker.internet.password({ length: 20 }),
});

export const updateUserNicknameDto = (): UpdateUserNicknameRequest => ({
  nickname: faker.person.firstName(),
});

interface UserEntityOptions {
  id?: number;
  role?: UserRole;
  password?: string;
}

export const createUserEntity = ({
  id = 1,
  role = UserRole.USER,
  password = faker.internet.password({ length: 20 }),
}: UserEntityOptions = {}): User => {
  const user = new User();
  user.id = id;
  user.email = faker.internet.email();
  user.name = faker.person.fullName();
  user.passwordHash = bcrypt.hashSync(password, 10);
  user.role = role;
  return user;
};
