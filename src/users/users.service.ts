import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async signUpUser(createUserDto: CreateUserDto) {
    const checkExist = await this.findExistUser(createUserDto.email);
    if (checkExist) {
      throw new BadRequestException(
        `This email ${createUserDto.email} is already existed!`,
      );
    }
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    const user = this.usersRepository.create({
      name: createUserDto.name,
      email: createUserDto.email,
      passwordHash: hashedPassword,
    });
    return this.usersRepository.save(user);
  }

  async findUser(email: string) {
    return this.usersRepository
      .findOne({
        where: { email: email },
      })
      .then((user) => {
        if (user) {
          return user;
        } else {
          throw new NotFoundException(
            `This email ${email} user could not be found`,
          );
        }
      });
  }

  async findExistUser(email: string) {
    return this.findUser(email)
      .then(() => {
        return true;
      })
      .catch((err) => {
        if (err instanceof NotFoundException) {
          return false;
        } else {
          throw err;
        }
      });
  }

  async updatePassword(email: string, updateUserDto: UpdateUserDto) {
    const user = await this.findUser(email);
    const hashedPassword = await bcrypt.hash(updateUserDto.password, 10);
    user.passwordHash = hashedPassword;
    return this.usersRepository.save(user);
  }

  async removeAccount(email: string) {
    const user = await this.findUser(email);
    return this.usersRepository.remove(user);
  }
}
