import { IsString } from 'class-validator';

export class DeletePostResultDto {
  @IsString()
  message: string;
}
