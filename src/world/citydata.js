// Static layout data for Saint Vesper.
export const N = 13, PITCH = 110, ROAD = 20, BLOCK = 90, HALF = 715, EDGE = 735, WATER_Y = -1.7;
export const roadC = i => -HALF + i * PITCH;
export const blockC = i => -660 + i * PITCH;
export const MAP = [
  'HHHHHCCCCSSSS', 'HHHHHCCCCSSSS', 'HHHHNCCCCSSSS', 'SHHNNNDDDDSSS', 'SSNNNNDDDDSSS', 'SSNNNDDDDDDSS', 'SSNNNPPPDDDSS',
  'SSBBNPPPDDCCS', 'BBBBNPPPDCCCS', 'BBBBNNNNCCSSS', 'BBSSSSNNRRRRR', 'SSSSSSRRRRRRR', 'SSSSRRRRRRRRR'];
export const DISTRICTS = {
  D: { name: 'The Vault District', sub: 'Money lives here. You do not.', col: '#8a7a4a' }, N: { name: 'Neon Row', sub: 'Open all night. So are the wounds.', col: '#7a3a7a' },
  C: { name: 'Little Circuit', sub: 'Warranty void on every corner', col: '#2d6a72' }, S: { name: 'The Sprawl', sub: 'Rent is due', col: '#6a5a4a' },
  H: { name: 'Glory Heights', sub: 'Gated, guarded, guilty', col: '#4a6a44' }, R: { name: 'Rust Harbor', sub: 'Everything falls off the back of something', col: '#6a4a34' },
  P: { name: 'Saint Vesper Park', sub: 'Please do not feed the drones', col: '#3a6a3a' }, B: { name: 'Solvent Beach', sub: 'Come on in, the water is mostly water', col: '#8a7a5a' },
  F: { name: 'Fort Fortis', sub: 'Restricted. Deadly force authorized. Gift shop closed.', col: '#6a6a5a' }, X: { name: 'Halfmoon Ridge Reserve', sub: 'Leave only footprints. Take only Bigfoot photos.', col: '#3a5a32' },
  Y: { name: 'The Dry Margin', sub: 'Population: sand', col: '#a08a5a' }, W: { name: 'Northern Scrub', sub: 'Nothing up here but trailers and secrets', col: '#5a5a3a' },
};
let outerD = null; export const setOuterDistrict = f => { outerD = f; };
export const districtAt = (x, z) => { const i = Math.floor((x + HALF) / PITCH), j = Math.floor((z + HALF) / PITCH); return (MAP[j] && MAP[j][i]) || (outerD ? outerD(x, z) : null); };
// ---- points of interest. door is on the +z (south) face unless `open`
export const POIS = [
  { id: 'bank', name: 'Aurelian Trust Tower', bx: 7, bz: 5, type: 'tower', icon: '$', col: '#ffd24a', interior: 'banklobby' },
  { id: 'hideout', name: 'Suds of Anarchy Laundromat', bx: 4, bz: 10, w: 34, d: 26, h: 11, style: 10, color: '#7b5a4c', sign: 'SUDS OF ANARCHY', sc: '#40ffd0', icon: 'H', col: '#40ffd0', interior: 'hideout' },
  { id: 'tvtower', name: 'VSPR Broadcast Tower', bx: 2, bz: 1, type: 'tvtower', icon: 'T', col: '#ff6a6a', interior: 'studio' },
  { id: 'casino', name: 'The Lucky Overdraft Casino', bx: 5, bz: 4, w: 64, d: 54, h: 32, style: 2, color: '#5a2a6a', sign: 'THE LUCKY OVERDRAFT', sc: '#ffcf3a', icon: 'C', col: '#ffcf3a', interior: 'casino' },
  { id: 'club', name: 'Club Escrow', bx: 5, bz: 9, w: 44, d: 36, h: 14, style: 5, color: '#22202c', sign: 'CLUB ESCROW', sc: '#ff3df2', icon: 'N', col: '#ff3df2', interior: 'club' },
  { id: 'prison', name: 'Aurelian Asset Retention Center', bx: 11, bz: 10, w: 60, d: 46, h: 18, style: 0, color: '#6e7278', sign: 'ASSET RETENTION', sc: '#ff5040', icon: 'A', col: '#ff5040', interior: 'prison', wall: true },
  { id: 'plant', name: 'Vesper Grid Plant', bx: 9, bz: 12, type: 'plant', icon: 'E', col: '#ffe04a', interior: 'plantroom' },
  { id: 'airfield', name: 'Fortis Air Yard', bx: 12, bz: 11, type: 'airfield', icon: 'V', col: '#9ad0ff' },
  { id: 'docks', name: 'Pier 13 Container Docks', bx: 6, bz: 12, type: 'docks', icon: 'D', col: '#ffa04a', interior: 'warehouse' },
  { id: 'mansion', name: 'Goldman Estate', bx: 3, bz: 0, w: 46, d: 30, h: 14, style: 2, color: '#e8e2d2', sign: '', icon: 'G', col: '#ffd24a', interior: 'mansion', wall: true, lawn: true },
  { id: 'clinic', name: 'Chop Doc Body Shop', bx: 10, bz: 8, w: 26, d: 26, h: 15, style: 3, color: '#3b5560', sign: 'CHOP DOC  BODY SHOP', sc: '#5affc0', icon: '+', col: '#5affc0', interior: 'clinic' },
  { id: 'guns', name: "Aunt Bev's Firearms & Preserves", bx: 6, bz: 10, w: 28, d: 22, h: 10, style: 10, color: '#6a3b30', sign: "AUNT BEV'S GUNS & JAM", sc: '#ff5a5a', icon: 'W', col: '#ff5a5a', interior: 'guns' },
  { id: 'garage', name: "Nova's Torque Temple", bx: 8, bz: 10, w: 38, d: 28, h: 11, style: 5, color: '#4a5560', sign: 'TORQUE TEMPLE', sc: '#ff8a2a', icon: 'O', col: '#ff8a2a', shop: 'garage' },
  { id: 'chop', name: 'The Chop Shop', bx: 10, bz: 11, w: 44, d: 30, h: 10, style: 5, color: '#553d32', sign: 'DEFINITELY NOT A CHOP SHOP', sc: '#ffb03a', icon: 'X', col: '#ffb03a', shop: 'chop' },
  { id: 'hospital', name: 'St. Deductible Hospital', bx: 8, bz: 8, w: 54, d: 44, h: 40, style: 2, color: '#b7c2c8', sign: 'ST. DEDUCTIBLE', sc: '#6affff', icon: '+', col: '#ffffff' },
  { id: 'police', name: 'SVPD Central', bx: 9, bz: 6, w: 50, d: 44, h: 30, style: 2, color: '#4c5a74', sign: 'SVPD CENTRAL', sc: '#5a8aff', icon: 'P', col: '#5a8aff' },
  { id: 'gala', name: 'The Meridian Opera House', bx: 8, bz: 3, w: 66, d: 56, h: 26, style: 2, color: '#c9b48a', sign: 'THE MERIDIAN', sc: '#fff0b0', icon: 'M', col: '#fff0b0', interior: 'gala' },
  { id: 'arcade', name: 'Button Masher Arcade', bx: 4, bz: 5, w: 30, d: 24, h: 12, style: 4, color: '#392a52', sign: 'BUTTON MASHER', sc: '#7aff5a', icon: 'J', col: '#7aff5a', interior: 'arcade' },
  { id: 'diner', name: 'Mama Interest Diner', bx: 3, bz: 8, w: 28, d: 20, h: 8, style: 4, color: '#b05a4a', sign: 'MAMA INTEREST', sc: '#ff9a5a', icon: 'R', col: '#ff9a5a', interior: 'diner' },
  { id: 'radio', name: 'Echo Pirate Radio', bx: 7, bz: 1, w: 40, d: 34, h: 22, style: 3, color: '#3a4a5a', sign: 'VACANT (NOT)', sc: '#b04aff', icon: 'E', col: '#b04aff', interior: 'radio' },
  { id: 'lab', name: 'Abandoned Neural Lab', bx: 8, bz: 2, w: 36, d: 36, h: 24, style: 1, color: '#41606a', sign: 'NEUROPLEX', sc: '#4affff', icon: 'L', col: '#4affff', interior: 'lab' },
  { id: 'pawn', name: 'Pawn of the Dead', bx: 9, bz: 9, w: 26, d: 22, h: 10, style: 4, color: '#5a5a3a', sign: 'PAWN OF THE DEAD', sc: '#d0ff4a', icon: 'K', col: '#d0ff4a', interior: 'pawn' },
  { id: 'otto', name: "Otto's Fair & Balanced Loans", bx: 9, bz: 10, w: 34, d: 26, h: 13, style: 5, color: '#5a4a2a', sign: "OTTO'S LOANS", sc: '#ffe03a', icon: 'O', col: '#ffe03a', interior: 'otto' },
  { id: 'spray', name: 'Alibi Paint & Body', bx: 2, bz: 6, w: 26, d: 24, h: 9, style: 5, color: '#346058', sign: 'ALIBI PAINT', sc: '#4affd0', icon: 'Y', col: '#4affd0', shop: 'spray' },
  { id: 'spray2', name: 'Alibi Paint & Body East', bx: 11, bz: 5, w: 26, d: 24, h: 9, style: 5, color: '#346058', sign: 'ALIBI PAINT', sc: '#4affd0', icon: 'Y', col: '#4affd0', shop: 'spray' },
  { id: 'br1', name: 'Aurelian Branch - Neon Row', bx: 3, bz: 5, w: 30, d: 24, h: 12, style: 4, color: '#a08a4a', sign: 'AURELIAN TRUST', sc: '#ffd24a', icon: '$', col: '#c9a53a', interior: 'branch' },
  { id: 'br2', name: 'Aurelian Branch - The Sprawl', bx: 11, bz: 3, w: 30, d: 24, h: 12, style: 4, color: '#a08a4a', sign: 'AURELIAN TRUST', sc: '#ffd24a', icon: '$', col: '#c9a53a', interior: 'branch' },
  { id: 'br3', name: 'Aurelian Branch - Solvent Beach', bx: 2, bz: 9, w: 30, d: 24, h: 12, style: 4, color: '#a08a4a', sign: 'AURELIAN TRUST', sc: '#ffd24a', icon: '$', col: '#c9a53a', interior: 'branch' },
  { id: 'br4', name: 'Aurelian Branch - Little Circuit', bx: 6, bz: 2, w: 30, d: 24, h: 12, style: 4, color: '#a08a4a', sign: 'AURELIAN TRUST', sc: '#ffd24a', icon: '$', col: '#c9a53a', interior: 'branch' },
  { id: 'br5', name: 'Aurelian Branch - Rust Harbor', bx: 8, bz: 11, w: 30, d: 24, h: 12, style: 4, color: '#a08a4a', sign: 'AURELIAN TRUST', sc: '#ffd24a', icon: '$', col: '#c9a53a', interior: 'branch' },
  { id: 'store1', name: '24/7/365/Forever', bx: 1, bz: 4, w: 24, d: 20, h: 8, style: 4, color: '#3f6a4c', sign: '24/7/365', sc: '#6aff6a', icon: 'S', col: '#6aff6a', interior: 'store' },
  { id: 'store2', name: '24/7/365/Forever', bx: 10, bz: 2, w: 24, d: 20, h: 8, style: 4, color: '#3f6a4c', sign: '24/7/365', sc: '#6aff6a', icon: 'S', col: '#6aff6a', interior: 'store' },
  { id: 'store3', name: '24/7/365/Forever', bx: 2, bz: 11, w: 24, d: 20, h: 8, style: 4, color: '#3f6a4c', sign: '24/7/365', sc: '#6aff6a', icon: 'S', col: '#6aff6a', interior: 'store' },
  { id: 'store4', name: '24/7/365/Forever', bx: 7, bz: 9, w: 24, d: 20, h: 8, style: 4, color: '#3f6a4c', sign: '24/7/365', sc: '#6aff6a', icon: 'S', col: '#6aff6a', interior: 'store' },
  { id: 'tailor', name: 'Fabric Crimes Tailoring', bx: 4, bz: 4, w: 26, d: 22, h: 11, style: 4, color: '#5a3a5a', sign: 'FABRIC CRIMES', sc: '#ff8ae0', icon: 'F', col: '#ff8ae0', shop: 'tailor' },
  { id: 'spire', name: 'Halcyon Spire (Neuroplex HQ)', bx: 8, bz: 5, type: 'sky', h: 262, tone: '#5a8a9a', trim: '#4affff', icon: 'Z', col: '#4affff', interior: 'spire0', sign: 'NEUROPLEX' },
  { id: 'goldtower', name: 'Goldman Tower', bx: 6, bz: 4, type: 'sky', h: 300, tone: '#8a7a5a', trim: '#ffd24a', icon: 'G', col: '#ffd24a', interior: 'gold0', sign: 'GOLDMAN' },
  { id: 'velvet', name: 'The Velvet Ledger', bx: 4, bz: 3, w: 46, d: 38, h: 13, style: 5, color: '#2a1a22', sign: 'THE VELVET LEDGER', sc: '#ff4a8a', icon: 'V', col: '#ff4a8a', interior: 'velvet' },
  { id: 'fortis', name: 'Fortis Command', x: 210, z: -1530, door: { x: 210, z: -1514.4 }, outer: true, icon: 'F', col: '#ff5040', interior: 'armory' },
  { id: 'motel', name: 'Last Chance Motel', x: -1300, z: 585, door: { x: -1336.2, z: 591.4 }, outer: true, icon: 'M', col: '#ff5a8a', interior: 'motel' },
  { id: 'bunker', name: 'Aurelian Deep Storage', x: -1905, z: 1965, door: { x: -1905, z: 1974.6 }, outer: true, icon: 'B', col: '#ffd24a', interior: 'bunker' },
  { id: 'ranger', name: 'Halfmoon Ridge Ranger Station', x: 1965, z: -2095, door: { x: 1965, z: -2084.4 }, outer: true, icon: 'R', col: '#9aff6a', interior: 'ranger' },
  { id: 'chipshop', name: 'The Daemon Emporium', bx: 8, bz: 0, w: 26, d: 24, h: 14, style: 4, color: '#2a4a5a', sign: 'DAEMON EMPORIUM', sc: '#4ac8ff', icon: 'Q', col: '#4ac8ff', shop: 'chips' },
];
export const POI = {}; for (const p of POIS) { POI[p.id] = p; if (p.outer) continue; p.x = blockC(p.bx); p.z = blockC(p.bz); p.door = { x: p.x, z: p.z + (p.d || 60) / 2 + 1.4 }; }
POI.bank.door = { x: POI.bank.x, z: POI.bank.z + 29 }; POI.tvtower.door = { x: POI.tvtower.x, z: POI.tvtower.z + 11.5 }; POI.plant.door = { x: POI.plant.x - 12, z: POI.plant.z + 16.5 }; POI.docks.door = { x: POI.docks.x + 20, z: POI.docks.z - 9.5 }; POI.airfield.door = { x: POI.airfield.x, z: POI.airfield.z + 20 };
export const BANK_ROOF = 232;
export const SIGNS = ['NOODLES', 'BAIL BONDS', 'CHROME & CO', 'PAYDAY?', 'SUSHI-ISH', 'REGRET', 'TATTOO', 'LIVE BAIT', 'HOT TOFU', 'KARMA BANK', 'DENTIST 24H', 'LOAN SHARK', 'VAPE CHURCH', 'PIXEL BAR', 'MOTEL NO', 'GIGAWATT', 'ROBOWASH', 'CURRY UP', 'BIOHAZARD', 'EAT', 'WIFI', 'HOTEL', 'KARAOKE', 'DUMPLINGS', 'PSYCHIC', 'DONUT GOD', 'ILLEGAL?', 'OPEN', 'RAMEN RAM', 'BYTE ME', 'COIN LAUNDRY', 'PIZZA CRIME', 'SPA-GHETTI', 'ZZZ PODS', 'NEURO NAILS', 'FAX YOU', 'BOBA FRAUD', 'TAX DODGE', 'LUCKY 7', 'FISH?', 'GYM & TONIC', 'HACKSAW', 'COPY THAT', 'GOOD ENOUGH', 'SMOKE', 'MIRRORS', 'DISCO NAP', 'TOASTED', 'SOUP', 'ARCADIA', 'MEGA MEATS', 'CLONE ZONE', 'LAWYER?!', 'SHOES ONLY', 'WET MARKET', 'HALF OFF', 'THE OFFICE', 'FAKE ID', 'REAL ID', 'VESPER 1', 'SLEEP', 'PAY HERE', 'NOPE', 'AURELIAN'];
export const VSIGNS = ['HOTEL', 'NOODLE', 'CHROME', 'CASINO', 'DREAMS', 'VESPER', 'GLORY', 'DEBT', 'SUSHI', 'NEON', 'TATTOO', 'PHARMA', 'BAIL', 'CREDIT', 'LOVE', 'TOFU'];
export const ADS = [
  ['AURELIAN TRUST', 'WE OWN YOU(R FUTURE)', '#ffd24a', '#2a1f08'], ['GLORIA', 'She already approved it.', '#ffe9b0', '#503a08'], ['FIZZ-B-GONE', 'The soda that quits', '#4affd0', '#07302c'], ['NEUROPLEX', 'Think our thoughts', '#6ad0ff', '#081e38'],
  ['MEGA MEATS', '40% probably beef', '#ff6a4a', '#380d08'], ['LARRY GOLDMAN', 'A human man. Like you.', '#ffd24a', '#101420'], ['DEBT IS LOVE', 'an Aurelian message', '#ff8ae0', '#33082a'], ['ROBOWASH', 'Touchless. Soulless.', '#8affff', '#06262c'],
  ['CLUB ESCROW', 'We hold your drinks', '#ff3df2', '#22042a'], ['FORTIS AIR', 'Above the law', '#9ad0ff', '#0a1a30'], ['SPLEEN LEASE', 'Own nothing. Inside.', '#b0ff4a', '#14260a'], ['TORQUE TEMPLE', 'Pray at 200 mph', '#ff8a2a', '#2c1404'],
  ['24/7/365', 'We cannot leave', '#6aff6a', '#0a2a0c'], ['YOUR KIDNEYS', 'are pre-qualified', '#ffd24a', '#301808'], ['DUCKS', 'Have you seen them?', '#fff04a', '#2c2804'], ['VOTE GOLDMAN', 'or the bank will for you', '#ff5a5a', '#160a2a']];
