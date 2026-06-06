import type { DestinationSeed } from './types';

// Huế stayed a centrally-governed city in the 2025 reform. 40 commune-level
// units (21 phường + 19 xã). Reference: Nghị quyết 1675/NQ-UBTVQH15.
// Data heavily weighted to Phú Xuân (45) and Thuận Hóa (26) — the central
// urban wards covering the Citadel and south-of-river downtown.
const seed: DestinationSeed = {
  citySlug: 'hue',
  wards: [
    {
      name: 'Phú Xuân',
      type: 'phuong',
      aliasesOldDistrict: ['Phú Xuân', 'Quận Phú Xuân', 'TP Huế'],
      aliasesOldWards: ['Phú Hậu', 'Phú Hiệp', 'Phú Hòa', 'Phú Cát', 'Phú Bình', 'Tây Lộc', 'Thuận Lộc', 'Thuận Hòa', 'Phú Thuận'],
      aliasesUser: ['Đại Nội', 'Kinh thành Huế', 'Citadel'],
    },
    {
      name: 'Thuận Hóa',
      type: 'phuong',
      aliasesOldDistrict: ['Thuận Hóa', 'TP Huế'],
      aliasesOldWards: ['Phú Hội', 'Phú Nhuận', 'Đúc', 'Vĩnh Ninh', 'Phước Vĩnh', 'Trường An'],
      aliasesUser: ['phố đi bộ Phạm Ngũ Lão', 'phố Tây Huế'],
    },
    {
      name: 'Kim Long',
      type: 'phuong',
      aliasesOldDistrict: ['TP Huế', 'Phú Xuân'],
      aliasesOldWards: ['Long Hồ', 'Hương Long', 'Kim Long'],
      aliasesUser: ['chùa Thiên Mụ', 'lăng Tự Đức'],
    },
    {
      name: 'An Cựu',
      type: 'phuong',
      aliasesOldDistrict: ['Thuận Hóa', 'TP Huế'],
      aliasesOldWards: ['An Cựu', 'An Đông', 'An Tây', 'Phước Vĩnh'],
    },
    {
      name: 'Vỹ Dạ',
      type: 'phuong',
      aliasesOldDistrict: ['Thuận Hóa', 'TP Huế'],
      aliasesOldWards: ['Vỹ Dạ', 'Vĩ Dạ', 'Xuân Phú'],
    },
    {
      name: 'Thủy Xuân',
      type: 'phuong',
      aliasesOldDistrict: ['TP Huế'],
      aliasesOldWards: ['Thủy Xuân', 'Thủy Biều'],
      aliasesUser: ['lăng Tự Đức', 'làng hương Thủy Xuân'],
    },
    {
      name: 'Thủy Bằng',
      type: 'phuong',
      aliasesOldDistrict: ['TP Huế', 'Hương Thủy'],
      aliasesOldWards: ['Thủy Bằng', 'Thủy Phương'],
      aliasesUser: ['lăng Khải Định', 'lăng Minh Mạng'],
    },
    {
      name: 'Thủy Thanh',
      type: 'xa',
      aliasesOldDistrict: ['Hương Thủy', 'TX Hương Thủy'],
      aliasesOldWards: ['Thủy Thanh', 'Thủy Vân'],
      aliasesUser: ['cầu ngói Thanh Toàn'],
    },
    {
      name: 'Hương An',
      type: 'phuong',
      aliasesOldDistrict: ['Hương Trà', 'TX Hương Trà'],
      aliasesOldWards: ['Hương An', 'Hương Chữ', 'Hương Toàn'],
    },
    {
      name: 'Hương Hồ',
      type: 'phuong',
      aliasesOldDistrict: ['Hương Trà'],
      aliasesOldWards: ['Hương Hồ', 'Hương Bình', 'Bình Tiến'],
    },
    {
      name: 'Hương Thọ',
      type: 'phuong',
      aliasesOldDistrict: ['Hương Trà'],
      aliasesOldWards: ['Hương Thọ', 'Hương Vân'],
    },
    {
      name: 'Dương Nỗ',
      type: 'xa',
      aliasesOldDistrict: ['Phú Vang', 'Huyện Phú Vang'],
      aliasesOldWards: ['Phú Dương', 'Phú Mậu'],
      aliasesUser: ['nhà lưu niệm Bác Hồ Dương Nỗ'],
    },
    {
      name: 'Phú Hội',
      type: 'xa',
      aliasesOldDistrict: ['Phú Vang'],
      aliasesOldWards: ['Phú Hội'],
    },
    {
      name: 'Mỹ Thượng',
      type: 'xa',
      aliasesOldDistrict: ['Phú Vang'],
      aliasesOldWards: ['Phú Mỹ', 'Phú Thượng'],
    },
  ],
};

export default seed;
