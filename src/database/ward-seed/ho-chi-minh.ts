import type { DestinationSeed } from './types';

// HCM after the July 2025 reform: HCM proper + Bình Dương + Bà Rịa-Vũng Tàu
// merged into one centrally-governed city with 168 commune-level units
// (113 phường + 54 xã + 1 đặc khu Côn Đảo).
//
// Seed scope here = HCM PROPER ONLY — the central + suburban wards that used
// to be the old HCM city. Côn Đảo, Cần Giờ, Long Hải, Phước Hải, the old
// BR-VT area, and the old Bình Dương communes are seeded under their tourism
// destinations (vung-tau.ts) where current venues are tagged. That keeps
// each tourism slug's wards in one file even when admin geography no longer
// agrees.
//
// Aliases capture (1) the pre-2025 quận numbers users still say, and
// (2) the pre-2025 phường names Apify scrapes from before July 2025 still
// include in raw address strings. Cross-reference: Nghị quyết 1685/NQ-UBTVQH15
// and https://xaydungchinhsach.chinhphu.vn/sap-xep-dvhc-danh-sach-168-xa-phuong-dac-khu-cua-thanh-pho-ho-chi-minh-119250623085031865.htm
const seed: DestinationSeed = {
  citySlug: 'ho-chi-minh',
  wards: [
    // ── Old District 1 ──────────────────────────────────────────────
    {
      name: 'Sài Gòn',
      type: 'phuong',
      aliasesOldDistrict: ['Quận 1', 'Q.1', 'Q1', 'District 1'],
      aliasesOldWards: ['Bến Nghé', 'Đa Kao', 'Nguyễn Thái Bình'],
      aliasesUser: ['trung tâm Sài Gòn', 'downtown Saigon'],
    },
    {
      name: 'Tân Định',
      type: 'phuong',
      aliasesOldDistrict: ['Quận 1', 'Q.1'],
      aliasesOldWards: ['Tân Định'],
    },
    {
      name: 'Bến Thành',
      type: 'phuong',
      aliasesOldDistrict: ['Quận 1', 'Q.1'],
      aliasesOldWards: ['Bến Thành', 'Phạm Ngũ Lão', 'Cầu Ông Lãnh', 'Nguyễn Thái Bình'],
      aliasesUser: ['chợ Bến Thành', 'Bùi Viện', 'phố Tây'],
    },
    {
      name: 'Cầu Ông Lãnh',
      type: 'phuong',
      aliasesOldDistrict: ['Quận 1', 'Q.1'],
      aliasesOldWards: ['Nguyễn Cư Trinh', 'Cầu Kho', 'Cô Giang', 'Cầu Ông Lãnh'],
    },

    // ── Old District 3 ──────────────────────────────────────────────
    {
      name: 'Bàn Cờ',
      type: 'phuong',
      aliasesOldDistrict: ['Quận 3', 'Q.3', 'Q3', 'District 3'],
      aliasesOldWards: ['Phường 1', 'Phường 2', 'Phường 3', 'Phường 4', 'Phường 5'],
    },
    {
      name: 'Xuân Hòa',
      type: 'phuong',
      aliasesOldDistrict: ['Quận 3', 'Q.3'],
      aliasesOldWards: ['Phường 6', 'Phường 8', 'Phường 9', 'Võ Thị Sáu'],
    },
    {
      name: 'Nhiêu Lộc',
      type: 'phuong',
      aliasesOldDistrict: ['Quận 3', 'Q.3'],
      aliasesOldWards: ['Phường 10', 'Phường 11', 'Phường 12', 'Phường 13', 'Phường 14'],
    },

    // ── Old District 4 ──────────────────────────────────────────────
    {
      name: 'Vĩnh Hội',
      type: 'phuong',
      aliasesOldDistrict: ['Quận 4', 'Q.4', 'Q4', 'District 4'],
      aliasesOldWards: ['Phường 1', 'Phường 2', 'Phường 3'],
    },
    {
      name: 'Khánh Hội',
      type: 'phuong',
      aliasesOldDistrict: ['Quận 4', 'Q.4'],
      aliasesOldWards: ['Phường 4', 'Phường 6', 'Phường 8', 'Phường 9', 'Phường 13', 'Phường 14', 'Phường 15', 'Phường 16', 'Phường 18'],
    },
    {
      name: 'Xóm Chiếu',
      type: 'phuong',
      aliasesOldDistrict: ['Quận 4', 'Q.4'],
      aliasesOldWards: ['Phường 10', 'Phường 12'],
    },

    // ── Old District 5 ──────────────────────────────────────────────
    {
      name: 'Chợ Quán',
      type: 'phuong',
      aliasesOldDistrict: ['Quận 5', 'Q.5', 'Q5', 'District 5'],
      aliasesOldWards: ['Phường 1', 'Phường 2', 'Phường 4'],
    },
    {
      name: 'An Đông',
      type: 'phuong',
      aliasesOldDistrict: ['Quận 5', 'Q.5'],
      aliasesOldWards: ['Phường 5', 'Phường 7', 'Phường 9'],
    },
    {
      name: 'Chợ Lớn',
      type: 'phuong',
      aliasesOldDistrict: ['Quận 5', 'Q.5'],
      aliasesOldWards: ['Phường 10', 'Phường 11', 'Phường 12', 'Phường 13', 'Phường 14'],
      aliasesUser: ['Chợ Lớn', 'Chinatown'],
    },

    // ── Old District 6 ──────────────────────────────────────────────
    {
      name: 'Bình Tiên',
      type: 'phuong',
      aliasesOldDistrict: ['Quận 6', 'Q.6', 'Q6'],
      aliasesOldWards: ['Phường 1', 'Phường 2', 'Phường 3', 'Phường 4'],
    },
    {
      name: 'Bình Tây',
      type: 'phuong',
      aliasesOldDistrict: ['Quận 6', 'Q.6'],
      aliasesOldWards: ['Phường 5', 'Phường 7', 'Phường 8', 'Phường 9', 'Phường 10'],
    },
    {
      name: 'Bình Phú',
      type: 'phuong',
      aliasesOldDistrict: ['Quận 6', 'Q.6'],
      aliasesOldWards: ['Phường 11', 'Phường 12', 'Phường 13', 'Phường 14'],
    },

    // ── Old District 7 ──────────────────────────────────────────────
    {
      name: 'Tân Mỹ',
      type: 'phuong',
      aliasesOldDistrict: ['Quận 7', 'Q.7', 'Q7'],
      aliasesOldWards: ['Tân Phong', 'Tân Phú', 'Tân Quy'],
    },
    {
      name: 'Tân Hưng',
      type: 'phuong',
      aliasesOldDistrict: ['Quận 7', 'Q.7'],
      aliasesOldWards: ['Tân Hưng', 'Tân Kiểng'],
    },
    {
      name: 'Tân Thuận',
      type: 'phuong',
      aliasesOldDistrict: ['Quận 7', 'Q.7'],
      aliasesOldWards: ['Tân Thuận Đông', 'Tân Thuận Tây', 'Bình Thuận'],
    },
    {
      name: 'Phú Thuận',
      type: 'phuong',
      aliasesOldDistrict: ['Quận 7', 'Q.7'],
      aliasesOldWards: ['Phú Mỹ', 'Phú Thuận'],
    },

    // ── Old District 8 ──────────────────────────────────────────────
    {
      name: 'Chánh Hưng',
      type: 'phuong',
      aliasesOldDistrict: ['Quận 8', 'Q.8'],
      aliasesOldWards: ['Phường 1', 'Phường 2', 'Phường 3', 'Phường 4', 'Phường 5'],
    },
    {
      name: 'Bình Đông',
      type: 'phuong',
      aliasesOldDistrict: ['Quận 8', 'Q.8'],
      aliasesOldWards: ['Phường 6', 'Phường 7', 'Phường 8', 'Phường 9', 'Phường 10', 'Phường 11', 'Phường 12', 'Phường 13'],
    },
    {
      name: 'Phú Định',
      type: 'phuong',
      aliasesOldDistrict: ['Quận 8', 'Q.8'],
      aliasesOldWards: ['Phường 14', 'Phường 15', 'Phường 16'],
    },

    // ── Old District 10 ─────────────────────────────────────────────
    {
      name: 'Vườn Lài',
      type: 'phuong',
      aliasesOldDistrict: ['Quận 10', 'Q.10'],
      aliasesOldWards: ['Phường 1', 'Phường 2', 'Phường 4'],
    },
    {
      name: 'Diên Hồng',
      type: 'phuong',
      aliasesOldDistrict: ['Quận 10', 'Q.10'],
      aliasesOldWards: ['Phường 8', 'Phường 9', 'Phường 10'],
    },
    {
      name: 'Hòa Hưng',
      type: 'phuong',
      aliasesOldDistrict: ['Quận 10', 'Q.10'],
      aliasesOldWards: ['Phường 12', 'Phường 13', 'Phường 14', 'Phường 15'],
    },

    // ── Old District 11 ─────────────────────────────────────────────
    {
      name: 'Hòa Bình',
      type: 'phuong',
      aliasesOldDistrict: ['Quận 11', 'Q.11'],
      aliasesOldWards: ['Phường 1', 'Phường 2', 'Phường 3', 'Phường 4', 'Phường 5'],
    },
    {
      name: 'Phú Thọ',
      type: 'phuong',
      aliasesOldDistrict: ['Quận 11', 'Q.11'],
      aliasesOldWards: ['Phường 6', 'Phường 7', 'Phường 8', 'Phường 9', 'Phường 10', 'Phường 11'],
    },
    {
      name: 'Bình Thới',
      type: 'phuong',
      aliasesOldDistrict: ['Quận 11', 'Q.11'],
      aliasesOldWards: ['Phường 12', 'Phường 13', 'Phường 14', 'Phường 15', 'Phường 16'],
    },
    {
      name: 'Minh Phụng',
      type: 'phuong',
      aliasesOldDistrict: ['Quận 11', 'Q.11'],
      aliasesOldWards: ['Bình Thới', 'Phường 11'],
    },

    // ── Old District 12 ─────────────────────────────────────────────
    {
      name: 'Đông Hưng Thuận',
      type: 'phuong',
      aliasesOldDistrict: ['Quận 12', 'Q.12'],
      aliasesOldWards: ['Đông Hưng Thuận', 'Tân Hưng Thuận', 'Trung Mỹ Tây'],
    },
    {
      name: 'Trung Mỹ Tây',
      type: 'phuong',
      aliasesOldDistrict: ['Quận 12', 'Q.12'],
      aliasesOldWards: ['Trung Mỹ Tây', 'Tân Chánh Hiệp'],
    },
    {
      name: 'Tân Thới Hiệp',
      type: 'phuong',
      aliasesOldDistrict: ['Quận 12', 'Q.12'],
      aliasesOldWards: ['Tân Thới Hiệp', 'Hiệp Thành'],
    },
    {
      name: 'Thới An',
      type: 'phuong',
      aliasesOldDistrict: ['Quận 12', 'Q.12'],
      aliasesOldWards: ['Thới An', 'Thạnh Lộc', 'Thạnh Xuân'],
    },
    {
      name: 'An Phú Đông',
      type: 'phuong',
      aliasesOldDistrict: ['Quận 12', 'Q.12'],
      aliasesOldWards: ['An Phú Đông'],
    },

    // ── Old Bình Thạnh ──────────────────────────────────────────────
    {
      name: 'Bình Thạnh',
      type: 'phuong',
      aliasesOldDistrict: ['Quận Bình Thạnh', 'Bình Thạnh', 'Q. Bình Thạnh'],
      aliasesOldWards: ['Phường 1', 'Phường 2', 'Phường 3', 'Phường 14', 'Phường 15'],
    },
    {
      name: 'Gia Định',
      type: 'phuong',
      aliasesOldDistrict: ['Quận Bình Thạnh', 'Bình Thạnh'],
      aliasesOldWards: ['Phường 5', 'Phường 6', 'Phường 7'],
      aliasesUser: ['Gia Định cũ'],
    },
    {
      name: 'Thạnh Mỹ Tây',
      type: 'phuong',
      aliasesOldDistrict: ['Quận Bình Thạnh', 'Bình Thạnh'],
      aliasesOldWards: ['Phường 19', 'Phường 22', 'Phường 25'],
    },
    {
      name: 'Bình Lợi Trung',
      type: 'phuong',
      aliasesOldDistrict: ['Quận Bình Thạnh', 'Bình Thạnh'],
      aliasesOldWards: ['Phường 11', 'Phường 12', 'Phường 13', 'Phường 17'],
    },
    {
      name: 'Bình Quới',
      type: 'phuong',
      aliasesOldDistrict: ['Quận Bình Thạnh', 'Bình Thạnh'],
      aliasesOldWards: ['Phường 26', 'Phường 27', 'Phường 28'],
    },

    // ── Old Phú Nhuận ───────────────────────────────────────────────
    {
      name: 'Phú Nhuận',
      type: 'phuong',
      aliasesOldDistrict: ['Quận Phú Nhuận', 'Phú Nhuận', 'Q. Phú Nhuận'],
      aliasesOldWards: ['Phường 1', 'Phường 2', 'Phường 3', 'Phường 4', 'Phường 5'],
    },
    {
      name: 'Đức Nhuận',
      type: 'phuong',
      aliasesOldDistrict: ['Quận Phú Nhuận', 'Phú Nhuận'],
      aliasesOldWards: ['Phường 7', 'Phường 8', 'Phường 9', 'Phường 10', 'Phường 11', 'Phường 13', 'Phường 15', 'Phường 17'],
    },
    {
      name: 'Cầu Kiệu',
      type: 'phuong',
      aliasesOldDistrict: ['Quận Phú Nhuận', 'Phú Nhuận'],
      aliasesOldWards: ['Phường 1', 'Phường 2', 'Phường 17'],
    },

    // ── Old Gò Vấp ──────────────────────────────────────────────────
    {
      name: 'Gò Vấp',
      type: 'phuong',
      aliasesOldDistrict: ['Quận Gò Vấp', 'Gò Vấp', 'Q. Gò Vấp'],
      aliasesOldWards: ['Phường 1', 'Phường 3', 'Phường 4'],
    },
    {
      name: 'Hạnh Thông',
      type: 'phuong',
      aliasesOldDistrict: ['Quận Gò Vấp', 'Gò Vấp'],
      aliasesOldWards: ['Phường 5', 'Phường 6', 'Phường 7', 'Phường 8'],
    },
    {
      name: 'An Nhơn',
      type: 'phuong',
      aliasesOldDistrict: ['Quận Gò Vấp', 'Gò Vấp'],
      aliasesOldWards: ['Phường 9', 'Phường 10', 'Phường 11', 'Phường 17'],
    },
    {
      name: 'Thông Tây Hội',
      type: 'phuong',
      aliasesOldDistrict: ['Quận Gò Vấp', 'Gò Vấp'],
      aliasesOldWards: ['Phường 12', 'Phường 13', 'Phường 14', 'Phường 15', 'Phường 16'],
    },

    // ── Old Tân Bình ────────────────────────────────────────────────
    {
      name: 'Tân Bình',
      type: 'phuong',
      aliasesOldDistrict: ['Quận Tân Bình', 'Tân Bình', 'Q. Tân Bình'],
      aliasesOldWards: ['Phường 1', 'Phường 2', 'Phường 11', 'Phường 12', 'Phường 13'],
    },
    {
      name: 'Bảy Hiền',
      type: 'phuong',
      aliasesOldDistrict: ['Quận Tân Bình', 'Tân Bình'],
      aliasesOldWards: ['Phường 4', 'Phường 5', 'Phường 6', 'Phường 7', 'Phường 8', 'Phường 11'],
    },
    {
      name: 'Tân Sơn Hòa',
      type: 'phuong',
      aliasesOldDistrict: ['Quận Tân Bình', 'Tân Bình'],
      aliasesOldWards: ['Phường 9', 'Phường 10'],
    },
    {
      name: 'Tân Sơn Nhất',
      type: 'phuong',
      aliasesOldDistrict: ['Quận Tân Bình', 'Tân Bình'],
      aliasesOldWards: ['Phường 2', 'Phường 4', 'Phường 15'],
      aliasesUser: ['sân bay Tân Sơn Nhất'],
    },
    {
      name: 'Tân Sơn',
      type: 'phuong',
      aliasesOldDistrict: ['Quận Tân Bình', 'Tân Bình'],
      aliasesOldWards: ['Phường 14', 'Phường 15'],
    },

    // ── Old Tân Phú ─────────────────────────────────────────────────
    {
      name: 'Tân Phú',
      type: 'phuong',
      aliasesOldDistrict: ['Quận Tân Phú', 'Tân Phú', 'Q. Tân Phú'],
      aliasesOldWards: ['Tân Thành', 'Tân Sơn Nhì'],
    },
    {
      name: 'Tây Thạnh',
      type: 'phuong',
      aliasesOldDistrict: ['Quận Tân Phú', 'Tân Phú'],
      aliasesOldWards: ['Tây Thạnh', 'Sơn Kỳ'],
    },
    {
      name: 'Phú Thọ Hòa',
      type: 'phuong',
      aliasesOldDistrict: ['Quận Tân Phú', 'Tân Phú'],
      aliasesOldWards: ['Phú Thọ Hòa', 'Phú Trung'],
    },
    {
      name: 'Phú Thạnh',
      type: 'phuong',
      aliasesOldDistrict: ['Quận Tân Phú', 'Tân Phú'],
      aliasesOldWards: ['Phú Thạnh', 'Hiệp Tân', 'Hòa Thạnh', 'Tân Quý'],
    },

    // ── Old Bình Tân ────────────────────────────────────────────────
    {
      name: 'Bình Tân',
      type: 'phuong',
      aliasesOldDistrict: ['Quận Bình Tân', 'Bình Tân'],
      aliasesOldWards: ['Bình Hưng Hòa', 'Bình Hưng Hòa A', 'Bình Hưng Hòa B'],
    },
    {
      name: 'An Lạc',
      type: 'phuong',
      aliasesOldDistrict: ['Quận Bình Tân', 'Bình Tân'],
      aliasesOldWards: ['An Lạc', 'An Lạc A'],
    },
    {
      name: 'Tân Tạo',
      type: 'phuong',
      aliasesOldDistrict: ['Quận Bình Tân', 'Bình Tân'],
      aliasesOldWards: ['Tân Tạo', 'Tân Tạo A'],
    },
    {
      name: 'Bình Trị Đông',
      type: 'phuong',
      aliasesOldDistrict: ['Quận Bình Tân', 'Bình Tân'],
      aliasesOldWards: ['Bình Trị Đông', 'Bình Trị Đông A', 'Bình Trị Đông B'],
    },

    // ── Old Thủ Đức (Q.2, Q.9, Thủ Đức) ─────────────────────────────
    {
      name: 'Thủ Đức',
      type: 'phuong',
      aliasesOldDistrict: ['Thủ Đức', 'TP Thủ Đức', 'TP. Thủ Đức', 'TP Thu Duc'],
      aliasesOldWards: ['Linh Chiểu', 'Trường Thọ', 'Bình Thọ'],
    },
    {
      name: 'Linh Xuân',
      type: 'phuong',
      aliasesOldDistrict: ['Thủ Đức', 'TP Thủ Đức'],
      aliasesOldWards: ['Linh Xuân', 'Linh Trung'],
    },
    {
      name: 'Tam Bình',
      type: 'phuong',
      aliasesOldDistrict: ['Thủ Đức', 'TP Thủ Đức'],
      aliasesOldWards: ['Tam Bình', 'Tam Phú', 'Hiệp Bình Chánh', 'Hiệp Bình Phước'],
    },
    {
      name: 'Hiệp Bình',
      type: 'phuong',
      aliasesOldDistrict: ['Thủ Đức', 'TP Thủ Đức'],
      aliasesOldWards: ['Hiệp Bình Chánh', 'Hiệp Bình Phước'],
    },
    {
      name: 'Thủ Đức Đông',
      type: 'phuong',
      aliasesOldDistrict: ['Thủ Đức', 'TP Thủ Đức'],
      aliasesOldWards: ['Bình Thọ', 'Trường Thọ', 'Linh Đông'],
    },
    {
      name: 'An Khánh',
      type: 'phuong',
      aliasesOldDistrict: ['Thủ Đức', 'TP Thủ Đức', 'Quận 2', 'Q.2'],
      aliasesOldWards: ['An Khánh', 'Thủ Thiêm', 'Thảo Điền', 'An Phú'],
      aliasesUser: ['Thảo Điền', 'Thủ Thiêm'],
    },
    {
      name: 'Bình Trưng',
      type: 'phuong',
      aliasesOldDistrict: ['Thủ Đức', 'Quận 2', 'Q.2'],
      aliasesOldWards: ['Bình Trưng Đông', 'Bình Trưng Tây', 'Cát Lái'],
    },
    {
      name: 'Cát Lái',
      type: 'phuong',
      aliasesOldDistrict: ['Thủ Đức', 'Quận 2', 'Q.2'],
      aliasesOldWards: ['Cát Lái', 'Thạnh Mỹ Lợi'],
    },
    {
      name: 'Long Bình',
      type: 'phuong',
      aliasesOldDistrict: ['Thủ Đức', 'Quận 9', 'Q.9'],
      aliasesOldWards: ['Long Bình', 'Long Thạnh Mỹ'],
    },
    {
      name: 'Long Phước',
      type: 'phuong',
      aliasesOldDistrict: ['Thủ Đức', 'Quận 9', 'Q.9'],
      aliasesOldWards: ['Long Phước', 'Trường Thạnh'],
    },
    {
      name: 'Long Trường',
      type: 'phuong',
      aliasesOldDistrict: ['Thủ Đức', 'Quận 9', 'Q.9'],
      aliasesOldWards: ['Long Trường', 'Phú Hữu'],
    },
    {
      name: 'Tăng Nhơn Phú',
      type: 'phuong',
      aliasesOldDistrict: ['Thủ Đức', 'Quận 9', 'Q.9'],
      aliasesOldWards: ['Tăng Nhơn Phú A', 'Tăng Nhơn Phú B', 'Phước Long A', 'Phước Long B'],
    },
    {
      name: 'Phước Long',
      type: 'phuong',
      aliasesOldDistrict: ['Thủ Đức', 'Quận 9', 'Q.9'],
      aliasesOldWards: ['Phước Long A', 'Phước Long B', 'Phước Bình'],
    },

    // ── Outer communes (Bình Chánh, Hóc Môn, Củ Chi, Nhà Bè) ────────
    // Minimal entries — venues here are rare. Add aliases as data appears.
    { name: 'Bình Chánh', type: 'xa', aliasesOldDistrict: ['Bình Chánh', 'Huyện Bình Chánh'] },
    { name: 'Bình Hưng', type: 'xa', aliasesOldDistrict: ['Bình Chánh', 'Huyện Bình Chánh'] },
    { name: 'Tân Nhựt', type: 'xa', aliasesOldDistrict: ['Bình Chánh', 'Huyện Bình Chánh'] },
    { name: 'Vĩnh Lộc', type: 'xa', aliasesOldDistrict: ['Bình Chánh', 'Huyện Bình Chánh'] },
    { name: 'Tân Vĩnh Lộc', type: 'xa', aliasesOldDistrict: ['Bình Chánh', 'Huyện Bình Chánh'] },
    { name: 'Hóc Môn', type: 'xa', aliasesOldDistrict: ['Hóc Môn', 'Huyện Hóc Môn'] },
    { name: 'Bà Điểm', type: 'xa', aliasesOldDistrict: ['Hóc Môn', 'Huyện Hóc Môn'] },
    { name: 'Củ Chi', type: 'xa', aliasesOldDistrict: ['Củ Chi', 'Huyện Củ Chi'] },
    { name: 'Tân An Hội', type: 'xa', aliasesOldDistrict: ['Củ Chi', 'Huyện Củ Chi'] },
    { name: 'Nhà Bè', type: 'xa', aliasesOldDistrict: ['Nhà Bè', 'Huyện Nhà Bè'] },
    { name: 'An Thới Đông', type: 'xa', aliasesOldDistrict: ['Cần Giờ', 'Huyện Cần Giờ'], aliasesOldWards: ['An Thới Đông', 'Lý Nhơn'] },

    // ── Ex-Bình Dương (merged into HCM 2025) ────────────────────────
    // Coverage for the most-trafficked BD areas; venues tagged to old
    // BD districts/towns now resolve to these. Geographically the new
    // HCM extends NW up to Phú Giáo.
    {
      name: 'Thủ Dầu Một',
      type: 'phuong',
      aliasesOldDistrict: ['Thủ Dầu Một', 'TP Thủ Dầu Một', 'Bình Dương', 'Tỉnh Bình Dương'],
      aliasesOldWards: ['Phú Cường', 'Phú Hòa', 'Phú Lợi', 'Phú Thọ', 'Hiệp Thành', 'Hòa Phú', 'Định Hòa', 'Phú Mỹ', 'Phú Tân', 'Tân An'],
    },
    {
      name: 'Phú Lợi',
      type: 'phuong',
      aliasesOldDistrict: ['Thủ Dầu Một', 'Bình Dương'],
      aliasesOldWards: ['Phú Lợi'],
    },
    {
      name: 'Dĩ An',
      type: 'phuong',
      aliasesOldDistrict: ['Dĩ An', 'TP Dĩ An', 'Bình Dương'],
      aliasesOldWards: ['Dĩ An', 'Đông Hòa', 'Tân Bình', 'Tân Đông Hiệp', 'An Bình', 'Bình An', 'Bình Thắng'],
    },
    {
      name: 'Đông Hòa',
      type: 'phuong',
      aliasesOldDistrict: ['Dĩ An', 'Bình Dương'],
      aliasesOldWards: ['Đông Hòa'],
    },
    {
      name: 'Thuận An',
      type: 'phuong',
      aliasesOldDistrict: ['Thuận An', 'TP Thuận An', 'Bình Dương'],
      aliasesOldWards: ['Lái Thiêu', 'An Phú', 'An Sơn', 'Bình Chuẩn', 'Bình Hòa', 'Bình Nhâm', 'Hưng Định', 'Thuận Giao', 'Vĩnh Phú'],
    },
    {
      name: 'Bến Cát',
      type: 'phuong',
      aliasesOldDistrict: ['Bến Cát', 'TX Bến Cát', 'Bình Dương'],
      aliasesOldWards: ['Mỹ Phước', 'Thới Hòa', 'Hòa Lợi', 'Tân Định', 'Chánh Phú Hòa'],
    },
    {
      name: 'Bình Dương',
      type: 'phuong',
      aliasesOldDistrict: ['Bình Dương', 'Tỉnh Bình Dương'],
      aliasesUser: ['Bình Dương generic'],
    },
  ],
};

export default seed;
