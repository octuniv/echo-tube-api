// dto/create-message-response.dto.ts
export class CreateNoticeResponseDto {
  noticeId: string;
  content: string;
  recipientCount: number;
  createdAt: Date;

  static create(
    noticeId: string,
    content: string,
    recipientCount: number,
    createdAt: Date,
  ): CreateNoticeResponseDto {
    const dto = new CreateNoticeResponseDto();
    dto.noticeId = noticeId;
    dto.content = content;
    dto.recipientCount = recipientCount;
    dto.createdAt = createdAt;
    return dto;
  }
}
