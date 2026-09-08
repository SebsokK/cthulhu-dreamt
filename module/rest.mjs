/**
 * Cthulhu Dreamt — Rest & Recovery
 */

const ATTR_KEYS   = ["strong","agile","cunning","vigilant","careful","tenacious"];
const ATTR_LABELS = { strong:"Strong", agile:"Agile", cunning:"Cunning",
                      vigilant:"Vigilant", careful:"Careful", tenacious:"Tenacious" };

// ── Étape 1 : Choix de la qualité de repos ───────────────────────────────────
export async function openRestDialog(actor) {
  return new Promise((resolve) => {
    new Dialog({
      title: "Rest & Recovery",
      content: `
        <div class="cd-dialog cd-rest-dialog">
          <p class="cd-dialog-hint">Choose your rest quality based on completed journey tasks.</p>

          <div class="cd-rest-quality-list">
            <label class="cd-rest-quality-row">
              <input type="radio" name="quality" value="poor" checked />
              <div class="cd-rest-quality-info">
                <span class="cd-rest-quality-name poor">POOR</span>
                <span class="cd-rest-quality-desc">Less than 3 tasks — 6 AP to distribute, half stress (one type)</span>
              </div>
            </label>
            <label class="cd-rest-quality-row">
              <input type="radio" name="quality" value="good" />
              <div class="cd-rest-quality-info">
                <span class="cd-rest-quality-name good">GOOD</span>
                <span class="cd-rest-quality-desc">3+ tasks — half Total Max AP, full or half stress, wounds –1</span>
              </div>
            </label>
            <label class="cd-rest-quality-row">
              <input type="radio" name="quality" value="great" />
              <div class="cd-rest-quality-info">
                <span class="cd-rest-quality-name great">GREAT</span>
                <span class="cd-rest-quality-desc">Safe & comfortable shelter — full AP, all stress, wounds –1</span>
              </div>
            </label>
          </div>

          <p class="cd-rest-modifiers-hint">
            <i class="fas fa-info-circle"></i>
            Don't forget to account for skill and equipment modifiers — sleeping bags and tents may improve rest quality.
          </p>
        </div>
      `,
      buttons: {
        next: {
          icon:  `<i class="fas fa-arrow-right"></i>`,
          label: "Next",
          callback: async (html) => {
            const quality = html.find('[name="quality"]:checked').val();
            resolve(quality);
            await _processRest(actor, quality);
          },
        },
        cancel: { label: "Cancel", callback: () => resolve(null) },
      },
      default: "next",
    }).render(true);
  });
}

// ── Processus selon la qualité ─────────────────────────────────────────────
async function _processRest(actor, quality) {
  if (quality === "poor")  await _restPoor(actor);
  if (quality === "good")  await _restGood(actor);
  if (quality === "great") await _restGreat(actor);
}

// ── POOR : 6 AP à distribuer, moitié d'un type de stress ─────────────────
async function _restPoor(actor) {
  const attrs = actor.system.attributes ?? {};

  // Dialog 1 : distribution des 6 AP
  const apDistrib = await _dialogDistributeAP(actor, 6);
  if (!apDistrib) return;

  // Dialog 2 : choix du type de stress (Physical ou Mental)
  const stressChoice = await _dialogStressChoice(actor, "half_one");
  if (!stressChoice) return;

  await _applyRest(actor, { quality: "poor", apDistrib, stressChoice, healWounds: false });
}

// ── GOOD : moitié Total Max AP à distribuer, stress (full ou half), wounds –1
async function _restGood(actor) {
  const attrs      = actor.system.attributes ?? {};
  const totalMaxAP = Object.values(attrs).reduce((s, a) => s + (a.max ?? 0), 0);
  const apPool     = Math.floor(totalMaxAP / 2);

  const stressChoice = await _dialogStressChoice(actor, "full_or_half");
  if (!stressChoice) return;

  // Le joueur distribue lui-même les AP (comme pour POOR)
  const apDistrib = await _dialogDistributeAP(actor, apPool);
  if (!apDistrib) return;

  await _applyRest(actor, { quality: "good", apDistrib, stressChoice, healWounds: true, apPool });
}

