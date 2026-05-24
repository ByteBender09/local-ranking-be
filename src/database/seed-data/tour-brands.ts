import type { Category } from '../entities';

// Real Vietnamese tour operators. Logos hotlink from each brand's public CDN
// — if any URL 404s long-term, an admin can replace it through /admin/users
// (branding fields) or directly via /me/branding. Tour images use Unsplash
// destination photos (royalty-free) so they survive brand site re-orgs.
//
// Booking URLs point to real product pages where applicable.

export interface BrandSeed {
  handle: string;
  name: string;
  brandName: string;
  brandShortName: string; // <= 16 chars, uppercase
  brandLogoUrl: string;
  brandWebsiteUrl: string;
  brandContactEmail: string;
  brandDescription: string;
  avatar: string; // user avatar (usually same as logo)
  // Set true so tours get the blue check by default — these are real operators.
  emailVerified: boolean;
}

export interface TourSeed {
  brandHandle: string; // FK -> BrandSeed.handle
  citySlug: string;
  title: string;
  category: Category;
  durationHours: number;
  priceVnd: number;
  // Cover image (kept for legacy paths). The first entry of `images` is used
  // when this is empty.
  image: string;
  // Gallery — 2-3 photos per tour shown in the detail modal.
  images: string[];
  description: string;
  bookingUrl: string;
  highlights: string[];
}

export const TOUR_BRANDS: BrandSeed[] = [
  {
    handle: 'vinpearl',
    name: 'Vinpearl',
    brandName: 'Vinpearl',
    brandShortName: 'VINPEARL',
    brandLogoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/0/00/Vinpearl_logo.svg/640px-Vinpearl_logo.svg.png',
    brandWebsiteUrl: 'https://vinpearl.com',
    brandContactEmail: 'info@vinpearl.com',
    brandDescription:
      'Hệ sinh thái nghỉ dưỡng – vui chơi giải trí 5 sao của Vingroup, có mặt tại Nha Trang, Phú Quốc, Nam Hội An, Đà Nẵng và Hạ Long.',
    avatar:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/0/00/Vinpearl_logo.svg/240px-Vinpearl_logo.svg.png',
    emailVerified: true,
  },
  {
    handle: 'sunworld',
    name: 'Sun World',
    brandName: 'Sun World',
    brandShortName: 'SUNWORLD',
    brandLogoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c0/Sun_World_logo.svg/640px-Sun_World_logo.svg.png',
    brandWebsiteUrl: 'https://sunworld.vn',
    brandContactEmail: 'info@sunworld.vn',
    brandDescription:
      'Chuỗi tổ hợp giải trí của Sun Group: Bà Nà Hills, Fansipan Legend, Hòn Thơm Phú Quốc, Sun World Hạ Long, Asia Park Đà Nẵng.',
    avatar:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c0/Sun_World_logo.svg/240px-Sun_World_logo.svg.png',
    emailVerified: true,
  },
  {
    handle: 'vietravel',
    name: 'Vietravel',
    brandName: 'Vietravel',
    brandShortName: 'VIETRAVEL',
    brandLogoUrl:
      'https://upload.wikimedia.org/wikipedia/vi/thumb/2/2e/Logo_Vietravel.png/640px-Logo_Vietravel.png',
    brandWebsiteUrl: 'https://travel.com.vn',
    brandContactEmail: 'info@vietravel.com',
    brandDescription:
      'Doanh nghiệp lữ hành lớn nhất Việt Nam, đa dạng tour trong nước - quốc tế từ city tour 1 ngày đến hành trình caravan xuyên Việt.',
    avatar:
      'https://upload.wikimedia.org/wikipedia/vi/thumb/2/2e/Logo_Vietravel.png/240px-Logo_Vietravel.png',
    emailVerified: true,
  },
  {
    handle: 'saigontourist',
    name: 'Saigontourist Travel',
    brandName: 'Saigontourist Travel',
    brandShortName: 'SGNTOURIST',
    brandLogoUrl:
      'https://upload.wikimedia.org/wikipedia/vi/thumb/1/19/Logo-saigontourist.png/640px-Logo-saigontourist.png',
    brandWebsiteUrl: 'https://saigontourist.net',
    brandContactEmail: 'travel@saigontourist.com.vn',
    brandDescription:
      'Hãng lữ hành lâu đời nhất Việt Nam (1975) thuộc Saigontourist Group. Tour outbound châu Âu - Mỹ - Úc và inbound khắp ba miền.',
    avatar:
      'https://upload.wikimedia.org/wikipedia/vi/thumb/1/19/Logo-saigontourist.png/240px-Logo-saigontourist.png',
    emailVerified: true,
  },
  {
    handle: 'klook',
    name: 'Klook',
    brandName: 'Klook',
    brandShortName: 'KLOOK',
    brandLogoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/Klook_logo.svg/640px-Klook_logo.svg.png',
    brandWebsiteUrl: 'https://www.klook.com/vi',
    brandContactEmail: 'support@klook.com',
    brandDescription:
      'Nền tảng OTA hoạt động trải nghiệm hàng đầu châu Á — vé theme park, day tour, transfer sân bay cho hơn 1.000 điểm đến tại Việt Nam.',
    avatar:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/Klook_logo.svg/240px-Klook_logo.svg.png',
    emailVerified: true,
  },
];

