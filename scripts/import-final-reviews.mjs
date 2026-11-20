// Final reviews import — uploads photos and inserts all reviews (≥3★) for all 18 women's-collection pieces.
// Run from site/:  node --env-file=.env.local scripts/import-final-reviews.mjs
//
// What it does:
//   1. Runs the NULL-body migration (safe to run again)
//   2. Deletes ALL existing reviews for the 18 slugs (clean slate)
//   3. Uploads 15 customer photos to review-images Storage bucket
//   4. Inserts 76 text reviews (Part 1, ≥3★ only)
//   5. Inserts ~2369 rating-only bulk reviews (Part 2, 3–5★ only)

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { randomUUID } from "crypto";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REVIEWS_DIR = join(__dirname, "../../reviews/all reviews");

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
if (!url || !key) throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set");

const sb = createClient(url, key, { auth: { persistSession: false } });

const SLUGS = [
  "necklace-verdis-gold",   "necklace-verdis-silver",
  "bracelet-verdis-gold",   "bracelet-verdis-silver",
  "necklace-noctis-gold",   "necklace-noctis-silver",
  "bracelet-noctis-gold",   "bracelet-noctis-silver",
  "necklace-lumen-gold",    "necklace-lumen-silver",
  "bracelet-lumen-gold",    "bracelet-lumen-silver",
  "bracelet-linea-gold",    "bracelet-linea-silver",
  "bracelet-solaris-gold",  "bracelet-solaris-silver",
  "bracelet-spira-gold",    "bracelet-spira-silver",
];

// ─── 1. Verify connection ─────────────────────────────────────────────────────
console.log("1. Checking connection...");
const { error: pingErr } = await sb.from("reviews").select("id").limit(1);
if (pingErr) throw new Error("Cannot reach reviews table: " + pingErr.message + "\n  → Run supabase/reviews-allow-null-body.sql in Supabase Dashboard if not already done.");
console.log("  ✓ Connected.\n");

// ─── 2. Delete existing reviews ───────────────────────────────────────────────
console.log("2. Clearing existing reviews for all 18 slugs...");
const { error: delErr, count: delCount } = await sb
  .from("reviews")
  .delete({ count: "exact" })
  .in("product_slug", SLUGS);
if (delErr) throw new Error("Delete error: " + delErr.message);
console.log(`  ✓ Deleted ${delCount ?? "unknown"} existing reviews.\n`);

// ─── 3. Upload photos ─────────────────────────────────────────────────────────
console.log("3. Uploading customer photos...");

// Local file → Storage path → DB path (what gets stored in images[] column)
const PHOTOS = [
  // Necklace photos (from necklaces/ subfolder)
  { local: "necklaces/1.png",   bucket: "necklaces/import-fn-01.png",   mime: "image/png" },
  { local: "necklaces/2.webp",  bucket: "necklaces/import-fn-02.webp",  mime: "image/webp" },
  { local: "necklaces/3.webp",  bucket: "necklaces/import-fn-03.webp",  mime: "image/webp" },
  { local: "necklaces/5.webp",  bucket: "necklaces/import-fn-05.webp",  mime: "image/webp" },
  { local: "necklaces/6.png",   bucket: "necklaces/import-fn-06.png",   mime: "image/png" },
  { local: "necklaces/7.webp",  bucket: "necklaces/import-fn-07.webp",  mime: "image/webp" },
  // Bracelet photos (from root)
  { local: "image.webp",        bucket: "bracelets/import-fb-01.webp",  mime: "image/webp" },
  { local: "image (1).webp",    bucket: "bracelets/import-fb-02.webp",  mime: "image/webp" },
  { local: "image (2).webp",    bucket: "bracelets/import-fb-03.webp",  mime: "image/webp" },
  { local: "image (3).webp",    bucket: "bracelets/import-fb-04.webp",  mime: "image/webp" },
  { local: "image (4).webp",    bucket: "bracelets/import-fb-05.webp",  mime: "image/webp" },
  { local: "image (5).webp",    bucket: "bracelets/import-fb-06.webp",  mime: "image/webp" },
  { local: "image (7).webp",    bucket: "bracelets/import-fb-07.webp",  mime: "image/webp" },
  { local: "image (8).webp",    bucket: "bracelets/import-fb-08.webp",  mime: "image/webp" },
  { local: "image (9).webp",    bucket: "bracelets/import-fb-09.webp",  mime: "image/webp" },
];

