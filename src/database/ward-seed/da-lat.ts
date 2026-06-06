import type { DestinationSeed } from './types';

// Đà Lạt is no longer a city — it's 5 phường of Lâm Đồng province
// (Nghị quyết 1671/NQ-UBTVQH15). Tourism-wise kept as a destination.
//
// 5 phường:
//   Xuân Hương — old Phường 1, 2, 3, 4, 10 (downtown lake area)
//   Cam Ly     — old Phường 5, 6 + Tà Nung commune (west)
//   Lâm Viên   — old Phường 8, 9, 12 (north / Cù Lần)
//   Xuân Trường — old Phường 11 + xã Xuân Thọ + Xuân Trường + Trạm Hành (tea-farm east)
//   Lang Biang — old Phường 7 + Lạc Dương town + Lát (Lạc Dương mountain area)
const seed: DestinationSeed = {
  citySlug: 'da-lat',
  wards: [
    {
      name: 'Xuân Hương - Đà Lạt',
      type: 'phuong',
      aliasesOldDistrict: ['Đà Lạt', 'TP Đà Lạt', 'TP. Đà Lạt'],
      aliasesOldWards: ['Phường 1', 'Phường 2', 'Phường 3', 'Phường 4', 'Phường 10', 'Xuân Hương'],
      aliasesUser: ['hồ Xuân Hương', 'trung tâm Đà Lạt', 'downtown Đà Lạt', 'chợ Đà Lạt', 'chợ Đêm Đà Lạt'],
    },
    {
      name: 'Cam Ly - Đà Lạt',
      type: 'phuong',
      aliasesOldDistrict: ['Đà Lạt', 'TP Đà Lạt'],
      aliasesOldWards: ['Phường 5', 'Phường 6', 'Tà Nung', 'Cam Ly', 'Xã Tà Nung'],
      aliasesUser: ['thác Cam Ly', 'làng hoa Vạn Thành'],
    },
    {
      name: 'Lâm Viên - Đà Lạt',
      type: 'phuong',
      aliasesOldDistrict: ['Đà Lạt', 'TP Đà Lạt'],
      aliasesOldWards: ['Phường 8', 'Phường 9', 'Phường 12', 'Lâm Viên'],
      aliasesUser: ['Cù Lần', 'thung lũng Tình Yêu'],
    },
    {
      name: 'Xuân Trường - Đà Lạt',
      type: 'phuong',
      aliasesOldDistrict: ['Đà Lạt', 'TP Đà Lạt'],
      aliasesOldWards: ['Phường 11', 'Xã Xuân Thọ', 'Xã Xuân Trường', 'Trạm Hành', 'Tram Hanh', 'Xuân Trường', 'Trường Thọ', 'Đa Thọ', 'Đa Lộc', 'Trường Xuân', 'Phát Chi', 'Đá Quý', 'Đồi Chè', 'Tây Sơn', 'Đồi chè'],
      aliasesUser: ['đồi chè Cầu Đất', 'làng cù lần', 'làng tằm'],
    },
    {
      name: 'Lang Biang - Đà Lạt',
      type: 'phuong',
      aliasesOldDistrict: ['Đà Lạt', 'TP Đà Lạt', 'Lạc Dương', 'Huyện Lạc Dương'],
      aliasesOldWards: ['Phường 7', 'Lạc Dương', 'Thị trấn Lạc Dương', 'Xã Lát', 'Lang Biang'],
      aliasesUser: ['núi Lang Biang', 'Bidoup', 'Đồi Đa Phú'],
    },
  ],
};

export default seed;
