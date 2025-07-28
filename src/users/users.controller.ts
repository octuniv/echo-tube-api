import {
  Controller,
  Post,
  Body,
  Patch,
  Delete,
  UseGuards,
  Req,
  HttpCode,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserPasswordRequest } from './dto/update-user-password.dto';
import { UpdateUserNicknameRequest } from './dto/update-user-nickname.dto';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CheckEmailRequest } from './dto/check-user-email.dto';
import { CheckNicknameRequest } from './dto/check-user-nickname.dto';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiBody,
  ApiBearerAuth,
  ApiUnauthorizedResponse,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import { CreateUserResponseDto } from './dto/user-create-response.dto';
import { UserDeleteResponseDto } from './dto/user-delete-response.dto';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new user account' })
  @ApiOkResponse({
    schema: {
      example: {
        email: 'user@example.com',
        message: 'Successfully created account',
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiConflictResponse({ description: 'Email or nickname already exists' })
  async createUser(
    @Body() createUserDto: CreateUserDto,
  ): Promise<CreateUserResponseDto> {
    return this.usersService.createUser(createUserDto);
  }

  @Post('check-email')
  @HttpCode(200)
  @ApiOperation({ summary: 'Check email availability' })
  @ApiOkResponse({
    schema: { example: { exists: false } },
    description: 'Email availability status',
  })
  @ApiBody({ type: CheckEmailRequest })
  async checkEmailAvailability(@Body() checkEmail: CheckEmailRequest) {
    const exists = await this.usersService.isUserExists(checkEmail.email);
    return { exists };
  }

  @Post('check-nickname')
  @HttpCode(200)
  @ApiOperation({ summary: 'Check nickname availability' })
  @ApiOkResponse({
    schema: { example: { exists: false } },
    description: 'Nickname availability status',
  })
  @ApiBody({ type: CheckNicknameRequest })
  async checkNicknameAvailability(@Body() checkNickname: CheckNicknameRequest) {
    const exists = await this.usersService.isNicknameAvailable(
      checkNickname.nickname,
    );
    return { exists };
  }

  @UseGuards(JwtAuthGuard)
  @Patch('nickname')
  @ApiOperation({ summary: 'Update user nickname' })
  @ApiBearerAuth()
  @ApiOkResponse({
    schema: { example: { message: 'Nickname change successful.' } },
  })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiConflictResponse({ description: 'Nickname already exists' })
  @ApiBody({ type: UpdateUserNicknameRequest })
  async updateNickname(
    @Body() updateDto: UpdateUserNicknameRequest,
    @Req() req: any,
  ) {
    const userId = Number(req.user.id);
    return this.usersService.updateUserNickname(userId, updateDto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('password')
  @ApiOperation({ summary: 'Update user password' })
  @ApiBearerAuth()
  @ApiOkResponse({
    schema: { example: { message: 'Passcode change successful.' } },
  })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiBody({ type: UpdateUserPasswordRequest })
  async updatePassword(
    @Body() updateDto: UpdateUserPasswordRequest,
    @Req() req: any,
  ) {
    const userId = Number(req.user.id);
    return this.usersService.updateUserPassword(userId, updateDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete()
  @ApiOperation({ summary: 'Soft delete user account' })
  @ApiBearerAuth()
  @ApiOkResponse({
    schema: {
      example: { message: 'Successfully deleted account', success: true },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiInternalServerErrorResponse({ description: 'Deletion failed' })
  async deleteUser(@Req() req: any): Promise<UserDeleteResponseDto> {
    const userId = Number(req.user.id);
    return this.usersService.softDeleteUser(userId);
  }
}
