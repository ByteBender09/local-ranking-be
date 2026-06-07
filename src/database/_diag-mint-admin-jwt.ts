import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as jwt from 'jsonwebtoken';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from './data-source';
import { User } from './entities';

async function main() {
  dotenv.config();
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET missing');
  const ds = new DataSource({ ...dataSourceOptions, synchronize: false });
  await ds.initialize();
  try {
    const admin = await ds
      .getRepository(User)
      .findOne({ where: { role: 'admin' }, order: { createdAt: 'ASC' } });
    if (!admin) throw new Error('no admin user found');
    const token = jwt.sign(
      { sub: admin.id, handle: admin.handle, role: admin.role },
      secret,
      { expiresIn: '30d' },
    );
    console.log(token);
  } finally {
    await ds.destroy();
  }
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
