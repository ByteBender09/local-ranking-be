import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from './data-source';
import { City, User } from './entities';

dotenv.config();

// Bootstrap fixtures only — *not* mock data:
//   - 12 cities (geographic facts, stable)
//   - Admin/business sample accounts
//
// All venue / tour / review content is created by admins through the
// /admin UI and lives in user-owned database state. No hardcoded venues
// in the codebase anymore.

const CITY_SEED: Array<
  Omit<City, 'id' | 'venues' | 'tours' | 'createdAt' | 'updatedAt'>
> = [
  {
    slug: 'ho-chi-minh',
    name: 'Hồ Chí Minh',
    nameEn: 'Ho Chi Minh City',
    region: 'south',
    coverImage: 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=1600&auto=format&fit=crop&q=80',
    tagline: 'Sài Gòn không ngủ',
    description:
      'Thủ phủ năng động của miền Nam — thiên đường street food, rooftop bar và cà phê thủ công kiểu Sài Gòn.',
    highlights: ['Cà phê sữa đá', 'Rooftop view sông Sài Gòn', 'Street food Bùi Viện', 'Vintage cafe Quận 3'],
    lat: 10.7769,
    lng: 106.7009,
  },
  {
    slug: 'ha-noi',
    name: 'Hà Nội',
    nameEn: 'Hanoi',
    region: 'north',
    coverImage: 'https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=1600&auto=format&fit=crop&q=80',
    tagline: '36 phố phường',
    description:
      'Cổ kính và đậm chất văn hóa Bắc Bộ — phố cổ, hồ Tây, cà phê trứng và quán bia hơi vỉa hè.',
    highlights: ['Phố cổ 36', 'Hồ Tây sunset', 'Cà phê trứng Giảng', 'Bia hơi vỉa hè'],
    lat: 21.0285,
    lng: 105.8542,
  },
  {
    slug: 'da-nang',
    name: 'Đà Nẵng',
    nameEn: 'Da Nang',
    region: 'central',
    coverImage: 'https://images.unsplash.com/photo-1528127269322-539801943592?w=1600&auto=format&fit=crop&q=80',
    tagline: 'Thành phố đáng sống',
    description:
      'Bãi biển dài, cầu Rồng và view Bà Nà Hills — điểm dừng chân hoàn hảo của miền Trung.',
    highlights: ['Bãi biển Mỹ Khê', 'Cầu Vàng', 'Mì Quảng', 'Sunset bar'],
    lat: 16.0544,
    lng: 108.2022,
  },
  {
    slug: 'da-lat',
    name: 'Đà Lạt',
    nameEn: 'Da Lat',
    region: 'central',
    coverImage: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1600&auto=format&fit=crop&q=80',
    tagline: 'Thành phố ngàn hoa',
    description:
      'Sương mờ, đồi thông và homestay cực chill — thiên đường của những tâm hồn check-in.',
    highlights: ['Homestay đồi thông', 'Hồ Tuyền Lâm', 'Cafe view sương', 'Vườn dâu'],
    lat: 11.9404,
    lng: 108.4583,
  },
  {
    slug: 'hoi-an',
    name: 'Hội An',
    nameEn: 'Hoi An',
    region: 'central',
    coverImage: 'https://images.unsplash.com/photo-1528127269322-539801943592?w=1600&auto=format&fit=crop&q=80',
    tagline: 'Phố cổ đèn lồng',
    description:
      'Di sản UNESCO với phố cổ vàng rực đèn lồng và những con thuyền hoa đăng trên sông Hoài.',
    highlights: ['Phố cổ', 'Đèn lồng đêm', 'Cao lầu', 'Cơm gà bà Buội'],
    lat: 15.8801,
    lng: 108.338,
  },
  {
    slug: 'nha-trang',
    name: 'Nha Trang',
    nameEn: 'Nha Trang',
    region: 'central',
    coverImage: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1600&auto=format&fit=crop&q=80',
    tagline: 'Biển xanh nắng vàng',
    description:
      'Biển trong xanh, hải sản tươi và những resort sang chảnh dọc bờ biển miền Trung.',
    highlights: ['Vịnh Nha Trang', 'Hải sản chợ đêm', 'Vinpearl', 'Bãi tắm Trần Phú'],
    lat: 12.2388,
    lng: 109.1967,
  },
  {
    slug: 'phu-quoc',
    name: 'Phú Quốc',
    nameEn: 'Phu Quoc',
    region: 'south',
    coverImage: 'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=1600&auto=format&fit=crop&q=80',
    tagline: 'Đảo ngọc Kiên Giang',
    description:
      'Hòn đảo lớn nhất Việt Nam — bãi Sao trắng tinh, hải sản rẻ và sunset đẹp như tranh.',
    highlights: ['Bãi Sao', 'Cáp treo Hòn Thơm', 'Chợ đêm Dinh Cậu', 'Sunset point'],
    lat: 10.2899,
    lng: 103.984,
  },
  {
    slug: 'hue',
    name: 'Huế',
    nameEn: 'Hue',
    region: 'central',
    coverImage: 'https://images.unsplash.com/photo-1531259683007-016a7b628fc3?w=1600&auto=format&fit=crop&q=80',
    tagline: 'Cố đô mộng mơ',
    description:
      'Đại Nội, sông Hương và bún bò cay nồng — vẻ đẹp trầm mặc của cố đô.',
    highlights: ['Đại Nội', 'Bún bò Huế', 'Sông Hương', 'Cà phê cung đình'],
    lat: 16.4637,
    lng: 107.5909,
  },
  {
    slug: 'sa-pa',
    name: 'Sa Pa',
    nameEn: 'Sapa',
    region: 'north',
    coverImage: 'https://images.unsplash.com/photo-1565967511849-76a60a516170?w=1600&auto=format&fit=crop&q=80',
    tagline: 'Nóc nhà Đông Dương',
    description:
      "Ruộng bậc thang, mây bay và homestay người H'mông giữa núi rừng Tây Bắc.",
    highlights: ['Ruộng bậc thang', 'Fansipan', 'Bản Cát Cát', 'Mây Sa Pa'],
    lat: 22.3364,
    lng: 103.844,
  },
  {
    slug: 'vung-tau',
    name: 'Vũng Tàu',
    nameEn: 'Vung Tau',
    region: 'south',
    coverImage: 'https://images.unsplash.com/photo-1535262971913-a5d3e3d4f8b4?w=1600&auto=format&fit=crop&q=80',
    tagline: 'Cuối tuần biển gần',
    description:
      'Điểm chạy trốn cuối tuần lý tưởng từ Sài Gòn — bánh khọt, biển và view từ tượng Chúa.',
    highlights: ['Tượng Chúa', 'Bãi Sau', 'Bánh khọt', 'Sunset Bãi Trước'],
    lat: 10.3459,
    lng: 107.0843,
  },
  {
    slug: 'ninh-binh',
    name: 'Ninh Bình',
    nameEn: 'Ninh Binh',
    region: 'north',
    coverImage: 'https://images.unsplash.com/photo-1557750255-c76072a7aad1?q=80&w=2070&auto=format&fit=crop&q=80',
    tagline: 'Vịnh Hạ Long trên cạn',
    description:
      'Ninh Bình với quần thể Tràng An, Tam Cốc - Bích Động và cố đô Hoa Lư.',
    highlights: ['Tràng An', 'Tam Cốc - Bích Động', 'Hang Múa', 'Chùa Bái Đính', 'Đầm Vân Long'],
    lat: 20.2506,
    lng: 105.9745,
  },
  {
    slug: 'quang-ninh',
    name: 'Quảng Ninh',
    nameEn: 'Quang Ninh',
    region: 'north',
    coverImage: 'https://images.unsplash.com/photo-1641563634844-bcda72f71221?q=80&w=1926&auto=format&fit=crop&q=80',
    tagline: 'Vùng đất của vàng đen',
    description:
      'Quảng Ninh nổi tiếng với Vịnh Hạ Long, Bãi Cháy và đảo Cô Tô.',
    highlights: ['Vịnh Hạ Long', 'Vịnh Bái Tử Long', 'Đảo Tuần Châu', 'Bãi Cháy', 'Cô Tô'],
    lat: 20.9599,
    lng: 107.0448,
  },
];