// ── GREAT : full AP, tout le stress, wounds –1 ────────────────────────────
async function _restGreat(actor) {
  const attrs = actor.system.attributes ?? {};
  // Full AP — chaque attribut au max
  const apDistrib = {};
  for (const key of ATTR_KEYS) apDistrib[key] = attrs[key]?.max ?? 0;

  await _applyRest(actor, { quality: "great", apDistrib, stressChoice: "all", healWounds: true });
}

// ── Dialog : distribuer N AP ────────────────────────────────────────────────
function _dialogDistributeAP(actor, pool) {
  return new Promise((resolve) => {
    const attrs = actor.system.attributes ?? {};

    const rows = ATTR_KEYS.map(key => {
      const cur  = attrs[key]?.value ?? 0;
      const max  = attrs[key]?.max ?? 0;
      const need = Math.max(0, max - cur);
      const full = cur >= max;
      return `
        <div class="cd-rest-ap-row ${full ? 'full' : ''}" data-key="${key}">
          <span class="cd-rest-ap-label">${ATTR_LABELS[key]}</span>
          <span class="cd-rest-ap-cur" id="cur-${key}">${cur} / ${max}</span>
          <input class="cd-input cd-input-sm cd-rest-ap-input" type="number"
            name="ap_${key}" value="0" min="0" max="${need}"
            data-cur="${cur}" data-max-val="${max}" data-need="${need}" />
        </div>`;
    }).join("");

    new Dialog({
      title: `Distribute ${pool} AP`,
      content: `
        <div class="cd-dialog">
          <div class="cd-rest-ap-counter">
            <span class="cd-label">AP REMAINING</span>
            <span class="cd-rest-ap-remaining" id="ap-remaining">${pool}</span>
            <span class="cd-rest-ap-total">/ ${pool}</span>
          </div>
          <div class="cd-rest-ap-list">${rows}</div>
          <p class="cd-dialog-hint">Excess AP beyond your maximum are lost.</p>
        </div>
      `,
      buttons: {
        confirm: {
          icon:  `<i class="fas fa-check"></i>`,
          label: "Apply",
          callback: (html) => {
            const result = {};
            for (const key of ATTR_KEYS) {
              result[key] = parseInt(html.find(`[name="ap_${key}"]`).val()) || 0;
            }
            resolve(result);
          },
        },
        cancel: { label: "Cancel", callback: () => resolve(null) },
      },
      default: "confirm",
      render: (html) => {
        const updateCounter = () => {
          let used = 0;
          for (const key of ATTR_KEYS) {
            used += parseInt(html.find(`[name="ap_${key}"]`).val()) || 0;
          }
          const remaining = pool - used;
          html.find("#ap-remaining").text(remaining);
          html.find("#ap-remaining").toggleClass("over", remaining < 0);

          // Mettre à jour chaque ligne
          for (const key of ATTR_KEYS) {
            const input  = html.find(`[name="ap_${key}"]`);
            const adding = parseInt(input.val()) || 0;
            const cur    = parseInt(input.data("cur")) || 0;
            const maxVal = parseInt(input.data("max-val")) || 0;
            const need   = parseInt(input.data("need")) || 0;
            const newCur = Math.min(maxVal, cur + adding);
            const isFull = newCur >= maxVal;

            // Mettre à jour l'affichage cur/max
            html.find(`#cur-${key}`).text(`${newCur} / ${maxVal}`);
            // Highlight si plein
            html.find(`[data-key="${key}"]`).toggleClass("full", isFull);
            // Limiter le max de l'input
            input.attr("max", Math.min(need, adding + Math.max(0, remaining)));
          }
        };
        html.find(".cd-rest-ap-input").on("input", updateCounter);
        updateCounter();
      },
    }).render(true);
  });
}