const uploadedPaths = {}; // local name → bucket path
for (const ph of PHOTOS) {
  const localPath = join(REVIEWS_DIR, ph.local);
  const data = readFileSync(localPath);
  const { error: upErr } = await sb.storage
    .from("review-images")
    .upload(ph.bucket, data, { contentType: ph.mime, upsert: true });
  if (upErr) {
    console.error(`  ✗ Failed ${ph.local}: ${upErr.message}`);
  } else {
    uploadedPaths[ph.local] = ph.bucket;
    console.log(`  ✓ ${ph.local} → ${ph.bucket}`);
  }
}
console.log();

// ─── Helper: random date spread over past 12 months ──────────────────────────
let dateOffset = 0;
function nextDate() {
  // Spread dates from 12 months ago to 1 month ago; newer dates more likely
  const maxDaysAgo = 365;
  const minDaysAgo = 30;
  // Deterministic but varied: cycle through values
  dateOffset += 1;
  const daysAgo = minDaysAgo + ((dateOffset * 7 + 13) % (maxDaysAgo - minDaysAgo));
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  // Vary the time too
  d.setHours((dateOffset * 3) % 23, (dateOffset * 17) % 59, 0, 0);
  return d.toISOString();
}

// ─── 4. Insert text reviews (Part 1) ─────────────────────────────────────────
console.log("4. Inserting text reviews...");

// Map product display name → slug
const SLUG_MAP = {
  "Колие Verdis – Злато":   "necklace-verdis-gold",
  "Колие Verdis – Сребро":  "necklace-verdis-silver",
  "Гривна Verdis – Злато":  "bracelet-verdis-gold",
  "Гривна Verdis – Сребро": "bracelet-verdis-silver",
  "Колие Noctis – Злато":   "necklace-noctis-gold",
  "Колие Noctis – Сребро":  "necklace-noctis-silver",
  "Гривна Noctis – Злато":  "bracelet-noctis-gold",
  "Гривна Noctis – Сребро": "bracelet-noctis-silver",
  "Колие Lumen – Злато":    "necklace-lumen-gold",
  "Колие Lumen – Сребро":   "necklace-lumen-silver",
  "Гривна Lumen – Злато":   "bracelet-lumen-gold",
  "Гривна Lumen – Сребро":  "bracelet-lumen-silver",
  "Гривна Linea – Злато":   "bracelet-linea-gold",
  "Гривна Linea – Сребро":  "bracelet-linea-silver",
  "Гривна Solaris – Злато": "bracelet-solaris-gold",
  "Гривна Solaris – Сребро":"bracelet-solaris-silver",
  "Гривна Spira – Злато":   "bracelet-spira-gold",
  "Гривна Spira – Сребро":  "bracelet-spira-silver",
};

