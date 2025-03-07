import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserPasswordRequest } from './dto/update-user-password.dto';
import { UpdateUserNicknameRequest } from './dto/update-user-nickName.dto';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  async signUpUser(@Body() createUserDto: CreateUserDto) {
    return this.usersService.signUpUser(createUserDto).then((res) => {
      return {
        email: res.email,
        message: 'Successfully created account',
      };
    });
  }

  @Get(':email')
  async findExistUser(@Param('email') email: string) {
    return this.usersService.findExistUser(email);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('nickname')
  async updateNickname(
    @Body() UpdateUserNicknameRequest: UpdateUserNicknameRequest,
    @Req() req: any,
  ) {
    const userId = Number(req.user.id);
    return this.usersService
      .updateNickname(userId, UpdateUserNicknameRequest)
      .then(() => {
        return {
          message: 'Nickname change successful.',
        };
      });
  }

  @UseGuards(JwtAuthGuard)
  @Patch('password')
  async updatePassword(
    @Body() UpdateUserPasswordRequest: UpdateUserPasswordRequest,
    @Req() req: any,
  ) {
    const userId = Number(req.user.id);
    return this.usersService
      .updatePassword(userId, UpdateUserPasswordRequest)
      .then(() => {
        return {
          message: 'Passcode change successful.',
        };
      });
  }

  @UseGuards(JwtAuthGuard)
  @Delete()
  async deleteAccount(@Req() req: any) {
    const userId = Number(req.user.id);
    return this.usersService.deleteAccount(userId).then(() => {
      return {
        message: 'Successfully deleted account',
      };
    });
  }
}
