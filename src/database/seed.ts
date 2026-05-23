import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { faker } from '@faker-js/faker';
import { dataSourceOptions } from './data-source';
import {
  Category,
  City,
  Review,
  Tour,
  TourProviderInfo,
  User,
  Venue,
} from './entities';

dotenv.config();

const slugify = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const ALL_CATEGORIES: Category[] = [
  'cafe',
  'restaurant',
  'street_food',
  'viewpoint',
  'beach',
  'homestay',
  'bar',
  'museum',
  'park',
  'shopping',
];

const CITY_SEED: Array<Omit<City, 'id' | 'venues' | 'tours' | 'createdAt' | 'updatedAt'>> = [
  { slug: 'ho-chi-minh', name: 'Hồ Chí Minh', nameEn: 'Ho Chi Minh City', region: 'south', coverImage: 'https://picsum.photos/seed/hnd-hcm/1600/900', tagline: 'Sài Gòn không ngủ', description: 'Thủ phủ năng động của miền Nam — thiên đường street food, rooftop bar và cà phê thủ công kiểu Sài Gòn.', highlights: ['Cà phê sữa đá', 'Rooftop view sông Sài Gòn', 'Street food Bùi Viện', 'Vintage cafe Quận 3'], lat: 10.7769, lng: 106.7009 },
  { slug: 'ha-noi', name: 'Hà Nội', nameEn: 'Hanoi', region: 'north', coverImage: 'https://picsum.photos/seed/hnd-hn/1600/900', tagline: '36 phố phường', description: 'Cổ kính và đậm chất văn hóa Bắc Bộ — phố cổ, hồ Tây, cà phê trứng và quán bia hơi vỉa hè.', highlights: ['Phố cổ 36', 'Hồ Tây sunset', 'Cà phê trứng Giảng', 'Bia hơi vỉa hè'], lat: 21.0285, lng: 105.8542 },
  { slug: 'da-nang', name: 'Đà Nẵng', nameEn: 'Da Nang', region: 'central', coverImage: 'https://picsum.photos/seed/hnd-dn/1600/900', tagline: 'Thành phố đáng sống', description: 'Bãi biển dài, cầu Rồng và view Bà Nà Hills — điểm dừng chân hoàn hảo của miền Trung.', highlights: ['Bãi biển Mỹ Khê', 'Cầu Vàng', 'Mì Quảng', 'Sunset bar'], lat: 16.0544, lng: 108.2022 },
  { slug: 'da-lat', name: 'Đà Lạt', nameEn: 'Da Lat', region: 'central', coverImage: 'https://picsum.photos/seed/hnd-dl/1600/900', tagline: 'Thành phố ngàn hoa', description: 'Sương mờ, đồi thông và homestay cực chill — thiên đường của những tâm hồn check-in.', highlights: ['Homestay đồi thông', 'Hồ Tuyền Lâm', 'Cafe view sương', 'Vườn dâu'], lat: 11.9404, lng: 108.4583 },
  { slug: 'hoi-an', name: 'Hội An', nameEn: 'Hoi An', region: 'central', coverImage: 'https://picsum.photos/seed/hnd-ha/1600/900', tagline: 'Phố cổ đèn lồng', description: 'Di sản UNESCO với phố cổ vàng rực đèn lồng và những con thuyền hoa đăng trên sông Hoài.', highlights: ['Phố cổ', 'Đèn lồng đêm', 'Cao lầu', 'Cơm gà bà Buội'], lat: 15.8801, lng: 108.338 },
  { slug: 'nha-trang', name: 'Nha Trang', nameEn: 'Nha Trang', region: 'central', coverImage: 'https://picsum.photos/seed/hnd-nt/1600/900', tagline: 'Biển xanh nắng vàng', description: 'Biển trong xanh, hải sản tươi và những resort sang chảnh dọc bờ biển miền Trung.', highlights: ['Vịnh Nha Trang', 'Hải sản chợ đêm', 'Vinpearl', 'Bãi tắm Trần Phú'], lat: 12.2388, lng: 109.1967 },
  { slug: 'phu-quoc', name: 'Phú Quốc', nameEn: 'Phu Quoc', region: 'south', coverImage: 'https://picsum.photos/seed/hnd-pq/1600/900', tagline: 'Đảo ngọc Kiên Giang', description: 'Hòn đảo lớn nhất Việt Nam — bãi Sao trắng tinh, hải sản rẻ và sunset đẹp như tranh.', highlights: ['Bãi Sao', 'Cáp treo Hòn Thơm', 'Chợ đêm Dinh Cậu', 'Sunset point'], lat: 10.2899, lng: 103.984 },
  { slug: 'hue', name: 'Huế', nameEn: 'Hue', region: 'central', coverImage: 'https://picsum.photos/seed/hnd-hue/1600/900', tagline: 'Cố đô mộng mơ', description: 'Đại Nội, sông Hương và bún bò cay nồng — vẻ đẹp trầm mặc của cố đô.', highlights: ['Đại Nội', 'Bún bò Huế', 'Sông Hương', 'Cà phê cung đình'], lat: 16.4637, lng: 107.5909 },
  { slug: 'sa-pa', name: 'Sa Pa', nameEn: 'Sapa', region: 'north', coverImage: 'https://picsum.photos/seed/hnd-sapa/1600/900', tagline: 'Nóc nhà Đông Dương', description: "Ruộng bậc thang, mây bay và homestay người H'mông giữa núi rừng Tây Bắc.", highlights: ['Ruộng bậc thang', 'Fansipan', 'Bản Cát Cát', 'Mây Sa Pa'], lat: 22.3364, lng: 103.844 },
  { slug: 'vung-tau', name: 'Vũng Tàu', nameEn: 'Vung Tau', region: 'south', coverImage: 'https://picsum.photos/seed/hnd-vt/1600/900', tagline: 'Cuối tuần biển gần', description: 'Điểm chạy trốn cuối tuần lý tưởng từ Sài Gòn — bánh khọt, biển và view từ tượng Chúa.', highlights: ['Tượng Chúa', 'Bãi Sau', 'Bánh khọt', 'Sunset Bãi Trước'], lat: 10.3459, lng: 107.0843 },
  { slug: 'ca-mau', name: 'Cà Mau', nameEn: 'Ca Mau', region: 'south', coverImage: 'https://picsum.photos/seed/hnd-cm/1600/900', tagline: 'Mũi đất tận cùng', description: 'Vùng đất cuối cùng của Tổ Quốc — rừng đước, sông nước miệt vườn và đặc sản cua biển.', highlights: ['Mũi Cà Mau', 'Rừng U Minh', 'Cua Cà Mau', 'Chợ nổi'], lat: 9.1769, lng: 105.1524 },
  { slug: 'hai-phong', name: 'Hải Phòng', nameEn: 'Hai Phong', region: 'north', coverImage: 'https://picsum.photos/seed/hnd-hp/1600/900', tagline: 'Hoa phượng đỏ', description: 'Thành phố cảng nổi tiếng với bánh đa cua, nem cua bể và những con phố hoa phượng.', highlights: ['Bánh đa cua', 'Phố Cát Dài', 'Đảo Cát Bà', 'Nem cua bể'], lat: 20.8449, lng: 106.6881 },
];

