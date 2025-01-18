import { faker } from '@faker-js/faker';
import { UpdateUserDto } from '@/users/dto/update-user.dto';
import { CreateUserDto } from '@/users/dto/create-user.dto';

export const MakeCreateUserDtoFaker = () => {
  const createUserDtoFaker: CreateUserDto = {
    name: faker.person.fullName(),
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
