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

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
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
  async checkEmailAvailability(@Body() checkEmail: CheckEmailRequest) {
    const exists = await this.usersService.isUserExists(checkEmail.email);
    return { exists };
  }

  @Post('check-nickname')
  @HttpCode(200)
  async checkNicknameAvailability(@Body() checkNickname: CheckNicknameRequest) {
    const exists = await this.usersService.isNicknameAvailable(
      checkNickname.nickname,
    );
    return { exists };
  }

  @UseGuards(JwtAuthGuard)
  @Patch('nickname')
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
  async deleteUser(@Req() req: any) {
    const userId = Number(req.user.id);
    return this.usersService.softDeleteUser(userId).then(() => {
      return {
        message: 'Successfully deleted account',
      };
    });
  }
}