const DISTRICTS: Record<string, string[]> = {
  'ho-chi-minh': ['Quận 1', 'Quận 3', 'Quận 5', 'Bình Thạnh', 'Phú Nhuận', 'Quận 2', 'Quận 7'],
  'ha-noi': ['Hoàn Kiếm', 'Ba Đình', 'Tây Hồ', 'Đống Đa', 'Cầu Giấy', 'Hai Bà Trưng'],
  'da-nang': ['Hải Châu', 'Sơn Trà', 'Ngũ Hành Sơn', 'Liên Chiểu', 'Thanh Khê'],
  'da-lat': ['Phường 1', 'Phường 2', 'Phường 8', 'Tà Nung', 'Xuân Hương'],
  'hoi-an': ['Phố Cổ', 'Cẩm Phô', 'Minh An', 'An Hội'],
  'nha-trang': ['Lộc Thọ', 'Vĩnh Hải', 'Vĩnh Nguyên', 'Phước Tân'],
  'phu-quoc': ['Dương Đông', 'An Thới', 'Hàm Ninh', 'Cửa Cạn'],
  hue: ['Phú Hội', 'Vĩnh Ninh', 'Phú Cát', 'Thuận Thành'],
  'sa-pa': ['Trung tâm', 'Cát Cát', 'Tả Van', 'Lao Chải'],
  'vung-tau': ['Phường 1', 'Phường 2', 'Phường 8', 'Phường Thắng Tam'],
  'ca-mau': ['Phường 5', 'Phường 7', 'Tân Xuyên'],
  'hai-phong': ['Hồng Bàng', 'Lê Chân', 'Ngô Quyền', 'Đồ Sơn'],
};

