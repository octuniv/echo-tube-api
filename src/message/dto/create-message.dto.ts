import { IsNotEmpty, IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateMessageDto {
  @IsNotEmpty()
  receiverId: number;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsBoolean()
  @IsOptional()
  isNotice?: boolean = false;
}
