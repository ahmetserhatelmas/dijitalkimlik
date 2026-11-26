export type Place = {
  country: string | null;
  province: string | null;
};

type Names = readonly [code: string, tr: string, en: string];

const COUNTRY_LIST = [
  ["TR", "Türkiye", "Turkey"],
  ["KKTC", "Kuzey Kıbrıs", "Northern Cyprus"],
  ["AE", "Birleşik Arap Emirlikleri", "United Arab Emirates"],
  ["AT", "Avusturya", "Austria"],
  ["AU", "Avustralya", "Australia"],
  ["BE", "Belçika", "Belgium"],
  ["CA", "Kanada", "Canada"],
  ["CH", "İsviçre", "Switzerland"],
  ["DE", "Almanya", "Germany"],
  ["ES", "İspanya", "Spain"],
  ["FR", "Fransa", "France"],
  ["GB", "Birleşik Krallık", "United Kingdom"],
  ["GR", "Yunanistan", "Greece"],
  ["IT", "İtalya", "Italy"],
  ["NL", "Hollanda", "Netherlands"],
  ["PL", "Polonya", "Poland"],
  ["US", "Amerika Birleşik Devletleri", "United States"],
] as const satisfies readonly Names[];

const PROVINCE_LIST = {
  TR: [
    ["01", "Adana", "Adana"], ["02", "Adıyaman", "Adıyaman"], ["03", "Afyonkarahisar", "Afyonkarahisar"],
    ["04", "Ağrı", "Ağrı"], ["05", "Amasya", "Amasya"], ["06", "Ankara", "Ankara"], ["07", "Antalya", "Antalya"],
    ["08", "Artvin", "Artvin"], ["09", "Aydın", "Aydın"], ["10", "Balıkesir", "Balıkesir"], ["11", "Bilecik", "Bilecik"],
    ["12", "Bingöl", "Bingöl"], ["13", "Bitlis", "Bitlis"], ["14", "Bolu", "Bolu"], ["15", "Burdur", "Burdur"],
    ["16", "Bursa", "Bursa"], ["17", "Çanakkale", "Çanakkale"], ["18", "Çankırı", "Çankırı"], ["19", "Çorum", "Çorum"],
    ["20", "Denizli", "Denizli"], ["21", "Diyarbakır", "Diyarbakır"], ["22", "Edirne", "Edirne"], ["23", "Elazığ", "Elazığ"],
    ["24", "Erzincan", "Erzincan"], ["25", "Erzurum", "Erzurum"], ["26", "Eskişehir", "Eskişehir"], ["27", "Gaziantep", "Gaziantep"],
    ["28", "Giresun", "Giresun"], ["29", "Gümüşhane", "Gümüşhane"], ["30", "Hakkari", "Hakkari"], ["31", "Hatay", "Hatay"],
    ["32", "Isparta", "Isparta"], ["33", "Mersin", "Mersin"], ["34", "İstanbul", "Istanbul"], ["35", "İzmir", "İzmir"],
    ["36", "Kars", "Kars"], ["37", "Kastamonu", "Kastamonu"], ["38", "Kayseri", "Kayseri"], ["39", "Kırklareli", "Kırklareli"],
    ["40", "Kırşehir", "Kırşehir"], ["41", "Kocaeli", "Kocaeli"], ["42", "Konya", "Konya"], ["43", "Kütahya", "Kütahya"],
    ["44", "Malatya", "Malatya"], ["45", "Manisa", "Manisa"], ["46", "Kahramanmaraş", "Kahramanmaraş"], ["47", "Mardin", "Mardin"],
    ["48", "Muğla", "Muğla"], ["49", "Muş", "Muş"], ["50", "Nevşehir", "Nevşehir"], ["51", "Niğde", "Niğde"],
    ["52", "Ordu", "Ordu"], ["53", "Rize", "Rize"], ["54", "Sakarya", "Sakarya"], ["55", "Samsun", "Samsun"],
    ["56", "Siirt", "Siirt"], ["57", "Sinop", "Sinop"], ["58", "Sivas", "Sivas"], ["59", "Tekirdağ", "Tekirdağ"],
    ["60", "Tokat", "Tokat"], ["61", "Trabzon", "Trabzon"], ["62", "Tunceli", "Tunceli"], ["63", "Şanlıurfa", "Şanlıurfa"],
    ["64", "Uşak", "Uşak"], ["65", "Van", "Van"], ["66", "Yozgat", "Yozgat"], ["67", "Zonguldak", "Zonguldak"],
    ["68", "Aksaray", "Aksaray"], ["69", "Bayburt", "Bayburt"], ["70", "Karaman", "Karaman"], ["71", "Kırıkkale", "Kırıkkale"],
    ["72", "Batman", "Batman"], ["73", "Şırnak", "Şırnak"], ["74", "Bartın", "Bartın"], ["75", "Ardahan", "Ardahan"],
    ["76", "Iğdır", "Iğdır"], ["77", "Yalova", "Yalova"], ["78", "Karabük", "Karabük"], ["79", "Kilis", "Kilis"],
    ["80", "Osmaniye", "Osmaniye"], ["81", "Düzce", "Düzce"],
  ],
  KKTC: [
    ["lefkosa", "Lefkoşa", "Nicosia"], ["gazimagusa", "Gazimağusa", "Famagusta"], ["girne", "Girne", "Kyrenia"],
    ["guzelyurt", "Güzelyurt", "Morphou"], ["iskele", "İskele", "Trikomo"], ["lefke", "Lefke", "Lefke"],
  ],
  AE: [
    ["az", "Abu Dabi", "Abu Dhabi"], ["du", "Dubai", "Dubai"], ["sh", "Şarika", "Sharjah"], ["aj", "Acman", "Ajman"],
    ["uq", "Ummül Kayveyn", "Umm Al Quwain"], ["rk", "Rasül Hayme", "Ras Al Khaimah"], ["fu", "Füceyre", "Fujairah"],
  ],
  AT: [
    ["1", "Burgenland", "Burgenland"], ["2", "Karintiya", "Carinthia"], ["3", "Aşağı Avusturya", "Lower Austria"],
    ["4", "Yukarı Avusturya", "Upper Austria"], ["5", "Salzburg", "Salzburg"], ["6", "Steiermark", "Styria"],
    ["7", "Tirol", "Tyrol"], ["8", "Vorarlberg", "Vorarlberg"], ["9", "Viyana", "Vienna"],
  ],
  AU: [
    ["nsw", "Yeni Güney Galler", "New South Wales"], ["vic", "Viktorya", "Victoria"], ["qld", "Queensland", "Queensland"],
    ["sa", "Güney Avustralya", "South Australia"], ["wa", "Batı Avustralya", "Western Australia"], ["tas", "Tazmanya", "Tasmania"],
    ["act", "Avustralya Başkent Bölgesi", "Australian Capital Territory"], ["nt", "Kuzey Toprakları", "Northern Territory"],
  ],
  BE: [
    ["bru", "Brüksel", "Brussels"], ["vlg", "Flaman Bölgesi", "Flanders"], ["wal", "Valon Bölgesi", "Wallonia"],
  ],
  CA: [
    ["ab", "Alberta", "Alberta"], ["bc", "Britanya Kolombiyası", "British Columbia"], ["mb", "Manitoba", "Manitoba"],
    ["nb", "New Brunswick", "New Brunswick"], ["nl", "Newfoundland ve Labrador", "Newfoundland and Labrador"],
    ["ns", "Nova Scotia", "Nova Scotia"], ["on", "Ontario", "Ontario"], ["pe", "Prens Edward Adası", "Prince Edward Island"],
    ["qc", "Quebec", "Quebec"], ["sk", "Saskatchewan", "Saskatchewan"], ["nt", "Kuzeybatı Toprakları", "Northwest Territories"],
    ["nu", "Nunavut", "Nunavut"], ["yt", "Yukon", "Yukon"],
  ],
  CH: [
    ["zh", "Zürih", "Zurich"], ["be", "Bern", "Bern"], ["lu", "Luzern", "Lucerne"], ["ur", "Uri", "Uri"],
    ["sz", "Schwyz", "Schwyz"], ["ow", "Obwalden", "Obwalden"], ["nw", "Nidwalden", "Nidwalden"], ["gl", "Glarus", "Glarus"],
    ["zg", "Zug", "Zug"], ["fr", "Fribourg", "Fribourg"], ["so", "Solothurn", "Solothurn"], ["bs", "Basel-Stadt", "Basel-Stadt"],
    ["bl", "Basel-Landschaft", "Basel-Landschaft"], ["sh", "Schaffhausen", "Schaffhausen"], ["ar", "Appenzell Ausserrhoden", "Appenzell Ausserrhoden"],
    ["ai", "Appenzell Innerrhoden", "Appenzell Innerrhoden"], ["sg", "St. Gallen", "St. Gallen"], ["gr", "Graubünden", "Graubünden"],
    ["ag", "Aargau", "Aargau"], ["tg", "Thurgau", "Thurgau"], ["ti", "Ticino", "Ticino"], ["vd", "Vaud", "Vaud"],
    ["vs", "Valais", "Valais"], ["ne", "Neuchâtel", "Neuchâtel"], ["ge", "Cenevre", "Geneva"], ["ju", "Jura", "Jura"],
  ],
  DE: [
    ["bw", "Baden-Württemberg", "Baden-Württemberg"], ["by", "Bavyera", "Bavaria"], ["be", "Berlin", "Berlin"],
    ["bb", "Brandenburg", "Brandenburg"], ["hb", "Bremen", "Bremen"], ["hh", "Hamburg", "Hamburg"], ["he", "Hessen", "Hesse"],
    ["mv", "Mecklenburg-Vorpommern", "Mecklenburg-Vorpommern"], ["ni", "Aşağı Saksonya", "Lower Saxony"],
    ["nw", "Kuzey Ren-Vestfalya", "North Rhine-Westphalia"], ["rp", "Renanya-Palatina", "Rhineland-Palatinate"],
    ["sl", "Saarland", "Saarland"], ["sn", "Saksonya", "Saxony"], ["st", "Saksonya-Anhalt", "Saxony-Anhalt"],
    ["sh", "Schleswig-Holstein", "Schleswig-Holstein"], ["th", "Türingiya", "Thuringia"],
  ],
  ES: [
    ["an", "Endülüs", "Andalusia"], ["ar", "Aragon", "Aragon"], ["as", "Asturias", "Asturias"], ["ib", "Balear Adaları", "Balearic Islands"],
    ["cn", "Kanarya Adaları", "Canary Islands"], ["cb", "Kantabria", "Cantabria"], ["cl", "Kastilya ve Leon", "Castile and León"],
    ["cm", "Kastilya-La Mancha", "Castile-La Mancha"], ["ct", "Katalonya", "Catalonia"], ["vc", "Valensiya", "Valencia"],
    ["ex", "Ekstremadura", "Extremadura"], ["ga", "Galiçya", "Galicia"], ["md", "Madrid", "Madrid"], ["mc", "Murcia", "Murcia"],
    ["nc", "Navarra", "Navarre"], ["pv", "Bask Bölgesi", "Basque Country"], ["ri", "La Rioja", "La Rioja"],
  ],
  FR: [
    ["ara", "Auvergne-Rhône-Alpes", "Auvergne-Rhône-Alpes"], ["bfc", "Bourgogne-Franche-Comté", "Bourgogne-Franche-Comté"],
    ["bre", "Bretanya", "Brittany"], ["cvl", "Centre-Val de Loire", "Centre-Val de Loire"], ["cor", "Korsika", "Corsica"],
    ["ges", "Grand Est", "Grand Est"], ["hdf", "Hauts-de-France", "Hauts-de-France"], ["idf", "Île-de-France", "Île-de-France"],
    ["nor", "Normandiya", "Normandy"], ["naq", "Nouvelle-Aquitaine", "Nouvelle-Aquitaine"], ["occ", "Occitanie", "Occitanie"],
    ["pdl", "Pays de la Loire", "Pays de la Loire"], ["pac", "Provence-Alpes-Côte d'Azur", "Provence-Alpes-Côte d'Azur"],
  ],
  GB: [
    ["eng", "İngiltere", "England"], ["sct", "İskoçya", "Scotland"], ["wls", "Galler", "Wales"], ["nir", "Kuzey İrlanda", "Northern Ireland"],
  ],
  GR: [
    ["a", "Attika", "Attica"], ["b", "Orta Yunanistan", "Central Greece"], ["c", "Orta Makedonya", "Central Macedonia"],
    ["d", "Girit", "Crete"], ["e", "Doğu Makedonya ve Trakya", "Eastern Macedonia and Thrace"], ["f", "Epir", "Epirus"],
    ["g", "İyonya Adaları", "Ionian Islands"], ["h", "Kuzey Ege", "North Aegean"], ["i", "Peloponez", "Peloponnese"],
    ["j", "Güney Ege", "South Aegean"], ["k", "Tesalya", "Thessaly"], ["l", "Batı Yunanistan", "Western Greece"],
    ["m", "Batı Makedonya", "Western Macedonia"],
  ],
  IT: [
    ["21", "Piyemonte", "Piedmont"], ["23", "Aosta Vadisi", "Aosta Valley"], ["25", "Lombardiya", "Lombardy"],
    ["32", "Trentino-Alto Adige", "Trentino-Alto Adige"], ["34", "Veneto", "Veneto"], ["36", "Friuli-Venezia Giulia", "Friuli-Venezia Giulia"],
    ["42", "Ligurya", "Liguria"], ["45", "Emilia-Romagna", "Emilia-Romagna"], ["52", "Toskana", "Tuscany"],
    ["55", "Umbria", "Umbria"], ["57", "Marche", "Marche"], ["62", "Lazio", "Lazio"], ["65", "Abruzzo", "Abruzzo"],
    ["67", "Molise", "Molise"], ["72", "Campania", "Campania"], ["75", "Puglia", "Apulia"], ["77", "Basilicata", "Basilicata"],
    ["78", "Calabria", "Calabria"], ["82", "Sicilya", "Sicily"], ["88", "Sardinya", "Sardinia"],
  ],
  NL: [
    ["dr", "Drenthe", "Drenthe"], ["fl", "Flevoland", "Flevoland"], ["fr", "Friesland", "Friesland"], ["ge", "Gelderland", "Gelderland"],
    ["gr", "Groningen", "Groningen"], ["li", "Limburg", "Limburg"], ["nb", "Kuzey Brabant", "North Brabant"],
    ["nh", "Kuzey Hollanda", "North Holland"], ["ov", "Overijssel", "Overijssel"], ["ut", "Utrecht", "Utrecht"],
    ["ze", "Zeeland", "Zeeland"], ["zh", "Güney Hollanda", "South Holland"],
  ],
  PL: [
    ["ds", "Aşağı Silezya", "Lower Silesian"], ["kp", "Kuyavya-Pomeranya", "Kuyavian-Pomeranian"], ["lu", "Lublin", "Lublin"],
    ["lb", "Lubusz", "Lubusz"], ["ld", "Łódź", "Łódź"], ["ma", "Küçük Polonya", "Lesser Poland"], ["mz", "Mazovya", "Masovian"],
    ["op", "Opole", "Opole"], ["pk", "Alt Karpatya", "Subcarpathian"], ["pd", "Podlasya", "Podlaskie"],
    ["pm", "Pomeranya", "Pomeranian"], ["sl", "Silezya", "Silesian"], ["sk", "Świętokrzyskie", "Świętokrzyskie"],
    ["wn", "Warmia-Mazurya", "Warmian-Masurian"], ["wp", "Büyük Polonya", "Greater Poland"], ["zp", "Batı Pomeranya", "West Pomeranian"],
  ],
  US: [
    ["al", "Alabama", "Alabama"], ["ak", "Alaska", "Alaska"], ["az", "Arizona", "Arizona"], ["ar", "Arkansas", "Arkansas"],
    ["ca", "Kaliforniya", "California"], ["co", "Colorado", "Colorado"], ["ct", "Connecticut", "Connecticut"],
    ["de", "Delaware", "Delaware"], ["dc", "Washington, D.C.", "Washington, D.C."], ["fl", "Florida", "Florida"],
    ["ga", "Georgia", "Georgia"], ["hi", "Hawaii", "Hawaii"], ["id", "Idaho", "Idaho"], ["il", "Illinois", "Illinois"],
    ["in", "Indiana", "Indiana"], ["ia", "Iowa", "Iowa"], ["ks", "Kansas", "Kansas"], ["ky", "Kentucky", "Kentucky"],
    ["la", "Louisiana", "Louisiana"], ["me", "Maine", "Maine"], ["md", "Maryland", "Maryland"], ["ma", "Massachusetts", "Massachusetts"],
    ["mi", "Michigan", "Michigan"], ["mn", "Minnesota", "Minnesota"], ["ms", "Mississippi", "Mississippi"], ["mo", "Missouri", "Missouri"],
    ["mt", "Montana", "Montana"], ["ne", "Nebraska", "Nebraska"], ["nv", "Nevada", "Nevada"], ["nh", "New Hampshire", "New Hampshire"],
    ["nj", "New Jersey", "New Jersey"], ["nm", "New Mexico", "New Mexico"], ["ny", "New York", "New York"],
    ["nc", "Kuzey Karolina", "North Carolina"], ["nd", "Kuzey Dakota", "North Dakota"], ["oh", "Ohio", "Ohio"],
    ["ok", "Oklahoma", "Oklahoma"], ["or", "Oregon", "Oregon"], ["pa", "Pensilvanya", "Pennsylvania"],
    ["ri", "Rhode Island", "Rhode Island"], ["sc", "Güney Karolina", "South Carolina"], ["sd", "Güney Dakota", "South Dakota"],
    ["tn", "Tennessee", "Tennessee"], ["tx", "Teksas", "Texas"], ["ut", "Utah", "Utah"], ["vt", "Vermont", "Vermont"],
    ["va", "Virginia", "Virginia"], ["wa", "Washington", "Washington"], ["wv", "Batı Virginia", "West Virginia"],
    ["wi", "Wisconsin", "Wisconsin"], ["wy", "Wyoming", "Wyoming"],
  ],
} as const satisfies Record<string, readonly Names[]>;