const STREETS = [
  'Nguyễn Huệ', 'Lê Lợi', 'Hai Bà Trưng', 'Trần Hưng Đạo', 'Lý Tự Trọng',
  'Đồng Khởi', 'Pasteur', 'Nam Kỳ Khởi Nghĩa', 'Phan Đăng Lưu', 'Võ Văn Tần',
];

const NAME_TEMPLATES: Record<Category, { prefix: string[]; mid: string[]; suffix: string[]; tags: string[] }> = {
  cafe: { prefix: ['Cộng', 'The', 'Cà phê', 'Coffee', 'Bean', 'Nhà'], mid: ['Garden', 'Phố', 'Vintage', 'Sky', 'Đường Tàu', 'Sương', 'Mây', 'Local'], suffix: ['Cafe', 'Coffee', 'House', 'Studio', 'Lab'], tags: ['chill', 'wifi tốt', 'view đẹp', 'decor vintage', 'menu đặc biệt'] },
  restaurant: { prefix: ['Nhà hàng', 'Bistro', 'Quán', 'Bếp'], mid: ['Bà Nội', 'Hồng', 'Sài Gòn', 'Hà Nội', 'Mama', 'Cô Ba'], suffix: ['Quán', 'Garden', 'Kitchen', 'Restaurant'], tags: ['family-friendly', 'đặc sản', 'menu phong phú', 'phục vụ nhanh'] },
  street_food: { prefix: ['Bún', 'Phở', 'Bánh', 'Cơm', 'Hủ tiếu'], mid: ['Cô Năm', 'Bà Tư', 'Anh Tuấn', 'Dì Hai'], suffix: ['vỉa hè', 'ngõ chợ', 'phố cũ'], tags: ['đông khách', 'giá rẻ', 'truyền thống', 'ăn xế'] },
  viewpoint: { prefix: ['Đỉnh', 'Đồi', 'Núi', 'Đèo'], mid: ['Mây', 'Trắng', 'Vàng', 'Hoa', 'Gió'], suffix: ['View', 'Point', 'Lookout'], tags: ['sunrise', 'sunset', 'trekking', 'ảnh đẹp'] },
  beach: { prefix: ['Bãi', 'Bờ'], mid: ['Sao', 'Trăng', 'Dài', 'Đá', 'Xanh', 'Ngọc'], suffix: ['Beach', 'Bay'], tags: ['tắm biển', 'hải sản', 'lặn ngắm san hô', 'thuê dù'] },
  homestay: { prefix: ['Homestay', 'Villa', 'Garden'], mid: ['Đồi Thông', 'Hoa Hồng', 'Mây Trắng', 'Bình Yên'], suffix: ['House', 'Stay', 'Home'], tags: ['sống ảo', 'view xịn', 'bếp riêng', 'BBQ'] },
  bar: { prefix: ['The', 'Bar', 'Rooftop'], mid: ['Hidden', 'Sunset', 'Sky', 'Neon', 'Underground'], suffix: ['Bar', 'Lounge', 'Club', 'Speakeasy'], tags: ['cocktail', 'live music', 'rooftop', 'city view'] },
  museum: { prefix: ['Bảo tàng', 'Phòng tranh'], mid: ['Mỹ thuật', 'Lịch sử', 'Văn hóa', 'Đương đại'], suffix: ['', 'TP', 'Việt Nam'], tags: ['văn hóa', 'kiến trúc', 'triển lãm', 'phù hợp gia đình'] },
  park: { prefix: ['Công viên', 'Vườn'], mid: ['Hoa', 'Xanh', 'Tao Đàn', 'Lê Văn Tám', 'Thống Nhất'], suffix: ['', 'Park'], tags: ['chạy bộ', 'picnic', 'trẻ em', 'miễn phí'] },
  shopping: { prefix: ['Chợ', 'Mall', 'Center'], mid: ['Bến Thành', 'Đêm', 'An Đông', 'Nhỏ'], suffix: ['', 'Plaza', 'Market'], tags: ['mua sắm', 'ăn vặt', 'quà lưu niệm'] },
};

