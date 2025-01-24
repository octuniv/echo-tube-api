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
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
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
  @Patch(':email')
  async updatePassword(
    @Param('email') email: string,
    @Body() updateUserDto: UpdateUserDto,
    @Req() req: any,
  ) {
    if (req.user.email !== email) {
      throw new UnauthorizedException('You can only update your own account');
    }
    return this.usersService.updatePassword(email, updateUserDto).then(() => {
      return {
        message: 'Passcode change successful.',
      };
    });
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':email')
  async removeAccount(@Param('email') email: string, @Req() req: any) {
    return this.usersService.removeAccount(email).then(() => {
      if (req.user.email !== email) {
        throw new UnauthorizedException('You can only delete your own account');
      }
      return {
        message: 'Successfully deleted account',
      };
    });
  }
}
