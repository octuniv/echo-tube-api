import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsBoolean,
  ValidateIf,
} from 'class-validator';

export class CreateMessageDto {
  @ValidateIf((o) => !o.isNotice)
  @IsNotEmpty({ message: '개인 메시지 전송 시 receiverNickname은 필수입니다.' })
  @IsString({ message: 'receiverNickname은 문자열이어야 합니다.' })
  receiverNickname?: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsBoolean()
  @IsOptional()
  isNotice?: boolean = false;
}
