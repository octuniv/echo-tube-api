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
import { UpdateUserNicknameRequest } from './dto/update-user-nickName.dto';

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
    const nickNameExist = await this.findAbsenseOfNickname(nickName);
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

  async findAbsenseOfNickname(nickName: string) {
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

  async updateNickname(
    id: number,
    updateNicknameDto: UpdateUserNicknameRequest,
  ) {
    const user = await this.findUserById(id);
    if (!user) {
      throw new NotFoundException('This user could not be found.');
    }
    user.nickName = updateNicknameDto.nickName;
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
