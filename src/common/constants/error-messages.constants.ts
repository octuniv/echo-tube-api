export const CATEGORY_ERROR_MESSAGES = {
  SLUGS_REQUIRED: '최소 1개 이상의 슬러그가 필요합니다',
  DUPLICATE_SLUGS: (slugs: string[]) =>
    `이미 사용 중인 슬러그가 있습니다: ${slugs.join(', ')}`,
  CATEGORY_NOT_FOUND: `카테고리를 찾을 수 없습니다.`,
  DUPLICATE_CATEGORY_NAME: '이미 존재하는 카테고리 이름입니다.',
  NAME_REQUIRED: '이름은 필수입니다',
  INVALID_SLUGS:
    'Each slug must be URL-friendly (lowercase letters, numbers, hyphens)',
};

export const BOARD_ERROR_MESSAGES = {
  INVALID_SLUGS:
    'Slug must be URL-friendly (lowercase letters, numbers, hyphens)',
  NOT_FOUND_BOARD: 'Board not found',
  SLUG_NOT_ALLOWED_IN_CATEGORY: (slug: string) =>
    `Slug "${slug}" is not allowed in this category`,
  AI_DIGEST_REQUIRES_HIGHER_ROLE:
    'AI_DIGEST board requires a role higher than USER',
};