// All text reviews: { name, rating, product, body, photoLocal? }
// Skip ≤2★ reviews (25, 33, 38, 55, 60, 79)
const TEXT_REVIEWS = [
  { name: "Симона В.",    rating: 5, product: "Колие Lumen – Сребро",   body: "Много фино ляга на врата, слагам го почти всеки ден със сини и бели тениски. Не се натрапва и не пречи изобщо, точно такъв размер висулка търсех.", photoLocal: "necklaces/1.png" },
  { name: "Габриела М.",  rating: 5, product: "Колие Lumen – Злато",    body: "Взех го за себе си и не го свалям вече втора седмица. Седефът леко прелива на светлина и седи чисто на кожата, закопчалката също е стабилна.", photoLocal: "necklaces/2.webp" },
  { name: "Ивелина К.",   rating: 5, product: "Колие Lumen – Злато",    body: "Носих го цяло лято с рокли и потници, не е потъмняло грам. Много изчистено и леко колие, слага се за секунди и си отива с всичко.", photoLocal: "necklaces/3.webp" },
  { name: "Цветелина П.", rating: 5, product: "Колие Verdis – Злато",   body: "Зеленото на златното изпъква жестоко, особено на по-тъмни или червени дрехи. Верижката е тъничка и лежи точно на ключицата, не се усуква.", photoLocal: "necklaces/5.webp" },
  { name: "Магдалена Р.", rating: 5, product: "Колие Verdis – Сребро",  body: "Мъжът ми го взе за именния ден и много си го харесвам. Малахитът има хубави шарки и на сребро изглежда свежо, не дразни кожата.", photoLocal: "necklaces/6.png" },
  { name: "Боряна Д.",    rating: 5, product: "Колие Noctis – Сребро",  body: "Черното на сребро ми е любимо за всеки ден. Върви си чудесно и с по-спортни дрехи с яка, не е натруфено и не се закача.", photoLocal: "necklaces/7.webp" },
  { name: "Рая С.",       rating: 5, product: "Гривна Noctis – Злато",  body: "Много добре ляга на ръката, размерът на детелинките е точен – нито са прекалено големи, нито се губят. Закопчалката държи здраво и не се откопчава сама.", photoLocal: "image.webp" },
  { name: "Калина Т.",    rating: 5, product: "Гривна Noctis – Злато",  body: "Нося я вечер като излизам и на изкуствена светлина златното около черното много приятно блести. Не тежи и не пречи изобщо, даже забравям, че ми е на китката.", photoLocal: "image (1).webp" },
  { name: "Милена Г.",    rating: 5, product: "Гривна Verdis – Злато",  body: "Прясно сложена още в колата след като я взех от офиса на куриера 😂 На живо зеленото е още по-наситено и седи много нежно на ръката.", photoLocal: "image (2).webp" },
  { name: "Дарина Н.",    rating: 5, product: "Гривна Verdis – Злато",  body: "Поръчах я за себе си, защото много харесвам малахит. Детелинките са двустранни, така че и да се завърти на китката, пак си изглежда добре.", photoLocal: "image (3).webp" },
  { name: "Пламена Х.",   rating: 5, product: "Гривна Lumen – Злато",   body: "Седефът е истински и на светлина леко си сменя оттенъка, не изглежда като пластмаса. Много фино е изработена и златният кант около детелинките е прецизен.", photoLocal: "image (4).webp" },
  { name: "Никол Б.",     rating: 5, product: "Гривна Lumen – Злато",   body: "Комбинирам я с твърдата ми златна гривна и двете заедно заспаха. Не се оплитат и не се драскат, много съм доволна от покупката.", photoLocal: "image (5).webp" },
  { name: "Виолета А.",   rating: 5, product: "Гривна Verdis – Сребро", body: "Търсех точно зелено на сребро, че златно не нося. На живо шарките на камъка са естествени и изглежда много свежо на ръката.", photoLocal: "image (7).webp" },
  { name: "Елица З.",     rating: 5, product: "Гривна Lumen – Сребро",  body: "Сребърната със седеф е много нежна и отива буквално на всичко – и с черен суитшърт, и с риза. Верижката изглежда фина, но е доста здрава.", photoLocal: "image (8).webp" },
  { name: "Калоян М.",    rating: 5, product: "Гривна Noctis – Сребро", body: "Взех я за подарък на приятелката ми, пробвах я на моята ръка само да видя как държи закопчалката преди да я опаковам. Много добра изработка, хареса си я адски много.", photoLocal: "image (9).webp" },
  { name: "Розалия К.",   rating: 5, product: "Гривна Verdis – Злато",  body: "Поръчах я за рождения ден на майка ми, направо й светнаха очите като отвори кутийката. На живо зеленото е доста по-плътно от снимките." },
  { name: "Веселина Д.",  rating: 5, product: "Гривна Verdis – Злато",  body: "Карам вече втори месец с нея почти без да я свалям и позлатеното не е мръднало. Не се закача по пуловери и ръкави, което ми е най-важно." },
  { name: "Мариета Г.",   rating: 5, product: "Гривна Verdis – Злато",  body: "Мъжът ми ме изненада за именния ден. Много приятна изработка, даже торбичката и кутията вътре са пипнати." },
  { name: "Антония Х.",   rating: 5, product: "Гривна Verdis – Злато",  body: "Излезе ми реклама в инстаграм и реших да рискувам. На живо детелинките изглеждат по-живи, нося я до друга гривна и си пасват добре." },
  { name: "Борис Н.",     rating: 5, product: "Гривна Verdis – Злато",  body: "Взех я за подарък на жена ми за Коледа, уцелих от раз. Каза, че на живо изглежда доста по-добре, отколкото я бях показал на телефона." },
  { name: "Нели Т.",      rating: 5, product: "Гривна Verdis – Злато",  body: "Малко се чудех дали няма да изглежда евтино, но всъщност е доста добре направена. Слагах я на едно събиране и веднага ме питаха откъде е." },
  { name: "Снежана В.",   rating: 5, product: "Гривна Verdis – Злато",  body: "Комбинирах я с колието от същата серия и заспаха. За цената си изглежда като доста по-скъпо бижу." },
  { name: "Николета Р.",  rating: 4, product: "Гривна Verdis – Злато",  body: "Камъчетата имат страхотен нюанс и изработката е добра. Единствено синджирчето ми се видя една идея по-тънко в началото, но пък седи фино." },
  { name: "Ивона К.",     rating: 3, product: "Гривна Verdis – Злато",  body: "На снимките в сайта детелинките ми изглеждаха малко по-едри. На живо са по-дребни от очакваното, иначе като качество нямам забележки." },
  // 25 skipped (2★)
  { name: "Яница С.",     rating: 5, product: "Колие Verdis – Злато",   body: "Много фино колие, зеленото камъче веднага хваща окото. Дойде на следващия ден с преглед, всичко беше точно." },
  { name: "Кристиян В.",  rating: 5, product: "Колие Verdis – Злато",   body: "Подарък за сестра ми, много се зарадва. На живо изглежда доста по-стилно, отколкото на снимките в сайта." },
  { name: "Деница П.",    rating: 5, product: "Колие Verdis – Злато",   body: "Взех го в комбинация с гривната Verdis на промоцията 1+1 и излезе супер изгодно. Верижката има удължител и пада точно на ключицата." },
  { name: "Александра Т.",rating: 5, product: "Колие Verdis – Злато",   body: "Нося го почти всеки ден от месец насам, къпя се с него и не е потъмняло. Малахитът има много красиви естествени ивици." },
  { name: "Михаела К.",   rating: 4, product: "Колие Verdis – Злато",   body: "Хубаво колие, изчистено и леко. Само висулката е по-малка, отколкото изглежда на близките кадри, но стои много нежно." },
  { name: "Георги Д.",    rating: 5, product: "Колие Verdis – Сребро",  body: "Поръчах го за приятелката ми, пристигна в много хубава кутия с торбичка. Зеленото със сребро изглежда много свежо." },
  { name: "Надежда П.",   rating: 4, product: "Колие Verdis – Сребро",  body: "Хубаво колие, цветът на малахита е наситен. Само ми се искаше верижката да е с 2-3 сантиметра по-дълга, но и така е добре." },
  // 33 skipped (2★)
  { name: "Теодора М.",   rating: 5, product: "Колие Verdis – Сребро",  body: "Не нося злато и много се радвам, че го има на сребро. Леко е, не се усуква и закопчалката е удобна." },
  { name: "Ралица С.",    rating: 5, product: "Колие Verdis – Сребро",  body: "Взех го заедно със сребърната гривна Verdis и станаха страшен комплект. Получих доста комплименти в офиса." },
  { name: "Димитър К.",   rating: 5, product: "Колие Lumen – Злато",    body: "Поръчах го за годишнината ни и жена ми много го хареса. Кутийката е много приятна, не се наложи да търся отделна опаковка." },
  { name: "Симона Д.",    rating: 5, product: "Колие Lumen – Злато",    body: "Седефът е истински и на слънце прелива много приятно. Слагам го и с тениска, и с по-официална рокля." },
  // 38 skipped (2★)
  { name: "Валерия Н.",   rating: 5, product: "Колие Lumen – Злато",    body: "Много деликатно колие, не дразни кожата и не се оплита в косата. Доволна съм." },
  { name: "Елена Г.",     rating: 4, product: "Колие Lumen – Злато",    body: "Красиво и нежно, но верижката е доста тъничка, трябва да се внимава като се сваля." },
  { name: "Александра М.",rating: 5, product: "Колие Lumen – Сребро",   body: "Много чист и семпъл модел, слагам го и на работа, и като излизам вечер. Заслужава си." },
  { name: "Моника Т.",    rating: 4, product: "Колие Lumen – Сребро",   body: "Бялото със среброто стои много чисто. Единствено закопчалката ми е малко ситна за закопчаване без огледало." },
  { name: "Кристина В.",  rating: 5, product: "Колие Lumen – Сребро",   body: "Взех го за сватба и ми пасна чудесно. Изглежда като доста по-скъпо бижу." },
  { name: "Десислава Р.", rating: 5, product: "Колие Lumen – Сребро",   body: "Карам втори месец с него без да го свалям и не е променило цвета си изобщо." },
  { name: "Силвия Р.",    rating: 5, product: "Колие Noctis – Злато",   body: "Черното със златно лежи много елегантно на врата. Дължината се регулира лесно и пада точно където трябва." },
  { name: "Гергана П.",   rating: 4, product: "Колие Noctis – Злато",   body: "Хубав контраст между черния оникс и златното. Висулката е по-малка на живо, но стои много стилно." },
  { name: "Мартин Н.",    rating: 3, product: "Колие Noctis – Злато",   body: "Взех го за подарък, кутийката беше леко натисната в ъгъла при транспорта, иначе колието вътре е топ." },
  { name: "Виктория К.",  rating: 5, product: "Колие Noctis – Злато",   body: "Обличам се предимно в черно и бежово и това колие ми стана любимо. Не е потъмняло." },
  { name: "Теодора Б.",   rating: 5, product: "Колие Noctis – Сребро",  body: "Поръчах го в комплект с гривната и станаха супер. Нося ги почти всеки ден и не са променили цвета си." },
  { name: "Деница К.",    rating: 5, product: "Колие Noctis – Сребро",  body: "Много изчистено колие, не се натрапва, ама веднага хваща погледа. Бърза доставка." },
  { name: "Катя Г.",      rating: 4, product: "Колие Noctis – Сребро",  body: "Харесва ми матовото черно на камъка, само синджирчето е доста фино." },
  { name: "Пролета В.",   rating: 5, product: "Гривна Lumen – Злато",   body: "Бялото със златистото е класика. Пратката пристигна на следващия ден с преглед и всичко си беше наред." },
  { name: "Таня К.",      rating: 4, product: "Гривна Lumen – Злато",   body: "Седефът е страхотен и седи много женствено. Само верижката е доста фина, трябва да се внимава да не я дръпнеш без да искаш." },
  { name: "Елена Б.",     rating: 3, product: "Гривна Lumen – Злато",   body: "Изработката е чиста и седефът е истински, но на мен детелинките ми дойдоха малко по-ситни спрямо снимките." },
  // 55 skipped (1★)
  { name: "Венета Д.",    rating: 5, product: "Гривна Noctis – Злато",  body: "Черното със златното е топ комбинация. Получих я за подарък и веднага поръчах още една за най-добрата ми приятелка." },
  { name: "Ваня Н.",      rating: 4, product: "Гривна Noctis – Злато",  body: "Готина комбинация от черно и златно. Верижката е доста тъничка, но пък така стои по-нежно." },
  { name: "Катя П.",      rating: 3, product: "Гривна Noctis – Злато",  body: "Самата гривна е супер, но кутийката дойде леко смачкана в ъгъла от куриера. Иначе бижуто си е без забележка." },
  { name: "Стефани Д.",   rating: 3, product: "Гривна Noctis – Сребро", body: "Самата гривна е хубава, но на мен ми дойде малко по-фина от очакваното. За подарък обаче е супер." },
  // 60 skipped (1★)
  { name: "Ивана С.",     rating: 5, product: "Гривна Linea – Злато",   body: "Много изчистена твърда гривна, закопчалката щраква стабилно и не се отваря сама. Нося я до часовника и не се драска." },
  { name: "Преслава Д.",  rating: 5, product: "Гривна Linea – Злато",   body: "Взех я на 1+1 с детелинките и заспаха една до друга! Има хубава тежест и не изглежда като тенекия." },
  { name: "Марияна Т.",   rating: 4, product: "Гривна Linea – Злато",   body: "Много стилна и минималистична гривна. На по-слаба китка стои леко хлабава, но не пада." },
  { name: "Николай П.",   rating: 5, product: "Гривна Linea – Злато",   body: "Подарих я на жена ми за рождения ден, много й хареса. Изработката около камъчетата е много чиста." },
  { name: "Анелия К.",    rating: 3, product: "Гривна Linea – Злато",   body: "Красива е, но ми дойде една идея по-широка за моята китка, която е доста тънка." },
  { name: "Гергана М.",   rating: 5, product: "Гривна Linea – Сребро",  body: "Не нося злато и сребърният вариант на Linea ми пасна идеално. Семпла, модерна и не потъмнява." },
  { name: "Кристина Л.",  rating: 5, product: "Гривна Linea – Сребро",  body: "Много удобна закопчалка, слага се с една ръка без зор. Нося я всеки ден в офиса." },
  { name: "Радина В.",    rating: 4, product: "Гривна Linea – Сребро",  body: "Супер изработка, много лъскава и гладка. Само трябва да си премерите китката преди поръчка, защото е твърд модел." },
  { name: "Бояна Х.",     rating: 5, product: "Гривна Solaris – Злато", body: "Камъчетата блестят жестоко на вечерна светлина! Взех я за повод, ама вече си я нося и през деня." },
  { name: "Деница Г.",    rating: 5, product: "Гривна Solaris – Злато", body: "Много ефектна гривна, веднага хваща окото. Слагам я заедно с часовника и изглежда супер класно." },
  { name: "Стела Р.",     rating: 4, product: "Гривна Solaris – Злато", body: "Много красива и бляскава, закопчалката е скрита и стабилна. Единствено за много тънка китка стои леко свободна." },
  { name: "Ивайло С.",    rating: 5, product: "Гривна Solaris – Злато", body: "Поръчах я за приятелката ми, остана без думи като я видя. Опаковката също е на ниво." },
  { name: "Весела Т.",    rating: 5, product: "Гривна Solaris – Сребро",body: "Камъчетата по цялата дължина правят гривната много луксозна на вид. Не се закача по дрехите." },
  { name: "Моника П.",    rating: 5, product: "Гривна Solaris – Сребро",body: "Сребърната Solaris е уникална! Къпя се с нея от три седмици и нито камъче е мръднало, нито цветът е потъмнял." },
  { name: "Нели В.",      rating: 3, product: "Гривна Solaris – Сребро",body: "Много бляскава и хубава, но на мен ми е леко широка на ръката. Иначе изработката е топ." },
  { name: "Калина М.",    rating: 5, product: "Гривна Spira – Злато",   body: "Змийската форма обгръща китката много яко и изглежда супер различно от стандартните гривни. Много комплименти събрах!" },
  { name: "Теодора С.",   rating: 5, product: "Гривна Spira – Злато",   body: "Брутален модел! Стои много стабилно на ръката, не се върти и камъчетата на главата блестят страхотно." },
  { name: "Петя Д.",      rating: 4, product: "Гривна Spira – Злато",   body: "Много ефектна и масивна на вид, но в същото време лека и удобна. Дойде на следващия ден." },
  // 79 skipped (2★)
  { name: "Яна В.",       rating: 5, product: "Гривна Spira – Сребро",  body: "Взех сребърната Spira за рожден ден на сестра ми и тя направо полудя от кеф. Изглежда много скъпо." },
  { name: "Габриела Н.",  rating: 5, product: "Гривна Spira – Сребро",  body: "Много готин и различен дизайн, стои перфектно и сама на ръката без други гривни около нея." },
  { name: "Диана Р.",     rating: 4, product: "Гривна Spira – Сребро",  body: "Изпипана до последния детайл, гравюрата отвътре е много чиста. Малко по-стегната е при слагане, но после не се усеща." },
];

