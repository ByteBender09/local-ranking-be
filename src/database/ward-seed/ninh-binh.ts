import type { DestinationSeed } from './types';

// Ninh Bình after July 2025: Ninh Bình + Hà Nam + Nam Định merged. 129
// commune-level units (32 phường + 97 xã). Reference: Nghị quyết 1674.
// Tourism data is overwhelmingly the Hoa Lư area (Tràng An, Tam Cốc, Bích
// Động, Bái Đính) — that's where the seed focuses.
const seed: DestinationSeed = {
  citySlug: 'ninh-binh',
  wards: [
    {
      name: 'Hoa Lư',
      type: 'phuong',
      aliasesOldDistrict: ['Ninh Bình', 'TP Ninh Bình', 'Hoa Lư', 'Huyện Hoa Lư'],
      aliasesOldWards: ['Ninh Mỹ', 'Ninh Khánh', 'Đông Thành', 'Tân Thành', 'Vân Giang', 'Nam Thành', 'Nam Bình', 'Bích Đào', 'Ninh Khang', 'Ninh Nhất', 'Ninh Tiến', 'Đinh Tiên Hoàng', 'Tràng An', 'Khê Hạ', 'Khê Thượng', 'Thôn Khê Thượng', 'Tổ dân phố Khê Thượng', 'Hoàng Sơn', 'Xuân Áng Nội', 'Xuân Áng Ngoại', 'Thôn Nội'],
      aliasesUser: ['Tràng An', 'Tam Cốc', 'Bích Động', 'Bái Đính', 'cố đô Hoa Lư', 'Mua Cave', 'hang Múa'],
    },
    {
      name: 'Tây Hoa Lư',
      type: 'phuong',
      aliasesOldDistrict: ['Hoa Lư', 'Ninh Bình'],
      aliasesOldWards: ['Ninh Giang', 'Trường Yên', 'Ninh Hòa', 'Phúc Sơn', 'Gia Sinh', 'Khu du lịch sinh thái'],
      aliasesUser: ['chùa Bái Đính', 'cố đô Hoa Lư'],
    },
    {
      name: 'Nam Hoa Lư',
      type: 'phuong',
      aliasesOldDistrict: ['Hoa Lư', 'Ninh Bình'],
      aliasesOldWards: ['Ninh Phong', 'Ninh Sơn', 'Ninh Vân', 'Ninh An', 'Ninh Hải'],
      aliasesUser: ['Tam Cốc', 'Bích Động'],
    },
    {
      name: 'Nho Quan',
      type: 'phuong',
      aliasesOldDistrict: ['Nho Quan', 'Huyện Nho Quan'],
      aliasesOldWards: ['Nho Quan', 'Đồng Phong', 'Yên Quang', 'Văn Phú', 'Văn Phương'],
      aliasesUser: ['Cúc Phương', 'vườn quốc gia Cúc Phương'],
    },
    {
      name: 'Gia Viễn',
      type: 'phuong',
      aliasesOldDistrict: ['Gia Viễn', 'Huyện Gia Viễn'],
      aliasesOldWards: ['Gia Viễn', 'Gia Thanh', 'Gia Vân', 'Gia Hòa', 'Gia Hưng'],
      aliasesUser: ['Vân Long', 'khu bảo tồn Vân Long', 'suối nước nóng Kênh Gà'],
    },
    {
      name: 'Kim Sơn',
      type: 'phuong',
      aliasesOldDistrict: ['Kim Sơn', 'Huyện Kim Sơn'],
      aliasesOldWards: ['Phát Diệm', 'Kim Đông', 'Kim Trung', 'Kim Mỹ', 'Lai Thành'],
      aliasesUser: ['nhà thờ Phát Diệm'],
    },
  ],
};

export default seed;
