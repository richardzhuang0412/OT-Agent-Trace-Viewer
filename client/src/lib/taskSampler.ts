export function getRandomTaskPage(totalItems: number, pageSize: number): number {
  if (totalItems <= 0 || pageSize <= 0) {
    return 0;
  }

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  return Math.floor(Math.random() * totalPages);
}
