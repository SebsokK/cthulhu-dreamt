/**
 * Cthulhu Dreamt — Actor Document Class
 * Foundry VTT v14
 */

export class CthulhuDreamtActor extends Actor {

  prepareDerivedData() {
    const system = this.system;
    if (this.type === "character" || this.type === "npc") {
      this._prepareAttributes(system);
      this._prepareCarryingCapacity(system);
      this._prepareIPTracking(system);
    }
  }

  _prepareAttributes(system) {
    const attrs = system.attributes;
    if (!attrs) return;
    let totalMax = 0;
    for (const [, attr] of Object.entries(attrs)) {
      attr.value = Math.max(0, Math.min(attr.value, attr.max));
      totalMax += attr.max;
    }
    system.totalAttributeMax = totalMax;
  }

  _prepareCarryingCapacity(system) {
    const cc = system.carryingCapacity;
    if (!cc) return;

    // La Carrying Capacity de base vient de la Specialty équipée
    const specialty = this.items.find(i => i.type === "specialty");
    const specBase  = specialty?.system?.carryCapacity ?? cc.base ?? 7;

    let bonus = 0;
    for (const item of this.items) {
      if ((item.type === "gear" || item.type === "armor") && item.system.equipped)
        bonus += item.system.carryCapacityBonus ?? 0;
    }
    cc.base  = specBase;
    cc.bonus = bonus;
    cc.total = specBase + bonus;
    let load = 0;
    for (const item of this.items) {
      if (item.type === "skill" || item.type === "specialty") continue;
      const worn = (item.type === "armor" || item.type === "gear") && item.system.equipped;
      if (!worn) load += (item.system.size ?? 0) * (item.system.quantity ?? 1);
    }
    system.load.current = load;
    system.load.isOverloaded = load > cc.total;
  }

  _prepareIPTracking(system) {
    const ip = system.ip;
    if (ip) ip.remaining = ip.gained - ip.spent;
  }

  /* -------------------------------------------------------
   *  ROLL ATTRIBUTE — Point d'entrée principal
   *  ------------------------------------------------------- */
  async rollAttribute(attributeKey, options = {}) {
    const attr  = this.system.attributes?.[attributeKey];
    if (!attr) return;

    const label     = game.i18n.localize(`CD-Attr-${attributeKey}`);
    const attrMax   = attr.max;
    const attrCur   = attr.value;
    const lucky     = options.lucky ?? false;

    // 1. Demander le TN
    const dialogResult = await CthulhuDreamtActor._promptRollDialog(label, attrCur, lucky);
    if (!dialogResult) return;

    const { tn, initialAP, isLucky } = dialogResult;

    // 2. Lancer le dé
    const roll    = await new Roll("1d12").evaluate();
    const natural = roll.total;

    // 3. Calculer AP dépensés initiaux (0 si lucky)
    const apToSpend = isLucky ? 0 : Math.min(initialAP, attrCur);

    // 4. Résultat final
    const finalResult = natural + apToSpend;

    // 5. Degré de réussite
    const degree = CthulhuDreamtActor.computeDegree(natural, finalResult, tn);

    // 6. Sureffort : stress si > 2 AP
    let overexertionStress = 0;
    if (apToSpend > 2) overexertionStress = apToSpend - 2;

    // 7. Déduire les AP de l'acteur
    if (apToSpend > 0 && natural !== 1) {
      const newVal = Math.max(0, attrCur - apToSpend);
      await this.update({ [`system.attributes.${attributeKey}.value`]: newVal });
    }

    // 8. Appliquer le stress de sureffort
    if (overexertionStress > 0) {
      await this._applyOverexertion(overexertionStress, attributeKey);
    }

    // 9. Créer la Roll Card dans le chat
    const rollData = {
      actorId:       this.id,
      actorName:     this.name,
      attributeKey,
      label,
      attrMax,
      tn,
      natural,
      apSpent:       apToSpend,
      totalAP:       apToSpend,
      finalResult,
      degree,
      degreeLabel:   CthulhuDreamtActor.degreeLabel(degree),
      overexertion:  overexertionStress,
      isLucky,
      canSpendMore:  !isLucky && natural !== 1,
    };

    await CthulhuDreamtActor._createRollCard(roll, rollData, this);

    return { roll, degree, finalResult };
  }

