/**
 * Cthulhu Dreamt — Dialog helper
 * Wrapper skinné pour tous les dialogs du module.
 */

/**
 * Dialog générique skinné CD.
 * @param {object} options
 * @param {string} options.title
 * @param {string} options.content   — HTML injecté dans .cd-dialog
 * @param {Array}  options.buttons   — [{value, label, icon, primary}]
 * @returns {Promise<string|null>}   — valeur du bouton cliqué, ou null si fermé
 */
export function cdDialog({ title, content, buttons }) {
  return new Promise((resolve) => {
    const foundryButtons = Object.fromEntries(
      buttons.map(b => [b.value, {
        icon:     b.icon ? `<i class="${b.icon}"></i>` : "",
        label:    b.label,
        callback: () => resolve(b.value),
      }])
    );

    new Dialog({
      title,
      content: `<div class="cd-dialog">${content}</div>`,
      buttons: foundryButtons,
      default: buttons.find(b => b.primary)?.value ?? buttons[0]?.value,
      close:   () => resolve(null),
    }).render(true);
  });
}

/**
 * Confirm dialog skinné CD (Yes / No).
 * @returns {Promise<boolean>}
 */
export function cdConfirm({ title, content }) {
  return cdDialog({
    title,
    content,
    buttons: [
      { value: "yes", label: "Yes", icon: "fas fa-check", primary: true },
      { value: "no",  label: "No",  icon: "fas fa-times" },
    ],
  }).then(v => v === "yes");
}