// ── Dialog : choix du stress ────────────────────────────────────────────────
function _dialogStressChoice(actor, mode) {
  const sys     = actor.system;
  const physVal = sys.stress?.physical?.value ?? 0;
  const menVal  = sys.stress?.mental?.value   ?? 0;
  const physHalf = Math.floor(physVal / 2);
  const menHalf  = Math.floor(menVal / 2);

  return new Promise((resolve) => {
    let buttons, content;

    if (mode === "half_one") {
      // POOR : moitié d'un seul type
      content = `
        <div class="cd-dialog">
          <p class="cd-dialog-hint">Remove half of one stress type.</p>
          <div class="cd-rest-stress-options">
            <label class="cd-rest-stress-row">
              <input type="radio" name="stress" value="phys_half" ${physVal === 0 ? 'disabled' : 'checked'} />
              <span>Remove <strong>${physHalf}</strong> Physical Stress (${physVal} → ${physVal - physHalf})</span>
            </label>
            <label class="cd-rest-stress-row">
              <input type="radio" name="stress" value="men_half" ${menVal === 0 && physVal > 0 ? '' : physVal === 0 ? 'checked' : ''} />
              <span>Remove <strong>${menHalf}</strong> Mental Stress (${menVal} → ${menVal - menHalf})</span>
            </label>
          </div>
        </div>`;
      buttons = {
        confirm: {
          icon: `<i class="fas fa-check"></i>`,
          label: "Apply",
          callback: (html) => resolve(html.find('[name="stress"]:checked').val()),
        },
        cancel: { label: "Cancel", callback: () => resolve(null) },
      };
    } else {
      // GOOD : full d'un type ou moitié des deux
      content = `
        <div class="cd-dialog">
          <p class="cd-dialog-hint">Choose how to recover stress.</p>
          <div class="cd-rest-stress-options">
            <label class="cd-rest-stress-row">
              <input type="radio" name="stress" value="phys_all" checked />
              <span>Remove <strong>all</strong> Physical Stress (${physVal} → 0)</span>
            </label>
            <label class="cd-rest-stress-row">
              <input type="radio" name="stress" value="men_all" />
              <span>Remove <strong>all</strong> Mental Stress (${menVal} → 0)</span>
            </label>
            <label class="cd-rest-stress-row">
              <input type="radio" name="stress" value="both_half" />
              <span>Remove half of both — Physical: ${physVal} → ${physVal - physHalf}, Mental: ${menVal} → ${menVal - menHalf}</span>
            </label>
          </div>
        </div>`;
      buttons = {
        confirm: {
          icon: `<i class="fas fa-check"></i>`,
          label: "Apply",
          callback: (html) => resolve(html.find('[name="stress"]:checked').val()),
        },
        cancel: { label: "Cancel", callback: () => resolve(null) },
      };
    }

    new Dialog({ title: "Stress Recovery", content, buttons, default: "confirm" }).render(true);
  });
}

// ── Distribution automatique des AP ────────────────────────────────────────
function _autoDistribute(attrs, pool) {
  const result = {};
  for (const key of ATTR_KEYS) result[key] = 0;
  let remaining = pool;
  // Remplir chaque attribut jusqu'au max, tant qu'il reste des AP
  for (const key of ATTR_KEYS) {
    if (remaining <= 0) break;
    const cur  = attrs[key]?.value ?? 0;
    const max  = attrs[key]?.max   ?? 0;
    const add  = Math.min(max - cur, remaining);
    if (add > 0) { result[key] = add; remaining -= add; }
  }
  return result;
}

