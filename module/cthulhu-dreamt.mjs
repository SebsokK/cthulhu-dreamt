/**
 * Cthulhu Dreamt — Entry point
 * Foundry VTT v14
 */

import { CthulhuDreamtActor }      from "./actors/actor.mjs";
import { CthulhuDreamtItem }       from "./items/item.mjs";
import { CthulhuDreamtActorSheet } from "./actors/actor-sheet.mjs";
import { CthulhuDreamtNPCSheet }   from "./actors/npc-sheet.mjs";
import { CthulhuDreamtItemSheet }  from "./items/item-sheet.mjs";
import { CthulhuDreamtSpecialtySheet } from "./items/specialty-sheet.mjs";
import { CD_SYSTEM }               from "./config.mjs";
import { registerHandlebarsHelpers } from "./helpers.mjs";
import { preloadHandlebarsTemplates } from "./templates.mjs";
import { registerChatListeners }   from "./chat.mjs";

Hooks.once("init", async function () {
  console.log("Cthulhu Dreamt | Initializing...");

  game.cthulhuDreamt = { CthulhuDreamtActor, CthulhuDreamtItem, config: CD_SYSTEM };
  CONFIG.CD = CD_SYSTEM;
  CONFIG.Actor.documentClass = CthulhuDreamtActor;
  CONFIG.Item.documentClass  = CthulhuDreamtItem;

  Actors.registerSheet("cthulhu-dreamt", CthulhuDreamtActorSheet, {
    types: ["character"],
    makeDefault: true,
    label: "Cthulhu Dreamt Character Sheet",
  });

  Actors.registerSheet("cthulhu-dreamt", CthulhuDreamtNPCSheet, {
    types: ["npc"],
    makeDefault: true,
    label: "Cthulhu Dreamt NPC Sheet",
  });

  Items.registerSheet("cthulhu-dreamt", CthulhuDreamtItemSheet, {
    makeDefault: true,
    label: "Cthulhu Dreamt Item Sheet",
  });

  Items.registerSheet("cthulhu-dreamt", CthulhuDreamtSpecialtySheet, {
    types: ["specialty"],
    makeDefault: true,
    label: "Cthulhu Dreamt Specialty Sheet",
  });

  registerHandlebarsHelpers();
  await preloadHandlebarsTemplates();

  console.log("Cthulhu Dreamt | Initialized.");
});

Hooks.once("ready", function () {
  registerChatListeners();
  console.log("Cthulhu Dreamt | Ready.");
});
