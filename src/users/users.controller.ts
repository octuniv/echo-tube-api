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
  async createUser(@Body() createUserDto: CreateUserDto) {
    return this.usersService.createUser(createUserDto).then((res) => {
      return {
        email: res.email,
        message: 'Successfully created account',
      };
    });
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
    return this.usersService.updateUserNickname(userId, updateDto).then(() => {
      return {
        message: 'Nickname change successful.',
      };
    });
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
    return this.usersService.updateUserPassword(userId, updateDto).then(() => {
      return {
        message: 'Passcode change successful.',
      };
    });
  }

  @UseGuards(JwtAuthGuard)
  @Delete()
  @ApiOperation({ summary: 'Soft delete user account' })
  @ApiBearerAuth()
  @ApiOkResponse({
    schema: { example: { message: 'Successfully deleted account' } },
  })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiInternalServerErrorResponse({ description: 'Deletion failed' })
  async deleteUser(@Req() req: any) {
    const userId = Number(req.user.id);
    return this.usersService.softDeleteUser(userId).then(() => {
      return {
        message: 'Successfully deleted account',
      };
    });
  }
}
