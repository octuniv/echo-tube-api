import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

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

  // ToDo : Authorization must be applied.
  @Patch(':email')
  async updatePassword(
    @Param('email') email: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.updatePassword(email, updateUserDto).then(() => {
      return {
        message: 'Passcode change successful.',
      };
    });
  }

  // ToDo : Authorization must be applied.
  @Delete(':email')
  async removeAccount(@Param('email') email: string) {
    return this.usersService.removeAccount(email).then(() => {
      return {
        message: 'Successfully deleted account',
      };
    });
  }
}