  /* -------------------------------------------------------
   *  SPEND AP — appelé depuis un bouton de la Roll Card
   *  ------------------------------------------------------- */
  static async spendAPOnRoll(messageId, actorId, extra) {
    const actor   = game.actors.get(actorId);
    const message = game.messages.get(messageId);
    if (!actor || !message) return;

    const rollData = message.getFlag("cthulhu-dreamt", "rollData");
    if (!rollData) return;

    // AP disponibles pour cet acteur (son propre attribut)
    const attrKey   = rollData.attributeKey;
    const attrCur   = actor.system.attributes?.[attrKey]?.value ?? 0;
    const available = Math.min(extra, attrCur);
    if (available <= 0) {
      ui.notifications.warn("No AP available for this attribute.");
      return;
    }

    // Déduire les AP
    await actor.update({ [`system.attributes.${attrKey}.value`]: attrCur - available });

    // Recalculer
    const newTotalAP    = rollData.totalAP + available;
    const newFinal      = rollData.natural + newTotalAP;
    const newDegree     = CthulhuDreamtActor.computeDegree(rollData.natural, newFinal, rollData.tn);
    const overexertion  = newTotalAP > 2 ? newTotalAP - 2 : 0;

    // Appliquer sureffort différentiel (seulement le nouveau)
    const prevOver = rollData.overexertion ?? 0;
    const newOver  = overexertion - prevOver;
    if (newOver > 0) await actor._applyOverexertion(newOver, attrKey);

    // Mettre à jour le flag et re-render la card
    const newRollData = {
      ...rollData,
      apSpent:      available,
      totalAP:      newTotalAP,
      finalResult:  newFinal,
      degree:       newDegree,
      degreeLabel:  CthulhuDreamtActor.degreeLabel(newDegree),
      overexertion,
      helpers:      [...(rollData.helpers ?? []), { name: actor.name, ap: available }],
    };

    await message.setFlag("cthulhu-dreamt", "rollData", newRollData);

    // Mettre à jour le contenu HTML du message
    const newContent = await renderTemplate(
      "systems/cthulhu-dreamt/templates/chat/roll-result.hbs",
      { ...newRollData, messageId }
    );
    await message.update({ content: newContent });
  }

  /* -------------------------------------------------------
   *  APPLY OVEREXERTION STRESS
   *  ------------------------------------------------------- */
  async _applyOverexertion(amount, attributeKey) {
    // Physical si attribut physique (strong/agile), Mental sinon
    const physicalAttrs = ["strong", "agile"];
    const stressType    = physicalAttrs.includes(attributeKey) ? "physical" : "mental";
    const cur           = this.system.stress?.[stressType]?.value ?? 0;
    const limit         = this.system.stress?.[stressType]?.limit ?? 8;
    const newVal        = Math.min(cur + amount, limit);
    await this.update({ [`system.stress.${stressType}.value`]: newVal });

    ui.notifications.warn(
      `${this.name} — Overexertion: +${amount} ${stressType} stress`
    );
  }

  /* -------------------------------------------------------
   *  DEGREE OF SUCCESS
   *  ------------------------------------------------------- */
  static computeDegree(natural, final, tn) {
    if (natural === 1)  return "criticalFailure";
    if (natural === 12 && (tn === "?" || tn <= 11)) return "criticalSuccess";
    if (tn === "?")     return "unknown";
    if (final > tn)     return "success";
    if (final === tn)   return "partial";
    return "failure";
  }

  static degreeLabel(degree) {
    const map = {
      criticalSuccess: "CRITICAL SUCCESS",
      success:         "SUCCESS",
      partial:         "PARTIAL SUCCESS",
      failure:         "FAILURE",
      criticalFailure: "CRITICAL FAILURE",
      unknown:         "TN UNKNOWN",
    };
    return map[degree] ?? degree;
  }

