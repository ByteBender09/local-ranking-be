import type { DestinationSeed } from './types';

// Đà Nẵng after July 2025: merged with Quảng Nam into one centrally-governed
// city with 94 commune-level units. This file covers wards in the OLD Đà
// Nẵng city footprint (Hải Châu, Sơn Trà, Ngũ Hành Sơn, Liên Chiểu, Thanh
// Khê, Cẩm Lệ, Hoà Vang). The Hội An area is its own tourism destination
// and lives in hoi-an.ts even though admin-wise those 3 wards now belong to
// Đà Nẵng province.
const seed: DestinationSeed = {
  citySlug: 'da-nang',
  wards: [
    { name: 'Hải Châu', type: 'phuong', aliasesOldDistrict: ['Hải Châu', 'Q. Hải Châu'], aliasesOldWards: ['Thanh Bình', 'Thuận Phước', 'Thạch Thang', 'Phước Ninh', 'Hải Châu'], aliasesUser: ['trung tâm Đà Nẵng', 'downtown Da Nang'] },
    { name: 'Thanh Khê', type: 'phuong', aliasesOldDistrict: ['Thanh Khê', 'Q. Thanh Khê'], aliasesOldWards: ['Xuân Hà', 'Chính Gián', 'Thạc Gián', 'Thanh Khê Tây', 'Thanh Khê Đông'] },
    { name: 'An Khê', type: 'phuong', aliasesOldDistrict: ['Thanh Khê', 'Cẩm Lệ'], aliasesOldWards: ['Hòa An', 'Hòa Phát', 'An Khê'] },
    { name: 'An Hải', type: 'phuong', aliasesOldDistrict: ['Sơn Trà', 'Q. Sơn Trà'], aliasesOldWards: ['Phước Mỹ', 'An Hải Bắc', 'An Hải Nam'] },
    { name: 'Sơn Trà', type: 'phuong', aliasesOldDistrict: ['Sơn Trà', 'Q. Sơn Trà'], aliasesOldWards: ['Thọ Quang', 'Nại Hiên Đông', 'Mân Thái'], aliasesUser: ['bán đảo Sơn Trà', 'chùa Linh Ứng'] },
    { name: 'Ngũ Hành Sơn', type: 'phuong', aliasesOldDistrict: ['Ngũ Hành Sơn', 'Q. Ngũ Hành Sơn'], aliasesOldWards: ['Mỹ An', 'Khuê Mỹ', 'Hòa Hải', 'Hòa Quý'], aliasesUser: ['bãi biển Mỹ Khê', 'Marble Mountains'] },
    { name: 'Liên Chiểu', type: 'phuong', aliasesOldDistrict: ['Liên Chiểu', 'Q. Liên Chiểu'], aliasesOldWards: ['Hòa Khánh Bắc', 'Hòa Khánh Nam', 'Hòa Liên', 'Hòa Hiệp Bắc', 'Hòa Hiệp Nam', 'Hòa Minh'] },
    { name: 'Cẩm Lệ', type: 'phuong', aliasesOldDistrict: ['Cẩm Lệ', 'Q. Cẩm Lệ'], aliasesOldWards: ['Hòa Thọ Đông', 'Hòa Thọ Tây', 'Hòa Xuân', 'Khuê Trung'] },
    { name: 'Hòa Vang', type: 'xa', aliasesOldDistrict: ['Hòa Vang', 'Huyện Hòa Vang'], aliasesOldWards: ['Hòa Phước', 'Hòa Châu', 'Hòa Tiến', 'Hòa Phong'] },
    { name: 'Bà Nà', type: 'xa', aliasesOldDistrict: ['Hòa Vang'], aliasesOldWards: ['Hòa Ninh', 'Hòa Bắc'], aliasesUser: ['Bà Nà Hills', 'Sun World Bà Nà'] },

    // ── Old Quảng Nam — major destinations now in Đà Nẵng province ──
    { name: 'Tam Kỳ', type: 'phuong', aliasesOldDistrict: ['Tam Kỳ', 'TP Tam Kỳ'], aliasesOldWards: ['An Mỹ', 'An Phú', 'An Sơn', 'An Xuân', 'Hòa Hương', 'Hòa Thuận', 'Phước Hòa', 'Tân Thạnh'] },
    { name: 'Đại Lộc', type: 'xa', aliasesOldDistrict: ['Đại Lộc', 'Huyện Đại Lộc'], aliasesOldWards: ['Ái Nghĩa', 'Đại An', 'Đại Cường', 'Đại Hiệp', 'Đại Hồng', 'Đại Hưng'] },
    { name: 'Duy Xuyên', type: 'xa', aliasesOldDistrict: ['Duy Xuyên', 'Huyện Duy Xuyên'], aliasesOldWards: ['Nam Phước', 'Duy Phước', 'Duy Vinh', 'Duy Nghĩa', 'Duy Hải'], aliasesUser: ['Mỹ Sơn'] },
    { name: 'Núi Thành', type: 'xa', aliasesOldDistrict: ['Núi Thành', 'Huyện Núi Thành'], aliasesOldWards: ['Núi Thành', 'Tam Hải', 'Tam Anh Bắc', 'Tam Anh Nam', 'Tam Quang'] },
    { name: 'Tam Anh', type: 'xa', aliasesOldDistrict: ['Núi Thành'], aliasesOldWards: ['Tam Anh Bắc', 'Tam Anh Nam'] },
    { name: 'Tam Hải', type: 'xa', aliasesOldDistrict: ['Núi Thành'], aliasesOldWards: ['Tam Hải'] },
    { name: 'Tam Xuân', type: 'xa', aliasesOldDistrict: ['Núi Thành'], aliasesOldWards: ['Tam Xuân I', 'Tam Xuân II'] },
    { name: 'Thăng Bình', type: 'xa', aliasesOldDistrict: ['Thăng Bình', 'Huyện Thăng Bình'], aliasesOldWards: ['Hà Lam', 'Bình Nguyên', 'Bình Trị', 'Bình Định Bắc', 'Bình Định Nam'] },
    { name: 'Thăng An', type: 'xa', aliasesOldDistrict: ['Thăng Bình'], aliasesOldWards: ['Bình An', 'Bình Lãnh', 'Bình Phú'] },
    { name: 'Thăng Trường', type: 'xa', aliasesOldDistrict: ['Thăng Bình'], aliasesOldWards: ['Bình Trường', 'Bình Triều', 'Bình Đào'] },
    { name: 'Thăng Điền', type: 'xa', aliasesOldDistrict: ['Thăng Bình'], aliasesOldWards: ['Bình Quý', 'Bình Quế'] },
    { name: 'Quế Sơn', type: 'xa', aliasesOldDistrict: ['Quế Sơn', 'Huyện Quế Sơn'], aliasesOldWards: ['Hương An', 'Phú Thọ', 'Quế Châu', 'Quế Cường', 'Quế Hiệp', 'Quế Long'] },
    { name: 'Quế Sơn Trung', type: 'xa', aliasesOldDistrict: ['Quế Sơn'], aliasesOldWards: ['Quế Phong', 'Quế Phú'] },
    { name: 'Nông Sơn', type: 'xa', aliasesOldDistrict: ['Nông Sơn', 'Huyện Nông Sơn'], aliasesOldWards: ['Trung Phước', 'Quế Lâm', 'Quế Lộc', 'Quế Ninh', 'Quế Trung'], aliasesUser: ['làng Đại Bình'] },
    { name: 'Hiệp Đức', type: 'xa', aliasesOldDistrict: ['Hiệp Đức', 'Huyện Hiệp Đức'], aliasesOldWards: ['Tân An', 'Thăng Phước', 'Bình Sơn', 'Sông Trà', 'Phước Trà'] },
    { name: 'Phước Trà', type: 'xa', aliasesOldDistrict: ['Hiệp Đức'], aliasesOldWards: ['Phước Trà', 'Phước Gia'] },
    { name: 'Phước Hiệp', type: 'xa', aliasesOldDistrict: ['Hiệp Đức'], aliasesOldWards: ['Phước Hiệp'] },
    { name: 'Thượng Đức', type: 'xa', aliasesOldDistrict: ['Đại Lộc'], aliasesOldWards: ['Đại Lãnh', 'Đại Sơn', 'Đại Thắng'] },
    { name: 'Khâm Đức', type: 'xa', aliasesOldDistrict: ['Phước Sơn', 'Huyện Phước Sơn'], aliasesOldWards: ['Khâm Đức', 'Phước Năng', 'Phước Đức', 'Phước Mỹ'] },
    { name: 'Bến Hiên', type: 'xa', aliasesOldDistrict: ['Đông Giang', 'Huyện Đông Giang'], aliasesOldWards: ['P. Rẫy', 'Tà Lu', 'Sông Kôn', 'A Ting'] },
    { name: 'Bến Giằng', type: 'xa', aliasesOldDistrict: ['Nam Giang', 'Huyện Nam Giang'], aliasesOldWards: ['Thạnh Mỹ', 'Cà Dy', 'Tà Bhing'] },
    { name: 'Tây Giang', type: 'xa', aliasesOldDistrict: ['Tây Giang', 'Huyện Tây Giang'], aliasesOldWards: ['Lăng', 'Atiêng', 'Ga Ri'] },
    { name: 'Thạnh Mỹ', type: 'xa', aliasesOldDistrict: ['Nam Giang'], aliasesOldWards: ['Thạnh Mỹ'] },
    { name: 'Đông Giang', type: 'xa', aliasesOldDistrict: ['Đông Giang'], aliasesOldWards: ['Sông Vàng', 'Tư', 'Ba'] },
    { name: 'Bàn Thạch', type: 'xa', aliasesOldDistrict: ['Duy Xuyên'], aliasesOldWards: ['Duy Vinh', 'Duy Nghĩa', 'Duy Hải'] },
    { name: 'Thu Bồn', type: 'xa', aliasesOldDistrict: ['Duy Xuyên'], aliasesOldWards: ['Duy Châu', 'Duy Trinh', 'Duy Sơn'] },
    { name: 'Việt An', type: 'xa', aliasesOldDistrict: ['Hiệp Đức'], aliasesOldWards: ['Bình Lâm'] },
    { name: 'Hà Nha', type: 'xa', aliasesOldDistrict: ['Đại Lộc'], aliasesOldWards: ['Đại Tân', 'Đại Hồng'] },
    { name: 'Vu Gia', type: 'xa', aliasesOldDistrict: ['Đại Lộc'], aliasesOldWards: ['Đại Sơn', 'Đại Hồng', 'Đại Lãnh'] },
    { name: 'Điện Bàn Bắc', type: 'xa', aliasesOldDistrict: ['Điện Bàn', 'TX Điện Bàn'], aliasesOldWards: ['Vĩnh Điện', 'Điện An', 'Điện Thắng Bắc'] },
    { name: 'Quảng Phú', type: 'xa', aliasesOldDistrict: ['Quế Sơn'], aliasesOldWards: ['Quế Xuân', 'Quế Phú'] },
    { name: 'Phú Thuận', type: 'xa', aliasesOldDistrict: ['Phú Ninh', 'Huyện Phú Ninh'], aliasesOldWards: ['Tam An', 'Tam Đàn'] },
    { name: 'Phú Ninh', type: 'xa', aliasesOldDistrict: ['Phú Ninh'], aliasesOldWards: ['Tam Lộc', 'Tam Phước', 'Tam Vinh'] },
    { name: 'Phú Long', type: 'xa', aliasesOldDistrict: ['Phú Ninh'], aliasesOldWards: ['Tam Dân'] },
    { name: 'Chiên Đàn', type: 'xa', aliasesOldDistrict: ['Phú Ninh'], aliasesOldWards: ['Tam Đại'] },
    { name: 'Sâm Linh Đông', type: 'xa', aliasesOldDistrict: ['Núi Thành'], aliasesOldWards: ['Tam Mỹ Đông'] },
    { name: 'Phạm Văn Đồng', type: 'xa', aliasesOldDistrict: ['Núi Thành'], aliasesOldWards: ['Tam Tiến'] },
    { name: 'An Hải Tây', type: 'xa', aliasesOldDistrict: ['Quảng Nam'], aliasesOldWards: ['Tam Hiệp', 'An Hải'] },
    { name: 'Đông Tuần', type: 'xa', aliasesOldDistrict: ['Núi Thành'], aliasesOldWards: ['Tam Hải'] },
    { name: 'Trang Điền', type: 'xa', aliasesOldDistrict: ['Nam Giang'], aliasesOldWards: ['Đắc Pre', 'Đắc Pring'] },
    { name: 'Hoàng Sa', type: 'dac_khu', aliasesOldDistrict: ['Hoàng Sa', 'Huyện Hoàng Sa'], aliasesUser: ['quần đảo Hoàng Sa', 'Paracel Islands'] },
  ],
};

export default seed;