async function seedCities(ds: DataSource): Promise<Map<string, City>> {
  const repo = ds.getRepository(City);
  const map = new Map<string, City>();
  for (const c of CITY_SEED) {
    let row = await repo.findOne({ where: { slug: c.slug } });
    if (!row) {
      row = repo.create(c as Partial<City>);
      row = await repo.save(row);
    }
    map.set(c.slug, row);
  }
  return map;
}

async function seedRoleAccounts(ds: DataSource): Promise<void> {
  const repo = ds.getRepository(User);
  const demos: Array<{
    handle: string;
    name: string;
    role: 'admin' | 'business';
    email?: string;
    bio?: string;
  }> = [
    {
      handle: 'admin',
      name: 'Site Admin',
      role: 'admin',
      bio: 'Quản trị viên hệ thống',
    },
    {
      handle: 'tourbiz',
      name: 'Demo Tour Company',
      role: 'business',
      bio: 'Công ty tour demo',
    },
    {
      handle: 'anhkhoi',
      name: 'Anh Khôi',
      role: 'admin',
      email: 'anhkhoi1192002@gmail.com',
      bio: 'Founder · admin & business · vận hành toàn hệ thống',
    },
  ];
  for (const d of demos) {
    let existing: User | null = null;
    if (d.email) existing = await repo.findOne({ where: { email: d.email } });
    if (!existing)
      existing = await repo.findOne({ where: { handle: d.handle } });

    if (existing) {
      let dirty = false;
      if (existing.role !== d.role) {
        existing.role = d.role;
        dirty = true;
      }
      if (d.email && existing.email !== d.email) {
        existing.email = d.email;
        dirty = true;
      }
      if (dirty) await repo.save(existing);
      continue;
    }

    await repo.save(
      repo.create({
        handle: d.handle,
        name: d.name,
        role: d.role,
        email: d.email ?? null,
        avatar: `https://picsum.photos/seed/avatar-${d.handle}/200/200`,
        bio: d.bio ?? '',
        socials: {},
        bookingEnabled: false,
        checkInCount: 0,
        followerCount: 0,
      }),
    );
  }
}

async function main(): Promise<void> {
  const ds = new DataSource({ ...dataSourceOptions, synchronize: true });
  await ds.initialize();
  console.log('Connected. Seeding bootstrap fixtures...');

  const cities = await seedCities(ds);
  console.log(`✓ Cities: ${cities.size}`);

  await seedRoleAccounts(ds);
  console.log('✓ Role accounts (admin, tourbiz, anhkhoi)');

  console.log(
    '\nDone. Use the admin UI at /admin/cities to add venues — no more hardcoded data.',
  );

  await ds.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
