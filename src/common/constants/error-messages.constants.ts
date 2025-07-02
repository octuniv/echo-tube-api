export const CATEGORY_ERROR_MESSAGES = {
  SLUGS_REQUIRED: '최소 1개 이상의 슬러그가 필요합니다',
  DUPLICATE_SLUG: (slug: string) => `Slug '${slug}'은(는) 이미 사용 중입니다.`,
  DUPLICATE_SLUGS: (slugs: string[]) =>
    `이미 사용 중인 슬러그가 있습니다: ${slugs.join(', ')}`,
  CATEGORY_NOT_FOUND: `카테고리를 찾을 수 없습니다.`,
  DUPLICATE_CATEGORY_NAME: '이미 존재하는 카테고리 이름입니다.',
};