export type CountryCode = (typeof COUNTRY_LIST)[number][0];

export type Country = { code: CountryCode; tr: string; en: string };
export type Province = { code: string; country: CountryCode; tr: string; en: string };

export const COUNTRIES: readonly Country[] = COUNTRY_LIST.map(([code, tr, en]) => ({ code, tr, en }));

export const PROVINCES: readonly Province[] = (Object.entries(PROVINCE_LIST) as Array<[CountryCode, readonly Names[]]>).flatMap(
  ([country, rows]) => rows.map(([code, tr, en]) => ({ code: `${country}-${code}`, country, tr, en })),
);

const countryByCode = new Map(COUNTRIES.map((country) => [country.code, country]));
const provincesByCountry = new Map<string, Province[]>();
const provinceByCode = new Map<string, Province>();
const legacyNames = new Map<string, Place>();

for (const province of PROVINCES) {
  const list = provincesByCountry.get(province.country) ?? [];
  list.push(province);
  provincesByCountry.set(province.country, list);
  provinceByCode.set(province.code, province);
}

for (const province of PROVINCES) {
  const place = { country: province.country, province: province.code };
  if (province.country === "TR" || !legacyNames.has(fold(province.tr))) legacyNames.set(fold(province.tr), place);
  if (province.country === "TR" || !legacyNames.has(fold(province.en))) legacyNames.set(fold(province.en), place);
}

