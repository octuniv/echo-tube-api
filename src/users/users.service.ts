import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserPasswordRequest } from './dto/update-user-password.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import * as bcrypt from 'bcrypt';
import { UpdateUserNicknameRequest } from './dto/update-user-nickname.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async signUpUser(createUserDto: CreateUserDto) {
    const { name, nickname, email, password } = createUserDto;
    const checkExist = await this.findExistUser(email);
    if (checkExist) {
      throw new BadRequestException(`This email ${email} is already existed!`);
    }
    const nicknameExist = await this.findAbsenseOfNickname(nickname);
    if (nicknameExist) {
      throw new BadRequestException(
        `This nickname ${nickname} is already existed!`,
      );
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = this.usersRepository.create({
      name: name,
      nickname: nickname,
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

  async findAbsenseOfNickname(nickname: string) {
    return this.usersRepository
      .findOne({
        where: { nickname: nickname },
      })
      .then((user) => {
        if (user) {
          return true;
        } else {
          return false;
        }
      });
  }

  async updateNickname(
    id: number,
    updateNicknameDto: UpdateUserNicknameRequest,
  ) {
    const user = await this.findUserById(id);
    if (!user) {
      throw new NotFoundException('This user could not be found.');
    }

    const nicknameExist = await this.findAbsenseOfNickname(
      updateNicknameDto.nickname,
    );

    if (nicknameExist) {
      throw new BadRequestException(
        `This nickname ${updateNicknameDto.nickname} is already existed!`,
      );
    }

    user.nickname = updateNicknameDto.nickname;
    return this.usersRepository.save(user);
  }

  async updatePassword(
    id: number,
    updatePasswordDto: UpdateUserPasswordRequest,
  ) {
    const user = await this.findUserById(id);
    if (!user) {
      throw new NotFoundException('This user could not be found.');
    }
    const hashedPassword = await bcrypt.hash(updatePasswordDto.password, 10);
    user.passwordHash = hashedPassword;
    return this.usersRepository.save(user);
  }

  async deleteAccount(id: number) {
    const user = await this.findUserById(id);
    if (!user) {
      throw new NotFoundException('This user could not be found.');
    }
    const result = await this.usersRepository.softDelete(id);
    if (result.affected !== 1) {
      throw new InternalServerErrorException('Internal Server Error');
    }
  }
}