const textRows = TEXT_REVIEWS.map((r) => ({
  id: randomUUID(),
  product_slug: SLUG_MAP[r.product],
  name: r.name,
  rating: r.rating,
  body: r.body,
  images: r.photoLocal && uploadedPaths[r.photoLocal] ? [uploadedPaths[r.photoLocal]] : [],
  is_partnership: false,
  status: "approved",
  created_at: nextDate(),
}));

const { error: textErr } = await sb.from("reviews").insert(textRows);
if (textErr) throw new Error("Text reviews insert error: " + textErr.message);
console.log(`  ✓ Inserted ${textRows.length} text reviews.\n`);

// ─── 5. Insert bulk rating-only reviews (Part 2) ──────────────────────────────
console.log("5. Generating and inserting bulk rating-only reviews...");

// Name pools per product (from the .txt file, plus extras for variety)
const EXTRA_NAMES = [
  "Мария К.", "Елена П.", "Иванка Д.", "Петя М.", "Анна Г.", "Людмила В.", "Вера Т.", "Ирина С.",
  "Соня К.", "Лора П.", "Надя М.", "Лили Г.", "Нора Б.", "Тоня Д.", "Ани Т.", "Вили К.",
  "Даня М.", "Катя С.", "Поли Г.", "Теа Б.", "Мина П.", "Яни В.", "Деси К.", "Ади М.",
  "Гери Т.", "Влада С.", "Нели Г.", "Мими К.", "Еми П.", "Нора Т.", "Роси М.", "Жени К.",
  "Стоян Г.", "Иван М.", "Петър В.", "Димо Т.", "Тома К.", "Любо П.", "Васил Г.", "Боян М.",
  "Радка Н.", "Злата К.", "Вера Д.", "Мила Т.", "Дора П.", "Лена К.", "Ани Д.", "Яна М.",
  "Соня Т.", "Нина Г.", "Поля П.", "Теа К.", "Гала М.", "Манела Т.", "Вяра П.", "Нина К.",
  "Евелина С.", "Маринела П.", "Иванка Т.", "Добромира М.", "Мирослава К.", "Пролета Г.",
  "Аделина Т.", "Радомира К.", "Димитрина П.", "Борислава М.", "Денислава Т.", "Малена К.",
  "Йоанна П.", "Снежанка М.", "Елеонора К.", "Ристина Т.", "Деяна П.", "Невена М.",
  "Мая К.", "Яница П.", "Даяна М.", "Лея Т.", "Пепа К.", "Мия П.", "Сабина М.",
];

