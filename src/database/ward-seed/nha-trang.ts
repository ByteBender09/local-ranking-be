import type { DestinationSeed } from './types';

// Nha Trang after July 2025: 4 phường of new Khánh Hòa province (Khánh Hòa
// + Ninh Thuận merged). Reference: Nghị quyết 1667/NQ-UBTVQH15.
//
// Nha Trang       = Vạn Thạnh + Lộc Thọ + Vĩnh Nguyên + Tân Tiến + Phước Hòa
// Bắc Nha Trang   = Vĩnh Hòa + Vĩnh Hải + Vĩnh Phước + Vĩnh Thọ + Vĩnh Lương + Vĩnh Phương
// Tây Nha Trang   = Ngọc Hiệp + Phương Sài + Vĩnh Ngọc + Vĩnh Thạnh + Vĩnh Hiệp + Vĩnh Trung
// Nam Nha Trang   = Phước Hải + Phước Long + Vĩnh Trường + Vĩnh Thái + Phước Đồng
const seed: DestinationSeed = {
  citySlug: 'nha-trang',
  wards: [
    {
      name: 'Nha Trang',
      type: 'phuong',
      aliasesOldDistrict: ['Nha Trang', 'TP Nha Trang', 'TP. Nha Trang'],
      aliasesOldWards: ['Vạn Thạnh', 'Lộc Thọ', 'Vĩnh Nguyên', 'Tân Tiến', 'Phước Hòa', 'Phước Tân', 'Phước Tiến', 'Phương Sơn', 'Thành phố'],
      aliasesUser: ['trung tâm Nha Trang', 'tháp Trầm Hương', 'biển Nha Trang trung tâm'],
    },
    {
      name: 'Bắc Nha Trang',
      type: 'phuong',
      aliasesOldDistrict: ['Nha Trang'],
      aliasesOldWards: ['Vĩnh Hòa', 'Vĩnh Hải', 'Vĩnh Phước', 'Vĩnh Thọ', 'Vĩnh Lương', 'Vĩnh Phương', 'Đường Đệ'],
      aliasesUser: ['Hòn Chồng', 'Vinpearl', 'bãi Tiên'],
    },
    {
      name: 'Tây Nha Trang',
      type: 'phuong',
      aliasesOldDistrict: ['Nha Trang'],
      aliasesOldWards: ['Ngọc Hiệp', 'Phương Sài', 'Vĩnh Ngọc', 'Vĩnh Thạnh', 'Vĩnh Hiệp', 'Vĩnh Trung', 'Vĩnh Điềm Trung'],
    },
    {
      name: 'Nam Nha Trang',
      type: 'phuong',
      aliasesOldDistrict: ['Nha Trang'],
      aliasesOldWards: ['Phước Hải', 'Phước Long', 'Vĩnh Trường', 'Vĩnh Thái', 'Phước Đồng', 'Phước Hạ', 'Hòn Rớ', 'VCN', 'Khu Đô Thị An Bình Tân'],
      aliasesUser: ['Hòn Rớ', 'cảng cá Hòn Rớ', 'An Bình Tân'],
    },
    // Adjacent areas in current data
    {
      name: 'Bích Đầm',
      type: 'xa',
      aliasesOldDistrict: ['Nha Trang'],
      aliasesOldWards: ['Bích Đầm'],
      aliasesUser: ['đảo Hòn Tre', 'Bích Đầm'],
    },
    {
      name: 'Cam Lâm',
      type: 'xa',
      aliasesOldDistrict: ['Cam Lâm', 'Huyện Cam Lâm'],
      aliasesOldWards: ['Cam Hải Đông', 'Cam Hải Tây', 'Cam Hòa', 'Cam Tân'],
    },
    {
      name: 'Cam Ranh',
      type: 'phuong',
      aliasesOldDistrict: ['Cam Ranh', 'TP Cam Ranh'],
      aliasesOldWards: ['Ba Ngòi', 'Cam Bình', 'Cam Linh', 'Cam Lộc', 'Cam Nghĩa', 'Cam Phú', 'Cam Phúc Bắc', 'Cam Phúc Nam', 'Cam Thuận'],
      aliasesUser: ['sân bay Cam Ranh', 'Bãi Dài'],
    },
    {
      name: 'Ninh Hòa',
      type: 'phuong',
      aliasesOldDistrict: ['Ninh Hòa', 'TX Ninh Hòa'],
      aliasesOldWards: ['Ninh Hiệp', 'Ninh An', 'Ninh Đa', 'Ninh Diêm', 'Ninh Hà', 'Ninh Hải', 'Ninh Phụng', 'Ninh Quang', 'Ninh Thủy'],
    },
  ],
};

export default seed;
