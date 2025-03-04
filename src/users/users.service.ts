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
    const { name, nickName, email, password } = createUserDto;
    const checkExist = await this.findExistUser(email);
    if (checkExist) {
      throw new BadRequestException(`This email ${email} is already existed!`);
    }
    const nickNameExist = await this.findAbsenseOfNickName(nickName);
    if (nickNameExist) {
      throw new BadRequestException(
        `This nickName ${nickName} is already existed!`,
      );
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = this.usersRepository.create({
      name: name,
      nickName: nickName,
      email: email,
      passwordHash: hashedPassword,
    });
    return this.usersRepository.save(user);
  }

  async findUserById(id: number) {
    return this.usersRepository.findOne({
      where: {
        id: id,
      },
    });
  }

  async findUserByEmail(email: string) {
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
    return this.findUserByEmail(email)
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

  async findAbsenseOfNickName(nickName: string) {
    return this.usersRepository
      .findOne({
        where: { nickName: nickName },
      })
      .then((user) => {
        if (user) {
          return true;
        } else {
          return false;
        }
      });
  }

  async updatePassword(email: string, updateUserDto: UpdateUserDto) {
    const user = await this.findUserByEmail(email);
    const hashedPassword = await bcrypt.hash(updateUserDto.password, 10);
    user.passwordHash = hashedPassword;
    return this.usersRepository.save(user);
  }

  async removeAccount(email: string) {
    const user = await this.findUserByEmail(email);
    return this.usersRepository.remove(user);
  }
}