  /* -------------------------------------------------------
   *  DIALOG — demander TN + AP initiaux
   *  ------------------------------------------------------- */
  static _promptRollDialog(label, attrCur, lucky = false) {
    return new Promise((resolve) => {
      const TEACH = [
        { label: "Trivial",      min: 1,  max: 3  },
        { label: "Easy",         min: 4,  max: 6  },
        { label: "Average",      min: 7,  max: 9  },
        { label: "Challenging",  min: 10, max: 12 },
        { label: "Harrowing",    min: 13, max: 99 },
      ];

      const getTeachLabel = (val) => {
        if (val === "?") return "";
        const n = parseInt(val);
        if (isNaN(n)) return "";
        const t = TEACH.find(t => n >= t.min && n <= t.max);
        return t ? t.label : n > 12 ? "Harrowing" : "";
      };

      new Dialog({
        title: `Roll — ${label}`,
        content: `
          <div class="cd-dialog">
            <div class="cd-dialog-row">
              <div class="cd-dialog-field cd-dialog-field-grow">
                <label class="cd-dialog-label">DIFFICULTY</label>
                <div class="cd-dialog-tn-wrap">
                  <input class="cd-dialog-input cd-dialog-tn"
                    type="text" name="tn" value="7"
                    placeholder="7 or ?" autocomplete="off" />
                  <span class="cd-dialog-teach-label" id="teach-label">Average</span>
                </div>
              </div>
            </div>
            ${!lucky ? `
            <div class="cd-dialog-row">
              <div class="cd-dialog-field cd-dialog-field-grow">
                <label class="cd-dialog-label">AP TO SPEND NOW
                  <span class="cd-dialog-avail">(available: ${attrCur})</span>
                </label>
                <input class="cd-dialog-input" type="number"
                  name="ap" value="0" min="0" max="${attrCur}" />
              </div>
            </div>
            <div class="cd-dialog-row">
              <label class="cd-dialog-checkbox-label">
                <input type="checkbox" name="lucky" />
                <span>Lucky Roll — no AP allowed</span>
              </label>
            </div>
            ` : `
            <p class="cd-dialog-hint">Lucky Roll — no AP modification allowed.</p>
            `}
          </div>
        `,
        buttons: {
          roll: {
            icon: `<i class="fas fa-dice-d12"></i>`,
            label: "Roll",
            callback: (html) => {
              const rawTN    = html.find('[name="tn"]').val().trim();
              const tn       = rawTN === "?" ? "?" : (parseInt(rawTN) || 7);
              const initialAP = lucky ? 0 : parseInt(html.find('[name="ap"]').val()) || 0;
              const isLucky   = lucky || html.find('[name="lucky"]').is(":checked");
              resolve({ tn, initialAP, isLucky });
            },
          },
          cancel: { label: "Cancel", callback: () => resolve(null) },
        },
        default: "roll",
        render: (html) => {
          const tnInput    = html.find('[name="tn"]');
          const teachLabel = html.find('#teach-label');

          const update = () => {
            const val = tnInput.val().trim();
            const label = getTeachLabel(val);
            teachLabel.text(label);
            teachLabel.toggleClass("cd-dialog-teach-hidden", !label);
          };

          tnInput.on("input", update);

          // Flèches clavier — incrémenter/décrémenter la valeur numérique
          tnInput.on("keydown", (e) => {
            if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
            e.preventDefault();
            const cur = parseInt(tnInput.val()) || 7;
            const next = e.key === "ArrowUp"
              ? Math.min(cur + 1, 20)
              : Math.max(cur - 1, 1);
            tnInput.val(next);
            update();
          });

          update();
          tnInput[0]?.select();
        },
      }).render(true);
    });
  }