const HOURS_OPTIONS = ['07:00 - 22:00', '08:00 - 23:00', '06:30 - 21:30', '10:00 - 24:00'];
const VENUES_PER_CITY = 24;
const VI_FIRST = ['Minh', 'An', 'Linh', 'Trang', 'Hà', 'Quang', 'Tú', 'Bảo', 'Hân', 'Phương', 'Khánh', 'Nhi', 'Vy', 'Long', 'Thảo'];
const VI_LAST = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Vũ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương'];
const BIO_TEMPLATES = [
  'Travel content creator · sống ảo chuyên nghiệp',
  'Food blogger · review quán ngon giá hời',
  'Backpacker đam mê khám phá ngõ ngách Việt Nam',
  'Local guide · sẵn sàng dẫn bạn đi ăn',
  'Coffee addict · săn quán mới mỗi tuần',
  'Photographer · chụp ảnh giúp bạn sống ảo',
  'Đi mọi nơi · viết về mọi điều',
];
const REVIEW_BODIES = [
  'Không gian quá xịn, chụp ảnh góc nào cũng đẹp! Sẽ quay lại lần nữa.',
  'Menu đa dạng, giá hợp lý, nhân viên dễ thương. Recommend cho bạn nào hay đi cà phê.',
  'Vibe siêu chill, view đẹp nhất quận. Đến vào buổi chiều là sống ảo cực phẩm.',
  'Đồ ăn ngon, phục vụ nhanh, không gian thoáng. 10/10 cho lần đầu trải nghiệm.',
  'Vị trí dễ tìm, parking thoải mái. Buổi tối có live music, hợp đi nhóm bạn.',
];
const TOUR_PROVIDERS: TourProviderInfo[] = [
  { name: 'Vietravel', shortName: 'VTV', verified: true },
  { name: 'Saigontourist', shortName: 'SGT', verified: true },
  { name: 'BestPrice Travel', shortName: 'BP', verified: true },
  { name: 'TST Tourist', shortName: 'TST', verified: true },
  { name: 'Klook Vietnam', shortName: 'KL', verified: true },
  { name: 'Traveloka Xperience', shortName: 'TVX', verified: true },
  { name: 'Local Insider VN', shortName: 'LIN', verified: false },
  { name: 'Wanderlust Co.', shortName: 'WLC', verified: false },
];
const TOUR_TEMPLATES: Partial<Record<Category, string[]>> = {
  viewpoint: ['Săn mây bình minh trên đỉnh {place}', 'Trekking ngắm hoàng hôn {place}', 'City tour view panorama {place}'],
  beach: ['Lặn ngắm san hô tại {place}', 'Tour 4 đảo siêu hời quanh {place}', 'Bãi biển hoang sơ — full day {place}'],
  museum: ['Walking tour văn hoá {place}', 'Đêm bảo tàng & ẩm thực {place}'],
  park: ['Picnic chill cuối tuần {place}', 'Photo tour mùa hoa {place}'],
};
const TOURIST_CATEGORIES: Category[] = ['viewpoint', 'beach', 'museum', 'park'];

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildVenueName(category: Category): string {
  const t = NAME_TEMPLATES[category];
  return `${pick(t.prefix)} ${pick(t.mid)} ${pick(t.suffix)}`.trim().replace(/\s+/g, ' ');
}

