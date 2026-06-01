import * as dotenv from 'dotenv';
dotenv.config();
import axios from 'axios';
import sharp from 'sharp';

// Fire N rapid uploads with NO delay to confirm /admin/uploads is no longer
// rate-limited (i.e. the @SkipThrottle deploy is live). Run: ts-node this file.
const BACKEND = (process.env.BACKEND_PUBLIC_URL ?? '').replace(/\/$/, '');
const JWT = process.env.IMPORT_ADMIN_JWT ?? '';
const IMG = 'https://lh3.googleusercontent.com/p/AF1QipMrDnpJqfoTZYg3oJs_fuaS5u8GJWeGy8Q51Q6n=w1920-h1080-k-no';
const N = parseInt(process.argv[2] ?? '15', 10);

async function main(): Promise<void> {
  const img = await axios.get<ArrayBuffer>(IMG, { responseType: 'arraybuffer' });
  const webp = await sharp(Buffer.from(img.data)).resize({ width: 800 }).webp({ quality: 70 }).toBuffer();
  let ok = 0, throttled = 0, other = 0;
  for (let i = 0; i < N; i++) {
    const fd = new FormData();
    fd.append('file', new Blob([new Uint8Array(webp)], { type: 'image/webp' }), 'b.webp');
    try {
      const r = await axios.post(`${BACKEND}/admin/uploads`, fd, {
        headers: { Authorization: `Bearer ${JWT}` }, maxBodyLength: Infinity, timeout: 20000,
      });
      if (r.status >= 200 && r.status < 300) ok++;
    } catch (e) {
      const s = axios.isAxiosError(e) ? e.response?.status : 0;
      if (s === 429) throttled++; else { other++; console.log('  other err', s); }
    }
  }
  console.log(`Burst ${N} uploads → ok=${ok} 429=${throttled} other=${other}`);
  console.log(throttled === 0 ? '✓ Throttle fix is LIVE (no 429).' : '✗ Still throttled — deploy not live yet.');
}
main();
