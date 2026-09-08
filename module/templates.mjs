/**
 * Cthulhu Dreamt — Preload Handlebars Templates
 */

export async function preloadHandlebarsTemplates() {
  const paths = [
    // Actor sheet partials
    "systems/cthulhu-dreamt/templates/actors/parts/header.hbs",
    "systems/cthulhu-dreamt/templates/actors/parts/tab-stats.hbs",
    "systems/cthulhu-dreamt/templates/actors/parts/tab-inventory.hbs",
    "systems/cthulhu-dreamt/templates/actors/parts/tab-goals.hbs",
    "systems/cthulhu-dreamt/templates/actors/npc-sheet.hbs",
    "systems/cthulhu-dreamt/templates/items/specialty-sheet.hbs",
    // Item sheet
    "systems/cthulhu-dreamt/templates/items/item-sheet.hbs",
    // Chat
    "systems/cthulhu-dreamt/templates/chat/roll-result.hbs",
  ];

  return foundry.applications.handlebars.loadTemplates(paths);
}
