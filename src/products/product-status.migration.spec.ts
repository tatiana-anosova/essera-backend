import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (path: string) =>
  readFileSync(join(__dirname, '..', '..', path), 'utf8');

describe('product status migration', () => {
  const migration = read(
    'prisma/migrations/20260726220000_add_product_status/migration.sql',
  );
  const schema = read('prisma/schema.prisma');

  it('publishes the products that existed before the lifecycle', () => {
    expect(migration).toMatch(
      /UPDATE "public"\."Product" SET "status" = 'ACTIVE';/,
    );
  });

  it('leaves new products as drafts', () => {
    expect(migration).toMatch(
      /ADD COLUMN\s+"status" "public"\."ProductStatus" NOT NULL DEFAULT 'DRAFT'/,
    );
    expect(schema).toMatch(/status\s+ProductStatus @default\(DRAFT\)/);
  });
});
