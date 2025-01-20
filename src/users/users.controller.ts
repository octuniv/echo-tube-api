import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  NotFoundException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  async signUpUser(@Body() createUserDto: CreateUserDto) {
    return this.usersService.signUpUser(createUserDto);
  }

  @Get(':email')
  async findExistUser(@Param('email') email: string) {
    return this.usersService.findExistUser(email).then((user) => {
      if (!user) {
        throw new NotFoundException(
          `This email ${email} user could not be found`,
        );
      }
      return user;
    });
  }

  // ToDo : Authorization must be applied.
  @Patch(':email')
  async updatePassword(
    @Param('email') email: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.updatePassword(email, updateUserDto);
  }

  // ToDo : Authorization must be applied.
  @Delete(':email')
  async removeAccount(@Param('email') email: string) {
    return this.usersService.removeAccount(email);
  }
}
