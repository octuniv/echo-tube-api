export const POST_ERROR_MESSAGES = {
  POST_FIND_NOT_FOUND: '게시글을 찾을 수 없습니다.',
  POST_FIND_NOT_FOUND_BY_ID: (id: string) =>
    `ID가 ${id}인 게시글을 찾을 수 없습니다.`,
  POST_CREATE_BOARD_PERMISSION_DENIED: '해당 게시판에 글쓰기 권한이 없습니다',
  POST_UPDATE_BOARD_PERMISSION_DENIED: '해당 게시판에 수정 권한이 없습니다',
  POST_DELETE_BOARD_PERMISSION_DENIED: '해당 게시판에 삭제 권한이 없습니다',
  POST_UPDATE_OWNERSHIP_PERMISSION_DENIED: '본인의 게시글만 수정할 수 있습니다',
  POST_DELETE_OWNERSHIP_PERMISSION_DENIED: '본인의 게시글만 삭제할 수 있습니다',
  POST_DELETE_FAILED: '게시글 삭제에 실패했습니다',
} as const;
