import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserPasswordRequest } from './dto/update-user-password.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import * as bcrypt from 'bcryptjs';
import { UpdateUserNicknameRequest } from './dto/update-user-nickname.dto';
import { AdminCreateUserDto } from './dto/admin/admin-create-user-dto';
import { UserRole } from './entities/user-role.enum';
import { AdminUpdateUserDto } from './dto/admin/admin-update-user-dto';
import { AdminUserDetailResponseDto } from './dto/admin/admin-user-detail-response.dto';
import { plainToInstance } from 'class-transformer';
import { AdminUserUpdateResponseDto } from './dto/admin/admin-user-update-response.dto';
import { UserDeleteResponseDto } from './dto/user-delete-response.dto';
import { PaginatedResponseDto } from '@/common/dto/paginated-response.dto';
import { CreateUserResponseDto } from './dto/user-create-response.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async createUser(
    createUserDto: CreateUserDto | AdminCreateUserDto,
  ): Promise<CreateUserResponseDto> {
    const { name, nickname, email, password } = createUserDto;

    const userRole =
      'role' in createUserDto ? createUserDto.role : UserRole.USER;

    const checkExist = await this.isUserExists(email);
    if (checkExist) {
      throw new ConflictException(`This email ${email} is already existed!`);
    }
    const nicknameExist = await this.isNicknameAvailable(nickname);
    if (nicknameExist) {
      throw new ConflictException(
        `This nickname ${nickname} is already existed!`,
      );
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = this.usersRepository.create({
      name: name,
      nickname: nickname,
      email: email,
      passwordHash: hashedPassword,
      role: userRole,
    });
    await this.usersRepository.save(user);
    return {
      email: user.email,
      message: 'Successfully created account',
    };
  }

  async getUserById(id: number): Promise<User> {
    return this.usersRepository.findOne({
      where: {
        id: id,
      },
      withDeleted: true,
    });
  }

  // only for authenticating
  async getUserByEmail(email: string): Promise<User> {
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

  async isUserExists(email: string): Promise<boolean> {
    return this.usersRepository
      .findOne({
        where: { email: email },
        withDeleted: true,
      })
      .then((user) => {
        if (user) {
          return true;
        } else {
          return false;
        }
      });
  }

  async isNicknameAvailable(nickname: string): Promise<boolean> {
    return this.usersRepository
      .findOne({
        where: { nickname: nickname },
        withDeleted: true,
      })
      .then((user) => {
        if (user) {
          return true;
        } else {
          return false;
        }
      });
  }

  async updateUserNickname(
    userId: number,
    updateDto: UpdateUserNicknameRequest,
  ): Promise<{ message: string }> {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new NotFoundException('This user could not be found.');
    }

    const nicknameExist = await this.isNicknameAvailable(updateDto.nickname);

    if (nicknameExist) {
      throw new ConflictException(
        `This nickname ${updateDto.nickname} is already existed!`,
      );
    }

    user.nickname = updateDto.nickname;
    await this.usersRepository.save(user);
    return { message: 'Nickname change successful.' };
  }

  async updateUserPassword(
    userId: number,
    updateDto: UpdateUserPasswordRequest,
  ): Promise<{ message: string }> {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new NotFoundException('This user could not be found.');
    }
    const hashedPassword = await bcrypt.hash(updateDto.password, 10);
    user.passwordHash = hashedPassword;
    await this.usersRepository.save(user);
    return {
      message: 'Passcode change successful.',
    };
  }

  async softDeleteUser(userId: number): Promise<UserDeleteResponseDto> {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new NotFoundException('This user could not be found.');
    }
    const result = await this.usersRepository.softDelete(userId);
    if (result.affected !== 1) {
      throw new InternalServerErrorException('Internal Server Error');
    }
    return {
      message: 'Successfully deleted account',
      success: true,
    };
  }

  async updateUser(
    id: number,
    dto: AdminUpdateUserDto,
  ): Promise<AdminUserUpdateResponseDto> {
    const user = await this.usersRepository.findOneBy({ id });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    if (user.deletedAt) {
      throw new NotFoundException('User is deleted');
    }

    if ('role' in dto && dto.role) {
      user.role = dto.role;
    }

    // 일반 사용자 필드 업데이트
    if (dto.name) user.name = dto.name;
    if (dto.nickname) {
      const nicknameExist = await this.isNicknameAvailable(dto.nickname);
      if (nicknameExist) {
        throw new ConflictException(
          `This nickname ${dto.nickname} is already existed!`,
        );
      }
      user.nickname = dto.nickname;
    }
    await this.usersRepository.save(user);

    return {
      message: 'Successfully updated user',
      success: true,
    };
  }

  async findAllWithPagination(
    page: number = 1,
    limit: number = 10,
    sort: 'createdAt' | 'updatedAt' = 'createdAt',
    order: 'ASC' | 'DESC' = 'DESC',
  ): Promise<PaginatedResponseDto<AdminUserDetailResponseDto>> {
    const skip = (page - 1) * limit;

    const [users, totalItems] = await this.usersRepository.findAndCount({
      where: {},
      withDeleted: true,
      skip,
      take: limit,
      order: { [sort]: order },
    });

    const data = users.map((user) =>
      plainToInstance(AdminUserDetailResponseDto, user, {
        excludeExtraneousValues: true,
      }),
    );

    const totalPages = Math.ceil(totalItems / limit);

    return {
      data,
      currentPage: page,
      totalItems,
      totalPages,
    };
  }

  async getAdminUserById(id: number): Promise<AdminUserDetailResponseDto> {
    const user = await this.usersRepository.findOne({
      where: { id },
      withDeleted: true,
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return plainToInstance(AdminUserDetailResponseDto, user, {
      excludeExtraneousValues: true,
    });
  }

  async findUsersWithSearch(
    page: number,
    limit: number,
    filters: { email?: string; nickname?: string; role?: UserRole },
    sort: 'createdAt' | 'updatedAt' = 'createdAt',
    order: 'ASC' | 'DESC' = 'DESC',
  ): Promise<PaginatedResponseDto<AdminUserDetailResponseDto>> {
    const skip = (page - 1) * limit;
    const queryBuilder = this.usersRepository
      .createQueryBuilder('user')
      .withDeleted();

    // 검색 조건 적용
    if (filters.email) {
      queryBuilder.andWhere('user.email ILIKE :email', {
        email: `%${filters.email}%`,
      });
    }
    if (filters.nickname) {
      queryBuilder.andWhere('user.nickname ILIKE :nickname', {
        nickname: `%${filters.nickname}%`,
      });
    }
    if (filters.role) {
      queryBuilder.andWhere('user.role = :role', { role: filters.role });
    }

    // 정렬 적용
    queryBuilder.orderBy(`user.${sort}`, order);

    // 페이지네이션 적용
    queryBuilder.skip(skip).take(limit);

    const [users, totalItems] = await queryBuilder.getManyAndCount();
    return {
      data: users.map((user) =>
        plainToInstance(AdminUserDetailResponseDto, user, {
          excludeExtraneousValues: true,
        }),
      ),
      currentPage: page,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
    };
  }
}