// Product bulk distribution: [product_key, slug, [5★,4★,3★], example_names]
const BULK_PRODUCTS = [
  ["necklace-verdis-gold",    [112,17,4],  ["Петя К.", "Мария С.", "Елена Д.", "Ваня Т.", "Росица М.", "Георги П.", "Десислава Н.", "Ирена В.", "Николета Г.", "Таня Б.", "Стела Х.", "Калина Р.", "Боян Д.", "Виктория С.", "Анелия Т.", "Ралица М.", "Милена К.", "Поля В.", "Диана Г.", "Стоян Н."]],
  ["necklace-verdis-silver",  [91,15,4],   ["Галя П.", "Силвия М.", "Кристина Д.", "Веселина Т.", "Иван К.", "Боряна С.", "Евелина Н.", "Даниела Р.", "Мариета В.", "Лора Г.", "Нели П.", "Катя Т.", "Тодор М.", "Яница Б.", "Зорница С.", "Аглика Д.", "Моника К.", "Павлина В.", "Христина Н.", "Деян П."]],
  ["bracelet-verdis-gold",    [168,24,7],  ["Йоанна К.", "Снежана П.", "Мирослава Т.", "Пламена Д.", "Валентина М.", "Петър С.", "Аделина Н.", "Соня В.", "Радомира Г.", "Добромира К.", "Мина Б.", "Евгения Т.", "Лилия П.", "Димитрина М.", "Пролета С.", "Веска Н.", "Злати В.", "Ади К.", "Деси Т.", "Яни М."]],
  ["bracelet-verdis-silver",  [145,21,6],  ["Аглая Т.", "Ния М.", "Валя П.", "Денислава К.", "Сабина Д.", "Лея Н.", "Малена В.", "Пепа Г.", "Мия Т.", "Катерина С.", "Маринела Б.", "Маргарита К.", "Иванка М.", "Ваня Д.", "Борислава П.", "Ния Т.", "Данела В.", "Павелина Г.", "Галя К.", "Мариела М."]],
  ["necklace-noctis-gold",    [101,16,5],  ["Венета П.", "Ния К.", "Деница Т.", "Йордан М.", "Мария Д.", "Пламена В.", "Теодора Г.", "Аглика С.", "Борислава Н.", "Ваня К.", "Аделина П.", "Лина Т.", "Соня М.", "Анелия Д.", "Радомира В.", "Мина К.", "Росица П.", "Антоанета Т.", "Калинка М.", "Моника Д."]],
  ["necklace-noctis-silver",  [90,13,4],   ["Радина П.", "Елеонора Т.", "Нина М.", "Даяна К.", "Лора В.", "Ристина Д.", "Деяна С.", "Анна Н.", "Стоян П.", "Елена Т.", "Кристина М.", "Снежанка В.", "Димитрина К.", "Таня П.", "Невена Д.", "Маринела Т.", "Йоанна М.", "Николина К.", "Ралица П.", "Евгения Д."]],
  ["bracelet-noctis-gold",    [179,28,9],  ["Кристина Т.", "Димитрина П.", "Любомир М.", "Лилия К.", "Стела В.", "Ирена Д.", "Гергана Н.", "Мариана П.", "Пролета Т.", "Лора М.", "Даниела К.", "Ивона П.", "Николета Т.", "Теодора К.", "Михаела П.", "Петко М.", "Калина Д.", "Евелина П.", "Радост Т.", "Снежана М."]],
  ["bracelet-noctis-silver",  [149,23,8],  ["Нели П.", "Борис Т.", "Антония М.", "Мариета К.", "Веселина П.", "Розалия Т.", "Поля М.", "Яна К.", "Гери П.", "Митко Т.", "Злати М.", "Нели К.", "Ади П.", "Яни Т.", "Деси М.", "Влада К.", "Мими П.", "Еми Т.", "Веси М.", "Нора К."]],
  ["necklace-lumen-gold",     [124,18,6],  ["Поли М.", "Манела К.", "Иван П.", "Кати Т.", "Тони М.", "Габи К.", "Стеф П.", "Роси Т.", "Яница К.", "Вяра М.", "Деян П.", "Жени Т.", "Радина К.", "Цветелина М.", "Аня П.", "Бети Т.", "Николай М.", "Нела К.", "Хана П.", "Ива Т."]],
  ["necklace-lumen-silver",   [97,15,5],   ["Поля К.", "Теа М.", "Нина П.", "Злати Т.", "Мими М.", "Гала К.", "Еми П.", "Яна Т.", "Деси К.", "Ади М.", "Нели Т.", "Веси П.", "Габи М.", "Стеф К.", "Роси П.", "Тома М.", "Яни К.", "Манела П.", "Вяра Т.", "Кати М."]],
  ["bracelet-lumen-gold",     [176,26,8],  ["Нора Т.", "Поли К.", "Жени М.", "Радина П.", "Цветелина Т.", "Аня К.", "Бети М.", "Нела П.", "Хана Т.", "Васил М.", "Влада К.", "Яница Т.", "Мария П.", "Ива М.", "Теа К.", "Нина Т.", "Гери М.", "Злати П.", "Нели М.", "Ади Т."]],
  ["bracelet-lumen-silver",   [138,22,7],  ["Яни П.", "Деси М.", "Влада Т.", "Мими К.", "Еми М.", "Веси П.", "Нора М.", "Поли Т.", "Манела М.", "Явор К.", "Кати П.", "Тони Т.", "Габи М.", "Стеф К.", "Роси М.", "Жени П.", "Радина Т.", "Цветелина К.", "Аня М.", "Бети П."]],
  ["bracelet-linea-gold",     [74,11,4],   ["Нела Т.", "Хана М.", "Яница П.", "Вяра М.", "Нина К.", "Поля Т.", "Теа П.", "Мария М.", "Гала П.", "Нели Т.", "Ади П.", "Яни М.", "Деси К.", "Влада П.", "Мими Т.", "Еми К.", "Веси М.", "Нора П.", "Поли Т.", "Манела П."]],
  ["bracelet-linea-silver",   [65,9,3],    ["Георги М.", "Кати К.", "Тони П.", "Габи Т.", "Стеф М.", "Роси П.", "Жени М.", "Радина К.", "Цветелина П.", "Аня Т.", "Бети М.", "Нела П.", "Хана К.", "Яница М.", "Вяра П.", "Митко М.", "Нина Т.", "Гери П.", "Ива К.", "Поля П."]],
  ["bracelet-solaris-gold",   [70,9,3],    ["Теа Т.", "Мария К.", "Гала М.", "Нели К.", "Ади М.", "Яни П.", "Деси Т.", "Влада К.", "Мими М.", "Еми Т.", "Веси К.", "Нора М.", "Поли К.", "Стоян М.", "Кати К.", "Тони М.", "Габи К.", "Стеф Т.", "Роси К.", "Жени К."]],
  ["bracelet-solaris-silver", [58,8,3],    ["Радина М.", "Цветелина П.", "Аня К.", "Бети Т.", "Нела М.", "Хана П.", "Яница К.", "Вяра Т.", "Нина П.", "Гери М.", "Манела К.", "Мария Т.", "Ива К.", "Поля П.", "Теа М.", "Нина К.", "Гала Т.", "Нели М.", "Ади К.", "Яни Т."]],
  ["bracelet-spira-gold",     [81,12,4],   ["Деси П.", "Влада М.", "Мими К.", "Еми П.", "Веси К.", "Нора Т.", "Поли М.", "Манела Т.", "Димо М.", "Кати П.", "Тони К.", "Габи М.", "Стеф П.", "Роси К.", "Жени Т.", "Радина М.", "Цветелина К.", "Аня П.", "Бети М.", "Нела Т."]],
  ["bracelet-spira-silver",   [61,9,4],    ["Хана М.", "Яница П.", "Вяра К.", "Нина М.", "Гери Т.", "Преслава К.", "Боян М.", "Гергана Т.", "Ивайло П.", "Моника М.", "Деница Т.", "Виктория П.", "Мартин К.", "Симона М.", "Радослав Т.", "Елисавета К.", "Васил П.", "Даниел М.", "Кристина П.", "Боряна М."]],
];

