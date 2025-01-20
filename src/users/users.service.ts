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
    const user = this.usersRepository.create({
      name: createUserDto.name,
      email: createUserDto.email,
      passwordHash: createUserDto.password,
    });
    return this.usersRepository.save(user);
  }

  async findExistUser(email: string) {
    return this.usersRepository.findOne({
      where: { email: email },
    });
  }

  async updatePassword(email: string, updateUserDto: UpdateUserDto) {
    const user = await this.findExistUser(email);
    if (!user) {
      throw new NotFoundException(
        `This email ${email} user could not be found`,
      );
    }
    user.passwordHash = updateUserDto.password;
    return this.usersRepository.save(user);
  }

  async removeAccount(email: string) {
    const user = await this.findExistUser(email);
    if (!user) {
      throw new NotFoundException(
        `This email ${email} user could not be found`,
      );
    }
    return this.usersRepository.delete({ email: email });
  }
}