export function blankPlace(): Place {
  return { country: null, province: null };
}

export function isCountry(code: string | null | undefined): code is CountryCode {
  return typeof code === "string" && countryByCode.has(code as CountryCode);
}

export function provincesOf(country: string | null | undefined): readonly Province[] {
  if (!country) return [];
  return provincesByCountry.get(country) ?? [];
}

export function isProvince(country: string | null | undefined, code: string | null | undefined): boolean {
  if (!country || !code) return false;
  const province = provinceByCode.get(code);
  return province?.country === country;
}

export function formatPlace(place: Place | null | undefined, locale: "tr" | "en"): string | null {
  if (!place?.country) return null;
  const country = countryByCode.get(place.country as CountryCode);
  const province = place.province ? provinceByCode.get(place.province) : undefined;
  const countryName = country ? country[locale] : place.country;
  if (!province) return countryName;
  return `${province[locale]}, ${countryName}`;
}

export function placeFromLegacy(location: string | null | undefined): Place {
  if (!location) return blankPlace();
  const parts = location.split(",").map((part) => fold(part)).filter(Boolean);
  for (const part of parts) {
    const found = legacyNames.get(part);
    if (found) return { ...found };
  }
  return blankPlace();
}

export function readPlace(value: unknown, legacyLocation?: string | null): Place {
  const row = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const country = typeof row.country === "string" && isCountry(row.country) ? row.country : null;
  const province = typeof row.province === "string" && isProvince(country, row.province) ? row.province : null;
  if (country) return { country, province };
  return placeFromLegacy(legacyLocation);
}

function fold(value: string): string {
  return value.trim().toLocaleLowerCase("tr-TR");
}
