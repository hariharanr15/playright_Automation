function normalizeText(value = '') {
  return String(value).replace(/\s+/g, ' ').trim();
}

const DEFAULT_UOMS = Object.freeze({
  distanceUnit: 'Miles',
  volumeUnit: 'Gallons',
  weightUnit: 'Oz',
  tonsUnit: 'US Tons'
});

const UNIT_DEFINITIONS = {
  distance: [
    {
      unit: 'Kilometers',
      pattern: /\b(km|kilometre|kilometer|kilometres|kilometers)\b/i
    },
    {
      unit: 'Miles',
      pattern: /\b(mi|mile|miles)\b/i
    }
  ],
  volume: [
    {
      unit: 'Liters',
      pattern: /\b(l|ltr|liter|liters|litre|litres)\b/i
    },
    {
      unit: 'Gallons',
      pattern: /\b(gal|gallon|gallons)\b/i
    }
  ],
  weight: [
    {
      unit: 'Kg',
      pattern: /\b(kg|kgs|kilogram|kilograms)\b/i
    },
    {
      unit: 'Oz',
      pattern: /\b(oz|ounce|ounces)\b/i
    },
    {
      unit: 'Pounds',
      pattern: /\b(lb|lbs|pound|pounds)\b/i
    }
  ],
  tons: [
    {
      unit: 'Metric Tons',
      pattern: /\b(metric|metric\s*tons?|tonne|tonnes|tco2e?|tco2|t)\b/i
    },
    {
      unit: 'US Tons',
      pattern: /\b(us|usa|us\s*tons?|short\s*tons?|tons?)\b/i
    }
  ]
};

const UOM_RULES = [
  {
    pattern: /\b(us|usa|united states|imperial|mile|miles)\b/i,
    distanceUnit: 'miles',
    distancePattern: /\b(mile|miles|mi)\b/i,
    distanceUnexpectedPattern: /\b(kilometre|kilometer|kilometres|kilometers|km)\b/i,
    emissionUnit: 'tons',
    emissionPattern: /\b(us\s*tons?|short\s*tons?|tons?)\b/i,
    emissionUnexpectedPattern: /\b(metric\s*tons?|metric\s*ton|tonne|tonnes)\b/i,
    fuelVolumeUnit: 'gallons',
    fuelVolumePattern: /\b(gallon|gallons|gal)\b/i,
    fuelVolumeUnexpectedPattern: /\b(litre|liter|litres|liters|ltr|l)\b/i
  },
  {
    pattern: /\b(metric|kilometre|kilometer|kilometres|kilometers|km|canada|australia|india|uae|united arab emirates|europe|france|germany|singapore|united kingdom|uk|gb|great britain|britain|england|scotland|wales)\b/i,
    distanceUnit: 'kilometers',
    distancePattern: /\b(kilometre|kilometer|kilometres|kilometers|km)\b/i,
    distanceUnexpectedPattern: /\b(mile|miles|mi)\b/i,
    emissionUnit: 'tonnes',
    emissionPattern: /\b(tonne|tonnes|metric\s*tons?|metric\s*ton|tCO2e?|t)\b/i,
    emissionUnexpectedPattern: /\b(us\s*tons?|short\s*tons?)\b/i,
    fuelVolumeUnit: 'litres',
    fuelVolumePattern: /\b(litre|liter|litres|liters|ltr|l)\b/i,
    fuelVolumeUnexpectedPattern: /\b(gallon|gallons|gal)\b/i
  }
];

function escapeRegex(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getLabelValue(configured, label) {
  const match = configured.match(new RegExp(`${label}\\s*:\\s*([^;|,\\n]+)`, 'i'));
  return normalizeText(match?.[1] || '');
}

function combinePatterns(patterns) {
  const sources = patterns
    .filter(Boolean)
    .map((pattern) => pattern.source || String(pattern));

  return sources.length ? new RegExp(sources.join('|'), 'i') : /$a/;
}

function unitDefinition(metric, configuredUnit, fallbackUnit) {
  const definitions = UNIT_DEFINITIONS[metric] || [];
  const configured = normalizeText(configuredUnit);
  const selected = definitions.find((definition) => definition.pattern.test(configured)) ||
    definitions.find((definition) => new RegExp(`^${escapeRegex(fallbackUnit)}$`, 'i').test(definition.unit)) ||
    definitions[0];
  const unexpectedPattern = combinePatterns(
    definitions
      .filter((definition) => definition !== selected)
      .map((definition) => definition.pattern)
  );

  return {
    unit: selected.unit,
    pattern: selected.pattern,
    unexpectedPattern
  };
}

function expectedUnitsFromCountryUom(countryUom) {
  const configured = normalizeText(countryUom);
  const rule = UOM_RULES.find((candidate) => candidate.pattern.test(configured));
  const ruleDistance = rule?.distanceUnit || DEFAULT_UOMS.distanceUnit;
  const ruleVolume = rule?.fuelVolumeUnit || DEFAULT_UOMS.volumeUnit;
  const ruleTons = rule?.emissionUnit || DEFAULT_UOMS.tonsUnit;
  const distance = unitDefinition('distance', getLabelValue(configured, 'Distance'), ruleDistance);
  const volume = unitDefinition('volume', getLabelValue(configured, 'Volume'), ruleVolume);
  const weight = unitDefinition('weight', getLabelValue(configured, 'Weight'), DEFAULT_UOMS.weightUnit);
  const tons = unitDefinition('tons', getLabelValue(configured, 'Tons'), ruleTons);

  return {
    configuredCountry: getLabelValue(configured, 'Country'),
    configuredCountryUom: configured || 'not configured; using default Miles/Gallons/Oz/US Tons',
    fallbackApplied: !configured,
    distanceUnit: distance.unit,
    distancePattern: distance.pattern,
    distanceUnexpectedPattern: distance.unexpectedPattern,
    volumeUnit: volume.unit,
    volumePattern: volume.pattern,
    volumeUnexpectedPattern: volume.unexpectedPattern,
    weightUnit: weight.unit,
    weightPattern: weight.pattern,
    weightUnexpectedPattern: weight.unexpectedPattern,
    tonsUnit: tons.unit,
    tonsPattern: tons.pattern,
    tonsUnexpectedPattern: tons.unexpectedPattern,
    emissionUnit: tons.unit,
    emissionPattern: tons.pattern,
    emissionUnexpectedPattern: tons.unexpectedPattern,
    fuelVolumeUnit: volume.unit,
    fuelVolumePattern: volume.pattern,
    fuelVolumeUnexpectedPattern: volume.unexpectedPattern
  };
}

function readNamedValue(value) {
  if (!value) return '';
  if (typeof value === 'string') return normalizeText(value);
  if (typeof value !== 'object') return normalizeText(value);
  return normalizeText(value.name || value.code || value.value || value.label || '');
}

function formatCountryUomConfig(config = {}) {
  const country = readNamedValue(config.country);
  const distance = readNamedValue(config.distance);
  const volume = readNamedValue(config.volume);
  const weight = readNamedValue(config.weight);
  const tons = readNamedValue(config.tons);
  const parts = [
    country && `Country: ${country}`,
    distance && `Distance: ${distance}`,
    volume && `Volume: ${volume}`,
    weight && `Weight: ${weight}`,
    tons && `Tons: ${tons}`
  ].filter(Boolean);
  return parts.join('; ');
}

module.exports = {
  DEFAULT_UOMS,
  expectedUnitsFromCountryUom,
  formatCountryUomConfig,
  normalizeText
};