function categoryLabel(c: Category): string {
  return {
    cafe: 'quán cà phê', restaurant: 'nhà hàng', street_food: 'quán ăn đường phố',
    viewpoint: 'điểm ngắm cảnh', beach: 'bãi biển', homestay: 'homestay',
    bar: 'rooftop bar', museum: 'bảo tàng', park: 'công viên', shopping: 'trung tâm mua sắm',
  }[c];
}

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

async function seedVenues(ds: DataSource, cities: Map<string, City>): Promise<Map<string, Venue>> {
  faker.seed(2026);
  const repo = ds.getRepository(Venue);
  const map = new Map<string, Venue>();

  for (const [slug, city] of cities) {
    for (let i = 0; i < VENUES_PER_CITY; i++) {
      const category = ALL_CATEGORIES[i % ALL_CATEGORIES.length];
      const name = buildVenueName(category);
      const district = pick(DISTRICTS[slug] ?? ['Trung tâm']);
      const venueSlug = `${slugify(name)}-${slug}-${i}`;

      const existing = await repo.findOne({ where: { slug: venueSlug } });
      if (existing) {
        map.set(venueSlug, existing);
        continue;
      }

      const imageCount = faker.number.int({ min: 3, max: 5 });
      const images = Array.from({ length: imageCount }).map(
        (_, k) => `https://picsum.photos/seed/${venueSlug}-${k}/1200/800`,
      );

      const venue = repo.create({
        slug: venueSlug,
        name,
        category,
        cityId: city.id,
        district,
        address: `${faker.number.int({ min: 1, max: 250 })} ${pick(STREETS)}, ${district}`,
        description: `${name} là một ${categoryLabel(category)} nổi tiếng tại ${district}. Không gian thoáng đãng, phục vụ tận tâm, được giới trẻ yêu thích để sống ảo và lưu giữ những khoảnh khắc đáng nhớ.`,
        images,
        rating: faker.number.float({ min: 3.6, max: 4.95, fractionDigits: 1 }),
        reviewCount: 0,
        upvotes: faker.number.int({ min: 24, max: 3200 }),
        priceRange: pick([1, 2, 2, 3, 3, 4]),
        tags: faker.helpers.arrayElements(NAME_TEMPLATES[category].tags, { min: 2, max: 4 }),
        hours: pick(HOURS_OPTIONS),
        lat: (city.lat ?? 14.0583) + faker.number.float({ min: -0.03, max: 0.03, fractionDigits: 6 }),
        lng: (city.lng ?? 108.2772) + faker.number.float({ min: -0.03, max: 0.03, fractionDigits: 6 }),
      });
      const saved = await repo.save(venue);
      map.set(venueSlug, saved);
    }
  }
  return map;
}

async function seedUsers(ds: DataSource, cities: Map<string, City>): Promise<User[]> {
  faker.seed(99);
  const repo = ds.getRepository(User);
  const usedHandles = new Set<string>();
  const out: User[] = [];

  const existing = await repo.find();
  for (const u of existing) usedHandles.add(u.handle);
  if (existing.length >= 60) return existing.slice(0, 60);

  const target = 60 - existing.length;
  for (let i = 0; i < target; i++) {
    const first = faker.helpers.arrayElement(VI_FIRST);
    const last = faker.helpers.arrayElement(VI_LAST);
    const baseHandle = `${first}${last}`
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, '');
    let handle = baseHandle;
    let n = 1;
    while (usedHandles.has(handle)) { n += 1; handle = `${baseHandle}${n}`; }
    usedHandles.add(handle);

    const bookingEnabled = Math.random() > 0.45;
    const citySlug = faker.helpers.arrayElement([...cities.keys()]);

    const created = repo.create({
      handle,
      name: `${last} ${first}`,
      avatar: `https://picsum.photos/seed/avatar-${handle}/200/200`,
      bio: faker.helpers.arrayElement(BIO_TEMPLATES),
      citySlug,
      checkInCount: faker.number.int({ min: 8, max: 420 }),
      followerCount: faker.number.int({ min: 50, max: 84_000 }),
      bookingEnabled,
      bookingPriceVnd: bookingEnabled
        ? faker.helpers.arrayElement([300_000, 500_000, 800_000, 1_200_000, 2_000_000])
        : null,
      socials: {
        instagram: Math.random() > 0.3 ? handle : undefined,
        tiktok: Math.random() > 0.4 ? handle : undefined,
      },
    });
    out.push(await repo.save(created));
  }
  return [...existing, ...out];
}

