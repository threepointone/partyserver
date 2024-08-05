const defaultLocations: DurableObjectLocationHint[] = [
  "wnam",
  "enam",
  "sam",
  "weur",
  "eeur",
  "apac",
  "oc",
  "afr",
  "me"
];

export function generateIdsGroupedByLocation(
  N: number = 9,
  config: Partial<Record<DurableObjectLocationHint, number>> = {
    wnam: 1,
    enam: 1,
    sam: 1,
    weur: 1,
    eeur: 1,
    apac: 1,
    oc: 1,
    afr: 1,
    me: 1
  }
): Record<DurableObjectLocationHint, string[]> {
  if (N < 1) {
    throw new Error("N must be greater than 0");
  }

  // Check if config is invalid or sum of all values is 0
  const isInvalidConfig =
    !config ||
    Object.keys(config).length === 0 ||
    Object.values(config).reduce((sum, value) => sum + value, 0) === 0;

  if (isInvalidConfig) {
    config = {};
    defaultLocations.forEach((loc) => {
      config[loc] = 1; // Assign default weight of 1 for each location
    });
  }

  const locations = Object.keys(config) as DurableObjectLocationHint[];
  const totalWeight = locations.reduce((sum, loc) => sum + config[loc]!, 0);
  const idsGrouped = {} as Record<DurableObjectLocationHint, string[]>;

  // First, calculate the base number of IDs for each location based on the weight
  const allocation = {} as Record<DurableObjectLocationHint, number>;
  let allocatedCount = 0;

  locations.forEach((loc) => {
    allocation[loc] = Math.max(Math.floor((config[loc]! / totalWeight) * N), 1);
    allocatedCount += allocation[loc];
    idsGrouped[loc] = []; // Initialize the array for each location
  });

  // Distribute the remaining IDs, if any
  let remaining = N - allocatedCount;
  let index = 0;

  while (remaining > 0) {
    const loc = locations[index % locations.length];
    allocation[loc]++;
    remaining--;
    index++;
  }

  // Generate the IDs grouped by location
  locations.forEach((loc) => {
    for (let i = 0; i < allocation[loc]; i++) {
      idsGrouped[loc].push(`${loc}-${i}`);
    }
  });

  return idsGrouped;
}

