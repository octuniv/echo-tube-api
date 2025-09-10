export const MessageErrors = {
  FORBIDDEN_NOTICE: '공지 메시지는 관리자만 발송할 수 있습니다.',
  MESSAGE_NOT_FOUND: '메시지를 찾을 수 없습니다.',
  RECEIVER_NOT_FOUND: '수신자를 찾을 수 없습니다.',
} as const;

export const MessageResponses = {
  DELETED: '메시지가 삭제되었습니다.',
} as const;
