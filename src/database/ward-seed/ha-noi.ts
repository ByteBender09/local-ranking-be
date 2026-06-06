import type { DestinationSeed } from './types';

// Hà Nội after July 2025: kept its provincial-city status but reorganized
// from 30 districts × ~500 wards down to 126 commune-level units (51 phường +
// 75 xã). Reference: Nghị quyết 1656/NQ-UBTVQH15 (June 2025).
//
// Tourists mostly hit the inner-city wards in Hoàn Kiếm, Ba Đình, Tây Hồ,
// Đống Đa, Hai Bà Trưng, Cầu Giấy, Long Biên, Hà Đông. The old commune
// names of Mỹ Đức / Hương Sơn (Perfume Pagoda area) and the rural wards
// with current venue counts are also included.
const seed: DestinationSeed = {
  citySlug: 'ha-noi',
  wards: [
    // ── Old Hoàn Kiếm ───────────────────────────────────────────────
    {
      name: 'Hoàn Kiếm',
      type: 'phuong',
      aliasesOldDistrict: ['Hoàn Kiếm', 'Q. Hoàn Kiếm', 'Quận Hoàn Kiếm'],
      aliasesOldWards: [
        'Hàng Bạc', 'Hàng Bồ', 'Hàng Buồm', 'Hàng Đào', 'Hàng Gai',
        'Hàng Mã', 'Lý Thái Tổ', 'Cửa Đông', 'Đồng Xuân', 'Hàng Bông', 'Hàng Trống',
      ],
      aliasesUser: ['phố cổ', 'Old Quarter', 'phố cổ Hà Nội', 'Hồ Gươm'],
    },
    {
      name: 'Cửa Nam',
      type: 'phuong',
      aliasesOldDistrict: ['Hoàn Kiếm', 'Hai Bà Trưng'],
      aliasesOldWards: ['Hàng Bài', 'Phan Chu Trinh', 'Trần Hưng Đạo', 'Tràng Tiền', 'Nguyễn Du', 'Phạm Đình Hổ'],
    },
    {
      name: 'Hồng Hà',
      type: 'phuong',
      aliasesOldDistrict: ['Hoàn Kiếm', 'Ba Đình', 'Tây Hồ', 'Long Biên'],
      aliasesOldWards: ['Chương Dương', 'Phúc Tân', 'Phúc Xá', 'Nhật Tân', 'Quảng An', 'Tứ Liên', 'Yên Phụ', 'Bồ Đề', 'Ngọc Thụy'],
    },

    // ── Old Ba Đình ─────────────────────────────────────────────────
    {
      name: 'Ba Đình',
      type: 'phuong',
      aliasesOldDistrict: ['Ba Đình', 'Q. Ba Đình', 'Quận Ba Đình'],
      aliasesOldWards: ['Quán Thánh', 'Trúc Bạch', 'Điện Biên', 'Đội Cấn', 'Kim Mã', 'Ngọc Hà', 'Thụy Khuê'],
      aliasesUser: ['Lăng Bác', 'Hoàng thành Thăng Long'],
    },
    {
      name: 'Ngọc Hà',
      type: 'phuong',
      aliasesOldDistrict: ['Ba Đình'],
      aliasesOldWards: ['Vĩnh Phúc', 'Liễu Giai', 'Cống Vị', 'Ngọc Khánh', 'Nghĩa Đô'],
    },
    {
      name: 'Giảng Võ',
      type: 'phuong',
      aliasesOldDistrict: ['Ba Đình', 'Đống Đa'],
      aliasesOldWards: ['Giảng Võ', 'Cát Linh', 'Láng Hạ', 'Ngọc Khánh', 'Thành Công'],
    },

    // ── Old Hai Bà Trưng ────────────────────────────────────────────
    {
      name: 'Hai Bà Trưng',
      type: 'phuong',
      aliasesOldDistrict: ['Hai Bà Trưng', 'Q. Hai Bà Trưng'],
      aliasesOldWards: ['Đồng Nhân', 'Phố Huế', 'Bạch Đằng', 'Lê Đại Hành', 'Nguyễn Du', 'Thanh Nhàn', 'Phạm Đình Hổ'],
    },
    {
      name: 'Vĩnh Tuy',
      type: 'phuong',
      aliasesOldDistrict: ['Hai Bà Trưng'],
      aliasesOldWards: ['Mai Động', 'Thanh Lương', 'Vĩnh Hưng', 'Vĩnh Tuy'],
    },
    {
      name: 'Bạch Mai',
      type: 'phuong',
      aliasesOldDistrict: ['Hai Bà Trưng'],
      aliasesOldWards: ['Bạch Mai', 'Bách Khoa', 'Quỳnh Mai', 'Minh Khai', 'Đồng Tâm', 'Trương Định'],
    },

    // ── Old Đống Đa ─────────────────────────────────────────────────
    {
      name: 'Đống Đa',
      type: 'phuong',
      aliasesOldDistrict: ['Đống Đa', 'Q. Đống Đa'],
      aliasesOldWards: ['Thịnh Quang', 'Quang Trung', 'Láng Hạ', 'Nam Đồng', 'Ô Chợ Dừa', 'Trung Liệt'],
    },
    {
      name: 'Kim Liên',
      type: 'phuong',
      aliasesOldDistrict: ['Đống Đa'],
      aliasesOldWards: ['Kim Liên', 'Khương Thượng', 'Phương Liên', 'Phương Mai', 'Trung Tự'],
    },
    {
      name: 'Văn Miếu - Quốc Tử Giám',
      type: 'phuong',
      aliasesOldDistrict: ['Đống Đa'],
      aliasesOldWards: ['Khâm Thiên', 'Thổ Quan', 'Văn Chương', 'Văn Miếu', 'Quốc Tử Giám'],
      aliasesUser: ['Văn Miếu', 'Quốc Tử Giám'],
    },
    {
      name: 'Láng',
      type: 'phuong',
      aliasesOldDistrict: ['Đống Đa'],
      aliasesOldWards: ['Láng Thượng', 'Láng Hạ', 'Ngọc Khánh'],
    },
    {
      name: 'Ô Chợ Dừa',
      type: 'phuong',
      aliasesOldDistrict: ['Đống Đa'],
      aliasesOldWards: ['Ô Chợ Dừa', 'Cát Linh', 'Điện Biên', 'Thành Công', 'Trung Liệt'],
    },

    // ── Old Hoàng Mai ───────────────────────────────────────────────
    {
      name: 'Hoàng Mai',
      type: 'phuong',
      aliasesOldDistrict: ['Hoàng Mai'],
      aliasesOldWards: ['Giáp Bát', 'Hoàng Liệt', 'Hoàng Văn Thụ', 'Tân Mai', 'Thịnh Liệt', 'Tương Mai'],
    },
    { name: 'Lĩnh Nam', type: 'phuong', aliasesOldDistrict: ['Hoàng Mai'], aliasesOldWards: ['Lĩnh Nam', 'Thanh Trì', 'Trần Phú', 'Yên Sở'] },
    { name: 'Tương Mai', type: 'phuong', aliasesOldDistrict: ['Hoàng Mai'], aliasesOldWards: ['Tương Mai', 'Phương Liệt', 'Trương Định'] },
    { name: 'Vĩnh Hưng', type: 'phuong', aliasesOldDistrict: ['Hoàng Mai'], aliasesOldWards: ['Vĩnh Hưng'] },
    { name: 'Định Công', type: 'phuong', aliasesOldDistrict: ['Hoàng Mai'], aliasesOldWards: ['Định Công', 'Thanh Liệt', 'Tân Triều', 'Đại Kim'] },
    { name: 'Hoàng Liệt', type: 'phuong', aliasesOldDistrict: ['Hoàng Mai'], aliasesOldWards: ['Hoàng Liệt', 'Văn Điển'] },
    { name: 'Yên Sở', type: 'phuong', aliasesOldDistrict: ['Hoàng Mai'], aliasesOldWards: ['Yên Sở', 'Tứ Hiệp'] },

    // ── Old Thanh Xuân ──────────────────────────────────────────────
    {
      name: 'Thanh Xuân',
      type: 'phuong',
      aliasesOldDistrict: ['Thanh Xuân', 'Q. Thanh Xuân'],
      aliasesOldWards: ['Nhân Chính', 'Thanh Xuân Bắc', 'Thanh Xuân Trung', 'Thượng Đình', 'Trung Hoà', 'Trung Văn'],
    },
    { name: 'Khương Đình', type: 'phuong', aliasesOldDistrict: ['Thanh Xuân'], aliasesOldWards: ['Hạ Đình', 'Khương Đình', 'Khương Trung'] },
    { name: 'Phương Liệt', type: 'phuong', aliasesOldDistrict: ['Thanh Xuân'], aliasesOldWards: ['Khương Mai', 'Phương Liệt'] },

    // ── Old Cầu Giấy ────────────────────────────────────────────────
    {
      name: 'Cầu Giấy',
      type: 'phuong',
      aliasesOldDistrict: ['Cầu Giấy', 'Q. Cầu Giấy'],
      aliasesOldWards: ['Dịch Vọng', 'Dịch Vọng Hậu', 'Quan Hoa', 'Mỹ Đình', 'Yên Hòa'],
    },
    { name: 'Nghĩa Đô', type: 'phuong', aliasesOldDistrict: ['Cầu Giấy'], aliasesOldWards: ['Nghĩa Tân', 'Cổ Nhuế', 'Mai Dịch', 'Nghĩa Đô'] },
    { name: 'Yên Hòa', type: 'phuong', aliasesOldDistrict: ['Cầu Giấy'], aliasesOldWards: ['Mễ Trì', 'Trung Hòa', 'Yên Hòa'] },

    // ── Old Tây Hồ ──────────────────────────────────────────────────
    {
      name: 'Tây Hồ',
      type: 'phuong',
      aliasesOldDistrict: ['Tây Hồ', 'Q. Tây Hồ'],
      aliasesOldWards: ['Bưởi', 'Phú Thượng', 'Xuân La', 'Nhật Tân', 'Quảng An', 'Tứ Liên', 'Yên Phụ', 'Thụy Khuê'],
      aliasesUser: ['Hồ Tây', 'West Lake'],
    },
    { name: 'Phú Thượng', type: 'phuong', aliasesOldDistrict: ['Tây Hồ'], aliasesOldWards: ['Đông Ngạc', 'Xuân Đỉnh', 'Xuân Tảo', 'Phú Thượng'] },

    // ── Old Bắc Từ Liêm + Nam Từ Liêm ───────────────────────────────
    { name: 'Tây Tựu', type: 'phuong', aliasesOldDistrict: ['Bắc Từ Liêm'], aliasesOldWards: ['Minh Khai', 'Tây Tựu', 'Kim Chung'] },
    { name: 'Phú Diễn', type: 'phuong', aliasesOldDistrict: ['Bắc Từ Liêm'], aliasesOldWards: ['Phú Diễn', 'Mai Dịch', 'Phúc Diễn'] },
    { name: 'Xuân Đỉnh', type: 'phuong', aliasesOldDistrict: ['Bắc Từ Liêm'], aliasesOldWards: ['Xuân Đỉnh', 'Cổ Nhuế', 'Xuân La', 'Xuân Tảo'] },
    { name: 'Đông Ngạc', type: 'phuong', aliasesOldDistrict: ['Bắc Từ Liêm'], aliasesOldWards: ['Đông Ngạc', 'Đức Thắng', 'Thụy Phương'] },
    { name: 'Thượng Cát', type: 'phuong', aliasesOldDistrict: ['Bắc Từ Liêm'], aliasesOldWards: ['Liên Mạc', 'Thượng Cát'] },
    { name: 'Từ Liêm', type: 'phuong', aliasesOldDistrict: ['Nam Từ Liêm'], aliasesOldWards: ['Cầu Diễn', 'Mỹ Đình', 'Mễ Trì'] },
    { name: 'Xuân Phương', type: 'phuong', aliasesOldDistrict: ['Nam Từ Liêm'], aliasesOldWards: ['Phương Canh', 'Xuân Phương', 'Đại Mỗ', 'Tây Mỗ'] },
    { name: 'Tây Mỗ', type: 'phuong', aliasesOldDistrict: ['Nam Từ Liêm'], aliasesOldWards: ['Tây Mỗ', 'Dương Nội'] },
    { name: 'Đại Mỗ', type: 'phuong', aliasesOldDistrict: ['Nam Từ Liêm'], aliasesOldWards: ['Đại Mỗ', 'Mộ Lao', 'Mễ Trì', 'Trung Hòa', 'Phú Đô'] },

    // ── Old Long Biên ───────────────────────────────────────────────
    { name: 'Long Biên', type: 'phuong', aliasesOldDistrict: ['Long Biên', 'Q. Long Biên'], aliasesOldWards: ['Cự Khối', 'Phúc Đồng', 'Thạch Bàn', 'Bát Tràng'] },
    { name: 'Bồ Đề', type: 'phuong', aliasesOldDistrict: ['Long Biên'], aliasesOldWards: ['Ngọc Lâm', 'Đức Giang', 'Gia Thụy', 'Thượng Thanh', 'Ngọc Thụy', 'Bồ Đề', 'Long Biên'] },
    { name: 'Việt Hưng', type: 'phuong', aliasesOldDistrict: ['Long Biên'], aliasesOldWards: ['Giang Biên', 'Việt Hưng', 'Phúc Lợi', 'Phúc Đồng'] },
    { name: 'Phúc Lợi', type: 'phuong', aliasesOldDistrict: ['Long Biên'], aliasesOldWards: ['Phúc Lợi', 'Cổ Bi'] },

    // ── Old Hà Đông ─────────────────────────────────────────────────
    { name: 'Hà Đông', type: 'phuong', aliasesOldDistrict: ['Hà Đông', 'Q. Hà Đông'], aliasesOldWards: ['Phúc La', 'Vạn Phúc', 'Quang Trung', 'Hà Cầu', 'La Khê', 'Văn Quán', 'Mộ Lao'] },
    { name: 'Dương Nội', type: 'phuong', aliasesOldDistrict: ['Hà Đông'], aliasesOldWards: ['Dương Nội', 'Phú La', 'Yên Nghĩa', 'La Phù'] },
    { name: 'Yên Nghĩa', type: 'phuong', aliasesOldDistrict: ['Hà Đông'], aliasesOldWards: ['Đồng Mai', 'Yên Nghĩa'] },
    { name: 'Phú Lương', type: 'phuong', aliasesOldDistrict: ['Hà Đông'], aliasesOldWards: ['Phú Lãm', 'Kiến Hưng', 'Phú Lương'] },
    { name: 'Kiến Hưng', type: 'phuong', aliasesOldDistrict: ['Hà Đông'], aliasesOldWards: ['Kiến Hưng', 'Phú Lương', 'Quang Trung'] },

    // ── Hương Sơn / Mỹ Đức (Perfume Pagoda area) ────────────────────
    {
      name: 'Hương Sơn',
      type: 'xa',
      aliasesOldDistrict: ['Mỹ Đức', 'Huyện Mỹ Đức'],
      aliasesOldWards: ['An Tiến', 'Hùng Tiến', 'Vạn Tín', 'Hương Sơn'],
      aliasesUser: ['Chùa Hương', 'Perfume Pagoda'],
    },
    { name: 'Mỹ Đức', type: 'xa', aliasesOldDistrict: ['Mỹ Đức', 'Huyện Mỹ Đức'], aliasesOldWards: ['Đại Nghĩa', 'An Phú', 'Đại Hưng', 'Hợp Thanh', 'Phù Lưu Tế'] },
    { name: 'Hồng Sơn', type: 'xa', aliasesOldDistrict: ['Mỹ Đức', 'Huyện Mỹ Đức'], aliasesOldWards: ['Phùng Xá', 'An Mỹ', 'Hợp Tiến', 'Lê Thanh', 'Xuy Xá', 'Hồng Sơn'] },
    { name: 'Phúc Sơn', type: 'xa', aliasesOldDistrict: ['Mỹ Đức', 'Huyện Mỹ Đức'], aliasesOldWards: ['Mỹ Xuyên', 'Phúc Lâm', 'Thượng Lâm', 'Tuy Lai', 'Đồng Tâm'] },

    // ── Hòa Xá / Ứng Hòa (Vân Đình area) ────────────────────────────
    { name: 'Hòa Xá', type: 'xa', aliasesOldDistrict: ['Ứng Hòa', 'Huyện Ứng Hòa'], aliasesOldWards: ['Hòa Phú', 'Thái Hòa', 'Bình Lưu Quang', 'Phù Lưu', 'Hòa Xá'] },
    { name: 'Ứng Hòa', type: 'xa', aliasesOldDistrict: ['Ứng Hòa', 'Huyện Ứng Hòa'], aliasesOldWards: ['Đại Cường', 'Đại Hùng', 'Đông Lỗ', 'Đồng Tân', 'Kim Đường', 'Minh Đức', 'Trầm Lộng', 'Trung Tú'] },
    { name: 'Ứng Thiên', type: 'xa', aliasesOldDistrict: ['Ứng Hòa'], aliasesOldWards: ['Hoa Viên', 'Liên Bạt', 'Quảng Phú Cầu', 'Trường Thịnh'] },
    { name: 'Vân Đình', type: 'xa', aliasesOldDistrict: ['Ứng Hòa'], aliasesOldWards: ['Vân Đình', 'Cao Sơn Tiến', 'Phương Tú', 'Tảo Dương Văn'] },

    // ── Other communes seen in data ─────────────────────────────────
    { name: 'Sóc Sơn', type: 'xa', aliasesOldDistrict: ['Sóc Sơn', 'Huyện Sóc Sơn'], aliasesOldWards: ['Sóc Sơn', 'Tân Minh', 'Đông Xuân', 'Phù Lỗ', 'Phù Linh', 'Tiên Dược'] },
    { name: 'Nội Bài', type: 'xa', aliasesOldDistrict: ['Sóc Sơn'], aliasesOldWards: ['Phú Cường', 'Hiền Ninh', 'Thanh Xuân', 'Mai Đình', 'Phú Minh', 'Quang Tiến'], aliasesUser: ['sân bay Nội Bài', 'Noi Bai airport'] },
    { name: 'Đa Phúc', type: 'xa', aliasesOldDistrict: ['Sóc Sơn'], aliasesOldWards: ['Bắc Phú', 'Đức Hoà', 'Kim Lũ', 'Tân Hưng', 'Việt Long', 'Xuân Giang', 'Xuân Thu'] },
    { name: 'Trung Giã', type: 'xa', aliasesOldDistrict: ['Sóc Sơn'], aliasesOldWards: ['Bắc Sơn', 'Hồng Kỳ', 'Nam Sơn', 'Trung Giã'] },
    { name: 'Kim Anh', type: 'xa', aliasesOldDistrict: ['Sóc Sơn'], aliasesOldWards: ['Tân Dân', 'Minh Phú', 'Minh Trí', 'Kim Anh'] },
    { name: 'Phú Cát', type: 'xa', aliasesOldDistrict: ['Quốc Oai', 'Huyện Quốc Oai'], aliasesOldWards: ['Đông Yên', 'Hoà Thạch', 'Phú Mãn', 'Phú Cát'] },
    { name: 'Yên Bài', type: 'xa', aliasesOldDistrict: ['Ba Vì', 'Huyện Ba Vì'], aliasesOldWards: ['Vân Hòa', 'Yên Bài', 'Thạch Hòa'] },
    { name: 'Yên Xuân', type: 'xa', aliasesOldDistrict: ['Thạch Thất', 'Huyện Thạch Thất'], aliasesOldWards: ['Đông Xuân', 'Yên Bình', 'Yên Trung', 'Tiến Xuân', 'Thạch Hòa'] },
    { name: 'Hòa Lạc', type: 'xa', aliasesOldDistrict: ['Thạch Thất'], aliasesOldWards: ['Tiến Xuân', 'Thạch Hòa', 'Cổ Đông', 'Bình Yên', 'Hạ Bằng', 'Tân Xã'] },
    { name: 'Bát Tràng', type: 'xa', aliasesOldDistrict: ['Gia Lâm', 'Huyện Gia Lâm'], aliasesOldWards: ['Kim Đức', 'Cự Khối', 'Thạch Bàn', 'Trâu Quỳ', 'Đa Tốn', 'Bát Tràng'], aliasesUser: ['làng gốm Bát Tràng'] },
    { name: 'Gia Lâm', type: 'xa', aliasesOldDistrict: ['Gia Lâm'], aliasesOldWards: ['Dương Xá', 'Kiêu Kỵ', 'Trâu Quỳ', 'Phú Sơn', 'Cổ Bi', 'Đa Tốn'] },
    { name: 'Phú Xuyên', type: 'xa', aliasesOldDistrict: ['Phú Xuyên', 'Huyện Phú Xuyên'], aliasesOldWards: ['Phú Minh', 'Phú Xuyên', 'Hồng Thái', 'Minh Cường', 'Nam Phong', 'Nam Tiến', 'Quang Hà', 'Văn Tự'] },
    { name: 'Phượng Dực', type: 'xa', aliasesOldDistrict: ['Phú Xuyên'], aliasesOldWards: ['Hoàng Long', 'Hồng Minh', 'Phú Túc', 'Văn Hoàng', 'Phượng Dực'] },
    { name: 'Đông Anh', type: 'xa', aliasesOldDistrict: ['Đông Anh', 'Huyện Đông Anh'], aliasesOldWards: ['Cổ Loa', 'Đông Hội', 'Mai Lâm', 'Đông Anh', 'Tàm Xá', 'Tiên Dương', 'Vĩnh Ngọc', 'Xuân Canh'] },
    { name: 'Phù Đổng', type: 'xa', aliasesOldDistrict: ['Gia Lâm'], aliasesOldWards: ['Yên Viên', 'Ninh Hiệp', 'Phù Đổng', 'Thiên Đức', 'Yên Thường'] },
    { name: 'Sơn Tây', type: 'phuong', aliasesOldDistrict: ['Sơn Tây', 'Thị xã Sơn Tây'], aliasesOldWards: ['Ngô Quyền', 'Phú Thịnh', 'Viên Sơn', 'Đường Lâm', 'Trung Hưng', 'Sơn Lộc', 'Thanh Mỹ'], aliasesUser: ['làng cổ Đường Lâm'] },
  ],
};

export default seed;
