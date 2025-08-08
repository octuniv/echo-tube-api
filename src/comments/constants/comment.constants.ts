export const COMMENT_MESSAGES = {
  CREATED: '댓글이 성공적으로 생성되었습니다.',
  UPDATED: '댓글이 성공적으로 수정되었습니다.',
  DELETED: '댓글이 성공적으로 삭제되었습니다.',
  LIKE_TOGGLED: '좋아요 상태가 변경되었습니다.',
} as const;

export const COMMENT_ERRORS = {
  NOT_FOUND: '댓글을 찾을 수 없습니다.',
  POST_NOT_FOUND: '게시물을 찾을 수 없습니다.',
  PARENT_NOT_FOUND: '부모 댓글을 찾을 수 없습니다.',
  MAX_DEPTH_EXCEEDED:
    '대댓글에 대한 답글은 작성할 수 없습니다. (최대 2단계 까지만 허용)',
  NO_PERMISSION: '수정 또는 삭제 권한이 없습니다.',
} as const;
