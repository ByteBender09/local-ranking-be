import * as dotenv from 'dotenv';
dotenv.config();
import axios from 'axios';
import sharp from 'sharp';

const BACKEND = (process.env.BACKEND_PUBLIC_URL ?? '').replace(/\/$/, '');
const JWT = process.env.IMPORT_ADMIN_JWT ?? '';
const IMG = 'https://lh3.googleusercontent.com/p/AF1QipMrDnpJqfoTZYg3oJs_fuaS5u8GJWeGy8Q51Q6n=w1920-h1080-k-no';

async function main(): Promise<void> {
  console.log('BACKEND_PUBLIC_URL =', BACKEND || '(empty)');
  const img = await axios.get<ArrayBuffer>(IMG, { responseType: 'arraybuffer', timeout: 30000 });
  const webp = await sharp(Buffer.from(img.data)).resize({ width: 1200, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
  console.log('webp bytes:', webp.length);
  const fd = new FormData();
  fd.append('file', new Blob([new Uint8Array(webp)], { type: 'image/webp' }), 'g.webp');
  try {
    const res = await axios.post(`${BACKEND}/admin/uploads`, fd, {
      headers: { Authorization: `Bearer ${JWT}` },
      maxBodyLength: Infinity, timeout: 30000,
    });
    console.log('STATUS', res.status, '| content-type:', res.headers['content-type']);
    console.log('DATA:', typeof res.data === 'string' ? res.data.slice(0, 400) : JSON.stringify(res.data, null, 2));
  } catch (e) {
    if (axios.isAxiosError(e)) {
      console.log('ERR STATUS', e.response?.status, '| ct:', e.response?.headers?.['content-type']);
      console.log('ERR DATA:', typeof e.response?.data === 'string' ? (e.response.data as string).slice(0, 400) : JSON.stringify(e.response?.data, null, 2));
    } else console.log('ERR', String(e));
  }
}
main();
