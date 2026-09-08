/**
 * Cthulhu Dreamt — Handlebars Helpers
 */

export function registerHandlebarsHelpers() {

  Handlebars.registerHelper("eq",  (a, b) => a === b);
  Handlebars.registerHelper("gt",  (a, b) => a > b);
  Handlebars.registerHelper("lt",  (a, b) => a < b);
  Handlebars.registerHelper("add", (a, b) => Number(a) + Number(b));
  Handlebars.registerHelper("sub", (a, b) => Number(a) - Number(b));
  Handlebars.registerHelper("mul", (a, b) => Number(a) * Number(b));

  // Crée un tableau inline — {{#each (array "a" "b" "c")}}
  Handlebars.registerHelper("array", (...args) => {
    // Le dernier argument est l'objet options de Handlebars, on l'exclut
    return args.slice(0, -1);
  });

  // Majuscule première lettre
  Handlebars.registerHelper("upper", (str) =>
    typeof str === "string" ? str.charAt(0).toUpperCase() + str.slice(1) : str
  );

  // Boucle n fois — {{#times 6}}...{{/times}}
  Handlebars.registerHelper("times", (n, block) => {
    let result = "";
    for (let i = 0; i < n; i++) result += block.fn(i);
    return result;
  });

  // Localise une clé
  Handlebars.registerHelper("cdl", (key) => game.i18n.localize(key));

  // % clampé 0-100
  Handlebars.registerHelper("pct", (val, max) =>
    Math.round((Math.min(Number(val), Number(max)) / Math.max(Number(max), 1)) * 100)
  );

  // Classe CSS pour les cellules de wound track
  Handlebars.registerHelper("woundCell", (index, track) =>
    Number(index) < Number(track) ? "filled" : ""
  );

  // Icône d'item avec fallback
  Handlebars.registerHelper("itemIcon", (item) =>
    item?.img ?? "icons/svg/item-bag.svg"
  );
}
