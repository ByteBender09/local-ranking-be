import type { DestinationSeed } from './types';

// Sa Pa after July 2025: now 6 units of Lào Cai province (Lào Cai + Yên Bái
// merged). The old Sa Pa thị xã (16 units) was consolidated into:
//   Phường Sa Pa       = 6 old phường (Sa Pả, Ô Quý Hồ, Hàm Rồng, Cầu Mây,
//                        Sa Pa, Phan Si Păng) — downtown + Fansipan cable car
//   Xã Mường Bo        = Liên Minh + Mường Bo
//   Xã Bản Hồ          = Thanh Bình + Bản Hồ
//   Xã Tả Van          = Hoàng Liên + Mường Hoa + Tả Van — Cát Cát, trekking
//   Xã Tả Phìn         = Trung Chải + Tả Phìn — Red Dao villages
//   Xã Ngũ Chỉ Sơn     = unchanged
const seed: DestinationSeed = {
  citySlug: 'sa-pa',
  wards: [
    {
      name: 'Sa Pa',
      type: 'phuong',
      aliasesOldDistrict: ['Sa Pa', 'TX Sa Pa', 'Thị xã Sa Pa', 'Sapa'],
      aliasesOldWards: ['Sa Pả', 'Ô Quý Hồ', 'Hàm Rồng', 'Cầu Mây', 'Sa Pa', 'Phan Si Păng', 'Phường Sa Pa', 'Bảo Tàng', 'TT. Sa Pa', 'Pang Sapa'],
      aliasesUser: ['Fansipan', 'cáp treo Fansipan', 'Hàm Rồng', 'nhà thờ đá Sa Pa', 'phố núi'],
    },
    {
      name: 'Mường Bo',
      type: 'xa',
      aliasesOldDistrict: ['Sa Pa'],
      aliasesOldWards: ['Liên Minh', 'Mường Bo', 'Thanh Phú'],
    },
    {
      name: 'Bản Hồ',
      type: 'xa',
      aliasesOldDistrict: ['Sa Pa'],
      aliasesOldWards: ['Thanh Bình', 'Bản Hồ', 'Bản Dền', 'Thôn Lếch Dao'],
      aliasesUser: ['suối Bản Hồ'],
    },
    {
      name: 'Tả Van',
      type: 'xa',
      aliasesOldDistrict: ['Sa Pa'],
      aliasesOldWards: ['Hoàng Liên', 'Mường Hoa', 'Tả Van', 'Cát Cát', 'Bản Pho', 'Giàng Tả Chải', 'Giáy', 'Séo Mý Tỷ', 'Lao Chải', 'Dáy'],
      aliasesUser: ['Cát Cát', 'bản Cát Cát', 'thung lũng Mường Hoa', 'Lao Chải', 'trekking Tả Van'],
    },
    {
      name: 'Tả Phìn',
      type: 'xa',
      aliasesOldDistrict: ['Sa Pa'],
      aliasesOldWards: ['Trung Chải', 'Tả Phìn', 'Can Ngài'],
      aliasesUser: ['bản Tả Phìn', 'người Dao đỏ'],
    },
    {
      name: 'Ngũ Chỉ Sơn',
      type: 'xa',
      aliasesOldDistrict: ['Sa Pa'],
      aliasesOldWards: ['Ngũ Chỉ Sơn', 'Xã San Sả Hồ', 'San Sả Hồ', 'Xã Sơn Bình', 'Sơn Bình'],
      aliasesUser: ['núi Ngũ Chỉ Sơn', 'thác Bạc'],
    },
  ],
};

export default seed;
