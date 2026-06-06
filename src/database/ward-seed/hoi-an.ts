import type { DestinationSeed } from './types';

// Hội An is no longer a separate city — after July 2025 it's 3 phường of
// Đà Nẵng province. Kept as a separate tourism destination here because
// users browse "Hội An" not "Đà Nẵng phường Hội An".
//
// 3 phường (Nghị quyết 1659/NQ-UBTVQH15):
//   Hội An       = Minh An + Cẩm Phô + Sơn Phong + Cẩm Nam + Cẩm Kim
//   Hội An Đông  = Cẩm Châu + Cửa Đại + Cẩm Thanh
//   Hội An Tây   = Thanh Hà + Tân An + Cẩm An + Cẩm Hà
const seed: DestinationSeed = {
  citySlug: 'hoi-an',
  wards: [
    {
      name: 'Hội An',
      type: 'phuong',
      aliasesOldDistrict: ['Hội An', 'TP Hội An', 'TP. Hội An'],
      aliasesOldWards: ['Minh An', 'Cẩm Phô', 'Sơn Phong', 'Cẩm Nam', 'Cẩm Kim'],
      aliasesUser: ['phố cổ Hội An', 'Hội An Old Town', 'Old Town', 'An Hội'],
    },
    {
      name: 'Hội An Đông',
      type: 'phuong',
      aliasesOldDistrict: ['Hội An', 'TP Hội An'],
      aliasesOldWards: ['Cẩm Châu', 'Cửa Đại', 'Cẩm Thanh', 'Thanh Tam'],
      aliasesUser: ['biển Cửa Đại', 'rừng dừa Bảy Mẫu', 'An Bàng'],
    },
    {
      name: 'Hội An Tây',
      type: 'phuong',
      aliasesOldDistrict: ['Hội An', 'TP Hội An'],
      aliasesOldWards: ['Thanh Hà', 'Tân An', 'Cẩm An', 'Cẩm Hà'],
      aliasesUser: ['làng gốm Thanh Hà', 'làng rau Trà Quế'],
    },
    // Adjacent Điện Bàn wards that show up under hoi-an city_slug in data
    {
      name: 'Điện Bàn',
      type: 'xa',
      aliasesOldDistrict: ['Điện Bàn', 'TX Điện Bàn', 'Thị xã Điện Bàn'],
      aliasesOldWards: ['Vĩnh Điện', 'Điện An', 'Điện Thắng Bắc', 'Điện Thắng Trung', 'Điện Thắng Nam'],
    },
    {
      name: 'Điện Bàn Đông',
      type: 'xa',
      aliasesOldDistrict: ['Điện Bàn'],
      aliasesOldWards: ['Điện Dương', 'Điện Ngọc', 'Điện Nam Bắc', 'Điện Nam Trung', 'Điện Nam Đông'],
    },
    {
      name: 'Nam Phước',
      type: 'xa',
      aliasesOldDistrict: ['Duy Xuyên', 'Huyện Duy Xuyên'],
      aliasesOldWards: ['Nam Phước'],
    },
    {
      name: 'Duy Nghĩa',
      type: 'xa',
      aliasesOldDistrict: ['Duy Xuyên'],
      aliasesOldWards: ['Duy Nghĩa', 'Duy Hải'],
    },
    {
      name: 'Gò Nổi',
      type: 'xa',
      aliasesOldDistrict: ['Điện Bàn'],
      aliasesOldWards: ['Điện Quang', 'Điện Trung', 'Điện Phong'],
    },
    {
      name: 'Xuân Phú',
      type: 'xa',
      aliasesOldDistrict: ['Đại Lộc'],
      aliasesOldWards: ['Đại Hồng', 'Đại Tân'],
    },
    {
      name: 'Thăng Bình',
      type: 'xa',
      aliasesOldDistrict: ['Thăng Bình'],
      aliasesOldWards: ['Hà Lam', 'Bình Nguyên'],
    },
  ],
};

export default seed;
