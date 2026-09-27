import type { Product } from "./types";

// Confirmed crocodile species (per CITES permit) - single source for both the
// specs "Вид" row and the LeatherDescription.tsx CITES bullet everywhere they're
// used below. citesPermitNumber (the per-product permit reference) is still
// pending - see Product.citesPermitNumber in lib/types.ts.
const SIAMESE_CROCODILE = "сиамски крокодил (Crocodylus siamensis)";
const NILE_CROCODILE = "нилски крокодил (Crocodylus niloticus)";

export const products: Product[] = [
  // ─── WATCHES ────────────────────────────────────────────────────────────────
  // Yachting collection - 3 dial colours of one design, placed first so they lead
  // the homepage watches section (FeaturedWatches renders getWatches() in array
  // order) and the /watches page. The original 3 watches are unchanged, just moved
  // below. Case size is the owner's measurement (2026-09-27); weight is pending (empty,
  // hidden row). Case material and dial construction aren't in `specs` - no confirmed
  // figures were given for those, and this file doesn't invent them.
  {
    id: "yachting-black",
    slug: "yachting-black",
    sku: "LR-YACHT-BLK",
    name: "Yachting Black",
    category: "watches",
    price: 140,
    currency: "€",
    inStock: true,
    warranty: "Търговска гаранция 5 години",
    shortDescription: "Италиански дизайн. Японска точност.",
    description:
      "Yachting Black: часовник с компасен циферблат в черно, корпус 44 мм, сапфирено стъкло и японски кварцов механизъм. Водоустойчив до 50 метра, с каучукова верижка и светещи индекси и стрелки.",
    tabDescription: [
      "Корпус 44 мм на ширина, 53.7 мм от ухо до ухо и 12.8 мм дебелина: едър часовник с присъствие на китката, в черно от корпуса до верижката. Каучуковата верижка с релефна структура е мека и ляга плътно.",
      "Индексите и стрелките светят на тъмно, както се вижда на втората снимка. Пристига в кутия за пътуване с капак, показана в галерията.",
    ],
    features: [
      "Лимитирана серия - след изчерпване няма да бъде произвеждана отново",
      "Сапфирено кристално стъкло",
      "Високопрецизен японски кварцов механизъм",
      "Каучукова верижка с релефна структура",
      "Светещи индекси и стрелки",
      "Водоустойчивост до 50 метра",
    ],
    specs: [
      { label: "Размери", value: "44 мм × 53.7 мм × 12.8 мм" }, // owner, 2026-09-27: width × lug-to-lug × thickness
      { label: "Тегло", value: "" }, // empty → row hidden until the owner gives the weight
      { label: "Стъкло", value: "Сапфирено кристално стъкло" },
      { label: "Механизъм", value: "Японски кварцов механизъм" },
      { label: "Каишка", value: "Каучук с релефна структура" },
      { label: "Водоустойчивост", value: "До 50 метра" },
    ],
    coverImage: {
      src: `/Products/watches/Yachting Black/yachting-black-hronograf-preden-izgled-v2.webp`,
      alt: "Lorenzo Ricci Yachting Black луксозен часовник - компасен циферблат, сапфирено стъкло",
    },
    images: [
      { src: `/Products/watches/Yachting Black/yachting-black-hronograf-preden-izgled-v2.webp`, alt: "Lorenzo Ricci Yachting Black - преден изглед, компасна роза и градусова скала" },
      { src: `/Products/watches/Yachting Black/yachting-black-lume-noshten-rejim-v2.webp`,        alt: "Lorenzo Ricci Yachting Black нощен режим - светещи индекси и стрелки" },
      { src: `/Products/watches/Yachting Black/yachting-black-stranicen-izgled-v2.webp`,          alt: "Lorenzo Ricci Yachting Black - страничен изглед, корона и каучукова верижка" },
      { src: `/Products/watches/Yachting Black/yachting-black-zadna-strana-v2.webp`,              alt: "Lorenzo Ricci Yachting Black - задна страна на корпуса, гравиран компас YACHTING" },
      { src: `/Products/watches/Yachting Black/yachting-black-kutiya-otvorena.webp`,           alt: "Lorenzo Ricci Yachting Black в луксозна кутия за пътуване" },
      { src: `/Products/watches/Yachting Black/yachting-black-kutiya-otvorena-detail.webp`,    alt: "Lorenzo Ricci Yachting Black - луксозна кутия за пътуване, друг ъгъл" },
    ],
  },
  {
    id: "yachting-blue",
    slug: "yachting-blue",
    sku: "LR-YACHT-BLU",
    name: "Yachting Blue",
    category: "watches",
    price: 140,
    currency: "€",
    inStock: true,
    warranty: "Търговска гаранция 5 години",
    shortDescription: "Италиански дизайн. Японска точност.",
    description:
      "Yachting Blue: часовник с компасен циферблат в синьо, корпус 44 мм, сапфирено стъкло и японски кварцов механизъм. Водоустойчив до 50 метра, с каучукова верижка и светещи индекси и стрелки.",
    tabDescription: [
      "Корпус 44 мм на ширина, 53.7 мм от ухо до ухо и 12.8 мм дебелина: едър часовник с присъствие на китката, със син циферблат и синя верижка към черния корпус. Каучуковата верижка с релефна структура е мека и ляга плътно.",
      "Индексите и стрелките светят на тъмно, както се вижда на втората снимка. Пристига в кутия за пътуване с капак, показана в галерията.",
    ],
    features: [
      "Лимитирана серия - след изчерпване няма да бъде произвеждана отново",
      "Сапфирено кристално стъкло",
      "Високопрецизен японски кварцов механизъм",
      "Каучукова верижка с релефна структура",
      "Светещи индекси и стрелки",
      "Водоустойчивост до 50 метра",
    ],
    specs: [
      { label: "Размери", value: "44 мм × 53.7 мм × 12.8 мм" }, // owner, 2026-09-27: width × lug-to-lug × thickness
      { label: "Тегло", value: "" }, // empty → row hidden until the owner gives the weight
      { label: "Стъкло", value: "Сапфирено кристално стъкло" },
      { label: "Механизъм", value: "Японски кварцов механизъм" },
      { label: "Каишка", value: "Каучук с релефна структура" },
      { label: "Водоустойчивост", value: "До 50 метра" },
    ],
    coverImage: {
      src: `/Products/watches/Yachting Blue/yachting-blue-hronograf-preden-izgled-v2.webp`,
      alt: "Lorenzo Ricci Yachting Blue луксозен часовник - синьо, компасен циферблат, сапфирено стъкло",
    },
    images: [
      { src: `/Products/watches/Yachting Blue/yachting-blue-hronograf-preden-izgled-v2.webp`, alt: "Lorenzo Ricci Yachting Blue - преден изглед, компасна роза и градусова скала" },
{ src: `/Products/watches/Yachting Blue/yachting-blue-lume-noshten-rejim-v3.webp`,       alt: "Lorenzo Ricci Yachting Blue нощен режим - светещи индекси и стрелки" },
      { src: `/Products/watches/Yachting Blue/yachting-blue-stranicen-izgled-v2.webp`,         alt: "Lorenzo Ricci Yachting Blue - страничен изглед, корона и каучукова верижка" },
            { src: `/Products/watches/Yachting Blue/yachting-blue-zadna-strana-v2.webp`,             alt: "Lorenzo Ricci Yachting Blue - задна страна на корпуса, гравиран компас YACHTING" },
      { src: `/Products/watches/Yachting Blue/yachting-blue-kutiya-otvorena.webp`,          alt: "Lorenzo Ricci Yachting Blue в луксозна кутия за пътуване" },
      { src: `/Products/watches/Yachting Blue/yachting-blue-kaishka-kopchalka.webp`,        alt: "Lorenzo Ricci Yachting Blue - закопчалка, детайл на каучуковата верижка" },
    ],
  },
  {
    id: "yachting-white",
    slug: "yachting-white",
    sku: "LR-YACHT-WHT",
    name: "Yachting White",
    category: "watches",
    price: 140,
    currency: "€",
    inStock: true,
    warranty: "Търговска гаранция 5 години",
    shortDescription: "Италиански дизайн. Японска точност.",
    description:
      "Yachting White: часовник с компасен циферблат в бяло, корпус 44 мм, сапфирено стъкло и японски кварцов механизъм. Водоустойчив до 50 метра, с каучукова верижка и светещи индекси и стрелки.",
    tabDescription: [
      "Корпус 44 мм на ширина, 53.7 мм от ухо до ухо и 12.8 мм дебелина: едър часовник с присъствие на китката, целият в бяло с черен кант на верижката. Каучуковата верижка с релефна структура е мека и ляга плътно.",
      "Индексите и стрелките светят на тъмно, както се вижда на втората снимка. Пристига в кутия за пътуване с капак, показана в галерията.",
    ],
    features: [
      "Лимитирана серия - след изчерпване няма да бъде произвеждана отново",
      "Сапфирено кристално стъкло",
      "Високопрецизен японски кварцов механизъм",
      "Каучукова верижка с релефна структура",
      "Светещи индекси и стрелки",
      "Водоустойчивост до 50 метра",
    ],
    specs: [
      { label: "Размери", value: "44 мм × 53.7 мм × 12.8 мм" }, // owner, 2026-09-27: width × lug-to-lug × thickness
      { label: "Тегло", value: "" }, // empty → row hidden until the owner gives the weight
      { label: "Стъкло", value: "Сапфирено кристално стъкло" },
      { label: "Механизъм", value: "Японски кварцов механизъм" },
      { label: "Каишка", value: "Каучук с релефна структура" },
      { label: "Водоустойчивост", value: "До 50 метра" },
    ],
    coverImage: {
      src: `/Products/watches/Yachting White/yachting-white-hronograf-preden-izgled-v2.webp`,
      alt: "Lorenzo Ricci Yachting White луксозен часовник - бял корпус, компасен циферблат, сапфирено стъкло",
    },
    images: [
      { src: `/Products/watches/Yachting White/yachting-white-hronograf-preden-izgled-v2.webp`, alt: "Lorenzo Ricci Yachting White - преден изглед, компасна роза и градусова скала" },
{ src: `/Products/watches/Yachting White/yachting-white-lume-noshten-rejim-v3.webp`,       alt: "Lorenzo Ricci Yachting White нощен режим - светещи индекси и стрелки" },
      { src: `/Products/watches/Yachting White/yachting-white-stranicen-izgled-v2.webp`,         alt: "Lorenzo Ricci Yachting White - страничен изглед, корона и каучукова верижка" },
      { src: `/Products/watches/Yachting White/yachting-white-na-ruka.webp`,                  alt: "Lorenzo Ricci Yachting White на ръка - лайфстайл изглед" },
            { src: `/Products/watches/Yachting White/yachting-white-zadna-strana-v2.webp`,             alt: "Lorenzo Ricci Yachting White - задна страна на корпуса, гравиран компас YACHTING" },
      { src: `/Products/watches/Yachting White/yachting-white-kutiya-otvorena.webp`,          alt: "Lorenzo Ricci Yachting White в луксозна кутия за пътуване" },
      { src: `/Products/watches/Yachting White/yachting-white-kaishka-kopchalka.webp`,        alt: "Lorenzo Ricci Yachting White - закопчалка, детайл на каучуковата верижка" },
    ],
  },
  {
    id: "chrono-black",
    slug: "chrono-black",
    sku: "LR-CHRONO-BLK",
    name: "Chrono Black",
    category: "watches",
    price: 279,
    currency: "€",
    inStock: true,
    warranty: "Търговска гаранция 5 години",
    shortDescription: "Италиански дизайн. Японска точност.",
    description:
      "Chrono Black въплъщава мощта на нощта в изчистен хронограф. Корпусът от премиум неръждаема стомана 316L, частично скелетизираният многослоен циферблат и сапфиреното кристално стъкло създават часовник, който изразява характер без усилие. Хипоалергенната силиконова каишка осигурява комфорт при продължително носене.",
    tabDescription: [
      "Черно на черно: корпус, циферблат и каишка в един тон. Стоманата 316L устоява на удари и корозия, сапфиреното стъкло на драскотини, а силиконовата каишка остава удобна с часове.",
      "Стои еднакво добре под риза и с тениска, а 5 ATM водоустойчивост поемат дъжд и плуване по повърхността. Пристига в луксозна кутия, с 5 години търговска гаранция.",
    ],
    features: [
      "Сапфирен кристал - изключителна яснота и защита от надраскване",
      "Японски кварцов механизъм - прецизен и надежден",
      "Водоустойчивост 5 ATM / 50 м",
      "316L неръждаема стомана - хипоалергенна, нержавяваща",
      "Хронограф с многофункционален циферблат",
      "Хипоалергенна дишаща силиконова каишка",
    ],
    specs: [
      { label: "Корпус", value: "Премиум неръждаема стомана 316L" },
      { label: "Размери", value: "43 мм × 50 мм × 16 мм" },
      { label: "Стъкло", value: "Сапфирен кристал" },
      { label: "Механизъм", value: "Японски кварцов хронограф" },
      { label: "Циферблат", value: "Частично скелетизиран, многослоен" },
      { label: "Каишка", value: "Хипоалергенен силикон" },
      { label: "Водоустойчивост", value: "5 ATM / 50 м" },
    ],
    coverImage: {
      src: `/Products/watches/Chrono Black/chrono-black-hronograf-preden-izgled.webp`,
      alt: "Lorenzo Ricci Chrono Black луксозен хронограф - преден изглед, 316L стомана сапфирен кристал",
    },
    images: [
      { src: `/Products/watches/Chrono Black/chrono-black-hronograf-preden-izgled.webp`,  alt: "Lorenzo Ricci Chrono Black хронограф - преден изглед, японски кварцов механизъм" },
      { src: `/Products/watches/Chrono Black/chrono-black-lume-noshten-rejim.webp`,        alt: "Lorenzo Ricci Chrono Black нощен режим - светещи маркери lume, циферблат детайл" },
      { src: `/Products/watches/Chrono Black/chrono-black-lifestyle.webp`,                 alt: "Lorenzo Ricci Chrono Black - лайфстайл снимка, луксозен мъжки часовник" },
      { src: `/Products/watches/Chrono Black/chrono-black-zadna-strana.webp`,              alt: "Lorenzo Ricci Chrono Black - задна страна на корпуса 316L неръждаема стомана" },
      { src: `/Products/watches/Chrono Black/chrono-black-stranicen-izgled.webp`,          alt: "Lorenzo Ricci Chrono Black - страничен изглед, водоустойчивост 5 ATM" },
      { src: `/Products/watches/Chrono Black/chrono-black-kutiya-otvorena.webp`,           alt: "Lorenzo Ricci Chrono Black в луксозна кутия - подаръчна опаковка отворена" },
      { src: `/Products/watches/Chrono Black/chrono-black-kutiya-zatvorena.webp`,          alt: "Lorenzo Ricci Chrono Black затворена подаръчна кутия" },
      { src: `/Products/watches/Chrono Black/chrono-black-skeletiziran-tsiferbat.webp`,    alt: "Lorenzo Ricci Chrono Black - детайл на хронографа, скелетизиран циферблат" },
    ],
    descriptionImages: [
      { src: `/Products/watches/Chrono Black/description/chrono-black-editorial.webp`, alt: "Lorenzo Ricci Chrono Black - лайфстайл editorial, луксозен хронограф" },
      { src: `/Products/watches/Chrono Black/chrono-black-lifestyle.webp`,             alt: "Lorenzo Ricci Chrono Black - lifestyle снимка на китката" },
    ],
    quoteVideo: "/chrono-black-quote.mp4",
  },
  {
    id: "golden-eclipse",
    slug: "golden-eclipse",
    sku: "LR-MIDNIGHT-ECL",
    name: "Golden Eclipse",
    category: "watches",
    price: 299,
    currency: "€",
    inStock: true,
    warranty: "Търговска гаранция 5 години",
    shortDescription: "Италиански дизайн. Японска точност.",
    description:
      "Golden Eclipse е ода към слънцето - великолепен хронограф, създаден за тези, които носят успеха си на китката. Позлатеният корпус от стомана 316L, скелетизираният циферблат и сапфиреното стъкло съставят силует с незаменимо присъствие. Изтънчен италиански дизайн и майсторска изработка, в която всеки детайл има значение.",
    tabDescription: [
      "Позлатата хваща светлината и я връща, часовник, който се забелязва пръв. Основата е стомана 316L в топъл златист тон, а скелетизираният циферблат под сапфирено стъкло отваря поглед към механиката.",
      "Осезаема тежест на китката, силиконова каишка за комфорт, 5 ATM водоустойчивост. За вечерята, снимката, срещата. Пристига в луксозна кутия, с 5 години търговска гаранция.",
    ],
    features: [
      "Сапфирен кристал - изключителна яснота и защита от надраскване",
      "Японски кварцов механизъм - прецизен и надежден",
      "Водоустойчивост 5 ATM / 50 м",
      "316L неръждаема стомана - хипоалергенна, нержавяваща",
      "Хронограф с многофункционален циферблат",
      "Хипоалергенна дишаща силиконова каишка",
    ],
    specs: [
      { label: "Корпус", value: "Премиум неръждаема стомана 316L" },
      { label: "Размери", value: "43 мм × 50 мм × 16 мм" },
      { label: "Стъкло", value: "Сапфирен кристал" },
      { label: "Механизъм", value: "Японски кварцов хронограф" },
      { label: "Циферблат", value: "Частично скелетизиран, многослоен" },
      { label: "Каишка", value: "Хипоалергенен силикон" },
      { label: "Водоустойчивост", value: "5 ATM / 50 м" },
    ],
    coverImage: {
      src: `/Products/watches/Golden Eclipse/golden-eclipse-hronograf-preden-izgled.webp`,
      alt: "Lorenzo Ricci Golden Eclipse луксозен хронограф - позлатен корпус 316L стомана сапфирен кристал",
    },
    images: [
      { src: `/Products/watches/Golden Eclipse/golden-eclipse-hronograf-preden-izgled.webp`, alt: "Lorenzo Ricci Golden Eclipse хронограф - преден изглед, позлатен корпус 18K PVD" },
      { src: `/Products/watches/Golden Eclipse/golden-eclipse-lume-noshten-rejim.webp`,      alt: "Lorenzo Ricci Golden Eclipse нощен режим - светещи маркери lume, скелетизиран циферблат" },
      { src: `/Products/watches/Golden Eclipse/golden-eclipse-na-ruka.webp`,                 alt: "Lorenzo Ricci Golden Eclipse на ръка - позлатен хронограф, лайфстайл изглед" },
      { src: `/Products/watches/Golden Eclipse/golden-eclipse-lifestyle-2.webp`,             alt: "Lorenzo Ricci Golden Eclipse - лайфстайл снимка, италиански дизайн" },
      { src: `/Products/watches/Golden Eclipse/golden-eclipse-pozlaten-tsiferbat.webp`,      alt: "Lorenzo Ricci Golden Eclipse - детайл на позлатения циферблат 18K PVD" },
      { src: `/Products/watches/Golden Eclipse/golden-eclipse-zadna-strana.webp`,            alt: "Lorenzo Ricci Golden Eclipse - задна страна на корпуса, 316L неръждаема стомана" },
      { src: `/Products/watches/Golden Eclipse/golden-eclipse-stranicen-izgled.webp`,        alt: "Lorenzo Ricci Golden Eclipse - страничен изглед, водоустойчивост 5 ATM" },
      { src: `/Products/watches/Golden Eclipse/golden-eclipse-kaishka-kopchalka.webp`,       alt: "Lorenzo Ricci Golden Eclipse - закопчалка, хипоалергенна силиконова каишка" },
      { src: `/Products/watches/Golden Eclipse/golden-eclipse-kutiya-otvorena.webp`,         alt: "Lorenzo Ricci Golden Eclipse в луксозна кутия - подаръчна опаковка отворена" },
      { src: `/Products/watches/Golden Eclipse/golden-eclipse-kutiya-zatvorena.webp`,        alt: "Lorenzo Ricci Golden Eclipse затворена подаръчна кутия" },
    ],
    descriptionImages: [
      { src: `/Products/watches/Golden Eclipse/description/golden-eclipse-editorial-1.webp`, alt: "Lorenzo Ricci Golden Eclipse - editorial лайфстайл, позлатен хронограф" },
      { src: `/Products/watches/Golden Eclipse/description/golden-eclipse-editorial-2.webp`, alt: "Lorenzo Ricci Golden Eclipse - луксозен детайл на позлатения циферблат" },
    ],
    quoteVideo: "/golden-eclipse-quote.mp4",
  },
  {
    id: "polar-frost",
    slug: "polar-frost",
    sku: "LR-POLAR-FROST",
    name: "Polar Frost",
    category: "watches",
    price: 279,
    currency: "€",
    inStock: true,
    warranty: "Търговска гаранция 5 години",
    shortDescription: "Италиански дизайн. Японска точност.",
    description:
      "Polar Frost носи хладната увереност на арктическата синева. Прецизно изработеният корпус от стомана 316L, сапфиреното кристално стъкло и хронографът с многослоен циферблат правят от Polar Frost часовник за хора с ясен вкус. Водоустойчивост 5 ATM - спокойствие за всяко приключение.",
    tabDescription: [
      "Арктическо синьо, което се мени със светлината: ярко на слънце, дълбоко на закрито. Многослоен, частично скелетизиран циферблат под драскоустойчиво сапфирено стъкло, в корпус от стомана 316L с присъствие.",
      "Силиконовата каишка ляга удобно, а 5 ATM поемат дъжд, пот и плуване по повърхността. Синьото се съчетава лесно: с деним денем, с тъмно сако вечер. Пристига в луксозна кутия, с 5 години търговска гаранция.",
    ],
    features: [
      "Сапфирен кристал - изключителна яснота и защита от надраскване",
      "Японски кварцов механизъм - прецизен и надежден",
      "Водоустойчивост 5 ATM / 50 м",
      "316L неръждаема стомана - хипоалергенна, нержавяваща",
      "Хронограф с многофункционален циферблат",
      "Хипоалергенна дишаща силиконова каишка",
    ],
    specs: [
      { label: "Корпус", value: "Премиум неръждаема стомана 316L" },
      { label: "Размери", value: "43 мм × 50 мм × 16 мм" },
      { label: "Стъкло", value: "Сапфирен кристал" },
      { label: "Механизъм", value: "Японски кварцов хронограф" },
      { label: "Циферблат", value: "Частично скелетизиран, многослоен" },
      { label: "Каишка", value: "Хипоалергенен силикон" },
      { label: "Водоустойчивост", value: "5 ATM / 50 м" },
    ],
    coverImage: {
      src: `/Products/watches/Polar Frost/polar-frost-hronograf-preden-izgled.webp`,
      alt: "Lorenzo Ricci Polar Frost луксозен хронограф - синя арктическа версия, сапфирен кристал",
    },
    images: [
      { src: `/Products/watches/Polar Frost/polar-frost-hronograf-preden-izgled.webp`, alt: "Lorenzo Ricci Polar Frost хронограф - преден изглед, арктическо синьо" },
      { src: `/Products/watches/Polar Frost/polar-frost-lume-noshten-rejim.webp`,      alt: "Lorenzo Ricci Polar Frost нощен режим lume - светещи маркери, арктически дизайн" },
      { src: `/Products/watches/Polar Frost/polar-frost-lifestyle-1.webp`,             alt: "Lorenzo Ricci Polar Frost - лайфстайл снимка, луксозен мъжки часовник" },
      { src: `/Products/watches/Polar Frost/polar-frost-lifestyle-2.webp`,             alt: "Lorenzo Ricci Polar Frost - лайфстайл снимка, италиански дизайн" },
      { src: `/Products/watches/Polar Frost/polar-frost-zadna-strana.webp`,            alt: "Lorenzo Ricci Polar Frost - задна страна на корпуса, 316L неръждаема стомана" },
      { src: `/Products/watches/Polar Frost/polar-frost-stranicen-izgled.webp`,        alt: "Lorenzo Ricci Polar Frost - страничен изглед, водоустойчивост 5 ATM" },
      { src: `/Products/watches/Polar Frost/polar-frost-kaishka-kopchalka.webp`,       alt: "Lorenzo Ricci Polar Frost - закопчалка, хипоалергенна силиконова каишка" },
      { src: `/Products/watches/Polar Frost/polar-frost-kutiya-otvorena.webp`,         alt: "Lorenzo Ricci Polar Frost в луксозна кутия - подаръчна опаковка отворена" },
      { src: `/Products/watches/Polar Frost/polar-frost-kutiya-zatvorena.webp`,        alt: "Lorenzo Ricci Polar Frost затворена подаръчна кутия" },
    ],
    descriptionImages: [
      { src: `/Products/watches/Polar Frost/description/polar-frost-editorial-1.webp`, alt: "Lorenzo Ricci Polar Frost - editorial лайфстайл, арктически хронограф" },
      { src: `/Products/watches/Polar Frost/description/polar-frost-editorial-2.webp`, alt: "Lorenzo Ricci Polar Frost - детайл на синия циферблат, арктическа колекция" },
    ],
    descriptionVideo: "/polar-frost-description.mp4",
  },

  // ─── JEWELLERY ───────────────────────────────────────────────────────────────
  {
    id: "bracelet-diamante-cross",
    slug: "bracelet-diamante-cross",
    sku: "GR-DIAMANTE-CROSS",
    name: "Гривна Diamante Cross",
    category: "jewellery",
    subcategory: "bracelet",
    // Sale from 27.09.2026 (owner): −20%. originalPrice = the lowest price of the previous 30
    // days (EU Omnibus) - €39, unchanged in the git history since at least 28.08.2026.
    price: 31.2,
    originalPrice: 39,
    currency: "€",
    badge: "Ограничена наличност",
    inStock: true,
    warranty: "Доживотна гаранция",
    shortDescription: "Блясък, който не натежава",
    description:
      "Циркониевият кръст лови светлината при всяко движение. Фин детайл, който грее, без да натежава на ръката. Тънка и лека, ляга еднакво добре на дамска и на мъжка китка. Носи я сама или до часовника. Блясък, не обем.",
    features: [
      "Кристален кръст в центъра",
      "Изящна тенис верига",
      "Регулируема 18-22 см",
      "Унисекс дизайн",
    ],
    specs: [
      { label: "Материал", value: "316L неръждаема стомана с 18K PVD покритие" },
      { label: "Дължина", value: "18 + 4 см (регулируема)" },
      { label: "Покритие", value: "4-слойно 18K PVD златно" },
      { label: "Печат", value: "750 IT" },
      { label: "Пол", value: "Унисекс" },
      { label: "Цвят", value: "Златен" },
    ],
    coverImage: {
      src: `/Products/jewellery/bracelet Diamante Cross/grivna-diamante-cross-18k-pvd-preden-izgled.webp`,
      alt: "Гривна Diamante Cross Lorenzo Ricci - 18K PVD позлата, циркониев кръст, 316L стомана",
    },
    images: [
      { src: `/Products/jewellery/bracelet Diamante Cross/grivna-diamante-cross-18k-pvd-preden-izgled.webp`, alt: "Гривна Diamante Cross Lorenzo Ricci - продуктова снимка бял фон, 18K PVD злато" },
      { src: `/Products/jewellery/bracelet Diamante Cross/grivna-diamante-cross-detal-tsirkoniev-krast.webp`, alt: "Гривна Diamante Cross - детайл на циркониевия кръст, луксозна гривна" },
      { src: `/Products/jewellery/bracelet Diamante Cross/grivna-diamante-cross-lifestyle.webp`,               alt: "Гривна Diamante Cross - лайфстайл снимка, носена на китката" },
      { src: `/Products/jewellery/bracelet Diamante Cross/grivna-diamante-cross-stranicen-izgled.webp`,        alt: "Гривна Diamante Cross - страничен изглед, дебелина и детайл на закопчалката" },
      { src: `/Products/jewellery/bracelet Diamante Cross/grivna-diamante-cross-kutiya.webp`,                  alt: "Гривна Diamante Cross в подаръчна кутия Lorenzo Ricci" },
    ],
  },
  {
    id: "bracelet-milano-forte",
    slug: "bracelet-milano-forte",
    sku: "GR-FORTE",
    name: "Гривна Milano Forte",
    category: "jewellery",
    subcategory: "bracelet",
    price: 49,
    currency: "€",
    inStock: false, // owner 2026-09-27: out of stock until further notice - stays listed as "Изчерпан"
    warranty: "Доживотна гаранция",
    shortDescription: "Осем милиметра присъствие",
    description:
      "Тежи осезаемо на китката, щом щракне закопчалката. Осем милиметра плетка, която присъства, без да се натрапва. До часовника печели контекст, самостоятелно държи вниманието. Плътно 18K PVD злато, без компромиси.",
    features: [
      "Масивна плетка 8 мм",
      "Изразителна тежест",
      "Дължина 20 см",
      "Миланска изработка",
    ],
    specs: [
      { label: "Материал", value: "316L неръждаема стомана с 18K PVD покритие" },
      { label: "Ширина", value: "8 мм" },
      { label: "Дължина", value: "20 см" },
      { label: "Покритие", value: "4-слойно 18K PVD златно" },
      { label: "Печат", value: "750 IT" },
      { label: "Пол", value: "Унисекс" },
      { label: "Цвят", value: "Златен" },
    ],
    coverImage: {
      src: `/Products/jewellery/Bracelet Milano Forte/grivna-milano-forte-18k-pvd-preden-izgled.webp`,
      alt: "Гривна Milano Forte Lorenzo Ricci - масивна 8мм 18K PVD позлата, 316L стомана",
    },
    images: [
      { src: `/Products/jewellery/Bracelet Milano Forte/grivna-milano-forte-18k-pvd-preden-izgled.webp`, alt: "Гривна Milano Forte Lorenzo Ricci - продуктова снимка бял фон, 18K PVD злато" },
      { src: `/Products/jewellery/Bracelet Milano Forte/grivna-milano-forte-lifestyle.webp`,              alt: "Гривна Milano Forte - лайфстайл снимка, носена на китката" },
      { src: `/Products/jewellery/Bracelet Milano Forte/grivna-milano-forte-detal-pletka-8mm.webp`,       alt: "Гривна Milano Forte - детайл на плетката, ширина 8мм" },
      { src: `/Products/jewellery/Bracelet Milano Forte/grivna-milano-forte-kopchalka.webp`,              alt: "Гривна Milano Forte - детайл на закопчалката, 750 IT печат" },
      { src: `/Products/jewellery/Bracelet Milano Forte/grivna-milano-forte-kutiya.webp`,                 alt: "Гривна Milano Forte в подаръчна кутия Lorenzo Ricci" },
    ],
  },
  {
    id: "bracelet-milano-twist",
    slug: "bracelet-milano-twist",
    sku: "GR-MILANO-TWIST",
    name: "Гривна Milano Twist",
    category: "jewellery",
    subcategory: "bracelet",
    price: 44,
    currency: "€",
    inStock: true,
    warranty: "Доживотна гаранция",
    shortDescription: "Спирала от светлина",
    description:
      "Усуканата плетка пречупва светлината в спирала при всяко движение. По-фина от масивните модели, но със същия златен характер. Носи се самостоятелно или в комбинация с още. Шест милиметра сдържан блясък.",
    features: [
      "Усукана плетка 6 мм",
      "Плавна игра на светлината",
      "Дължина 22 см",
      "Ежедневна елегантност",
    ],
    specs: [
      { label: "Материал", value: "316L неръждаема стомана с 18K PVD покритие" },
      { label: "Дебелина", value: "6 мм" },
      { label: "Дължина", value: "22 см" },
      { label: "Покритие", value: "4-слойно 18K PVD златно" },
      { label: "Печат", value: "750 IT" },
      { label: "Пол", value: "Унисекс" },
      { label: "Цвят", value: "Златен" },
    ],
    coverImage: {
      src: `/Products/jewellery/Bracelet Milano Twist/grivna-milano-twist-18k-pvd-preden-izgled.webp`,
      alt: "Гривна Milano Twist Lorenzo Ricci - усукана плетка 18K PVD позлата, 316L стомана",
    },
    images: [
      { src: `/Products/jewellery/Bracelet Milano Twist/grivna-milano-twist-18k-pvd-preden-izgled.webp`, alt: "Гривна Milano Twist Lorenzo Ricci - продуктова снимка бял фон, 18K PVD злато" },
      { src: `/Products/jewellery/Bracelet Milano Twist/grivna-milano-twist-lifestyle.webp`,               alt: "Гривна Milano Twist - лайфстайл снимка, носена на китката" },
      { src: `/Products/jewellery/Bracelet Milano Twist/grivna-milano-twist-detal-usukana-pletka.webp`,    alt: "Гривна Milano Twist - детайл на усуканата плетка, италиански дизайн" },
      { src: `/Products/jewellery/Bracelet Milano Twist/grivna-milano-twist-kopchalka.webp`,               alt: "Гривна Milano Twist - детайл на закопчалката, 750 IT печат" },
      { src: `/Products/jewellery/Bracelet Milano Twist/grivna-milano-twist-kutiya.webp`,                  alt: "Гривна Milano Twist в подаръчна кутия Lorenzo Ricci" },
    ],
  },
  {
    id: "bracelet-signature",
    slug: "bracelet-signature",
    sku: "GR-SIGNATURE",
    name: "Гривна Signature",
    category: "jewellery",
    subcategory: "bracelet",
    price: 55,
    currency: "€",
    inStock: true,
    warranty: "Доживотна гаранция",
    shortDescription: "Твоят подпис на китката",
    description:
      "Гривната, която остава на китката. Т-закопчалката щраква сигурно, шестте милиметра лягат изчистено под ръкава и стоят еднакво уверено с риза и с тениска. Ежедневен спътник, който не се сваля.",
    features: [
      "Curb плетка 6 мм",
      "Кръст-висулка като акцент",
      "Т-закопчалка",
      "Дължина 22 см",
    ],
    specs: [
      { label: "Материал", value: "316L неръждаема стомана с 18K PVD покритие" },
      { label: "Ширина", value: "6 мм" },
      { label: "Дължина", value: "22 см" },
      { label: "Покритие", value: "4-слойно 18K PVD златно" },
      { label: "Печат", value: "750 IT" },
      { label: "Пол", value: "Унисекс" },
      { label: "Цвят", value: "Златен" },
    ],
    coverImage: {
      src: `/Products/jewellery/Bracelet Signature/grivna-signature-18k-pvd-preden-izgled.webp`,
      alt: "Гривна Signature Lorenzo Ricci - класическа 6мм 18K PVD позлата, 316L стомана",
    },
    images: [
      { src: `/Products/jewellery/Bracelet Signature/grivna-signature-18k-pvd-preden-izgled.webp`, alt: "Гривна Signature Lorenzo Ricci - продуктова снимка бял фон, 18K PVD злато" },
      { src: `/Products/jewellery/Bracelet Signature/grivna-signature-lifestyle.webp`,              alt: "Гривна Signature - лайфстайл снимка, носена на китката" },
      { src: `/Products/jewellery/Bracelet Signature/grivna-signature-detal-pletka-6mm.webp`,       alt: "Гривна Signature - детайл на плетката, ширина 6мм" },
      { src: `/Products/jewellery/Bracelet Signature/grivna-signature-kopchalka.webp`,              alt: "Гривна Signature - детайл на закопчалката, 750 IT печат" },
      { src: `/Products/jewellery/Bracelet Signature/grivna-signature-kutiya.webp`,                 alt: "Гривна Signature в подаръчна кутия Lorenzo Ricci" },
    ],
  },
  {
    id: "necklace-aurelius",
    slug: "necklace-aurelius",
    sku: "KO-AURELIUS-CROSS",
    name: "Колие Aurelius Cross",
    category: "jewellery",
    subcategory: "necklace",
    // Sale from 27.09.2026 (owner): −20%. originalPrice = the lowest price of the previous 30
    // days (EU Omnibus) - €42, unchanged in the git history since at least 28.08.2026.
    price: 33.6,
    originalPrice: 42,
    currency: "€",
    badge: "Ограничена наличност",
    inStock: true,
    warranty: "Доживотна гаранция",
    shortDescription: "Дух на вечния Рим",
    description:
      "Кръст с премерени пропорции и спокойна геометрия, вдъхновен от античната традиция. Три милиметра верига носи тежестта с лекота и остава дискретна под яката. Символ, който говори тихо, но с ясна убеденост.",
    features: [
      "Кръст 3.7 см с чисти пропорции",
      "Верижка 3 мм",
      "Дължина 60 см",
      "Унисекс силует",
    ],
    specs: [
      { label: "Материал", value: "316L неръждаема стомана с 18K PVD покритие" },
      { label: "Размер на кръста", value: "3.7 × 2 см" },
      { label: "Дебелина", value: "3 мм" },
      { label: "Дължина", value: "60 см" },
      { label: "Покритие", value: "4-слойно 18K PVD златно" },
      { label: "Печат", value: "750 IT" },
      { label: "Пол", value: "Унисекс" },
      { label: "Цвят", value: "Златен" },
    ],
    coverImage: {
      src: `/Products/jewellery/Necklace Aurelius Cross/kolie-aurelius-cross-18k-pvd-preden-izgled.webp`,
      alt: "Колие Aurelius Cross Lorenzo Ricci - 18K PVD позлата, кръст 3.7×2см, 316L стомана",
    },
    images: [
      { src: `/Products/jewellery/Necklace Aurelius Cross/kolie-aurelius-cross-18k-pvd-preden-izgled.webp`, alt: "Колие Aurelius Cross Lorenzo Ricci - продуктова снимка бял фон, 18K PVD злато" },
      { src: `/Products/jewellery/Necklace Aurelius Cross/kolie-aurelius-cross-detal-krast.webp`,            alt: "Колие Aurelius Cross - детайл на кръста, размери 3.7×2см, дебелина 3мм" },
      { src: `/Products/jewellery/Necklace Aurelius Cross/kolie-aurelius-cross-lifestyle.webp`,               alt: "Колие Aurelius Cross - лайфстайл снимка, носено на шия" },
      { src: `/Products/jewellery/Necklace Aurelius Cross/kolie-aurelius-cross-verizka-60cm.webp`,            alt: "Колие Aurelius Cross - детайл на верижката, дължина 60см" },
      { src: `/Products/jewellery/Necklace Aurelius Cross/kolie-aurelius-cross-karabiner.webp`,               alt: "Колие Aurelius Cross - детайл на карабинера, 750 IT печат" },
      { src: `/Products/jewellery/Necklace Aurelius Cross/kolie-aurelius-cross-kutiya.webp`,                  alt: "Колие Aurelius Cross в подаръчна кутия Lorenzo Ricci" },
    ],
  },
  {
    id: "necklace-grande-imperiale",
    slug: "necklace-grande-imperiale",
    sku: "KO-GRANDE-IMPERIALE",
    name: "Колие Grande Imperiale",
    category: "jewellery",
    subcategory: "necklace",
    price: 62,
    currency: "€",
    badge: "Ограничена наличност",
    inStock: true,
    warranty: "Доживотна гаранция",
    shortDescription: "Влиза преди теб",
    description:
      "Осем и половина сантиметра кръст с внушителна, но овладяна форма. Grande Imperiale носи размах без показност, а чистите линии превръщат обема в достойнство. За онзи, който предпочита да остави присъствието да говори вместо него.",
    features: [
      "Внушителен кръст 8.5 см",
      "Верига 3 мм",
      "Дължина 60 см",
      "Изразителен акцент",
    ],
    specs: [
      { label: "Материал", value: "316L неръждаема стомана с 18K PVD покритие" },
      { label: "Размер на кръста", value: "8.5 × 5 см" },
      { label: "Ширина на верижката", value: "3 мм" },
      { label: "Дължина", value: "60 см" },
      { label: "Покритие", value: "4-слойно 18K PVD златно" },
      { label: "Печат", value: "750 IT" },
      { label: "Цвят", value: "Златен" },
    ],
    coverImage: {
      src: `/Products/jewellery/Necklace Grande Imperiale /kolie-grande-imperiale-18k-pvd-preden-izgled.webp`,
      alt: "Колие Grande Imperiale Lorenzo Ricci - масивен кръст 8.5×5см, 18K PVD позлата, 316L стомана",
    },
    images: [
      { src: `/Products/jewellery/Necklace Grande Imperiale /kolie-grande-imperiale-18k-pvd-preden-izgled.webp`, alt: "Колие Grande Imperiale Lorenzo Ricci - продуктова снимка бял фон, 18K PVD злато" },
      { src: `/Products/jewellery/Necklace Grande Imperiale /kolie-grande-imperiale-detal-masiven-krast.webp`,    alt: "Колие Grande Imperiale - детайл на масивния кръст, размери 8.5×5см" },
      { src: `/Products/jewellery/Necklace Grande Imperiale /kolie-grande-imperiale-lifestyle.webp`,               alt: "Колие Grande Imperiale - лайфстайл снимка, носено на шия" },
      { src: `/Products/jewellery/Necklace Grande Imperiale /kolie-grande-imperiale-verizka-60cm.webp`,            alt: "Колие Grande Imperiale - детайл на верижката 3мм, дължина 60см" },
      { src: `/Products/jewellery/Necklace Grande Imperiale /kolie-grande-imperiale-kutiya.webp`,                  alt: "Колие Grande Imperiale в подаръчна кутия Lorenzo Ricci" },
    ],
  },
  {
    id: "necklace-milano-forte",
    slug: "necklace-milano-forte",
    sku: "LA-MILANO-FORTE",
    name: "Колие Milano Forte",
    category: "jewellery",
    subcategory: "necklace",
    price: 55,
    currency: "€",
    inStock: false, // owner 2026-09-27: out of stock until further notice - stays listed as "Изчерпан"
    warranty: "Доживотна гаранция",
    shortDescription: "Тежестта на Милано",
    description:
      "Плътна миланска плетка с осем милиметра ширина и осезаема тежест, която се усеща при всяко движение. Веригата държи формата и характера си без компромис. Уверено присъствие, което не се нуждае от обяснение.",
    features: [
      "Плътна верига 8 мм",
      "Изразителна тежест",
      "Дължина 55 см",
      "Миланска плетка",
    ],
    specs: [
      { label: "Материал", value: "316L неръждаема стомана с 18K PVD покритие" },
      { label: "Ширина", value: "8 мм" },
      { label: "Дължина", value: "55 см" },
      { label: "Покритие", value: "4-слойно 18K PVD златно" },
      { label: "Печат", value: "750 IT" },
      { label: "Цвят", value: "Златен" },
    ],
    coverImage: {
      src: `/Products/jewellery/Necklace Milano Forte/kolie-milano-forte-18k-pvd-preden-izgled.webp`,
      alt: "Колие Milano Forte Lorenzo Ricci - масивна плетена верижка, 18K PVD позлата, 316L стомана",
    },
    images: [
      { src: `/Products/jewellery/Necklace Milano Forte/kolie-milano-forte-18k-pvd-preden-izgled.webp`, alt: "Колие Milano Forte Lorenzo Ricci - продуктова снимка бял фон, 18K PVD злато" },
      { src: `/Products/jewellery/Necklace Milano Forte/kolie-milano-forte-lifestyle.webp`,              alt: "Колие Milano Forte - лайфстайл снимка, носено на шия" },
      { src: `/Products/jewellery/Necklace Milano Forte/kolie-milano-forte-detal-masivna-pletka.webp`,   alt: "Колие Milano Forte - детайл на масивната плетена верижка" },
      { src: `/Products/jewellery/Necklace Milano Forte/kolie-milano-forte-karabiner.webp`,              alt: "Колие Milano Forte - детайл на карабинера, 750 IT печат" },
      { src: `/Products/jewellery/Necklace Milano Forte/kolie-milano-forte-kutiya.webp`,                 alt: "Колие Milano Forte в подаръчна кутия Lorenzo Ricci" },
    ],
  },
  {
    id: "necklace-milano-twist",
    slug: "necklace-milano-twist",
    sku: "KO-MILANO-TWIST",
    name: "Колие Milano Twist",
    category: "jewellery",
    subcategory: "necklace",
    price: 51,
    currency: "€",
    inStock: true,
    warranty: "Доживотна гаранция",
    shortDescription: "Въже от злато",
    description:
      "Усукана верига, чиято спираловидна плетка улавя и пречупва светлината в движение. По-фина от масивните модели, но със същата дълбочина на златото. Носи се самостоятелно или като основа за подбрана висулка.",
    features: [
      "Усукана верига 6 мм",
      "Плавна игра на светлината",
      "Дължина 55 см",
      "Самостоятелно или с висулка",
    ],
    specs: [
      { label: "Материал", value: "316L неръждаема стомана с 18K PVD покритие" },
      { label: "Ширина", value: "6 мм" },
      { label: "Дължина", value: "55 см" },
      { label: "Покритие", value: "4-слойно 18K PVD златно" },
      { label: "Печат", value: "750 IT" },
      { label: "Цвят", value: "Златен" },
    ],
    coverImage: {
      src: `/Products/jewellery/Necklace Milano Twist/kolie-milano-twist-18k-pvd-preden-izgled.webp`,
      alt: "Колие Milano Twist Lorenzo Ricci - усукана верижка 6мм, 18K PVD позлата, 316L стомана",
    },
    images: [
      { src: `/Products/jewellery/Necklace Milano Twist/kolie-milano-twist-18k-pvd-preden-izgled.webp`, alt: "Колие Milano Twist Lorenzo Ricci - продуктова снимка бял фон, 18K PVD злато" },
      { src: `/Products/jewellery/Necklace Milano Twist/kolie-milano-twist-lifestyle.webp`,               alt: "Колие Milano Twist - лайфстайл снимка, носено на шия" },
      { src: `/Products/jewellery/Necklace Milano Twist/kolie-milano-twist-detal-usukana-verizka.webp`,   alt: "Колие Milano Twist - детайл на усуканата верижка, ширина 6мм" },
      { src: `/Products/jewellery/Necklace Milano Twist/kolie-milano-twist-karabiner-55cm.webp`,          alt: "Колие Milano Twist - детайл на карабинера, дължина 55см" },
      { src: `/Products/jewellery/Necklace Milano Twist/kolie-milano-twist-blizak-plan.webp`,             alt: "Колие Milano Twist - близък план на плетката, 750 IT печат" },
      { src: `/Products/jewellery/Necklace Milano Twist/kolie-milano-twist-kutiya.webp`,                  alt: "Колие Milano Twist в подаръчна кутия Lorenzo Ricci" },
    ],
  },

  // ─── WALLETS ────────────────────────────────────────────────────────────────
  {
    id: "wallet-alabastro",
    slug: "wallet-alabastro",
    sku: "WLT-ALA",
    name: 'Lorenzo Ricci "Alabastro"',
    category: "wallets",
    price: 178,
    priceAED: 1200,
    currency: "€",
    inStock: true,
    stock: 5,
    warranty: "", // leather: no warranty is offered (owner, 2026-09-27)
    shortDescription: "Бял портфейл от крокодилска кожа",
    description: 'Всяко изделие от линията на Lorenzo Ricci е израз на безкомпромисен лукс. Съчетаваме суровата елегантност на автентичната кожа от сиамски крокодил (Crocodylus siamensis) с прецизна градска функционалност за тези, които ценят строгата индивидуалност.',
    materialNote: 'Изработено от истинска крокодилска кожа. Тъй като всяка кожа е уникална, шарките и текстурата може да се различават леко от показаните на снимките - това е естествена характеристика на автентичната крокодилска кожа и придава на всяко изделие неповторим характер.',
    crocodileSpecies: SIAMESE_CROCODILE,
    features: [
      "100% естествена крокодилска кожа",
      "CITES сертифициран произход №: 25VN4174/S",
      "Ръчна изработка - всяко изделие е уникално",
    ],
    specs: [
      { label: "Материал", value: "100% Крокодилска кожа" },
      { label: "Вид", value: SIAMESE_CROCODILE },
      { label: "CITES №", value: "25VN4174/S" },
      { label: "Изработка", value: "Ръчна" },
      { label: "Цвят", value: "Бял (Alabastro)" },
    ],
    coverImage: { src: `/Products/wallets/Alabastro/portfeil-alabastro-byal-krokodiilska-kozha.webp`, alt: 'Lorenzo Ricci Alabastro бял портфейл крокодилска кожа - преден изглед' },
    images: [
      { src: `/Products/wallets/Alabastro/portfeil-alabastro-byal-krokodiilska-kozha.webp`,         alt: 'Lorenzo Ricci Alabastro бял портфейл крокодилска кожа - продуктова снимка' },
      { src: `/Products/wallets/Alabastro/portfeil-alabastro-detal-krokodiilska-tekstura.webp`,      alt: 'Lorenzo Ricci Alabastro - детайл на крокодилската текстура' },
      { src: `/Products/wallets/Alabastro/portfeil-alabastro-otvoren-vatreshnost.webp`,              alt: 'Lorenzo Ricci Alabastro - отворен портфейл, вътрешност с джобове за карти' },
      { src: `/Products/wallets/Alabastro/portfeil-alabastro-rachna-izrabotka.webp`,                 alt: 'Lorenzo Ricci Alabastro - детайл на ръчната изработка, прецизни шевове' },
      { src: `/Products/wallets/Alabastro/portfeil-alabastro-kutiya-sertifikat.webp`,                alt: 'Lorenzo Ricci Alabastro в луксозна кутия с Сертификат за автентичност CITES' },
    ],
  },
  {
    id: "wallet-rubino",
    slug: "wallet-rubino",
    sku: "WLT-RUB",
    name: 'Lorenzo Ricci "Rubino"',
    category: "wallets",
    price: 178,
    priceAED: 1200,
    currency: "€",
    inStock: true,
    stock: 5,
    warranty: "", // leather: no warranty is offered (owner, 2026-09-27)
    shortDescription: "Червен портфейл от крокодилска кожа",
    description: 'Всяко изделие от линията на Lorenzo Ricci е израз на безкомпромисен лукс. Съчетаваме суровата елегантност на автентичната кожа от сиамски крокодил (Crocodylus siamensis) с прецизна градска функционалност за тези, които ценят строгата индивидуалност.',
    materialNote: 'Изработено от истинска крокодилска кожа. Тъй като всяка кожа е уникална, шарките и текстурата може да се различават леко от показаните на снимките - това е естествена характеристика на автентичната крокодилска кожа и придава на всяко изделие неповторим характер.',
    crocodileSpecies: SIAMESE_CROCODILE,
    features: [
      "100% естествена крокодилска кожа",
      "CITES сертифициран произход №: 25VN4174/S",
      "Ръчна изработка - всяко изделие е уникално",
    ],
    specs: [
      { label: "Материал", value: "100% Крокодилска кожа" },
      { label: "Вид", value: SIAMESE_CROCODILE },
      { label: "CITES №", value: "25VN4174/S" },
      { label: "Изработка", value: "Ръчна" },
      { label: "Цвят", value: "Рубинено червен (Rubino)" },
    ],
    coverImage: { src: `/Products/wallets/Rubino/portfeil-rubino-cherven-krokodiilska-kozha.webp`, alt: 'Lorenzo Ricci Rubino червен портфейл крокодилска кожа - преден изглед' },
    images: [
      { src: `/Products/wallets/Rubino/portfeil-rubino-cherven-krokodiilska-kozha.webp`,        alt: 'Lorenzo Ricci Rubino червен портфейл крокодилска кожа - продуктова снимка' },
      { src: `/Products/wallets/Rubino/portfeil-rubino-detal-krokodiilska-tekstura.webp`,        alt: 'Lorenzo Ricci Rubino - детайл на крокодилската текстура, рубинено червено' },
      { src: `/Products/wallets/Rubino/portfeil-rubino-otvoren-vatreshnost.webp`,                alt: 'Lorenzo Ricci Rubino - отворен портфейл, вътрешност с джобове за карти' },
      { src: `/Products/wallets/Rubino/portfeil-rubino-rachna-izrabotka.webp`,                   alt: 'Lorenzo Ricci Rubino - детайл на ръчната изработка, прецизни шевове' },
      { src: `/Products/wallets/Rubino/portfeil-rubino-kutiya-sertifikat.webp`,                  alt: 'Lorenzo Ricci Rubino в луксозна кутия с Сертификат за автентичност CITES' },
    ],
  },
  {
    id: "wallet-smeraldo",
    slug: "wallet-smeraldo",
    sku: "WLT-SME",
    name: 'Lorenzo Ricci "Smeraldo"',
    category: "wallets",
    price: 178,
    priceAED: 1200,
    currency: "€",
    badge: "Изчерпан",
    inStock: false,
    stock: 0,
    warranty: "", // leather: no warranty is offered (owner, 2026-09-27)
    shortDescription: "Зелен портфейл от крокодилска кожа",
    description: 'Всяко изделие от линията на Lorenzo Ricci е израз на безкомпромисен лукс. Съчетаваме суровата елегантност на автентичната кожа от сиамски крокодил (Crocodylus siamensis) с прецизна градска функционалност за тези, които ценят строгата индивидуалност.',
    materialNote: 'Изработено от истинска крокодилска кожа. Тъй като всяка кожа е уникална, шарките и текстурата може да се различават леко от показаните на снимките - това е естествена характеристика на автентичната крокодилска кожа и придава на всяко изделие неповторим характер.',
    crocodileSpecies: SIAMESE_CROCODILE,
    features: [
      "100% естествена крокодилска кожа",
      "CITES сертифициран произход №: 25VN4174/S",
      "Ръчна изработка - всяко изделие е уникално",
    ],
    specs: [
      { label: "Материал", value: "100% Крокодилска кожа" },
      { label: "Вид", value: SIAMESE_CROCODILE },
      { label: "CITES №", value: "25VN4174/S" },
      { label: "Изработка", value: "Ръчна" },
      { label: "Цвят", value: "Изумруденозелен (Smeraldo)" },
    ],
    coverImage: { src: `/Products/wallets/Smeraldo/portfeil-smeraldo-zelen-krokodiilska-kozha.webp`, alt: 'Lorenzo Ricci Smeraldo зелен портфейл крокодилска кожа - преден изглед' },
    images: [
      { src: `/Products/wallets/Smeraldo/portfeil-smeraldo-zelen-krokodiilska-kozha.webp`,        alt: 'Lorenzo Ricci Smeraldo зелен портфейл крокодилска кожа - продуктова снимка' },
      { src: `/Products/wallets/Smeraldo/portfeil-smeraldo-detal-krokodiilska-tekstura.webp`,      alt: 'Lorenzo Ricci Smeraldo - детайл на крокодилската текстура, изумруденозелено' },
      { src: `/Products/wallets/Smeraldo/portfeil-smeraldo-otvoren-vatreshnost.webp`,              alt: 'Lorenzo Ricci Smeraldo - отворен портфейл, вътрешност с джобове за карти' },
      { src: `/Products/wallets/Smeraldo/portfeil-smeraldo-rachna-izrabotka.webp`,                 alt: 'Lorenzo Ricci Smeraldo - детайл на ръчната изработка, прецизни шевове' },
      { src: `/Products/wallets/Smeraldo/portfeil-smeraldo-kutiya-sertifikat.webp`,                alt: 'Lorenzo Ricci Smeraldo в луксозна кутия с Сертификат за автентичност CITES' },
    ],
  },

  // ─── CARDHOLDERS ────────────────────────────────────────────────────────────
  {
    id: "cardholder-ambra",
    slug: "cardholder-ambra",
    sku: "CRD-AMB",
    name: 'Lorenzo Ricci "Ambra"',
    category: "cardholders",
    // Sale from 27.09.2026 (owner): −20%. originalPrice = the lowest price of the previous 30
    // days (EU Omnibus) - €65, unchanged in the git history since at least 28.08.2026.
    price: 52,
    originalPrice: 65,
    priceAED: 500,
    currency: "€",
    inStock: true,
    stock: 10,
    warranty: "", // leather: no warranty is offered (owner, 2026-09-27)
    shortDescription: "Оранжев кардхолдър от крокодилска кожа",
    description: 'Всяко изделие от линията на Lorenzo Ricci е израз на безкомпромисен лукс. Съчетаваме суровата елегантност на автентичната кожа от сиамски крокодил (Crocodylus siamensis) с прецизна градска функционалност за тези, които ценят строгата индивидуалност.',
    materialNote: 'Изработено от истинска крокодилска кожа. Тъй като всяка кожа е уникална, шарките и текстурата може да се различават леко от показаните на снимките - това е естествена характеристика на автентичната крокодилска кожа и придава на всяко изделие неповторим характер.',
    crocodileSpecies: SIAMESE_CROCODILE,
    features: [
      "100% естествена крокодилска кожа",
      "CITES сертифициран произход №: 25VN4174/S",
      "Ръчна изработка - всяко изделие е уникално",
    ],
    specs: [
      { label: "Материал", value: "100% Крокодилска кожа" },
      { label: "Вид", value: SIAMESE_CROCODILE },
      { label: "CITES №", value: "25VN4174/S" },
      { label: "Изработка", value: "Ръчна" },
      { label: "Цвят", value: "Кехлибарено оранжев (Ambra)" },
    ],
    coverImage: { src: `/Products/wallets/Ambra/kardholder-ambra-oranjev-krokodiilska-kozha.webp`, alt: 'Lorenzo Ricci Ambra оранжев кардхолдър крокодилска кожа - преден изглед' },
    images: [
      { src: `/Products/wallets/Ambra/kardholder-ambra-oranjev-krokodiilska-kozha.webp`,      alt: 'Lorenzo Ricci Ambra оранжев кардхолдър крокодилска кожа - продуктова снимка' },
      { src: `/Products/wallets/Ambra/kardholder-ambra-detal-krokodiilska-tekstura.webp`,     alt: 'Lorenzo Ricci Ambra - детайл на крокодилската текстура, кехлибарено оранжево' },
      { src: `/Products/wallets/Ambra/kardholder-ambra-lifestyle.webp`,                       alt: 'Lorenzo Ricci Ambra кардхолдър - лайфстайл снимка, ежедневна употреба' },
      { src: `/Products/wallets/Ambra/kardholder-ambra-kutiya-sertifikat.webp`,               alt: 'Lorenzo Ricci Ambra в луксозна кутия с Сертификат за автентичност CITES' },
    ],
  },
  {
    id: "cardholder-bianco",
    slug: "cardholder-bianco",
    sku: "CRD-BIA",
    name: 'Lorenzo Ricci "Bianco"',
    category: "cardholders",
    price: 65,
    priceAED: 500,
    currency: "€",
    inStock: true,
    stock: 88,
    warranty: "", // leather: no warranty is offered (owner, 2026-09-27)
    shortDescription: "Бял кожен кардхолдър",
    description: 'Всяко изделие от линията на Lorenzo Ricci е израз на безкомпромисен лукс. Съчетаваме суровата елегантност на автентичната кожа от сиамски крокодил (Crocodylus siamensis) с прецизна градска функционалност за тези, които ценят строгата индивидуалност.',
    materialNote: 'Всеки кардхолдър Bianco е от различна кожа. Всички са бели, но големината и шарката на люспите се различават видимо, така че вашият екземпляр може да не изглежда точно като на снимките.',
    crocodileSpecies: SIAMESE_CROCODILE,
    features: [
      "100% естествена крокодилска кожа",
      "CITES сертифициран произход №: 25VN4174/S",
      "Ръчна изработка - всяко изделие е уникално",
    ],
    specs: [
      { label: "Материал", value: "100% Крокодилска кожа" },
      { label: "Вид", value: SIAMESE_CROCODILE },
      { label: "CITES №", value: "25VN4174/S" },
      { label: "Изработка", value: "Ръчна" },
      { label: "Цвят", value: "Бял (Bianco)" },
    ],
    coverImage: { src: `/Products/wallets/Bianco/kardholder-bianco-byal-krokodiilska-kozha.webp`, alt: 'Lorenzo Ricci Bianco бял кардхолдър крокодилска кожа - преден изглед' },
    images: [
      { src: `/Products/wallets/Bianco/kardholder-bianco-byal-krokodiilska-kozha.webp`,       alt: 'Lorenzo Ricci Bianco бял кардхолдър крокодилска кожа - продуктова снимка' },
      { src: `/Products/wallets/Bianco/kardholder-bianco-lifestyle-marble.webp`,               alt: 'Lorenzo Ricci Bianco бял кардхолдър крокодилска кожа - мраморна повърхност' },
      { src: `/Products/wallets/Bianco/kardholder-bianco-lifestyle.webp`,                      alt: 'Lorenzo Ricci Bianco кардхолдър - лайфстайл снимка, ежедневна употреба' },
      { src: `/Products/wallets/Bianco/kardholder-bianco-kutiya-sertifikat.webp`,              alt: 'Lorenzo Ricci Bianco в луксозна кутия с Сертификат за автентичност CITES' },
    ],
  },
  {
    id: "cardholder-valentina",
    slug: "cardholder-valentina",
    sku: "CRD-VAL",
    name: 'Lorenzo Ricci "Valentina"',
    category: "cardholders",
    // Sale from 27.09.2026 (owner): −20%. originalPrice = the lowest price of the previous 30
    // days (EU Omnibus) - €65, unchanged in the git history since at least 28.08.2026.
    price: 52,
    originalPrice: 65,
    priceAED: 500,
    currency: "€",
    inStock: true,
    stock: 19,
    warranty: "", // leather: no warranty is offered (owner, 2026-09-27)
    shortDescription: "Розов кардхолдър от крокодилска кожа",
    description: 'Всяко изделие от линията на Lorenzo Ricci е израз на безкомпромисен лукс. Съчетаваме суровата елегантност на автентичната кожа от сиамски крокодил (Crocodylus siamensis) с прецизна градска функционалност за тези, които ценят строгата индивидуалност.',
    materialNote: 'Изработено от истинска крокодилска кожа. Тъй като всяка кожа е уникална, шарките и текстурата може да се различават леко от показаните на снимките - това е естествена характеристика на автентичната крокодилска кожа и придава на всяко изделие неповторим характер.',
    crocodileSpecies: SIAMESE_CROCODILE,
    features: [
      "100% естествена крокодилска кожа",
      "CITES сертифициран произход №: 25VN4174/S",
      "Ръчна изработка - всяко изделие е уникално",
    ],
    specs: [
      { label: "Материал", value: "100% Крокодилска кожа" },
      { label: "Вид", value: SIAMESE_CROCODILE },
      { label: "CITES №", value: "25VN4174/S" },
      { label: "Изработка", value: "Ръчна" },
      { label: "Цвят", value: "Розов (Valentina)" },
    ],
    coverImage: { src: `/Products/wallets/Valentina/kardholder-valentina-rozov-krokodiilska-kozha.webp`, alt: 'Lorenzo Ricci Valentina розов кардхолдър крокодилска кожа - преден изглед' },
    images: [
      { src: `/Products/wallets/Valentina/kardholder-valentina-rozov-krokodiilska-kozha.webp`,      alt: 'Lorenzo Ricci Valentina розов кардхолдър крокодилска кожа - продуктова снимка' },
      { src: `/Products/wallets/Valentina/kardholder-valentina-detal-krokodiilska-tekstura.webp`,    alt: 'Lorenzo Ricci Valentina - детайл на крокодилската текстура, розов цвят' },
      { src: `/Products/wallets/Valentina/kardholder-valentina-lifestyle.webp`,                      alt: 'Lorenzo Ricci Valentina кардхолдър - лайфстайл снимка, ежедневна употреба' },
      { src: `/Products/wallets/Valentina/kardholder-valentina-kutiya-sertifikat.webp`,              alt: 'Lorenzo Ricci Valentina в луксозна кутия с Сертификат за автентичност CITES' },
    ],
  },
  {
    id: "cardholder-zaffiro",
    slug: "cardholder-zaffiro",
    sku: "CRD-ZAF",
    name: 'Lorenzo Ricci "Zaffiro"',
    category: "cardholders",
    // Sale from 27.09.2026 (owner): −20%. originalPrice = the lowest price of the previous 30
    // days (EU Omnibus) - €65, unchanged in the git history since at least 28.08.2026.
    price: 52,
    originalPrice: 65,
    priceAED: 500,
    currency: "€",
    inStock: true,
    stock: 15,
    warranty: "", // leather: no warranty is offered (owner, 2026-09-27)
    shortDescription: "Тъмносин кардхолдър от крокодилска кожа",
    description: 'Всяко изделие от линията на Lorenzo Ricci е израз на безкомпромисен лукс. Съчетаваме суровата елегантност на автентичната кожа от сиамски крокодил (Crocodylus siamensis) с прецизна градска функционалност за тези, които ценят строгата индивидуалност.',
    materialNote: 'Изработено от истинска крокодилска кожа. Тъй като всяка кожа е уникална, шарките и текстурата може да се различават леко от показаните на снимките - това е естествена характеристика на автентичната крокодилска кожа и придава на всяко изделие неповторим характер.',
    crocodileSpecies: SIAMESE_CROCODILE,
    features: [
      "100% естествена крокодилска кожа",
      "CITES сертифициран произход №: 25VN4174/S",
      "Ръчна изработка - всяко изделие е уникално",
    ],
    specs: [
      { label: "Материал", value: "100% Крокодилска кожа" },
      { label: "Вид", value: SIAMESE_CROCODILE },
      { label: "CITES №", value: "25VN4174/S" },
      { label: "Изработка", value: "Ръчна" },
      { label: "Цвят", value: "Сапфирено син (Zaffiro)" },
    ],
    coverImage: { src: `/Products/wallets/Zaffiro/kardholder-zaffiro-sinen-krokodiilska-kozha.webp`, alt: 'Lorenzo Ricci Zaffiro тъмносин кардхолдър крокодилска кожа - преден изглед' },
    images: [
      { src: `/Products/wallets/Zaffiro/kardholder-zaffiro-sinen-krokodiilska-kozha.webp`,       alt: 'Lorenzo Ricci Zaffiro тъмносин кардхолдър крокодилска кожа - продуктова снимка' },
      { src: `/Products/wallets/Zaffiro/kardholder-zaffiro-detal-krokodiilska-tekstura.webp`,     alt: 'Lorenzo Ricci Zaffiro - детайл на крокодилската текстура, сапфирено синьо' },
      { src: `/Products/wallets/Zaffiro/kardholder-zaffiro-lifestyle.webp`,                       alt: 'Lorenzo Ricci Zaffiro кардхолдър - лайфстайл снимка, ежедневна употреба' },
      { src: `/Products/wallets/Zaffiro/kardholder-zaffiro-kutiya-sertifikat.webp`,               alt: 'Lorenzo Ricci Zaffiro в луксозна кутия с Сертификат за автентичност CITES' },
    ],
  },

  // New cardholder batch (added 2026-09-27). Owner's decisions: gallery = front then back;
  // NO CITES permit number (25VN4174/S is not claimed for this batch); no AED price
  // (Bulgaria only); €65 like the others; no description video (the "Автентичност и
  // Структура" block renders text-only). Counts from the owner 2026-09-27: Onice 46,
  // Giada 27, Cremisi 38, Perla 3, Topazio 23 (rows in wallet_inventory_restock_2026-09-27.sql).
  {
    id: "cardholder-onice",
    slug: "cardholder-onice",
    sku: "CRD-ONI",
    name: 'Lorenzo Ricci "Onice"',
    category: "cardholders",
    price: 65,
    currency: "€",
    inStock: true,
    badge: "Нова колекция",
    stock: 46,
    warranty: "", // leather: no warranty is offered (owner, 2026-09-27)
    shortDescription: "Черен кардхолдър от крокодилска кожа",
    description: 'Всяко изделие от линията на Lorenzo Ricci е израз на безкомпромисен лукс. Съчетаваме суровата елегантност на автентичната кожа от сиамски крокодил (Crocodylus siamensis) с прецизна градска функционалност за тези, които ценят строгата индивидуалност.',
    materialNote: 'Изработено от истинска крокодилска кожа. Тъй като всяка кожа е уникална, шарките и текстурата може да се различават леко от показаните на снимките - това е естествена характеристика на автентичната крокодилска кожа и придава на всяко изделие неповторим характер.',
    crocodileSpecies: SIAMESE_CROCODILE,
    features: [
      "100% естествена крокодилска кожа",
      "Ръчна изработка - всяко изделие е уникално",
    ],
    specs: [
      { label: "Материал", value: "100% Крокодилска кожа" },
      { label: "Вид", value: SIAMESE_CROCODILE },
      { label: "Изработка", value: "Ръчна" },
      { label: "Цвят", value: "Черен (Onice)" },
      { label: "Размери", value: "" }, // empty → row hidden until the owner gives real measurements
    ],
    coverImage: { src: `/Products/wallets/Onice/kardholder-onice-cheren-krokodilska-kozha.webp`, alt: 'Lorenzo Ricci Onice черен кардхолдър крокодилска кожа - преден изглед' },
    images: [
      { src: `/Products/wallets/Onice/kardholder-onice-cheren-krokodilska-kozha.webp`, alt: 'Lorenzo Ricci Onice черен кардхолдър крокодилска кожа - преден изглед' },
      { src: `/Products/wallets/Onice/kardholder-onice-zaden-izgled.webp`, alt: 'Lorenzo Ricci Onice - заден изглед, отделения за карти' },
    ],
  },
  {
    id: "cardholder-giada",
    slug: "cardholder-giada",
    sku: "CRD-GIA",
    name: 'Lorenzo Ricci "Giada"',
    category: "cardholders",
    price: 65,
    currency: "€",
    inStock: true,
    badge: "Нова колекция",
    stock: 27,
    warranty: "", // leather: no warranty is offered (owner, 2026-09-27)
    shortDescription: "Тъмнозелен кардхолдър от крокодилска кожа",
    description: 'Всяко изделие от линията на Lorenzo Ricci е израз на безкомпромисен лукс. Съчетаваме суровата елегантност на автентичната кожа от сиамски крокодил (Crocodylus siamensis) с прецизна градска функционалност за тези, които ценят строгата индивидуалност.',
    materialNote: 'Изработено от истинска крокодилска кожа. Тъй като всяка кожа е уникална, шарките и текстурата може да се различават леко от показаните на снимките - това е естествена характеристика на автентичната крокодилска кожа и придава на всяко изделие неповторим характер.',
    crocodileSpecies: SIAMESE_CROCODILE,
    features: [
      "100% естествена крокодилска кожа",
      "Ръчна изработка - всяко изделие е уникално",
    ],
    specs: [
      { label: "Материал", value: "100% Крокодилска кожа" },
      { label: "Вид", value: SIAMESE_CROCODILE },
      { label: "Изработка", value: "Ръчна" },
      { label: "Цвят", value: "Тъмнозелен (Giada)" },
      { label: "Размери", value: "" }, // empty → row hidden until the owner gives real measurements
    ],
    coverImage: { src: `/Products/wallets/Giada/kardholder-giada-zelen-krokodilska-kozha.webp`, alt: 'Lorenzo Ricci Giada тъмнозелен кардхолдър крокодилска кожа - преден изглед' },
    images: [
      { src: `/Products/wallets/Giada/kardholder-giada-zelen-krokodilska-kozha.webp`, alt: 'Lorenzo Ricci Giada тъмнозелен кардхолдър крокодилска кожа - преден изглед' },
      { src: `/Products/wallets/Giada/kardholder-giada-zaden-izgled.webp`, alt: 'Lorenzo Ricci Giada - заден изглед, отделения за карти' },
    ],
  },
  {
    id: "cardholder-cremisi",
    slug: "cardholder-cremisi",
    sku: "CRD-CRE",
    name: 'Lorenzo Ricci "Cremisi"',
    category: "cardholders",
    price: 65,
    currency: "€",
    inStock: true,
    badge: "Нова колекция",
    stock: 38,
    warranty: "", // leather: no warranty is offered (owner, 2026-09-27)
    shortDescription: "Червен кардхолдър от крокодилска кожа",
    description: 'Всяко изделие от линията на Lorenzo Ricci е израз на безкомпромисен лукс. Съчетаваме суровата елегантност на автентичната кожа от сиамски крокодил (Crocodylus siamensis) с прецизна градска функционалност за тези, които ценят строгата индивидуалност.',
    materialNote: 'Изработено от истинска крокодилска кожа. Тъй като всяка кожа е уникална, шарките и текстурата може да се различават леко от показаните на снимките - това е естествена характеристика на автентичната крокодилска кожа и придава на всяко изделие неповторим характер.',
    crocodileSpecies: SIAMESE_CROCODILE,
    features: [
      "100% естествена крокодилска кожа",
      "Ръчна изработка - всяко изделие е уникално",
    ],
    specs: [
      { label: "Материал", value: "100% Крокодилска кожа" },
      { label: "Вид", value: SIAMESE_CROCODILE },
      { label: "Изработка", value: "Ръчна" },
      { label: "Цвят", value: "Червен (Cremisi)" },
      { label: "Размери", value: "" }, // empty → row hidden until the owner gives real measurements
    ],
    coverImage: { src: `/Products/wallets/Cremisi/kardholder-cremisi-cherven-krokodilska-kozha.webp`, alt: 'Lorenzo Ricci Cremisi червен кардхолдър крокодилска кожа - преден изглед' },
    images: [
      { src: `/Products/wallets/Cremisi/kardholder-cremisi-cherven-krokodilska-kozha.webp`, alt: 'Lorenzo Ricci Cremisi червен кардхолдър крокодилска кожа - преден изглед' },
      { src: `/Products/wallets/Cremisi/kardholder-cremisi-zaden-izgled.webp`, alt: 'Lorenzo Ricci Cremisi - заден изглед, отделения за карти' },
    ],
  },
  {
    id: "cardholder-perla",
    slug: "cardholder-perla",
    sku: "CRD-PER",
    name: 'Lorenzo Ricci "Perla"',
    category: "cardholders",
    price: 65,
    currency: "€",
    inStock: true,
    badge: "Нова колекция",
    stock: 3,
    warranty: "", // leather: no warranty is offered (owner, 2026-09-27)
    shortDescription: "Сив кардхолдър от крокодилска кожа",
    description: 'Всяко изделие от линията на Lorenzo Ricci е израз на безкомпромисен лукс. Съчетаваме суровата елегантност на автентичната кожа от сиамски крокодил (Crocodylus siamensis) с прецизна градска функционалност за тези, които ценят строгата индивидуалност.',
    materialNote: 'Изработено от истинска крокодилска кожа. Тъй като всяка кожа е уникална, шарките и текстурата може да се различават леко от показаните на снимките - това е естествена характеристика на автентичната крокодилска кожа и придава на всяко изделие неповторим характер.',
    crocodileSpecies: SIAMESE_CROCODILE,
    features: [
      "100% естествена крокодилска кожа",
      "Ръчна изработка - всяко изделие е уникално",
    ],
    specs: [
      { label: "Материал", value: "100% Крокодилска кожа" },
      { label: "Вид", value: SIAMESE_CROCODILE },
      { label: "Изработка", value: "Ръчна" },
      { label: "Цвят", value: "Сив (Perla)" },
      { label: "Размери", value: "" }, // empty → row hidden until the owner gives real measurements
    ],
    coverImage: { src: `/Products/wallets/Perla/kardholder-perla-siv-krokodilska-kozha.webp`, alt: 'Lorenzo Ricci Perla сив кардхолдър крокодилска кожа - преден изглед' },
    images: [
      { src: `/Products/wallets/Perla/kardholder-perla-siv-krokodilska-kozha.webp`, alt: 'Lorenzo Ricci Perla сив кардхолдър крокодилска кожа - преден изглед' },
      { src: `/Products/wallets/Perla/kardholder-perla-zaden-izgled.webp`, alt: 'Lorenzo Ricci Perla - заден изглед, отделения за карти' },
    ],
  },
  {
    id: "cardholder-topazio",
    slug: "cardholder-topazio",
    sku: "CRD-TOP",
    name: 'Lorenzo Ricci "Topazio"',
    category: "cardholders",
    price: 65,
    currency: "€",
    inStock: true,
    badge: "Нова колекция",
    stock: 23,
    warranty: "", // leather: no warranty is offered (owner, 2026-09-27)
    shortDescription: "Жълт кардхолдър от крокодилска кожа",
    description: 'Всяко изделие от линията на Lorenzo Ricci е израз на безкомпромисен лукс. Съчетаваме суровата елегантност на автентичната кожа от сиамски крокодил (Crocodylus siamensis) с прецизна градска функционалност за тези, които ценят строгата индивидуалност.',
    materialNote: 'Изработено от истинска крокодилска кожа. Тъй като всяка кожа е уникална, шарките и текстурата може да се различават леко от показаните на снимките - това е естествена характеристика на автентичната крокодилска кожа и придава на всяко изделие неповторим характер.',
    crocodileSpecies: SIAMESE_CROCODILE,
    features: [
      "100% естествена крокодилска кожа",
      "Ръчна изработка - всяко изделие е уникално",
    ],
    specs: [
      { label: "Материал", value: "100% Крокодилска кожа" },
      { label: "Вид", value: SIAMESE_CROCODILE },
      { label: "Изработка", value: "Ръчна" },
      { label: "Цвят", value: "Жълт (Topazio)" },
      { label: "Размери", value: "" }, // empty → row hidden until the owner gives real measurements
    ],
    coverImage: { src: `/Products/wallets/Topazio/kardholder-topazio-zhalt-krokodilska-kozha.webp`, alt: 'Lorenzo Ricci Topazio жълт кардхолдър крокодилска кожа - преден изглед' },
    images: [
      { src: `/Products/wallets/Topazio/kardholder-topazio-zhalt-krokodilska-kozha.webp`, alt: 'Lorenzo Ricci Topazio жълт кардхолдър крокодилска кожа - преден изглед' },
      { src: `/Products/wallets/Topazio/kardholder-topazio-zaden-izgled.webp`, alt: 'Lorenzo Ricci Topazio - заден изглед, отделения за карти' },
    ],
  },
  // ─── BAGS ───────────────────────────────────────────────────────────────────
  // TODO (owed by owner before this section is publish-ready):
  //   - Milano Avorio: lining material (still dropped from specs entirely until confirmed -
  //     not shown as a placeholder). Dimensions confirmed 2026-09-14, now in specs.
  //   - Milano Avorio gallery (2026-09-13): 10 of 11 numbered source files are in, in the
  //     owner's numeric order (3, 4, 5, 8, 10 centre-cropped to square, off by only 1.9-5.4%
  //     pre-crop). File 11 is still missing from the source folder entirely - never
  //     re-supplied after the original (raw, unprocessed) version was flagged two rounds ago.
  //   - Milano Avorio descriptionImage: unset (see comment on the product entry) - none
  //     of the 10 current gallery photos is a genuine macro shot of the leather itself.
  //     No generic fallback - its media column is simply omitted until the owner shoots one.
  //   - Clutch stock counts: confirmed by the owner 2026-09-27 (Torino 5, Verona 5,
  //     Toscana 2, Portofino 5, Capri 3; Milano Avorio 1) - the rows are in
  //     supabase/wallet_inventory_bags.sql, which the owner runs in the SQL editor.
  //   - Clutch dimensions (all five): not measured yet. The "Размери" value stays ""
  //     and ProductInfo hides empty spec values, so customers never see a placeholder
  //     row. Fill it in only with the owner's real measurements.
  //   - Toscana: owner to provide a replacement for gallery slot 5 (see note on its
  //     images array below) - the supplied file wasn't square and was skipped
  //   - descriptionImage (macro texture shot for "Автентичност и Структура"): Torino,
  //     Verona, Toscana, and Portofino each have their own now (2026-09-24, from the
  //     owner's "under product" photos), and so does Capri (added 2026-09-25). Milano Avorio's stays unset - no genuine
  //     macro shot exists yet (see above) - and LeatherDescription no longer falls
  //     back to a generic image, so its media column is simply omitted.
  {
    id: "bag-milano-avorio",
    slug: "bag-milano-avorio",
    sku: "BAG-MILANO-AVORIO",
    name: 'Lorenzo Ricci "Milano Avorio"',
    category: "bags",
    price: 4000,
    currency: "€",
    badge: "Единствен екземпляр",
    crocodileSpecies: NILE_CROCODILE,
    inStock: true,
    stock: 1,
    warranty: "", // leather: no warranty is offered (owner, 2026-09-27)
    shortDescription: "Голям сак от нилски крокодил с индивидуален рисунък на люспите",
    // Short `description` feeds the meta/OG tag only (sliced to 160 chars) - the tab copy
    // customers actually read is `descriptionSections` below. Kept deliberately plain: no
    // occasion language, no durability claim beyond what's confirmed.
    description: 'Milano Avorio е изработен от кожа на нилски крокодил (Crocodylus niloticus) с финиш Himalaya. Всяка кожа има собствен рисунък на люспите.',
    descriptionSections: [
      {
        heading: "Единствен екземпляр - 1 от 1",
        body: "Настоящият сак е произведен в един-единствен екземпляр и е ограничен до 1 бройка. Това е единствената създадена бройка от тази конкретна комбинация между дизайн, нилска крокодилска кожа (Crocodylus niloticus), естествен рисунък на люспите и Himalaya финиш. Втори екземпляр няма да бъде произведен. Неповторимостта на изделието не се определя единствено от лимита до една бройка, а и от самата кожа: естественият релеф, разположението на люспите и характерният цветови градиент са присъщи единствено на този конкретен материал и не могат да бъдат възпроизведени идентично. Към екземпляра се предоставя поименен сертификат за автентичност, който придружава изделието като документ за неговата идентичност и произход.",
      },
      {
        heading: "Финишът",
        body: "Финишът Himalaya изсветлява горната част на всяка люспа, докато вдлъбнатините между тях остават с естествения тон на кожата. Получава се градиент между слонова кост и патина, който следва индивидуалния релеф на конкретната кожа.",
      },
      {
        heading: "Отвътре",
        body: "Сакът е структуриран в едно основно отделение, вътрешен джоб за по-малки предмети и отделен джоб за телефон. Подредбата разделя съдържанието, без излишни прегради.",
      },
      {
        heading: "Кожата",
        body: "Изработен е от кожа на нилски крокодил (Crocodylus niloticus). Рисунъкът на люспите е специфичен за тази кожа - оттук и означението Единствен екземпляр, а не сериен номер от ограничена серия.",
      },
    ],
    features: [
      "100% естествена крокодилска кожа",
      "Himalaya finish - контраст между слонова кост и естествена патина",
      "Индивидуален рисунък на люспите за всяка кожа",
      "Сериен номер LR-CR-9403",
      "Ръчна изработка от майстор кожар",
    ],
    // Rewritten 2026-09-13 per owner: Подплата omitted entirely (no verified lining material
    // yet) rather than shown as an UNVERIFIED placeholder. Размери added 2026-09-14, owner-
    // confirmed exact measurements. Вид/Сериен №/Изработка dropped from this table (folded
    // into Материал, or still visible via `features` above) to keep the list short. Finish +
    // zip + handles given directly by the owner as final spec content - not pending verification.
    specs: [
      { label: "Материал", value: `${NILE_CROCODILE}, Himalaya финиш` },
      { label: "Размери", value: "45 см (Дължина) × 22 см (Широчина) × 27 см (Височина)" },
      { label: "Цвят", value: "Слонова кост (Avorio)" },
      { label: "Вътрешност", value: "Основно отделение, вътрешен джоб, джоб за телефон" },
      { label: "Закопчаване", value: "Цип YKK" },
      { label: "Дръжки", value: "Две горни дръжки и подвижна раменна дръжка" },
    ],
    // descriptionImage intentionally unset - none of the 10 gallery photos is a genuine
    // macro shot of the leather itself (closest is the certificate/tag close-up, which is about
    // the fabric label, not the hornback texture). LeatherDescription no longer falls back to a
    // generic image when this is unset - its media column is simply omitted until a real texture
    // macro is supplied. See BAGS-section TODO above.
    coverImage: { src: `/Products/bags/Milano Avorio/sak-milano-avorio-krokodilska-kozha-preden-izgled.webp`, alt: 'Lorenzo Ricci Milano Avorio сак от крокодилска кожа - преден изглед' },
    images: [
      { src: `/Products/bags/Milano Avorio/sak-milano-avorio-krokodilska-kozha-preden-izgled.webp`, alt: 'Lorenzo Ricci Milano Avorio сак - продуктова снимка, преден изглед' },
      { src: `/Products/bags/Milano Avorio/sak-milano-avorio-lifestyle-nosene-na-ramo.webp`,         alt: 'Lorenzo Ricci Milano Avorio - лайфстайл снимка, носене на рамо' },
      { src: `/Products/bags/Milano Avorio/sak-milano-avorio-detal-etiket-i-emblema.webp`,           alt: 'Lorenzo Ricci Milano Avorio - детайл на щампования надпис LORENZO RICCI и закачения етикет' },
      { src: `/Products/bags/Milano Avorio/sak-milano-avorio-tristranichen-izgled.webp`,             alt: 'Lorenzo Ricci Milano Avorio - триизмерен изглед под ъгъл' },
      { src: `/Products/bags/Milano Avorio/sak-milano-avorio-strani-profil.webp`,                    alt: 'Lorenzo Ricci Milano Avorio - страничен профил, халка за раменната дръжка' },
      { src: `/Products/bags/Milano Avorio/sak-milano-avorio-detal-drazhki.webp`,                    alt: 'Lorenzo Ricci Milano Avorio - детайл на дръжките' },
      { src: `/Products/bags/Milano Avorio/sak-milano-avorio-dolna-chast-krachenca.webp`,            alt: 'Lorenzo Ricci Milano Avorio - долна част с предпазни краченца' },
      { src: `/Products/bags/Milano Avorio/sak-milano-avorio-vatreshnost-etiket.webp`,               alt: 'Lorenzo Ricci Milano Avorio - вътрешност с етикет LORENZO RICCI' },
      { src: `/Products/bags/Milano Avorio/sak-milano-avorio-sertifikat-nilski-krokodil.webp`,       alt: 'Lorenzo Ricci Milano Avorio - етикет за автентичност, Genuine Crocodile Leather, Himalaya Finish' },
      { src: `/Products/bags/Milano Avorio/sak-milano-avorio-vatreshen-djob-detal.webp`,             alt: 'Lorenzo Ricci Milano Avorio - детайл на вътрешен джоб' },
    ],
  },
  {
    id: "clutch-torino",
    slug: "clutch-torino",
    sku: "CLU-TORINO",
    name: 'Lorenzo Ricci "Torino"',
    category: "bags",
    price: 550,
    currency: "€",
    inStock: true,
    badge: "Нова колекция",
    stock: 5,
    warranty: "", // leather: no warranty is offered (owner, 2026-09-27)
    shortDescription: "Черен вечерен клъч от крокодилска кожа",
    description: 'Всяко изделие от линията на Lorenzo Ricci е израз на безкомпромисен лукс. Клъчът съчетава компактна градска функционалност с автентичната текстура на крокодилска кожа - аксесоар за вечер, който не се нуждае от повече от себе си.',
    materialNote: 'Изработено от истинска крокодилска кожа. Тъй като всяка кожа е уникална, шарките и текстурата може да се различават леко от показаните на снимките - това е естествена характеристика на автентичната крокодилска кожа и придава на всяко изделие неповторим характер.',
    crocodileSpecies: SIAMESE_CROCODILE,
    features: [
      "Лимитирана серия - след изчерпване няма да бъде произвеждана отново",
      "100% естествена крокодилска кожа",
      "Релефна ивица от естествени костни плочки, характерна за гръбната част на кожата",
      "Плавно движещ се метален цип, вграден дискретно в силуета на клъча",
      "Основно отделение и вътрешен джоб, подредени да поберат най-необходимото",
      "Компактен формат за вечер",
    ],
    specs: [
      { label: "Материал", value: "100% Крокодилска кожа" },
      { label: "Вид", value: SIAMESE_CROCODILE },
      { label: "Изработка", value: "Ръчна" },
      { label: "Цвят", value: "Нощно черен (Torino)" },
      { label: "Размери", value: "" }, // empty → row hidden until the owner gives real measurements
    ],
    descriptionImage: { src: `/Products/bags/Torino/klych-torino-varhu-kozhata.webp`, alt: 'Lorenzo Ricci Torino - детайл на крокодилската текстура' },
    coverImage: { src: `/Products/bags/Torino/klych-torino-cherna-krokodilska-kozha-preden-izgled.webp`, alt: 'Lorenzo Ricci Torino черен клъч крокодилска кожа - преден изглед' },
    images: [
      { src: `/Products/bags/Torino/klych-torino-cherna-krokodilska-kozha-preden-izgled.webp`, alt: 'Lorenzo Ricci Torino клъч - продуктова снимка, преден изглед' },
      { src: `/Products/bags/Torino/klych-torino-strancen-izgled.webp`,                          alt: 'Lorenzo Ricci Torino - страничен изглед' },
      { src: `/Products/bags/Torino/klych-torino-otvoren-vatreshnost-etiket.webp`,                alt: 'Lorenzo Ricci Torino - отворен клъч, вътрешност с марков етикет' },
      { src: `/Products/bags/Torino/klych-torino-vatreshnost-zakopchalka.webp`,                   alt: 'Lorenzo Ricci Torino - вътрешност, детайл на закопчалката' },
      { src: `/Products/bags/Torino/klych-torino-detal-tekstura.webp`,                            alt: 'Lorenzo Ricci Torino - детайл на крокодилската текстура' },
    ],
  },
  {
    id: "clutch-verona",
    slug: "clutch-verona",
    sku: "CLU-VERONA",
    name: 'Lorenzo Ricci "Verona"',
    category: "bags",
    price: 550,
    currency: "€",
    inStock: true,
    badge: "Нова колекция",
    stock: 5,
    warranty: "", // leather: no warranty is offered (owner, 2026-09-27)
    shortDescription: "Бордо вечерен клъч от крокодилска кожа",
    description: 'Всяко изделие от линията на Lorenzo Ricci е израз на безкомпромисен лукс. Клъчът съчетава компактна градска функционалност с автентичната текстура на крокодилска кожа - аксесоар за вечер, който не се нуждае от повече от себе си.',
    materialNote: 'Изработено от истинска крокодилска кожа. Тъй като всяка кожа е уникална, шарките и текстурата може да се различават леко от показаните на снимките - това е естествена характеристика на автентичната крокодилска кожа и придава на всяко изделие неповторим характер.',
    crocodileSpecies: SIAMESE_CROCODILE,
    features: [
      "Лимитирана серия - след изчерпване няма да бъде произвеждана отново",
      "100% естествена крокодилска кожа",
      "Релефна ивица от естествени костни плочки, характерна за гръбната част на кожата",
      "Плавно движещ се метален цип, вграден дискретно в силуета на клъча",
      "Основно отделение и вътрешен джоб, подредени да поберат най-необходимото",
      "Компактен формат за вечер",
    ],
    specs: [
      { label: "Материал", value: "100% Крокодилска кожа" },
      { label: "Вид", value: SIAMESE_CROCODILE },
      { label: "Изработка", value: "Ръчна" },
      { label: "Цвят", value: "Бордо червен (Verona)" },
      { label: "Размери", value: "" }, // empty → row hidden until the owner gives real measurements
    ],
    descriptionImage: { src: `/Products/bags/Verona/klych-verona-detal-tekstura.webp`, alt: 'Lorenzo Ricci Verona - детайл на крокодилската текстура' },
    coverImage: { src: `/Products/bags/Verona/klych-verona-cherven-krokodilska-kozha-preden-izgled.webp`, alt: 'Lorenzo Ricci Verona бордо клъч крокодилска кожа - преден изглед' },
    images: [
      { src: `/Products/bags/Verona/klych-verona-cherven-krokodilska-kozha-preden-izgled.webp`, alt: 'Lorenzo Ricci Verona клъч - продуктова снимка, преден изглед' },
      { src: `/Products/bags/Verona/klych-verona-strancen-izgled.webp`,                            alt: 'Lorenzo Ricci Verona - страничен изглед' },
      { src: `/Products/bags/Verona/klych-verona-otvoren-vatreshnost-etiket.webp`,                 alt: 'Lorenzo Ricci Verona - отворен клъч, вътрешност с марков етикет' },
      { src: `/Products/bags/Verona/klych-verona-vatreshnost-detal.webp`,                          alt: 'Lorenzo Ricci Verona - детайл на вътрешността' },
      { src: `/Products/bags/Verona/klych-verona-detal-logo.webp`,                                 alt: 'Lorenzo Ricci Verona - детайл на логото' },
    ],
  },
  {
    id: "clutch-toscana",
    slug: "clutch-toscana",
    sku: "CLU-TOSCANA",
    name: 'Lorenzo Ricci "Toscana"',
    category: "bags",
    price: 550,
    currency: "€",
    inStock: true,
    badge: "Нова колекция",
    stock: 2,
    warranty: "", // leather: no warranty is offered (owner, 2026-09-27)
    shortDescription: "Тъмнозелен вечерен клъч от крокодилска кожа",
    description: 'Всяко изделие от линията на Lorenzo Ricci е израз на безкомпромисен лукс. Клъчът съчетава компактна градска функционалност с автентичната текстура на крокодилска кожа - аксесоар за вечер, който не се нуждае от повече от себе си.',
    materialNote: 'Изработено от истинска крокодилска кожа. Тъй като всяка кожа е уникална, шарките и текстурата може да се различават леко от показаните на снимките - това е естествена характеристика на автентичната крокодилска кожа и придава на всяко изделие неповторим характер.',
    crocodileSpecies: SIAMESE_CROCODILE,
    features: [
      "Лимитирана серия - след изчерпване няма да бъде произвеждана отново",
      "100% естествена крокодилска кожа",
      "Релефна ивица от естествени костни плочки, характерна за гръбната част на кожата",
      "Плавно движещ се метален цип, вграден дискретно в силуета на клъча",
      "Основно отделение и вътрешен джоб, подредени да поберат най-необходимото",
      "Компактен формат за вечер",
    ],
    specs: [
      { label: "Материал", value: "100% Крокодилска кожа" },
      { label: "Вид", value: SIAMESE_CROCODILE },
      { label: "Изработка", value: "Ръчна" },
      { label: "Цвят", value: "Тъмнозелен (Toscana)" },
      { label: "Размери", value: "" }, // empty → row hidden until the owner gives real measurements
    ],
    descriptionImage: { src: `/Products/bags/Toscana/klych-toscana-detal-tekstura.webp`, alt: 'Lorenzo Ricci Toscana - детайл на крокодилската текстура' },
    coverImage: { src: `/Products/bags/Toscana/klych-toscana-zelen-krokodilska-kozha-preden-izgled.webp`, alt: 'Lorenzo Ricci Toscana тъмнозелен клъч крокодилска кожа - преден изглед' },
    // Slot 5 from the owner's numbered set was excluded (not square, still a raw
    // uncropped camera photo - see chat) - gallery currently skips straight from
    // detail #4 to #6, five images total. TODO: owner to provide a replacement.
    images: [
      { src: `/Products/bags/Toscana/klych-toscana-zelen-krokodilska-kozha-preden-izgled.webp`, alt: 'Lorenzo Ricci Toscana клъч - продуктова снимка, преден изглед' },
      { src: `/Products/bags/Toscana/klych-toscana-strancen-izgled.webp`,                          alt: 'Lorenzo Ricci Toscana - страничен изглед' },
      { src: `/Products/bags/Toscana/klych-toscana-detal-predna-strana.webp`,                      alt: 'Lorenzo Ricci Toscana - детайл на лицевата част' },
      { src: `/Products/bags/Toscana/klych-toscana-zakopchalka-detal.webp`,                        alt: 'Lorenzo Ricci Toscana - детайл на закопчалката' },
      { src: `/Products/bags/Toscana/klych-toscana-otvoren-vatreshnost-etiket.webp`,               alt: 'Lorenzo Ricci Toscana - отворен клъч, вътрешност с марков етикет' },
    ],
  },
  {
    id: "clutch-portofino",
    slug: "clutch-portofino",
    sku: "CLU-PORTOFINO",
    name: 'Lorenzo Ricci "Portofino"',
    category: "bags",
    price: 550,
    currency: "€",
    inStock: true,
    badge: "Нова колекция",
    stock: 5,
    warranty: "", // leather: no warranty is offered (owner, 2026-09-27)
    shortDescription: "Кремав вечерен клъч от крокодилска кожа",
    description: 'Всяко изделие от линията на Lorenzo Ricci е израз на безкомпромисен лукс. Клъчът съчетава компактна градска функционалност с автентичната текстура на крокодилска кожа - аксесоар за вечер, който не се нуждае от повече от себе си.',
    materialNote: 'Изработено от истинска крокодилска кожа. Тъй като всяка кожа е уникална, шарките и текстурата може да се различават леко от показаните на снимките - това е естествена характеристика на автентичната крокодилска кожа и придава на всяко изделие неповторим характер.',
    crocodileSpecies: SIAMESE_CROCODILE,
    features: [
      "Лимитирана серия - след изчерпване няма да бъде произвеждана отново",
      "100% естествена крокодилска кожа",
      "Релефна ивица от естествени костни плочки, характерна за гръбната част на кожата",
      "Плавно движещ се метален цип, вграден дискретно в силуета на клъча",
      "Основно отделение и вътрешен джоб, подредени да поберат най-необходимото",
      "Компактен формат за вечер",
    ],
    specs: [
      { label: "Материал", value: "100% Крокодилска кожа" },
      { label: "Вид", value: SIAMESE_CROCODILE },
      { label: "Изработка", value: "Ръчна" },
      { label: "Цвят", value: "Кремав (Portofino)" },
      { label: "Размери", value: "" }, // empty → row hidden until the owner gives real measurements
    ],
    descriptionImage: { src: `/Products/bags/Portofino/klych-portofino-detal-tekstura.webp`, alt: 'Lorenzo Ricci Portofino - детайл на крокодилската текстура' },
    coverImage: { src: `/Products/bags/Portofino/klych-portofino-krem-krokodilska-kozha-preden-izgled.webp`, alt: 'Lorenzo Ricci Portofino кремав клъч крокодилска кожа - преден изглед' },
    // "zakopchalka-detal" slide pulled - the bag occupies too small a band of the
    // square frame (lying-flat side-on shot, ~21% frame height). File is still on
    // disk (klych-portofino-zakopchalka-detal.webp), just not referenced here.
    images: [
      { src: `/Products/bags/Portofino/klych-portofino-krem-krokodilska-kozha-preden-izgled.webp`, alt: 'Lorenzo Ricci Portofino клъч - продуктова снимка, преден изглед' },
      { src: `/Products/bags/Portofino/klych-portofino-strancen-izgled.webp`,                         alt: 'Lorenzo Ricci Portofino - страничен изглед' },
      { src: `/Products/bags/Portofino/klych-portofino-drazhka-detal.webp`,                           alt: 'Lorenzo Ricci Portofino - детайл на дръжката' },
      { src: `/Products/bags/Portofino/klych-portofino-otvoren-vatreshnost.webp`,                     alt: 'Lorenzo Ricci Portofino - отворен клъч, вътрешност' },
      { src: `/Products/bags/Portofino/klych-portofino-otvoren-vatreshnost-etiket.webp`,              alt: 'Lorenzo Ricci Portofino - вътрешност с марков етикет' },
    ],
  },
  {
    id: "clutch-capri",
    slug: "clutch-capri",
    sku: "CLU-CAPRI",
    name: 'Lorenzo Ricci "Capri"',
    category: "bags",
    price: 550,
    currency: "€",
    inStock: true,
    badge: "Нова колекция",
    stock: 3,
    warranty: "", // leather: no warranty is offered (owner, 2026-09-27)
    shortDescription: "Тъмносин вечерен клъч от крокодилска кожа",
    description: 'Всяко изделие от линията на Lorenzo Ricci е израз на безкомпромисен лукс. Клъчът съчетава компактна градска функционалност с автентичната текстура на крокодилска кожа - аксесоар за вечер, който не се нуждае от повече от себе си.',
    materialNote: 'Изработено от истинска крокодилска кожа. Тъй като всяка кожа е уникална, шарките и текстурата може да се различават леко от показаните на снимките - това е естествена характеристика на автентичната крокодилска кожа и придава на всяко изделие неповторим характер.',
    crocodileSpecies: SIAMESE_CROCODILE,
    features: [
      "Лимитирана серия - след изчерпване няма да бъде произвеждана отново",
      "100% естествена крокодилска кожа",
      "Релефна ивица от естествени костни плочки, характерна за гръбната част на кожата",
      "Плавно движещ се метален цип, вграден дискретно в силуета на клъча",
      "Основно отделение и вътрешен джоб, подредени да поберат най-необходимото",
      "Компактен формат за вечер",
    ],
    specs: [
      { label: "Материал", value: "100% Крокодилска кожа" },
      { label: "Вид", value: SIAMESE_CROCODILE },
      { label: "Изработка", value: "Ръчна" },
      { label: "Цвят", value: "Тъмносин (Capri)" },
      { label: "Размери", value: "" }, // empty → row hidden until the owner gives real measurements
    ],
    descriptionImage: { src: `/Products/bags/Capri/klych-capri-varhu-kozhata.webp`, alt: 'Lorenzo Ricci Capri - клъчът върху тъмносиня крокодилска кожа' },
    coverImage: { src: `/Products/bags/Capri/klych-capri-sin-krokodilska-kozha-preden-izgled.webp`, alt: 'Lorenzo Ricci Capri тъмносин клъч крокодилска кожа - преден изглед' },
    images: [
      { src: `/Products/bags/Capri/klych-capri-sin-krokodilska-kozha-preden-izgled.webp`, alt: 'Lorenzo Ricci Capri клъч - продуктова снимка, преден изглед' },
      { src: `/Products/bags/Capri/klych-capri-zaden-izgled.webp`,                        alt: 'Lorenzo Ricci Capri - заден изглед, релефни костни плочки' },
      { src: `/Products/bags/Capri/klych-capri-otvoren-vatreshnost-etiket.webp`,          alt: 'Lorenzo Ricci Capri - отворен клъч, вътрешност с марков етикет' },
      { src: `/Products/bags/Capri/klych-capri-etiket-siamski-krokodil.webp`,             alt: 'Lorenzo Ricci Capri - етикет Genuine Crocodile Leather, Crocodylus siamensis' },
    ],
  },
];

export function getProductBySlug(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug);
}

export function getWatches(): Product[] {
  return products.filter((p) => p.category === "watches");
}

export function getJewellery(): Product[] {
  return products.filter((p) => p.category === "jewellery");
}

export function getBracelets(): Product[] {
  return products.filter((p) => p.subcategory === "bracelet");
}

export function getNecklaces(): Product[] {
  return products.filter((p) => p.subcategory === "necklace");
}

export function getRelatedProducts(product: Product, limit = 4): Product[] {
  return products
    .filter((p) => p.id !== product.id && p.category === product.category)
    .slice(0, limit);
}
