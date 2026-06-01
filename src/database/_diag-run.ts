import * as dotenv from 'dotenv';
dotenv.config();
import axios from 'axios';

const TOKEN = process.env.APIFY_TOKEN ?? '';
const ACTOR = 'compass~crawler-google-places';

async function main(): Promise<void> {
  console.log('token …' + TOKEN.slice(-4));
  try {
    const res = await axios.post(
      `https://api.apify.com/v2/acts/${ACTOR}/runs?token=${TOKEN}`,
      { searchStringsArray: ['cà phê'], locationQuery: 'Vung Tau, Vietnam', maxCrawledPlacesPerSearch: 1, maxImages: 1, maxReviews: 0 },
      { headers: { 'Content-Type': 'application/json' }, timeout: 30000 },
    );
    const id = res.data?.data?.id;
    console.log('START OK', res.status, 'runId', id);
    if (id) {
      await axios.post(`https://api.apify.com/v2/actor-runs/${id}/abort?token=${TOKEN}`).catch(() => {});
      console.log('aborted to save credit');
    }
  } catch (e) {
    if (axios.isAxiosError(e)) {
      console.log('STATUS', e.response?.status);
      console.log('BODY', JSON.stringify(e.response?.data, null, 2));
    } else console.log('ERR', String(e));
  }
}
main();