// ── Application finale ──────────────────────────────────────────────────────
async function _applyRest(actor, { quality, apDistrib, stressChoice, healWounds, apPool }) {
  const attrs  = actor.system.attributes ?? {};
  const update = {};
  let apTotal  = 0;

  // AP
  for (const key of ATTR_KEYS) {
    const cur    = attrs[key]?.value ?? 0;
    const max    = attrs[key]?.max   ?? 0;
    const add    = apDistrib[key] ?? 0;
    const newVal = Math.min(max, cur + add);
    update[`system.attributes.${key}.value`] = newVal;
    apTotal += (newVal - cur);
  }

  // Stress
  const physVal = actor.system.stress?.physical?.value ?? 0;
  const menVal  = actor.system.stress?.mental?.value   ?? 0;

  if (stressChoice === "phys_half") {
    update["system.stress.physical.value"] = physVal - Math.floor(physVal / 2);
  } else if (stressChoice === "men_half") {
    update["system.stress.mental.value"] = menVal - Math.floor(menVal / 2);
  } else if (stressChoice === "phys_all") {
    update["system.stress.physical.value"] = 0;
  } else if (stressChoice === "men_all") {
    update["system.stress.mental.value"] = 0;
  } else if (stressChoice === "both_half") {
    update["system.stress.physical.value"] = physVal - Math.floor(physVal / 2);
    update["system.stress.mental.value"]   = menVal  - Math.floor(menVal / 2);
  } else if (stressChoice === "all") {
    update["system.stress.physical.value"] = 0;
    update["system.stress.mental.value"]   = 0;
  }

  await actor.update(update);

  // Wounds –1 sur toutes les tracks
  if (healWounds) {
    const wounds = actor.system.wounds ?? {};
    const wUpdate = {};
    for (const type of ["physical", "mental"]) {
      for (const level of ["mild", "serious", "severe"]) {
        const cur = wounds[type]?.[level]?.track ?? 0;
        if (cur > 0) wUpdate[`system.wounds.${type}.${level}.track`] = cur - 1;
      }
    }
    if (Object.keys(wUpdate).length) await actor.update(wUpdate);
  }

  // Skills uses refresh
  const skills = actor.items.filter(i => i.type === "skill" && i.system.uses?.type === "limited");
  for (const skill of skills) {
    await skill.update({ "system.uses.value": skill.system.uses.max });
  }

  // Chat message
  const qualityColors = { poor: "#e06060", good: "var(--cd-accent)", great: "#9b7dff" };
  const qualityLabels = { poor: "POOR REST", good: "GOOD REST", great: "GREAT REST" };
  const woundLine     = healWounds
    ? `<div class="cd-rest-msg-line"><span class="cd-rest-msg-icon">🩹</span><span>All wound tracks reduced by <strong style="color:var(--cd-accent)">1</strong>.</span></div>`
    : "";

  // Résumé des AP
  const apLines = ATTR_KEYS
    .filter(k => (apDistrib?.[k] ?? 0) > 0)
    .map(k => `<span class="cd-rest-msg-ap-tag">${ATTR_LABELS[k]} +${apDistrib[k]}</span>`)
    .join("");

  const stressLines = [];
  const newPhys = update["system.stress.physical.value"];
  const newMen  = update["system.stress.mental.value"];
  if (newPhys !== undefined) stressLines.push(`Physical ${physVal} → <strong style="color:var(--cd-accent)">${newPhys}</strong>`);
  if (newMen  !== undefined) stressLines.push(`Mental ${menVal} → <strong style="color:var(--cd-accent)">${newMen}</strong>`);

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `
      <div class="cd-roll-card">
        <div class="cd-roll-header">
          <span class="cd-roll-actor">${actor.name}</span>
          <span class="cd-roll-sep">—</span>
          <span class="cd-roll-label" style="color:${qualityColors[quality]}">${qualityLabels[quality]}</span>
        </div>
        <div class="cd-rest-msg-body">
          <div class="cd-rest-msg-section">
            <span class="cd-rest-msg-title">AP RECOVERED</span>
            <div class="cd-rest-msg-ap-tags">
              ${apLines || '<span style="color:var(--cd-text-dim)">None</span>'}
            </div>
          </div>
          ${stressLines.length ? `
          <div class="cd-rest-msg-section">
            <span class="cd-rest-msg-title">STRESS</span>
            <div style="font-size:11px;color:var(--cd-frost)">${stressLines.join(" &nbsp;·&nbsp; ")}</div>
          </div>` : ""}
          ${woundLine ? `<div class="cd-rest-msg-section">${woundLine}</div>` : ""}
          <div class="cd-rest-msg-section">
            <span class="cd-rest-msg-title">SKILLS</span>
            <div style="font-size:11px;color:var(--cd-frost)">All limited uses refreshed.</div>
          </div>
        </div>
      </div>`,
  });
}