export const countriesGroupedByLocation = {
  wnam: [
    "CA", // Canada
    "US", // United States
    "MX" // Mexico
  ],
  enam: [
    "BM", // Bermuda
    "BS", // Bahamas
    "BZ", // Belize
    "CR", // Costa Rica
    "CU", // Cuba
    "DM", // Dominica
    "DO", // Dominican Republic
    "SV", // El Salvador
    "GD", // Grenada
    "GT", // Guatemala
    "HT", // Haiti
    "HN", // Honduras
    "JM", // Jamaica
    "NI", // Nicaragua
    "PA", // Panama
    "PR", // Puerto Rico
    "KN", // Saint Kitts and Nevis
    "LC", // Saint Lucia
    "VC", // Saint Vincent and the Grenadines
    "TT", // Trinidad and Tobago
    "VG" // British Virgin Islands
  ],
  sam: [
    "AR", // Argentina
    "BO", // Bolivia
    "BR", // Brazil
    "CL", // Chile
    "CO", // Colombia
    "EC", // Ecuador
    "FK", // Falkland Islands
    "GY", // Guyana
    "PY", // Paraguay
    "PE", // Peru
    "SR", // Suriname
    "UY", // Uruguay
    "VE" // Venezuela
  ],
  weur: [
    "AT", // Austria
    "BE", // Belgium
    "FR", // France
    "DE", // Germany
    "IE", // Ireland
    "IT", // Italy
    "LU", // Luxembourg
    "MT", // Malta
    "MC", // Monaco
    "NL", // Netherlands
    "PT", // Portugal
    "SM", // San Marino
    "ES", // Spain
    "CH", // Switzerland
    "GB" // United Kingdom
  ],
  eeur: [
    "AL", // Albania
    "BY", // Belarus
    "BA", // Bosnia and Herzegovina
    "BG", // Bulgaria
    "HR", // Croatia
    "CZ", // Czech Republic
    "HU", // Hungary
    "MD", // Moldova
    "ME", // Montenegro
    "MK", // North Macedonia
    "PL", // Poland
    "RO", // Romania
    "RS", // Serbia
    "RU", // Russia
    "SK", // Slovakia
    "SI", // Slovenia
    "UA" // Ukraine
  ],
  apac: [
    "AF", // Afghanistan
    "AM", // Armenia
    "AU", // Australia
    "AZ", // Azerbaijan
    "BD", // Bangladesh
    "BT", // Bhutan
    "BN", // Brunei
    "KH", // Cambodia
    "CN", // China
    "CY", // Cyprus
    "FJ", // Fiji
    "GE", // Georgia
    "IN", // India
    "ID", // Indonesia
    "IR", // Iran
    "IQ", // Iraq
    "IL", // Israel
    "JP", // Japan
    "JO", // Jordan
    "KZ", // Kazakhstan
    "KW", // Kuwait
    "KG", // Kyrgyzstan
    "LA", // Laos
    "LB", // Lebanon
    "MY", // Malaysia
    "MV", // Maldives
    "MN", // Mongolia
    "MM", // Myanmar
    "NP", // Nepal
    "NZ", // New Zealand
    "KP", // North Korea
    "KR", // South Korea
    "OM", // Oman
    "PK", // Pakistan
    "PG", // Papua New Guinea
    "PH", // Philippines
    "QA", // Qatar
    "SA", // Saudi Arabia
    "SG", // Singapore
    "LK", // Sri Lanka
    "SY", // Syria
    "TJ", // Tajikistan
    "TH", // Thailand
    "TL", // Timor-Leste
    "TR", // Turkey
    "TM", // Turkmenistan
    "AE", // United Arab Emirates
    "UZ", // Uzbekistan
    "VN", // Vietnam
    "YE" // Yemen
  ],
  oc: [
    "AS", // American Samoa
    "CK", // Cook Islands
    "FJ", // Fiji
    "PF", // French Polynesia
    "GU", // Guam
    "KI", // Kiribati
    "MH", // Marshall Islands
    "FM", // Micronesia
    "NR", // Nauru
    "NC", // New Caledonia
    "NZ", // New Zealand
    "NU", // Niue
    "NF", // Norfolk Island
    "MP", // Northern Mariana Islands
    "PW", // Palau
    "PG", // Papua New Guinea
    "PN", // Pitcairn Islands
    "WS", // Samoa
    "SB", // Solomon Islands
    "TK", // Tokelau
    "TO", // Tonga
    "TV", // Tuvalu
    "VU", // Vanuatu
    "WF" // Wallis and Futuna
  ],
  afr: [
    "DZ", // Algeria
    "AO", // Angola
    "BJ", // Benin
    "BW", // Botswana
    "BF", // Burkina Faso
    "BI", // Burundi
    "CV", // Cabo Verde
    "CM", // Cameroon
    "CF", // Central African Republic
    "TD", // Chad
    "KM", // Comoros
    "CG", // Congo - Brazzaville
    "CD", // Congo - Kinshasa
    "CI", // Côte d’Ivoire
    "DJ", // Djibouti
    "EG", // Egypt
    "GQ", // Equatorial Guinea
    "ER", // Eritrea
    "SZ", // Eswatini
    "ET", // Ethiopia
    "GA", // Gabon
    "GM", // Gambia
    "GH", // Ghana
    "GN", // Guinea
    "GW", // Guinea-Bissau
    "KE", // Kenya
    "LS", // Lesotho
    "LR", // Liberia
    "LY", // Libya
    "MG", // Madagascar
    "MW", // Malawi
    "ML", // Mali
    "MR", // Mauritania
    "MU", // Mauritius
    "YT", // Mayotte
    "MA", // Morocco
    "MZ", // Mozambique
    "NA", // Namibia
    "NE", // Niger
    "NG", // Nigeria
    "RW", // Rwanda
    "RE", // Réunion
    "SH", // Saint Helena
    "ST", // São Tomé and Príncipe
    "SN", // Senegal
    "SC", // Seychelles
    "SL", // Sierra Leone
    "SO", // Somalia
    "ZA", // South Africa
    "SS", // South Sudan
    "SD", // Sudan
    "TZ", // Tanzania
    "TG", // Togo
    "TN", // Tunisia
    "UG", // Uganda
    "ZM", // Zambia
    "ZW" // Zimbabwe
  ],
  me: [
    "AE", // United Arab Emirates
    "BH", // Bahrain
    "EG", // Egypt
    "IR", // Iran
    "IQ", // Iraq
    "IL", // Israel
    "JO", // Jordan
    "KW", // Kuwait
    "LB", // Lebanon
    "OM", // Oman
    "PS", // Palestine
    "QA", // Qatar
    "SA", // Saudi Arabia
    "SY", // Syria
    "YE" // Yemen
  ]
};
