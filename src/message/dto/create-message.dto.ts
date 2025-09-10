import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsBoolean,
  ValidateIf,
} from 'class-validator';

export class CreateMessageDto {
  @ValidateIf((o) => !o.isNotice)
  @IsNotEmpty({ message: '개인 메시지 전송 시 receiverId는 필수입니다.' })
  receiverId?: number;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsBoolean()
  @IsOptional()
  isNotice?: boolean = false;
}
