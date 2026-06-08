// Convert a PISO place response into the Apify-compatible external_raw
// shape the FE was originally built for. The FE reads:
//   externalRaw.additionalInfo  — { [vnCategory]: [{ [vnLabel]: true }, ...] }
//   externalRaw.reviews         — Array<{reviewId, name, reviewerPhotoUrl,
//                                          text, stars, publishedAtDate,
//                                          reviewImageUrls}>
// PISO ships these under different keys (features as snake_case grouped
// codes, review_list with author_*/text/photos) — without this translation
// layer those fields silently vanish on the detail page.

export interface PisoMedia { id?: string; url?: string }
export interface PisoReview {
  review_id?: string;
  author_name?: string;
  author_profile_pic?: string;
  rating?: number;
  relative_date?: string;
  text?: string;
  photos?: PisoMedia[];
}
export interface PisoPlace {
  data_id?: string;
  place_id?: string;
  type?: string;
  description?: string;
  contacts?: { phone?: string; website?: string };
  features?: Record<string, string[]>;
  review_list?: PisoReview[];
  google_maps_url?: string;
}

// PISO feature code → Vietnamese label. Strings match what Google's
// language=vi scrape returns so the FE's existing AmenityGroup labels
// look identical regardless of import source. Codes that aren't here fall
// back to "Quick title-case" derived from the code itself (better than
// hiding them entirely).
const FEATURE_LABELS_VI: Record<string, string> = {
  // Accessibility
  has_wheelchair_accessible_seating: 'Có chỗ ngồi phù hợp cho xe lăn',
  has_wheelchair_accessible_entrance: 'Có lối vào cho xe lăn',
  has_wheelchair_accessible_parking: 'Có chỗ đỗ xe phù hợp cho xe lăn',
  has_wheelchair_accessible_restroom: 'Nhà vệ sinh phù hợp cho xe lăn',
  has_wheelchair_accessible_elevator: 'Có thang máy cho xe lăn',
  // Parking
  has_paid_parking_lot: 'Có bãi đỗ xe có phí',
  has_free_parking_lot: 'Có bãi đỗ xe miễn phí',
  has_free_street_parking: 'Đỗ xe miễn phí trên phố',
  has_paid_street_parking: 'Đỗ xe có phí trên phố',
  has_valet_parking: 'Có dịch vụ đậu xe',
  // Payments
  accepts_reservations: 'Chấp nhận đặt chỗ',
  pay_credit_card: 'Thẻ tín dụng',
  pay_debit_card: 'Thẻ ghi nợ',
  pay_mobile_nfc: 'Thanh toán qua di động bằng NFC',
  pay_cash_only: 'Chỉ tiền mặt',
  requires_cash_only: 'Chỉ chấp nhận tiền mặt',
  // Service options
  has_takeout: 'Mang về',
  has_delivery: 'Giao hàng',
  has_dine_in: 'Phục vụ tại chỗ',
  has_curbside_pickup: 'Nhận hàng bên lề đường',
  has_drive_through: 'Drive-thru',
  has_order_ahead: 'Đặt trước',
  has_no_contact_delivery: 'Giao hàng không tiếp xúc',
  // Amenities (selected from "other")
  has_wi_fi: 'Wi-Fi',
  wi_fi: 'Wi-Fi',
  has_restroom: 'Nhà vệ sinh',
  has_seating: 'Có chỗ ngồi',
  has_seating_outdoors: 'Chỗ ngồi ngoài trời',
  has_bar_onsite: 'Có quầy bar',
  has_fireplace: 'Có lò sưởi',
  has_high_chairs: 'Ghế cao cho trẻ em',
  has_childrens_menu: 'Thực đơn trẻ em',
  has_table_service: 'Phục vụ tại bàn',
  has_private_dining_room: 'Phòng ăn riêng',
  has_catering: 'Có dịch vụ tiệc',
  has_live_music: 'Nhạc sống',
  has_television: 'Có TV',
  // Children
  welcomes_children: 'Phù hợp cho trẻ em',
  // Audience
  popular_with_tourists: 'Phổ biến với du khách',
  popular_with_lgbt: 'Phổ biến với cộng đồng LGBT',
  suitable_for_groups: 'Phù hợp cho nhóm',
  suitable_for_dates: 'Phù hợp cho hẹn hò',
  suitable_for_solo_dining: 'Phù hợp ăn một mình',
  suitable_for_watching_sports: 'Phù hợp xem thể thao',
  suitable_for_special_occasions: 'Phù hợp dịp đặc biệt',
  suitable_for_business_lunch: 'Phù hợp ăn trưa công việc',
  // Atmosphere
  feels_cozy: 'Không gian ấm cúng',
  feels_romantic: 'Không gian lãng mạn',
  feels_hip: 'Không gian sành điệu',
  feels_casual: 'Không gian thoải mái',
  feels_historic: 'Không gian cổ kính',
  feels_quiet: 'Không gian yên tĩnh',
  // Menu offers
  serves_breakfast: 'Phục vụ bữa sáng',
  serves_brunch: 'Phục vụ brunch',
  serves_lunch: 'Phục vụ bữa trưa',
  serves_dinner: 'Phục vụ bữa tối',
  serves_dessert: 'Phục vụ tráng miệng',
  serves_coffee: 'Phục vụ cà phê',
  serves_tea: 'Phục vụ trà',
  serves_beer: 'Phục vụ bia',
  serves_beer_craft: 'Phục vụ bia thủ công',
  serves_wine: 'Phục vụ rượu vang',
  serves_cocktails: 'Phục vụ cocktail',
  serves_alcohol: 'Phục vụ đồ uống có cồn',
  serves_liquor: 'Phục vụ rượu mạnh',
  serves_vegetarian: 'Phục vụ đồ chay',
  serves_organic: 'Phục vụ đồ hữu cơ',
  serves_locally_sourced_ingredients: 'Phục vụ nguyên liệu địa phương',
  serves_gluten_free: 'Phục vụ đồ không gluten',
  serves_happy_hour_food: 'Có happy hour đồ ăn',
  serves_happy_hour_drinks: 'Có happy hour đồ uống',
  serves_breakfast_popular: 'Bữa sáng nổi tiếng',
  serves_lunch_popular: 'Bữa trưa nổi tiếng',
  serves_coffee_notable: 'Cà phê đặc biệt',
  serves_dessert_notable: 'Tráng miệng đặc biệt',
  serves_wine_notable: 'Rượu vang đặc biệt',
  serves_tea_notable: 'Trà đặc biệt',
  serves_small_plates: 'Phục vụ món nhỏ',
  quick_bite: 'Đồ ăn nhanh',
  // Misc
  welcomes_dogs: 'Cho phép chó',
  usually_a_wait: 'Thường phải xếp hàng',
  recommends_reservations: 'Nên đặt chỗ',
  recommends_reservations_brunch: 'Nên đặt chỗ trước cho brunch',
  recommends_reservations_lunch: 'Nên đặt chỗ trước cho bữa trưa',
  recommends_reservations_dinner: 'Nên đặt chỗ trước cho bữa tối',
  requires_reservations: 'Bắt buộc đặt chỗ trước',
  acceptable_to_order_just_coffee: 'Có thể chỉ gọi cà phê',
  acceptable_to_order_just_alcohol: 'Có thể chỉ gọi đồ uống có cồn',
  // Extras
  has_onsite_services: 'Có dịch vụ tại chỗ',
  has_all_you_can_eat_always: 'Buffet không giới hạn',
  has_counter_seating: 'Chỗ ngồi ở quầy',
  has_seating_rooftop: 'Chỗ ngồi sân thượng',
  has_changing_tables: 'Có bàn thay tã',
  good_for_kids_birthday: 'Phù hợp tổ chức sinh nhật trẻ em',
  feels_upscale: 'Không gian sang trọng',
  pay_check: 'Thanh toán bằng séc',
  pay_credit_card_types_accepted: 'Chấp nhận nhiều loại thẻ tín dụng',
};

