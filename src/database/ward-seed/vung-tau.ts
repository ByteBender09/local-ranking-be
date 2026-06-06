import type { DestinationSeed } from './types';

// Vũng Tàu after July 2025 is administratively part of the new HCM City
// (HCM + Bình Dương + Bà Rịa-Vũng Tàu merger). Kept as a separate tourism
// destination here because users browse "Vũng Tàu" as a coastal getaway.
// Côn Đảo is now a đặc khu of HCM, but in this app it stays under vung-tau
// since current venues are tagged there.
const seed: DestinationSeed = {
  citySlug: 'vung-tau',
  wards: [
    {
      name: 'Vũng Tàu',
      type: 'phuong',
      aliasesOldDistrict: ['Vũng Tàu', 'TP Vũng Tàu', 'TP. Vũng Tàu', 'Thành phố Vũng Tàu', 'Thành phố Vũng Tầu'],
      aliasesOldWards: ['Phường 1', 'Phường 2', 'Phường 3', 'Phường 4', 'Phường 5', 'Phường Thắng Tam', 'Vi Ba'],
      aliasesUser: ['Bãi Trước', 'Bãi Sau', 'Bạch Dinh', 'tượng Chúa Vũng Tàu', 'núi lớn', 'Núi lớn'],
    },
    {
      name: 'Tam Thắng',
      type: 'phuong',
      aliasesOldDistrict: ['Vũng Tàu'],
      aliasesOldWards: ['Phường 8', 'Phường 9', 'Phường 10', 'Phường 11', 'Phường 12', 'Thắng Nhất', 'Thắng Nhì', 'Thắng Tam', 'Tam Thắng'],
    },
    {
      name: 'Rạch Dừa',
      type: 'phuong',
      aliasesOldDistrict: ['Vũng Tàu'],
      aliasesOldWards: ['Rạch Dừa', 'Phường 10'],
    },
    {
      name: 'Phước Thắng',
      type: 'phuong',
      aliasesOldDistrict: ['Vũng Tàu'],
      aliasesOldWards: ['Phước Thắng', 'Phường 11', 'Phường 12'],
    },
    {
      name: 'Long Sơn',
      type: 'xa',
      aliasesOldDistrict: ['Vũng Tàu'],
      aliasesOldWards: ['Long Sơn'],
      aliasesUser: ['đảo Long Sơn', 'nhà lớn Long Sơn'],
    },
    // ── Old Bà Rịa city / Bà Rịa-Vũng Tàu suburban ──────────────────
    {
      name: 'Bà Rịa',
      type: 'phuong',
      aliasesOldDistrict: ['Bà Rịa', 'TP Bà Rịa', 'Tỉnh Bà Rịa-Vũng Tàu', 'BRVT'],
      aliasesOldWards: ['Phước Hiệp', 'Phước Hưng', 'Phước Trung', 'Long Tâm', 'Long Toàn', 'Long Hương', 'Kim Dinh', 'Long Phước'],
    },
    {
      name: 'Phú Mỹ',
      type: 'phuong',
      aliasesOldDistrict: ['Phú Mỹ', 'TX Phú Mỹ'],
      aliasesOldWards: ['Phú Mỹ', 'Hắc Dịch', 'Mỹ Xuân', 'Tân Phước'],
    },
    // ── Beaches east of Vũng Tàu (Long Hải, Phước Hải) ──────────────
    {
      name: 'Long Hải',
      type: 'phuong',
      aliasesOldDistrict: ['Long Điền', 'Huyện Long Điền'],
      aliasesOldWards: ['Long Hải', 'Phước Tỉnh'],
      aliasesUser: ['biển Long Hải', 'dinh Cô'],
    },
    {
      name: 'Long Điền',
      type: 'xa',
      aliasesOldDistrict: ['Long Điền'],
      aliasesOldWards: ['Long Điền', 'An Ngãi', 'An Nhứt', 'Tam Phước'],
    },
    {
      name: 'Phước Hải',
      type: 'phuong',
      aliasesOldDistrict: ['Đất Đỏ', 'Huyện Đất Đỏ'],
      aliasesOldWards: ['Phước Hải', 'Lộc An', 'Long Mỹ', 'An Hòa', 'khu phố Mỹ Thuận', 'Mỹ Thuận'],
      aliasesUser: ['biển Phước Hải', 'Lộc An'],
    },
    {
      name: 'Đất Đỏ',
      type: 'xa',
      aliasesOldDistrict: ['Đất Đỏ'],
      aliasesOldWards: ['Đất Đỏ', 'Phước Long Thọ', 'Láng Dài'],
    },
    // ── Cần Giờ (HCM admin) — tagged under vung-tau in current data ─
    {
      name: 'Cần Giờ',
      type: 'xa',
      aliasesOldDistrict: ['Cần Giờ', 'Huyện Cần Giờ'],
      aliasesOldWards: ['Cần Thạnh', 'Long Hòa', 'Bình Khánh', 'Tam Thôn Hiệp'],
      aliasesUser: ['rừng ngập mặn Cần Giờ', 'biển 30 tháng 4'],
    },
    {
      name: 'An Thới Đông',
      type: 'xa',
      aliasesOldDistrict: ['Cần Giờ'],
      aliasesOldWards: ['An Thới Đông', 'Lý Nhơn'],
    },
    {
      name: 'Thạnh An',
      type: 'xa',
      aliasesOldDistrict: ['Cần Giờ'],
      aliasesOldWards: ['Thạnh An'],
      aliasesUser: ['đảo Thạnh An', 'Thiềng Liềng'],
    },
    // ── Côn Đảo (now đặc khu of HCM) ────────────────────────────────
    {
      name: 'Côn Đảo',
      type: 'dac_khu',
      aliasesOldDistrict: ['Côn Đảo', 'Huyện Côn Đảo', 'Côn Sơn'],
      aliasesOldWards: ['Côn Đảo', 'Khu 1', 'Khu 2', 'Khu 3', 'Khu 7'],
      aliasesUser: ['Côn Sơn', 'đảo Côn Sơn', 'bãi Đầm Trầu', 'bảo tàng Côn Đảo', 'nhà tù Côn Đảo'],
    },
  ],
};

export default seed;