  /* -------------------------------------------------------
   *  CREATE ROLL CARD
   *  ------------------------------------------------------- */
  static async _createRollCard(roll, rollData, actor) {

    // Dice So Nice est déclenché automatiquement par Foundry quand rolls[] est présent
    // dans le ChatMessage — pas besoin d'appel manuel showForRoll()

    const content = await renderTemplate(
      "systems/cthulhu-dreamt/templates/chat/roll-result.hbs",
      { ...rollData, messageId: null }
    );

    const msg = await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content,
      rolls:   [roll],
      flags:   { "cthulhu-dreamt": { rollData } },
    });

    if (!msg) {
      console.error("Cthulhu Dreamt | Failed to create chat message");
      return;
    }

    // Mettre à jour le messageId dans le flag
    const finalData = { ...rollData, messageId: msg.id };
    await msg.setFlag("cthulhu-dreamt", "rollData", finalData);

    const finalContent = await renderTemplate(
      "systems/cthulhu-dreamt/templates/chat/roll-result.hbs",
      { ...finalData, messageId: msg.id }
    );
    await msg.update({ content: finalContent });
  }

  /* -------------------------------------------------------
   *  JET D'ATTAQUE — Arme
   *  ------------------------------------------------------- */
  static CATEGORY_TO_PROF = {
    "close-quarters": "closeQuarters",
    "small-arms":     "smallArms",
    "long-arms":      "longArms",
    "thrown":         "thrown",
    "unarmed":        "unarmed",
    "edge":           "edge",
  };

  static CATEGORY_TO_DEFAULT_ATTR = {
    "close-quarters": "strong",
    "unarmed":        "strong",
    "edge":           "strong",
    "small-arms":     "vigilant",
    "long-arms":      "vigilant",
    "thrown":         "vigilant",
  };

  async rollWeapon(weapon) {
    const profKey     = CthulhuDreamtActor.CATEGORY_TO_PROF[weapon.system.category] ?? "closeQuarters";
    const profVal     = this.system.proficiencies?.[profKey] ?? 0;
    const modifier    = weapon.system.modifier ?? 0;
    const label       = weapon.name;
    const stress      = weapon.system.stress || "—";
    const defaultAttr = CthulhuDreamtActor.CATEGORY_TO_DEFAULT_ATTR[weapon.system.category] ?? "strong";

    const result = await this._promptWeaponDialog(label, defaultAttr);
    if (!result) return;
    const { tn, attrKey, initialAP } = result;

    // Décrémenter les munitions si applicable
    const shotsMax = weapon.system.shots?.max ?? 0;
    const shotsCur = weapon.system.shots?.value ?? 0;
    if (shotsMax > 0) {
      if (shotsCur <= 0) {
        ui.notifications.warn(`${weapon.name} is out of ammunition!`);
        return;
      }
      await weapon.update({ "system.shots.value": shotsCur - 1 });
    }

    const attrCur = this.system.attributes?.[attrKey]?.value ?? 0;
    const apSpent = Math.min(initialAP, attrCur);
    if (apSpent > 0) {
      await this.update({ [`system.attributes.${attrKey}.value`]: attrCur - apSpent });
    }

    const roll    = new Roll("1d12");
    await roll.evaluate();
    const natural = roll.total;
    const bonus   = profVal + modifier + apSpent;
    const final   = natural + bonus;
    const degree  = CthulhuDreamtActor.computeDegree(natural, final, tn);

    const ATTR_LABELS = { strong:"Strong", agile:"Agile", cunning:"Cunning",
      vigilant:"Vigilant", careful:"Careful", tenacious:"Tenacious" };

    const rollData = {
      actorId:     this.id,
      actorName:   this.name,
      actorImg:    this.img,
      label,
      isWeapon:    true,
      stressDice:  stress,
      weaponCategory: weapon.system.category,
      natural, bonus, profVal, modifier,
      totalAP:     apSpent,
      attrKey,
      attrLabel:   ATTR_LABELS[attrKey] ?? attrKey,
      final, tn, degree,
      degreeLabel: CthulhuDreamtActor.degreeLabel(degree),
      canSpendMore: true,
      helpers:     [],
      shotsRemaining: shotsMax > 0 ? shotsCur - 1 : null,
      shotsMax,
      messageId:   null,
    };

    const content = await renderTemplate(
      "systems/cthulhu-dreamt/templates/chat/roll-result.hbs", rollData
    );
    const msg = await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content, rolls: [roll],
      flags: { "cthulhu-dreamt": { rollData } },
    });
    if (msg) {
      const finalData = { ...rollData, messageId: msg.id };
      await msg.setFlag("cthulhu-dreamt", "rollData", finalData);
      await msg.update({ content: await renderTemplate(
        "systems/cthulhu-dreamt/templates/chat/roll-result.hbs",
        { ...finalData, messageId: msg.id }
      )});
    }
  }

  async _promptWeaponDialog(label, defaultAttr) {
    const TEACH = [
      { label: "Trivial",     min: 1,  max: 3  },
      { label: "Easy",        min: 4,  max: 6  },
      { label: "Average",     min: 7,  max: 9  },
      { label: "Challenging", min: 10, max: 12 },
      { label: "Harrowing",   min: 13, max: 99 },
    ];
    const getTeachLabel = (val) => {
      if (val === "?") return "";
      const n = parseInt(val);
      if (isNaN(n)) return "";
      return TEACH.find(t => n >= t.min && n <= t.max)?.label ?? "";
    };

    const attrs = this.system.attributes ?? {};
    const ATTR_LABELS = { strong:"Strong", agile:"Agile", cunning:"Cunning",
      vigilant:"Vigilant", careful:"Careful", tenacious:"Tenacious" };
    const attrOptions = Object.entries(ATTR_LABELS).map(([k, l]) => {
      const cur = attrs[k]?.value ?? 0;
      return `<li class="cd-custom-option" data-value="${k}">${l} <span class="cd-custom-option-ap">${cur} AP</span></li>`;
    }).join("");

    const defaultLabel = ATTR_LABELS[defaultAttr];
    const defaultCur   = attrs[defaultAttr]?.value ?? 0;

    return new Promise((resolve) => {
      new Dialog({
        title: `Attack — ${label}`,
        content: `
          <div class="cd-dialog">
            <div class="cd-dialog-row">
              <div class="cd-dialog-field cd-dialog-field-grow">
                <label class="cd-dialog-label">DIFFICULTY</label>
                <div class="cd-dialog-tn-wrap">
                  <input class="cd-dialog-input cd-dialog-tn"
                    type="text" name="tn" value="7" placeholder="7 or ?" autocomplete="off" />
                  <span class="cd-dialog-teach-label" id="teach-label">Average</span>
                </div>
              </div>
            </div>
            <div class="cd-dialog-row">
              <div class="cd-dialog-field cd-dialog-field-grow">
                <label class="cd-dialog-label">SPEND AP FROM</label>
                <div class="cd-custom-select" id="attr-select">
                  <div class="cd-custom-select-val">
                    <span class="cd-custom-select-label">${defaultLabel}</span>
                    <span class="cd-custom-option-ap">${defaultCur} AP</span>
                    <i class="fas fa-chevron-down cd-custom-select-arrow"></i>
                  </div>
                  <ul class="cd-custom-select-list">${attrOptions}</ul>
                  <input type="hidden" name="attrKey" value="${defaultAttr}" />
                </div>
              </div>
              <div class="cd-dialog-field" style="width:54px;flex-shrink:0">
                <label class="cd-dialog-label">AP</label>
                <input class="cd-dialog-input" type="number" name="ap" value="0" min="0" />
              </div>
            </div>
          </div>
        `,
        buttons: {
          roll: {
            icon:  `<i class="fas fa-crosshairs"></i>`,
            label: "Attack",
            callback: (html) => {
              const rawTN   = html.find('[name="tn"]').val().trim();
              const tn      = rawTN === "?" ? "?" : (parseInt(rawTN) || 7);
              const attrKey = html.find('[name="attrKey"]').val();
              const initialAP = parseInt(html.find('[name="ap"]').val()) || 0;
              resolve({ tn, attrKey, initialAP });
            },
          },
          cancel: { label: "Cancel", callback: () => resolve(null) },
        },
        default: "roll",
        render: (html) => {
          const tnInput = html.find('[name="tn"]');
          const teachLabel = html.find('#teach-label');
          const update = () => {
            const v = tnInput.val().trim();
            teachLabel.text(getTeachLabel(v));
            teachLabel.toggleClass("cd-dialog-teach-hidden", !getTeachLabel(v));
          };
          tnInput.on("input", update).on("keydown", (e) => {
            if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
            e.preventDefault();
            const cur  = parseInt(tnInput.val()) || 7;
            const next = e.key === "ArrowUp" ? Math.min(cur + 1, 20) : Math.max(cur - 1, 1);
            tnInput.val(next); update();
          });

          // Custom dropdown
          const selectEl  = html.find('#attr-select');
          const valEl     = selectEl.find('.cd-custom-select-val');
          const listEl    = selectEl.find('.cd-custom-select-list');
          const hiddenEl  = selectEl.find('[name="attrKey"]');
          const labelEl   = selectEl.find('.cd-custom-select-label');
          const apEl      = selectEl.find('.cd-custom-option-ap').first();

          valEl.on('click', (e) => {
            e.stopPropagation();
            selectEl.toggleClass('open');
          });

          listEl.find('.cd-custom-option').on('click', function() {
            const key = $(this).data('value');
            const lbl = $(this).find('.cd-custom-option-ap').siblings ? $(this).clone().find('.cd-custom-option-ap').remove().end().text().trim() : $(this).text();
            const ap  = $(this).find('.cd-custom-option-ap').text();
            hiddenEl.val(key);
            labelEl.text($(this).contents().filter(function(){ return this.nodeType === 3; }).text().trim());
            apEl.text(ap);
            selectEl.removeClass('open');
            // Mettre à jour le max AP
            html.find('[name="ap"]').attr('max', attrs[key]?.value ?? 0);
          });

          // Fermer si clic ailleurs
          $(document).on('click.weaponSelect', () => selectEl.removeClass('open'));
          update();
          tnInput[0]?.select();
        },
      }).render(true);
    });
  }
}

