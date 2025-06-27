import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@/users/entities/user-role.enum';
import { Roles } from '@/auth/roles.decorator';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { RolesGuard } from '@/auth/roles.guard';

import { UsersService } from '@/users/users.service';
import { AdminCreateUserDto } from '@/users/dto/admin/admin-create-user-dto';
import { AdminUpdateUserDto } from '@/users/dto/admin/admin-update-user-dto';
import { AdminUserDetailResponseDto } from '@/users/dto/admin/admin-user-detail-response.dto';
import { CreateUserResponseDto } from '@/users/dto/user-create-response.dto';
import { AdminUserUpdateResponseDto } from '@/users/dto/admin/admin-user-update-response.dto';
import { UserDeleteResponseDto } from '@/users/dto/user-delete-response.dto';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { PaginatedResponseDto } from '@/common/dto/paginated-response.dto';
import { SearchUserDto } from './dto/search-user.dto';

@ApiTags('admin-users')
@Controller('admin/users')
@Roles(UserRole.ADMIN)
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminUserController {
  constructor(private readonly userService: UsersService) {}

  @Post()
  @ApiOperation({
    summary: '관리자 전용 사용자 생성',
    description: '관리자 권한으로 새로운 사용자를 생성합니다.',
  })
  @ApiOkResponse({
    type: CreateUserResponseDto,
    description: '사용자가 성공적으로 생성되었습니다.',
  })
  @ApiConflictResponse({
    description: '이메일 또는 닉네임이 이미 존재합니다.',
  })
  @ApiBody({ type: AdminCreateUserDto })
  async createUser(
    @Body() dto: AdminCreateUserDto,
  ): Promise<CreateUserResponseDto> {
    return this.userService.createUser(dto);
  }

  @Get()
  @ApiOperation({
    summary: '전체 사용자 목록 조회 (페이지화 및 정렬)',
    description:
      '페이지 단위로 사용자 목록을 조회하며, createdAt 기준 정렬 가능',
  })
  @ApiOkResponse({
    type: PaginatedResponseDto<AdminUserDetailResponseDto>,
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiQuery({
    name: 'sort',
    required: false,
    enum: ['createdAt', 'updatedAt'],
    example: 'createdAt',
  })
  @ApiQuery({
    name: 'order',
    required: false,
    enum: ['ASC', 'DESC'],
    example: 'DESC',
  })
  async listUsers(
    @Query() paginationDto: PaginationDto,
  ): Promise<PaginatedResponseDto<AdminUserDetailResponseDto>> {
    const {
      page = 1,
      limit = 10,
      sort = 'createdAt',
      order = 'DESC',
    } = paginationDto;

    return this.userService.findAllWithPagination(page, limit, sort, order);
  }

  @Get('search')
  @ApiOperation({
    summary: '검색 가능한 사용자 목록 조회',
    description: '검색 조건에 따라 페이지화된 사용자 목록을 조회합니다.',
  })
  @ApiOkResponse({
    type: PaginatedResponseDto<AdminUserDetailResponseDto>,
    description: '성공적으로 사용자 목록을 페이지 단위로 조회했습니다.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiQuery({ name: 'searchEmail', required: false, type: String })
  @ApiQuery({ name: 'searchNickname', required: false, type: String })
  @ApiQuery({ name: 'searchRole', required: false, enum: UserRole })
  async searchUsers(
    @Query() searchDto: SearchUserDto,
  ): Promise<PaginatedResponseDto<AdminUserDetailResponseDto>> {
    const {
      page = 1,
      limit = 10,
      sort = 'createdAt',
      order = 'DESC',
      searchEmail,
      searchNickname,
      searchRole,
    } = searchDto;
    return this.userService.findUsersWithSearch(
      page,
      limit,
      {
        email: searchEmail,
        nickname: searchNickname,
        role: searchRole,
      },
      sort,
      order,
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: '특정 사용자 상세 정보 조회',
    description: '사용자 ID를 기반으로 상세 정보를 조회합니다.',
  })
  @ApiOkResponse({
    type: AdminUserDetailResponseDto,
    description: '성공적으로 사용자 정보를 조회했습니다.',
  })
  @ApiNotFoundResponse({
    description: '요청한 ID의 사용자를 찾을 수 없습니다.',
  })
  @ApiParam({
    name: 'id',
    type: 'number',
    description: '조회할 사용자의 고유 ID',
  })
  async getUserDetails(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<AdminUserDetailResponseDto> {
    return this.userService.getAdminUserById(+id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: '사용자 정보 업데이트',
    description: '기존 사용자의 정보를 수정합니다.',
  })
  @ApiOkResponse({
    type: AdminUserUpdateResponseDto,
    description: '사용자 정보가 성공적으로 업데이트되었습니다.',
  })
  @ApiNotFoundResponse({
    description: '수정할 사용자를 찾을 수 없습니다.',
  })
  @ApiConflictResponse({
    description: '중복된 닉네임으로 인해 업데이트에 실패했습니다.',
  })
  @ApiParam({
    name: 'id',
    type: 'number',
    description: '업데이트할 사용자의 고유 ID',
  })
  @ApiBody({ type: AdminUpdateUserDto })
  async updateUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminUpdateUserDto,
  ): Promise<AdminUserUpdateResponseDto> {
    // 사용자 정보 업데이트
    return this.userService.updateUser(+id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: '사용자 계정 삭제',
    description: '특정 사용자 계정을 시스템에서 삭제합니다.',
  })
  @ApiOkResponse({
    type: UserDeleteResponseDto,
    description: '사용자 계정이 성공적으로 삭제되었습니다.',
  })
  @ApiNotFoundResponse({
    description: '삭제할 사용자를 찾을 수 없습니다.',
  })
  async deleteUser(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<UserDeleteResponseDto> {
    // 사용자 삭제
    return this.userService.softDeleteUser(+id);
  }
}
