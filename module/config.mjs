/**
 * Cthulhu Dreamt — System Configuration
 */

export const CD_SYSTEM = {
  // The die used for standard rolls
  dieFace: 12,

  // The 6 core attributes
  attributes: {
    strong: "CD-Attr-strong",
    agile: "CD-Attr-agile",
    cunning: "CD-Attr-cunning",
    vigilant: "CD-Attr-vigilant",
    careful: "CD-Attr-careful",
    tenacious: "CD-Attr-tenacious",
  },

  // Attribute subtitles (flavour)
  attributeLabels: {
    strong:    "CD-Attr-strongSub",
    agile:     "CD-Attr-agileSub",
    cunning:   "CD-Attr-cunningSub",
    vigilant:  "CD-Attr-vigilantSub",
    careful:   "CD-Attr-carefulSub",
    tenacious: "CD-Attr-tenaciousSub",
  },

  // Wound severity levels
  woundLevels: {
    mild: "CD-Wound-mild",
    serious: "CD-Wound-serious",
    severe: "CD-Wound-severe",
  },

  // Wound track max per level (from the rulebook)
  woundTrackMax: {
    mild: { min: 1, max: 2 },
    serious: { min: 2, max: 4 },
    severe: { min: 4, max: 6 },
  },

  // Skill use types
  skillUseTypes: {
    unlimited: "CD-Skill-useTypeUnlimited",
    limited: "CD-Skill-useTypeLimited",
    passive: "CD-Skill-useTypePassive",
  },

  // Per-day reset
  skillPer: {
    day: "CD-Skill-perDay",
    encounter: "CD-Skill-perEncounter",
    always: "CD-Skill-perAlways",
  },

  // Weapon categories
  weaponCategories: {
    "close-quarters": "CD-Weapon-catcloseQuarters",
    "small-arms": "CD-Weapon-catsmallArms",
    "long-arms": "CD-Weapon-catlongArms",
    thrown: "CD-Weapon-catthrown",
    unarmed: "CD-Weapon-catunarmed",
  },

  // Weapon ranges
  weaponRanges: {
    close: "CD-Weapon-rangeclose",
    short: "CD-Weapon-rangeshort",
    medium: "CD-Weapon-rangemedium",
    long: "CD-Weapon-rangelong",
  },

  // Specialty tiers
  specialtyTiers: {
    1: "CD-Specialty-tier1",
    2: "CD-Specialty-tier2",
    3: "CD-Specialty-tier3",
  },

  // Roll degree thresholds (compared to TN)
  rollDegrees: {
    criticalFailure: 1,   // roll === 1, always
    failure: "below",     // roll < TN
    partial: "equal",     // roll === TN
    success: "above",     // roll > TN
    criticalSuccess: 12,  // roll === 12 (house-rule placeholder)
  },

  // Total Attribute Points cap at character creation
  totalAPStart: 16,
  totalAPMax: 40,

  // Limits cap
  limitMax: 12,
  attrMax: 12,
};
