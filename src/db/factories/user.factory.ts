import { setSeederFactory } from 'typeorm-extension';
import { User } from 'src/users/entities/user.entity';

export default setSeederFactory(User, (faker) => {
  const user = new User();
  user.name = faker.person.fullName();
  user.nickname = faker.person.firstName();
  user.email = faker.internet.email();
  user.passwordHash = faker.internet.password({ length: 20 });
  return user;
});