// Top-level Vietnamese category names matching what Apify scrapes return.
const CATEGORY_LABEL_VI: Record<string, string> = {
  accessibility: 'Khả năng tiếp cận',
  parking: 'Bãi đỗ xe',
  payments: 'Thanh toán',
  service_options: 'Lựa chọn dịch vụ',
};

// Codes in PISO's catch-all "other" array get redistributed into one of
// these named buckets so the FE renders them under a meaningful heading
// instead of a single 60-row "Khác" list.
function bucketOther(code: string): string {
  if (
    code.startsWith('welcomes_children') || code === 'has_childrens_menu' ||
    code === 'has_high_chairs'
  ) return 'Trẻ em';
  if (code.startsWith('feels_')) return 'Không khí';
  if (code.startsWith('popular_with_') || code.startsWith('suitable_for_')) return 'Đối tượng';
  if (code.startsWith('serves_') || code === 'quick_bite') return 'Thực đơn';
  if (
    code.startsWith('has_wi_fi') || code === 'wi_fi' ||
    code === 'has_restroom' || code === 'has_seating' ||
    code === 'has_seating_outdoors' || code === 'has_bar_onsite' ||
    code === 'has_fireplace' || code === 'has_table_service' ||
    code === 'has_live_music' || code === 'has_private_dining_room' ||
    code === 'has_catering' || code === 'has_television'
  ) return 'Tiện nghi';
  return 'Khác';
}