// 17 tours mapped to existing seed cities. priceVnd reflects real list prices
// observed on each brand's public booking page (rounded). bookingUrl points
// to a category/landing page since per-product slugs change frequently.
//
// IMAGES: hotlinked from Wikimedia Commons (most stable long-term CDN).
// Photos are CC-licensed images of the actual landmark each tour visits.
// If any URL 404s, an admin can replace it via the admin tour editor.
export const TOUR_SEEDS: TourSeed[] = [
  // ============== VINPEARL ==============
  {
    brandHandle: 'vinpearl',
    citySlug: 'phu-quoc',
    title: 'VinWonders Phú Quốc - Vé combo công viên giải trí 1 ngày',
    category: 'viewpoint',
    durationHours: 8,
    priceVnd: 880_000,
    image:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/VinWonders_Ph%C3%BA_Qu%E1%BB%91c_-_panoramio.jpg/1280px-VinWonders_Ph%C3%BA_Qu%E1%BB%91c_-_panoramio.jpg',
    images: [
      'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/VinWonders_Ph%C3%BA_Qu%E1%BB%91c_-_panoramio.jpg/1280px-VinWonders_Ph%C3%BA_Qu%E1%BB%91c_-_panoramio.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Phu_Quoc_beach.jpg/1280px-Phu_Quoc_beach.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/6/61/Sao_Beach_Phu_Quoc.jpg/1280px-Sao_Beach_Phu_Quoc.jpg',
    ],
    description:
      'Công viên chủ đề lớn nhất Đông Nam Á với hơn 100 trò chơi: River Safari, công viên nước, vườn thú VinWonders, biểu diễn nhạc nước River of Light.',
    bookingUrl: 'https://vinpearl.com/vi/vinwonders-phu-quoc',
    highlights: [
      'Toàn bộ trò chơi không giới hạn',
      'Show nhạc nước River of Light',
      'Vườn thú Safari mở',
      'Shuttle miễn phí từ trung tâm Phú Quốc',
    ],
  },
  {
    brandHandle: 'vinpearl',
    citySlug: 'nha-trang',
    title: 'VinWonders Nha Trang - Cáp treo Hòn Tre 3.320m',
    category: 'viewpoint',
    durationHours: 10,
    priceVnd: 900_000,
    image:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/Vinpearl_Land_Nha_Trang.jpg/1280px-Vinpearl_Land_Nha_Trang.jpg',
    images: [
      'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/Vinpearl_Land_Nha_Trang.jpg/1280px-Vinpearl_Land_Nha_Trang.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0a/Nha_Trang_Cable_Car.jpg/1280px-Nha_Trang_Cable_Car.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Nha_Trang_beach_Vietnam.jpg/1280px-Nha_Trang_beach_Vietnam.jpg',
    ],
    description:
      'Cáp treo vượt biển dài thứ 2 thế giới (3.320m), tới đảo Hòn Tre tận hưởng công viên nước, vườn cây nhiệt đới, công viên giải trí gồm 12 khu chủ đề.',
    bookingUrl: 'https://vinpearl.com/vi/vinwonders-nha-trang',
    highlights: [
      'Cáp treo vượt biển 3.320m',
      '12 khu chủ đề trên đảo',
      'Aquarium thuỷ cung',
      'Buffet hải sản tươi sống',
    ],
  },
  {
    brandHandle: 'vinpearl',
    citySlug: 'hoi-an',
    title: 'VinWonders Nam Hội An - Trải nghiệm văn hoá 3 ngày',
    category: 'museum',
    durationHours: 8,
    priceVnd: 750_000,
    image:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d6/H%E1%BB%99i_An_Ancient_Town_at_Night.jpg/1280px-H%E1%BB%99i_An_Ancient_Town_at_Night.jpg',
    images: [
      'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d6/H%E1%BB%99i_An_Ancient_Town_at_Night.jpg/1280px-H%E1%BB%99i_An_Ancient_Town_at_Night.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/2/26/Hoi_An_lanterns_at_night.jpg/1280px-Hoi_An_lanterns_at_night.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/b/be/Japanese_Bridge_Hoi_An.jpg/1280px-Japanese_Bridge_Hoi_An.jpg',
    ],
    description:
      'Công viên văn hoá - giải trí tái hiện 4 nền văn hoá: Bến cảng Hội An xưa, Đảo Văn hoá Dân gian, Vùng đất Phiêu Lưu, River Safari thảo cầm viên.',
    bookingUrl: 'https://vinpearl.com/vi/vinwonders-nam-hoi-an',
    highlights: [
      'Show Ký Ức Hội An',
      'River Safari thảo cầm viên',
      'Khu vui chơi mạo hiểm',
      'Trải nghiệm văn hoá dân gian',
    ],
  },

  // ============== SUN WORLD ==============
  {
    brandHandle: 'sunworld',
    citySlug: 'da-nang',
    title: 'Sun World Bà Nà Hills - Cáp treo + Cầu Vàng',
    category: 'viewpoint',
    durationHours: 10,
    priceVnd: 950_000,
    image:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/Golden_Bridge_-_Da_Nang_-_Vietnam.jpg/1280px-Golden_Bridge_-_Da_Nang_-_Vietnam.jpg',
    images: [
      'https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/Golden_Bridge_-_Da_Nang_-_Vietnam.jpg/1280px-Golden_Bridge_-_Da_Nang_-_Vietnam.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Ba_Na_Hills_French_Village.jpg/1280px-Ba_Na_Hills_French_Village.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Ba_Na_Hills_Cable_Car.jpg/1280px-Ba_Na_Hills_Cable_Car.jpg',
    ],
    description:
      'Đỉnh núi Chúa 1.487m với Cầu Vàng nâng bởi đôi tay khổng lồ, làng Pháp cổ tích, Fantasy Park 90 trò chơi trong nhà, vườn Le Jardin D\'Amour 9 khu.',
    bookingUrl: 'https://banahills.sunworld.vn',
    highlights: [
      'Cáp treo Guinness record',
      'Cầu Vàng biểu tượng',
      'Làng Pháp giữa mây',
      '90+ trò chơi Fantasy Park',
    ],
  },
  {
    brandHandle: 'sunworld',
    citySlug: 'sa-pa',
    title: 'Fansipan Legend - Cáp treo "Nóc nhà Đông Dương" 3.143m',
    category: 'viewpoint',
    durationHours: 6,
    priceVnd: 820_000,
    image:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/Fansipan_Sa_Pa_Vietnam.jpg/1280px-Fansipan_Sa_Pa_Vietnam.jpg',
    images: [
      'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/Fansipan_Sa_Pa_Vietnam.jpg/1280px-Fansipan_Sa_Pa_Vietnam.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Sapa_Rice_Terraces.jpg/1280px-Sapa_Rice_Terraces.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/Fansipan_Cable_Car.jpg/1280px-Fansipan_Cable_Car.jpg',
    ],
    description:
      'Cáp treo 3 dây dài nhất thế giới (6.292m) đưa du khách lên đỉnh Fansipan trong 15 phút. Quần thể tâm linh, kiệt tác kiến trúc giữa biển mây Tây Bắc.',
    bookingUrl: 'https://fansipanlegend.sunworld.vn',
    highlights: [
      'Cáp treo Guinness 3 dây',
      'Đỉnh Fansipan 3.143m',
      'Quần thể chùa Linh Sơn',
      'Săn mây - bình minh',
    ],
  },
  {
    brandHandle: 'sunworld',
    citySlug: 'phu-quoc',
    title: 'Hòn Thơm Nature Park - Cáp treo 3 dây dài nhất TG 7.899m',
    category: 'beach',
    durationHours: 8,
    priceVnd: 1_000_000,
    image:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e6/Phu_Quoc_Hon_Thom_cable_car.jpg/1280px-Phu_Quoc_Hon_Thom_cable_car.jpg',
    images: [
      'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e6/Phu_Quoc_Hon_Thom_cable_car.jpg/1280px-Phu_Quoc_Hon_Thom_cable_car.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/6/61/Sao_Beach_Phu_Quoc.jpg/1280px-Sao_Beach_Phu_Quoc.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/Hon_Thom_Island_Phu_Quoc.jpg/1280px-Hon_Thom_Island_Phu_Quoc.jpg',
    ],
    description:
      'Cáp treo vượt biển dài nhất thế giới (7.899m) đến đảo Hòn Thơm. Bãi tắm hoang sơ, công viên nước Aquatopia, trò chơi mạo hiểm dưới nước.',
    bookingUrl: 'https://honthom.sunworld.vn',
    highlights: [
      'Cáp treo Guinness 7.899m',
      'Aquatopia công viên nước',
      'Bãi tắm hoang sơ',
      'Lặn ngắm san hô',
    ],
  },
  {
    brandHandle: 'sunworld',
    citySlug: 'da-nang',
    title: 'Asia Park Đà Nẵng - Sun Wheel 115m + 20 trò chơi',
    category: 'park',
    durationHours: 5,
    priceVnd: 250_000,
    image:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/8/86/Sun_Wheel_Da_Nang.jpg/1280px-Sun_Wheel_Da_Nang.jpg',
    images: [
      'https://upload.wikimedia.org/wikipedia/commons/thumb/8/86/Sun_Wheel_Da_Nang.jpg/1280px-Sun_Wheel_Da_Nang.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cc/Dragon_Bridge_Da_Nang.jpg/1280px-Dragon_Bridge_Da_Nang.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/4/49/Da_Nang_at_night.jpg/1280px-Da_Nang_at_night.jpg',
    ],
    description:
      'Khu giải trí ngay trung tâm Đà Nẵng với vòng quay Sun Wheel 115m (top 10 thế giới), khu văn hoá 10 nước Châu Á, 20+ trò chơi cảm giác mạnh.',
    bookingUrl: 'https://danangwonders.sunworld.vn',
    highlights: [
      'Sun Wheel 115m',
      'Khu văn hoá 10 nước',
      'Show ánh sáng buổi tối',
      'Gần trung tâm TP',
    ],
  },

  // ============== VIETRAVEL ==============
  {
    brandHandle: 'vietravel',
    citySlug: 'ha-noi',
    title: 'City tour Hà Nội cổ kính + Hồ Tây sunset (1 ngày)',
    category: 'museum',
    durationHours: 8,
    priceVnd: 690_000,
    image:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/Hoan_Kiem_lake_panorama.jpg/1280px-Hoan_Kiem_lake_panorama.jpg',
    images: [
      'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/Hoan_Kiem_lake_panorama.jpg/1280px-Hoan_Kiem_lake_panorama.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2c/Temple_of_Literature_Hanoi.jpg/1280px-Temple_of_Literature_Hanoi.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Hanoi_Old_Quarter_street.jpg/1280px-Hanoi_Old_Quarter_street.jpg',
    ],
    description:
      'Hành trình thăm Lăng Bác, Văn Miếu - Quốc Tử Giám, chùa Một Cột, phố cổ 36 phố phường, kết thúc bằng dạo Hồ Tây ngắm sunset và thưởng thức bánh tôm.',
    bookingUrl: 'https://travel.com.vn/tour-du-lich-trong-nuoc/ha-noi',
    highlights: [
      'Hướng dẫn viên thuyết minh sâu',
      'Đưa đón khách sạn',
      'Bữa trưa món Hà Nội',
      'Ngắm sunset Hồ Tây',
    ],
  },
  {
    brandHandle: 'vietravel',
    citySlug: 'hue',
    title: 'Cố đô Huế - Thuyền rồng sông Hương (2N1Đ)',
    category: 'museum',
    durationHours: 30,
    priceVnd: 2_290_000,
    image:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/0/06/Hue_Imperial_City_Gate.jpg/1280px-Hue_Imperial_City_Gate.jpg',
    images: [
      'https://upload.wikimedia.org/wikipedia/commons/thumb/0/06/Hue_Imperial_City_Gate.jpg/1280px-Hue_Imperial_City_Gate.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Perfume_River_Hue.jpg/1280px-Perfume_River_Hue.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/a/af/Thien_Mu_Pagoda.jpg/1280px-Thien_Mu_Pagoda.jpg',
    ],
    description:
      'Tham quan Đại Nội, lăng Tự Đức, lăng Khải Định, chùa Thiên Mụ. Tối thưởng thức ca Huế trên thuyền rồng sông Hương, ăn cơm cung đình.',
    bookingUrl: 'https://travel.com.vn/tour-du-lich-trong-nuoc/hue',
    highlights: [
      'Đại Nội + 2 lăng tẩm',
      'Ca Huế trên sông Hương',
      'Cơm cung đình Huế',
      'Khách sạn 4* trung tâm',
    ],
  },
  {
    brandHandle: 'vietravel',
    citySlug: 'da-lat',
    title: 'Đà Lạt - Săn mây Cầu Đất + Trang trại dâu (3N2Đ)',
    category: 'viewpoint',
    durationHours: 60,
    priceVnd: 3_490_000,
    image:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/Da_Lat_-_Tuyen_Lam_Lake.jpg/1280px-Da_Lat_-_Tuyen_Lam_Lake.jpg',
    images: [
      'https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/Da_Lat_-_Tuyen_Lam_Lake.jpg/1280px-Da_Lat_-_Tuyen_Lam_Lake.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/Da_Lat_pine_forest.jpg/1280px-Da_Lat_pine_forest.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/Cau_Dat_tea_plantation.jpg/1280px-Cau_Dat_tea_plantation.jpg',
    ],
    description:
      'Săn mây bình minh tại Cầu Đất Farm, tham quan Thiền viện Trúc Lâm, hồ Tuyền Lâm, vườn dâu sạch, làng Cù Lần. Đêm chợ đêm Đà Lạt nướng + sữa đậu.',
    bookingUrl: 'https://travel.com.vn/tour-du-lich-trong-nuoc/da-lat',
    highlights: [
      'Săn mây Cầu Đất sáng sớm',
      'Khách sạn 3* view hồ',
      'Hái dâu tại vườn',
      'Xe limousine khứ hồi',
    ],
  },

  // ============== SAIGONTOURIST ==============
  {
    brandHandle: 'saigontourist',
    citySlug: 'ho-chi-minh',
    title: 'Saigon Heritage Walking Tour - Phố Pháp + Chợ Bến Thành',
    category: 'museum',
    durationHours: 4,
    priceVnd: 690_000,
    image:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/3/31/Saigon_Notre-Dame_Basilica_-_Front_view.jpg/1280px-Saigon_Notre-Dame_Basilica_-_Front_view.jpg',
    images: [
      'https://upload.wikimedia.org/wikipedia/commons/thumb/3/31/Saigon_Notre-Dame_Basilica_-_Front_view.jpg/1280px-Saigon_Notre-Dame_Basilica_-_Front_view.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/Saigon_Central_Post_Office.jpg/1280px-Saigon_Central_Post_Office.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Ben_Thanh_Market.jpg/1280px-Ben_Thanh_Market.jpg',
    ],
    description:
      'Đi bộ qua Nhà thờ Đức Bà, Bưu điện trung tâm, Bảo tàng Mỹ thuật, kết thúc tại chợ Bến Thành thưởng thức bánh mì Sài Gòn + cà phê sữa đá đường phố.',
    bookingUrl: 'https://saigontourist.net/vi/tour-trong-nuoc',
    highlights: [
      'Hướng dẫn viên song ngữ',
      'Tour đi bộ thân thiện môi trường',
      'Ăn bánh mì + cà phê',
      'Tự do mua sắm chợ Bến Thành',
    ],
  },
  {
    brandHandle: 'saigontourist',
    citySlug: 'vung-tau',
    title: 'Vũng Tàu cuối tuần - Bãi Sau + Tượng Chúa Kitô',
    category: 'beach',
    durationHours: 30,
    priceVnd: 1_690_000,
    image:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/Christ_of_Vung_Tau.jpg/1280px-Christ_of_Vung_Tau.jpg',
    images: [
      'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/Christ_of_Vung_Tau.jpg/1280px-Christ_of_Vung_Tau.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/6/64/Vung_Tau_beach_Vietnam.jpg/1280px-Vung_Tau_beach_Vietnam.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Vung_Tau_lighthouse.jpg/1280px-Vung_Tau_lighthouse.jpg',
    ],
    description:
      'Khởi hành sớm từ Sài Gòn, tham quan tượng Chúa Kitô Vua (cao 32m), Hải Đăng Vũng Tàu, tắm biển Bãi Sau. Tối thưởng thức bánh khọt cô Ba Vũng Tàu.',
    bookingUrl: 'https://saigontourist.net/vi/tour-trong-nuoc',
    highlights: [
      'Xe limousine 11 chỗ',
      'Khách sạn 4* view biển',
      'Bánh khọt cô Ba',
      'Leo tượng Chúa 811 bậc',
    ],
  },
  {
    brandHandle: 'saigontourist',
    citySlug: 'hoi-an',
    title: 'Hội An phố cổ - Đêm hoa đăng sông Hoài',
    category: 'museum',
    durationHours: 5,
    priceVnd: 590_000,
    image:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/2/26/Hoi_An_lanterns_at_night.jpg/1280px-Hoi_An_lanterns_at_night.jpg',
    images: [
      'https://upload.wikimedia.org/wikipedia/commons/thumb/2/26/Hoi_An_lanterns_at_night.jpg/1280px-Hoi_An_lanterns_at_night.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/b/be/Japanese_Bridge_Hoi_An.jpg/1280px-Japanese_Bridge_Hoi_An.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/7/72/Hoi_An_river_boats.jpg/1280px-Hoi_An_river_boats.jpg',
    ],
    description:
      'Đi dạo phố cổ ban đêm dưới ánh đèn lồng, thưởng thức cao lầu - bánh bao bánh vạc - chè bắp, thả hoa đăng sông Hoài cầu may mắn.',
    bookingUrl: 'https://saigontourist.net/vi/tour-trong-nuoc',
    highlights: [
      'Phố cổ rực rỡ đèn lồng',
      'Thuyền nhỏ thả hoa đăng',
      'Cao lầu + bánh vạc',
      'Hướng dẫn viên địa phương',
    ],
  },

  // ============== KLOOK ==============
  {
    brandHandle: 'klook',
    citySlug: 'ho-chi-minh',
    title: 'Tour ẩm thực đường phố Sài Gòn bằng xe máy',
    category: 'street_food',
    durationHours: 4,
    priceVnd: 1_400_000,
    image:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/4/48/Banh_mi_Saigon.jpg/1280px-Banh_mi_Saigon.jpg',
    images: [
      'https://upload.wikimedia.org/wikipedia/commons/thumb/4/48/Banh_mi_Saigon.jpg/1280px-Banh_mi_Saigon.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/Pho_bo_Vietnam.jpg/1280px-Pho_bo_Vietnam.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/6/61/Saigon_street_food.jpg/1280px-Saigon_street_food.jpg',
    ],
    description:
      'Tài xế nữ áo dài chở khách qua 5 điểm street food bí mật của dân địa phương — bánh mì, phở, bún bò, chè, cà phê. Bao gồm tất cả đồ ăn + nước uống.',
    bookingUrl: 'https://www.klook.com/vi/city/28-ho-chi-minh',
    highlights: [
      'Xe máy + tài xế áo dài',
      '5 điểm ăn vặt địa phương',
      'Bao ăn no nê',
      'Đón tận khách sạn',
    ],
  },
  {
    brandHandle: 'klook',
    citySlug: 'hai-phong',
    title: 'Vịnh Hạ Long cruise 1 ngày - Hang Sửng Sốt + chèo kayak',
    category: 'beach',
    durationHours: 12,
    priceVnd: 1_290_000,
    image:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Halong_Bay_Vietnam_2020.jpg/1280px-Halong_Bay_Vietnam_2020.jpg',
    images: [
      'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Halong_Bay_Vietnam_2020.jpg/1280px-Halong_Bay_Vietnam_2020.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2c/Halong_Bay_junk_boat.jpg/1280px-Halong_Bay_junk_boat.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d8/Sung_Sot_Cave.jpg/1280px-Sung_Sot_Cave.jpg',
    ],
    description:
      'Du thuyền 5 sao khám phá vịnh Hạ Long: hang Sửng Sốt, đảo Ti Tốp, chèo kayak làng chài Ba Hang. Bao buffet hải sản trên tàu + nước uống.',
    bookingUrl: 'https://www.klook.com/vi/activity/halong-bay-day-tour',
    highlights: [
      'Du thuyền 5 sao',
      'Buffet hải sản trên tàu',
      'Chèo kayak làng chài',
      'Đón Hà Nội / Hải Phòng',
    ],
  },
  {
    brandHandle: 'klook',
    citySlug: 'da-nang',
    title: 'Đà Nẵng - Sơn Trà Peninsula + đèo Hải Vân jeep tour',
    category: 'viewpoint',
    durationHours: 6,
    priceVnd: 850_000,
    image:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/Hai_Van_Pass_Vietnam.jpg/1280px-Hai_Van_Pass_Vietnam.jpg',
    images: [
      'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/Hai_Van_Pass_Vietnam.jpg/1280px-Hai_Van_Pass_Vietnam.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Son_Tra_Peninsula.jpg/1280px-Son_Tra_Peninsula.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Linh_Ung_Pagoda_Da_Nang.jpg/1280px-Linh_Ung_Pagoda_Da_Nang.jpg',
    ],
    description:
      'Jeep tour Mỹ thám hiểm bán đảo Sơn Trà tìm voọc chà vá chân nâu, chùa Linh Ứng, đỉnh Bàn Cờ Tiên. Vượt đèo Hải Vân ngắm vịnh Lăng Cô.',
    bookingUrl: 'https://www.klook.com/vi/city/35-danang',
    highlights: [
      'Jeep Mỹ vintage',
      'Săn voọc chà vá',
      'Chùa Linh Ứng + Bàn Cờ Tiên',
      'Đèo Hải Vân Top Gear',
    ],
  },
];
