import { DataSource } from 'typeorm';
import { dataSourceOptions } from './data-source';
import { Venue } from './entities';

async function main() {
  const ds = new DataSource({ ...dataSourceOptions, synchronize: false });
  await ds.initialize();
  try {
    const venues = await ds.getRepository(Venue).find({
      select: { id: true, slug: true, name: true, images: true },
    });

    let venuesWithExternal = 0;
    let venuesAllExternal = 0;
    let imageTotal = 0;
    let externalImages = 0;
    const hostCounts = new Map<string, number>();
    const externalRows: Array<{
      slug: string;
      name: string;
      external: number;
      total: number;
    }> = [];

    const isOwn = (host: string): boolean =>
      host.endsWith('homnaydidau.xyz') ||
      host === 'localhost' ||
      host === '127.0.0.1';

    for (const v of venues) {
      const imgs = v.images ?? [];
      if (imgs.length === 0) continue;
      let extCount = 0;
      let allExternal = true;
      for (const url of imgs) {
        imageTotal += 1;
        let host = '';
        try {
          host = new URL(url, 'http://_').hostname;
        } catch {
          host = '(invalid-url)';
        }
        if (host === '_' || isOwn(host)) {
          allExternal = false;
          continue;
        }
        extCount += 1;
        externalImages += 1;
        hostCounts.set(host, (hostCounts.get(host) ?? 0) + 1);
      }
      if (extCount > 0) {
        venuesWithExternal += 1;
        externalRows.push({
          slug: v.slug,
          name: v.name,
          external: extCount,
          total: imgs.length,
        });
      }
      if (allExternal) venuesAllExternal += 1;
    }

    const ranked = [...hostCounts.entries()].sort((a, b) => b[1] - a[1]);

    console.log('');
    console.log('── External-image audit ───────────────────────────────');
    console.log(`Total venues:                ${venues.length}`);
    console.log(`  with ≥1 external image:    ${venuesWithExternal}`);
    console.log(`  with ALL external images:  ${venuesAllExternal}`);
    console.log(`Total image URLs:            ${imageTotal}`);
    console.log(`  external:                  ${externalImages}`);
    console.log(`  own:                       ${imageTotal - externalImages}`);
    console.log('');
    console.log('Top external hosts:');
    for (const [host, count] of ranked.slice(0, 20)) {
      console.log(`  ${count.toString().padStart(5)}  ${host}`);
    }
    console.log('');
    console.log('Affected venues:');
    for (const r of externalRows.sort((a, b) => b.external - a.external)) {
      console.log(
        `  ${r.external}/${r.total} external  ${r.slug.padEnd(60)} ${r.name}`,
      );
    }
    console.log('');
    console.log(`Slugs for --slugs flag:`);
    console.log(externalRows.map((r) => r.slug).join(','));
    console.log('');
  } finally {
    await ds.destroy();
  }
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
