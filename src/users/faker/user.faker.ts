import { faker } from '@faker-js/faker';
import { UpdateUserDto } from '@/users/dto/update-user.dto';
import { CreateUserDto } from '@/users/dto/create-user.dto';
import { User } from '../entities/user.entity';
import * as bcrypt from 'bcrypt';
import { UserRole } from '../entities/user-role.enum';

export const MakeCreateUserDtoFaker = () => {
  const createUserDtoFaker: CreateUserDto = {
    name: faker.person.fullName(),
    nickName: faker.person.firstName(),
    email: faker.internet.email(),
    password: faker.internet.password({ length: 20 }),
  };
  return createUserDtoFaker;
};

export const MakeUpdateUserDtoFaker = () => {
  const updateUserDtoFaker: UpdateUserDto = {
    password: faker.internet.password({ length: 20 }),
  };

  return updateUserDtoFaker;
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
