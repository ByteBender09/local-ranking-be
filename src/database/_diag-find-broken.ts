import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from './data-source';
import { Venue } from './entities';

dotenv.config();

async function main() {
  const needle = process.argv[2] ?? 'mq3hg';
  const ds = new DataSource({ ...dataSourceOptions, synchronize: false });
  await ds.initialize();
  try {
    const venues = await ds.getRepository(Venue).find();
    const matches = venues.filter((v) =>
      (v.images ?? []).some((u) => u.includes(needle)),
    );
    for (const v of matches) {
      console.log(`${v.slug} — ${v.name}`);
      v.images.forEach((u, i) => console.log(`  [${i}] ${u}`));
    }
    console.log(`\nFound ${matches.length} venue(s).`);
  } finally {
    await ds.destroy();
  }
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