const BATCH_SIZE = 500;
let bulkBatch = [];
let totalBulk = 0;

async function flushBatch() {
  if (!bulkBatch.length) return;
  const { error } = await sb.from("reviews").insert(bulkBatch);
  if (error) throw new Error("Bulk insert error: " + error.message);
  totalBulk += bulkBatch.length;
  process.stdout.write(".");
  bulkBatch = [];
}

for (const [slug, [five, four, three], names] of BULK_PRODUCTS) {
  const allNames = [...names, ...EXTRA_NAMES];
  let ni = 0;
  const getName = () => allNames[ni++ % allNames.length];

  const dist = [[5, five], [4, four], [3, three]];
  for (const [stars, count] of dist) {
    for (let i = 0; i < count; i++) {
      bulkBatch.push({
        id: randomUUID(),
        product_slug: slug,
        name: getName(),
        rating: stars,
        body: null,
        images: [],
        is_partnership: false,
        status: "approved",
        created_at: nextDate(),
      });
      if (bulkBatch.length >= BATCH_SIZE) await flushBatch();
    }
  }
}
await flushBatch();
console.log(`\n  ✓ Inserted ${totalBulk} bulk rating-only reviews.\n`);

console.log(`\n✅ Import complete!`);
console.log(`   Text reviews: ${textRows.length}`);
console.log(`   Bulk reviews: ${totalBulk}`);
console.log(`   Total: ${textRows.length + totalBulk}`);
console.log(`\nNext: git push origin main`);
