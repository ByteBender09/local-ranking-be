import * as dotenv from 'dotenv';
dotenv.config();
import axios from 'axios';

// Confirms the Apify token works and dumps 2 sample Google Maps places so we
// can lock exact output field names (rating, imageUrls, location, opening
// hours) before finalising the importer.  Run:  npm run diag:apify
const TOKEN = process.env.APIFY_TOKEN ?? '';
const ACTOR = 'compass~crawler-google-places';
const URL = `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?token=${TOKEN}`;

async function main(): Promise<void> {
  console.log('token:', TOKEN ? `present (len ${TOKEN.length}, …${TOKEN.slice(-4)})` : 'MISSING');
  if (!TOKEN) return;
  try {
    const res = await axios.post(
      URL,
      {
        searchStringsArray: ['cafe'],
        locationQuery: 'Da Lat, Vietnam',
        maxCrawledPlacesPerSearch: 2,
        language: 'vi',
        maxImages: 3,
      },
      { timeout: 180000, headers: { 'Content-Type': 'application/json' } },
    );
    const items = Array.isArray(res.data) ? res.data : [];
    console.log('STATUS', res.status, '| items:', items.length);
    if (items[0]) {
      console.log('\nTOP-LEVEL KEYS:', Object.keys(items[0]).join(', '));
      const p = items[0];
      console.log('\nSAMPLE (trimmed):', JSON.stringify({
        title: p.title,
        categoryName: p.categoryName,
        address: p.address,
        city: p.city,
        neighborhood: p.neighborhood,
        location: p.location,
        totalScore: p.totalScore,
        reviewsCount: p.reviewsCount,
        price: p.price,
        placeId: p.placeId,
        permanentlyClosed: p.permanentlyClosed,
        imageUrls: (p.imageUrls || []).slice(0, 3),
        openingHours: p.openingHours,
      }, null, 2));
    }
  } catch (e) {
    if (axios.isAxiosError(e)) {
      console.log('STATUS', e.response?.status);
      console.log('BODY', JSON.stringify(e.response?.data, null, 2).slice(0, 1200));
    } else {
      console.log('ERR', String(e));
    }
  }
}
main();
