/**
 * Cthulhu Dreamt — Chat message hooks
 * Gère les boutons des Roll Cards
 */

import { CthulhuDreamtActor } from "./actors/actor.mjs";

export function registerChatListeners() {
  document.addEventListener("click", async (e) => {
    // Spend AP
    const spendBtn = e.target.closest("[data-action='spendAP']");
    if (spendBtn) {
      await _handleSpendAP(spendBtn);
      return;
    }

    // Roll Damage
    const dmgBtn = e.target.closest("[data-action='rollDamage']");
    if (dmgBtn) {
      await _handleRollDamage(dmgBtn);
      return;
    }
  });
}

async function _handleRollDamage(btn) {
  const stress = btn.dataset.stress;
  if (!stress || stress === "—") return;

  const roll = new Roll(stress);
  await roll.evaluate();

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker(),
    content: `
      <div class="cd-roll-card">
        <div class="cd-roll-header">
          <span class="cd-roll-label">Damage Roll</span>
          <span class="cd-roll-tn">${stress}</span>
        </div>
        <div class="cd-roll-body">
          <div class="cd-roll-dice-row">
            <div class="cd-roll-die">
              <span class="cd-roll-natural" style="font-size:28px">${roll.total}</span>
              <span class="cd-roll-die-label">${stress}</span>
            </div>
          </div>
          <div class="cd-roll-degree" style="color:var(--cd-red)">
            <i class="fas fa-skull"></i> ${roll.total} Physical Stress
          </div>
        </div>
      </div>`,
    rolls: [roll],
  });
}

async function _handleSpendAP(btn) {
    const messageId = btn.dataset.messageId;
    const actorId   = btn.dataset.actorId;
    if (!messageId) return;

    const message  = game.messages.get(messageId);
    const rollData = message?.getFlag("cthulhu-dreamt", "rollData");
    if (!rollData) return;

    const actor = game.actors.get(actorId) ?? game.user.character;
    // Jets d'attribut → attributeKey, jets d'arme → attrKey
    const attrKey   = rollData.attrKey ?? rollData.attributeKey;
    const available = actor?.system.attributes?.[attrKey]?.value ?? 0;

    const extra = await _promptAPSpend(actor?.name ?? "Character", available);
    if (!extra || extra <= 0) return;

    await CthulhuDreamtActor.spendAPOnRoll(messageId, actor?.id ?? actorId, extra);
}

function _promptAPSpend(actorName, available) {
  return new Promise((resolve) => {
    new Dialog({
      title: `Spend AP — ${actorName}`,
      content: `
        <div class="cd-dialog">
          <div class="cd-dialog-row">
            <div class="cd-dialog-field cd-dialog-field-grow">
              <label class="cd-dialog-label">AP TO ADD TO ROLL
                <span class="cd-dialog-avail">(available: ${available})</span>
              </label>
              <input class="cd-dialog-input" type="number"
                name="ap" value="1" min="1" max="${available}" autofocus />
            </div>
          </div>
          ${available === 0
            ? `<p class="cd-dialog-hint" style="color:var(--cd-red)">No AP available for this attribute!</p>`
            : ""}
        </div>
      `,
      buttons: {
        spend: {
          icon:  `<i class="fas fa-plus"></i>`,
          label: "Add AP",
          callback: (html) => {
            const val = parseInt(html.find('[name="ap"]').val()) || 0;
            resolve(Math.min(val, available));
          },
        },
        cancel: { label: "Cancel", callback: () => resolve(0) },
      },
      default: available > 0 ? "spend" : "cancel",
    }).render(true);
  });
}