async function seedReviews(ds: DataSource, venues: Venue[], users: User[]): Promise<void> {
  faker.seed(777);
  const repo = ds.getRepository(Review);
  const venueRepo = ds.getRepository(Venue);

  for (const venue of venues) {
    const existing = await repo.count({ where: { venueId: venue.id } });
    if (existing > 0) continue;

    const count = faker.number.int({ min: 2, max: 6 });
    const picked = faker.helpers.arrayElements(users, { min: count, max: count });
    const rows = picked.map((u) =>
      repo.create({
        venueId: venue.id,
        userId: u.id,
        rating: faker.number.float({ min: 3.5, max: 5, fractionDigits: 1 }),
        body: faker.helpers.arrayElement(REVIEW_BODIES),
      }),
    );
    await repo.save(rows);

    const { avg } = (await repo
      .createQueryBuilder('r')
      .select('AVG(r.rating)', 'avg')
      .where('r.venue_id = :id', { id: venue.id })
      .getRawOne<{ avg: string }>()) ?? { avg: '0' };
    await venueRepo.update({ id: venue.id }, {
      rating: Math.round(parseFloat(avg) * 100) / 100,
      reviewCount: rows.length,
    });
  }
}

async function seedTours(ds: DataSource, cities: Map<string, City>): Promise<void> {
  faker.seed(555);
  const repo = ds.getRepository(Tour);

  for (const [slug, city] of cities) {
    for (let ci = 0; ci < TOURIST_CATEGORIES.length; ci++) {
      const category = TOURIST_CATEGORIES[ci];
      const templates = TOUR_TEMPLATES[category] ?? ['Khám phá {place}'];
      for (let i = 0; i < 2; i++) {
        const template = faker.helpers.arrayElement(templates);
        const title = template.replace('{place}', city.name);
        const tourSlug = `${slugify(title)}-${slug}-${ci * 2 + i}`;
        if (await repo.exists({ where: { slug: tourSlug } })) continue;

        await repo.save(
          repo.create({
            slug: tourSlug,
            title,
            cityId: city.id,
            category,
            durationHours: faker.helpers.arrayElement([3, 4, 6, 8, 10, 12]),
            priceVnd: faker.helpers.arrayElement([290_000, 450_000, 590_000, 790_000, 990_000, 1_290_000, 1_790_000]),
            image: `https://picsum.photos/seed/tour-${tourSlug}/800/600`,
            rating: faker.number.float({ min: 4.2, max: 4.95, fractionDigits: 1 }),
            reviewCount: faker.number.int({ min: 24, max: 540 }),
            highlights: faker.helpers.arrayElements(
              ['Hướng dẫn viên bản địa', 'Đón tận khách sạn', 'Bữa trưa hải sản', 'Vé tham quan đã gồm', 'Nhóm tối đa 8 người', 'Photographer đi cùng', 'Bảo hiểm du lịch', 'Đồ uống miễn phí'],
              { min: 3, max: 4 },
            ),
            provider: faker.helpers.arrayElement(TOUR_PROVIDERS),
          }),
        );
      }
    }
  }
}

async function main(): Promise<void> {
  const ds = new DataSource({ ...dataSourceOptions, synchronize: true });
  await ds.initialize();
  console.log('Connected. Seeding...');

  const cities = await seedCities(ds);
  console.log(`✓ Cities: ${cities.size}`);

  const venuesMap = await seedVenues(ds, cities);
  console.log(`✓ Venues: ${venuesMap.size}`);

  const users = await seedUsers(ds, cities);
  console.log(`✓ Users: ${users.length}`);

  await seedReviews(ds, [...venuesMap.values()], users);
  console.log('✓ Reviews seeded');

  await seedTours(ds, cities);
  console.log('✓ Tours seeded');

  await ds.destroy();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
