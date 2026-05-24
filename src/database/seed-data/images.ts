import type { Category } from '../entities';

// Curated Unsplash photo IDs, grouped by category. Hand-picked from popular
// Vietnam-tagged content; if any specific ID 404s the frontend's SafeImage
// falls back to a deterministic picsum placeholder, so the venue card never
// breaks visually.
//
// Want to swap a specific photo? Edit the venue via the admin UI at
// /admin/venues/<slug> — images stored on the row override these defaults.

const u = (id: string): string =>
  `https://images.unsplash.com/${id}?w=1200&auto=format&fit=crop&q=80`;

const POOLS: Record<Category, string[]> = {
  cafe: [
    u('photo-1554118811-1e0d58224f24'),
    u('photo-1495474472287-4d71bcdd2085'),
    u('photo-1442512595331-e89e73853f31'),
    u('photo-1509042239860-f550ce710b93'),
    u('photo-1453614512568-c4024d13c247'),
    u('photo-1497636577773-f1231844b336'),
    u('photo-1559925393-8be0ec4767c8'),
    u('photo-1521017432531-fbd92d768814'),
    u('photo-1525610553991-2bede1a236e2'),
    u('photo-1453614512568-c4024d13c247'),
  ],
  restaurant: [
    u('photo-1517248135467-4c7edcad34c4'),
    u('photo-1414235077428-338989a2e8c0'),
    u('photo-1552566626-52f8b828add9'),
    u('photo-1559329007-40df8a9345d8'),
    u('photo-1466978913421-dad2ebd01d17'),
    u('photo-1555396273-367ea4eb4db5'),
    u('photo-1551782450-a2132b4ba21d'),
    u('photo-1592861956120-e524fc739696'),
    u('photo-1559339352-11d035aa65de'),
    u('photo-1600891964599-f61ba0e24092'),
  ],
  street_food: [
    u('photo-1583224944844-5b268c057b72'),
    u('photo-1576577445504-6af96477db52'),
    u('photo-1569718212165-3a8278d5f624'),
    u('photo-1582878826629-29b7ad1cdc43'),
    u('photo-1559339352-11d035aa65de'),
    u('photo-1565299507177-b0ac66763828'),
    u('photo-1604908554049-a4ea66f7e8b8'),
    u('photo-1551782450-17144efb9c50'),
    u('photo-1585032226651-759b368d7246'),
    u('photo-1582450871972-ab5ca641643d'),
  ],
  viewpoint: [
    u('photo-1528127269322-539801943592'),
    u('photo-1565967511849-76a60a516170'),
    u('photo-1583417319070-4a69db38a482'),
    u('photo-1528181304800-259b08848526'),
    u('photo-1506905925346-21bda4d32df4'),
    u('photo-1464822759023-fed622ff2c3b'),
    u('photo-1542273917363-3b1817f69a2d'),
    u('photo-1518002171953-a080ee817e1f'),
    u('photo-1519074002996-a69e7ac46a42'),
    u('photo-1559339352-11d035aa65de'),
  ],
  beach: [
    u('photo-1507525428034-b723cf961d3e'),
    u('photo-1519046904884-53103b34b206'),
    u('photo-1535262971913-a5d3e3d4f8b4'),
    u('photo-1473116763249-2faaef81ccda'),
    u('photo-1505142468610-359e7d316be0'),
    u('photo-1559827260-dc66d52bef19'),
    u('photo-1468413253725-0d5181091126'),
    u('photo-1500375592092-40eb2168fd21'),
    u('photo-1506953823976-52e1fdc0149a'),
    u('photo-1520454974749-611b7248ffdb'),
  ],
  homestay: [
    u('photo-1566073771259-6a8506099945'),
    u('photo-1564013799919-ab600027ffc6'),
    u('photo-1582719478250-c89cae4dc85b'),
    u('photo-1551776235-dde6d4829808'),
    u('photo-1520250497591-112f2f40a3f4'),
    u('photo-1455587734955-081b22074882'),
    u('photo-1568084680786-a84f91d1153c'),
    u('photo-1611892440504-42a792e24d32'),
    u('photo-1542314831-068cd1dbfeeb'),
    u('photo-1571896349842-33c89424de2d'),
  ],
  bar: [
    u('photo-1514933651103-005eec06c04b'),
    u('photo-1572116469696-31de0f17cc34'),
    u('photo-1551024709-8f23befc6f87'),
    u('photo-1470337458703-46ad1756a187'),
    u('photo-1543007630-9710e4a00a20'),
    u('photo-1574096145760-cb0fea0bb0aa'),
    u('photo-1581873372796-635b67ca2008'),
    u('photo-1525268323446-0505b6fe7778'),
    u('photo-1551024506-0bccd828d307'),
    u('photo-1572116469696-31de0f17cc34'),
  ],
  museum: [
    u('photo-1531259683007-016a7b628fc3'),
    u('photo-1528181304800-259b08848526'),
    u('photo-1572276596237-5db2c3e16c5d'),
    u('photo-1554907984-15263bfd63bd'),
    u('photo-1581873372796-635b67ca2008'),
    u('photo-1518128958364-65859d70aa41'),
    u('photo-1582719471384-894fbb16e074'),
    u('photo-1565623006066-82f23c79210b'),
    u('photo-1582719478250-c89cae4dc85b'),
    u('photo-1559339352-11d035aa65de'),
  ],
  park: [
    u('photo-1441974231531-c6227db76b6e'),
    u('photo-1551632811-561732d1e306'),
    u('photo-1448375240586-882707db888b'),
    u('photo-1542273917363-3b1817f69a2d'),
    u('photo-1500382017468-9049fed747ef'),
    u('photo-1500964757637-c85e8a162699'),
    u('photo-1469474968028-56623f02e42e'),
    u('photo-1564677819543-37c4f5ab16d6'),
    u('photo-1465056836041-7f43ac27dcb5'),
    u('photo-1518495973542-4542c06a5843'),
  ],
  shopping: [
    u('photo-1488459716781-31db52582fe9'),
    u('photo-1555529669-2269763671c0'),
    u('photo-1606914469633-0d5b1c4d3e07'),
    u('photo-1573083748739-bd02257e5b2a'),
    u('photo-1555529902-5261145633bf'),
    u('photo-1567784177951-6fa58317e16b'),
    u('photo-1604908554049-a4ea66f7e8b8'),
    u('photo-1555685812-4b943f1cb0eb'),
    u('photo-1556742044-3c52d6e88c62'),
    u('photo-1542838132-92c53300491e'),
  ],
};

// Deterministic 4-image set per venue. Same slug always gets the same 4
// photos; different venues in the same category get different slices.
export function imagesForVenue(category: Category, slug: string): string[] {
  const pool = POOLS[category];
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = (hash * 31 + slug.charCodeAt(i)) >>> 0;
  }
  const start = hash % pool.length;
  return [0, 1, 2, 3].map((i) => pool[(start + i) % pool.length]);
}
