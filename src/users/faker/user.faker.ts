import { faker } from '@faker-js/faker';
import { UpdateUserPasswordRequest } from '@/users/dto/update-user-password.dto';
import { CreateUserDto } from '@/users/dto/create-user.dto';
import { User } from '../entities/user.entity';
import * as bcrypt from 'bcrypt';
import { UserRole } from '../entities/user-role.enum';
import { UpdateUserNicknameRequest } from '../dto/update-user-nickname.dto';

export const MakeCreateUserDtoFaker = () => {
  const createUserDtoFaker: CreateUserDto = {
    name: faker.person.fullName(),
    nickname: faker.person.firstName(),
    email: faker.internet.email(),
    password: faker.internet.password({ length: 20 }),
  };
  return createUserDtoFaker;
};

export const MakeUpdateUserPasswordRequestFaker = () => {
  const UpdateUserPasswordRequestFaker: UpdateUserPasswordRequest = {
    password: faker.internet.password({ length: 20 }),
  };

  return UpdateUserPasswordRequestFaker;
};

export const MakeUpdateUserNicknameRequestFaker = () => {
  const UpdateUserNicknameRequestFaker: UpdateUserNicknameRequest = {
    nickname: faker.person.firstName(),
  };

  return UpdateUserNicknameRequestFaker;
};

export const MakeUserEntityFaker = () => {
  const user = new User();
  user.id = 1;
  user.email = faker.internet.email();
  user.name = faker.person.fullName();
  user.passwordHash = bcrypt.hashSync(
    faker.internet.password({ length: 20 }),
    10,
  );
  user.role = UserRole.USER;
  return user;
};