function labelFor(code: string): string {
  if (FEATURE_LABELS_VI[code]) return FEATURE_LABELS_VI[code];
  // Fallback: convert snake_case to Title Case so unknown codes still
  // render as something human-readable rather than disappearing.
  return code
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Convert PISO features → apify-shaped additionalInfo. Output structure:
//   { [vnCategory: string]: Array<{ [vnLabel: string]: true }> }
// Empty arrays / missing keys are skipped so the FE doesn't render an
// empty section.
export function featuresToAdditionalInfo(
  features: Record<string, string[]> | undefined,
): Record<string, Array<Record<string, true>>> | null {
  if (!features || typeof features !== 'object') return null;
  const groups: Record<string, Array<Record<string, true>>> = {};

  for (const [pisoCategory, codes] of Object.entries(features)) {
    if (!Array.isArray(codes) || codes.length === 0) continue;
    if (pisoCategory === 'other') {
      // Redistribute the catch-all bucket
      for (const code of codes) {
        const vnCat = bucketOther(code);
        (groups[vnCat] ??= []).push({ [labelFor(code)]: true });
      }
    } else {
      const vnCat = CATEGORY_LABEL_VI[pisoCategory] ?? pisoCategory;
      for (const code of codes) {
        (groups[vnCat] ??= []).push({ [labelFor(code)]: true });
      }
    }
  }
  return Object.keys(groups).length ? groups : null;
}

// Convert PISO review_list → apify-shaped reviews[]. The FE's
// extractExternalReviews() reads these exact keys, so renaming is the
// whole point: review_id→reviewId, author_name→name, author_profile_pic
// →reviewerPhotoUrl, photos[].url→reviewImageUrls.
export function reviewListToApifyShape(
  reviews: PisoReview[] | undefined,
): Array<Record<string, unknown>> {
  if (!Array.isArray(reviews)) return [];
  return reviews
    .filter((r) => (r.text ?? '').trim() || (r.photos?.length ?? 0) > 0)
    .map((r, i) => ({
      reviewId: r.review_id ?? `piso-${i}`,
      name: r.author_name ?? '',
      reviewerPhotoUrl: r.author_profile_pic ?? '',
      text: r.text ?? '',
      stars: r.rating ?? 0,
      publishedAtDate: r.relative_date ?? '',
      reviewImageUrls: (r.photos ?? [])
        .map((p) => p.url ?? '')
        .filter(Boolean),
    }));
}

// One-shot builder: returns the external_raw blob the importer should
// stash on the venue row. Includes everything the FE may want plus the
// PISO-native keys for debugging / future re-sync.
export function buildExternalRaw(
  place: PisoPlace,
  pickedReviews?: PisoReview[],
): Record<string, unknown> {
  const additionalInfo = featuresToAdditionalInfo(place.features);
  // The FE reads reviews from external_raw.reviews — include the picked
  // subset (the same 4 that get inserted into the Review table). Including
  // ALL of place.review_list would bloat the JSONB row pointlessly.
  const reviews = reviewListToApifyShape(pickedReviews ?? place.review_list);

  return {
    // PISO-native fields kept for traceability / re-sync
    data_id: place.data_id,
    place_id: place.place_id,
    type: place.type,
    description: place.description,
    contacts: place.contacts,
    google_maps_url: place.google_maps_url,
    features: place.features,
    // Apify-shaped fields the FE actually renders
    additionalInfo,
    reviews,
  };
}
