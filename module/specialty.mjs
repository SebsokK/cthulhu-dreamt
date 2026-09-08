/**
 * Cthulhu Dreamt — Specialty drop & available skills dialog
 */

import { cdDialog } from "./dialog.mjs";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Extrait la base d'un nom évolutif : "Pushing the Limit II — Athlete" → "Pushing the Limit" */
function evolutionBase(name) {
  // Retire le suffixe " — Specialty" puis le numéro romain final
  const withoutSpec = name.replace(/\s+—\s+\w+$/, "");
  return withoutSpec.replace(/\s+[IVX]+$/, "").trim();
}

/** Retourne la skill sur la fiche qui est la version précédente d'une skill évolutive */
function findPreviousEvolution(actorSkills, newSkillName) {
  const base = evolutionBase(newSkillName);
  if (!base || base === newSkillName.replace(/\s+—\s+\w+$/, "")) return null;
  return actorSkills.find(s => {
    const sBase = evolutionBase(s.name);
    return sBase === base && s.name !== newSkillName;
  }) ?? null;
}

/** Vérifie si une skill est évolutive (contient un numéro romain avant le tiret ou en fin) */
function isEvolutive(name) {
  return /\s+[IVX]+(\s+—|\s*$)/.test(name);
}

// ── Cost constants ─────────────────────────────────────────────────────────────
const COST_SPECIALTY  = 10;
const COST_UNIVERSAL  = 12;
const COST_TIER_UP    = 12;

// ── IP check ──────────────────────────────────────────────────────────────────
async function checkIP(actor, cost) {
  const remaining = (actor.system.ip?.gained ?? 0) - (actor.system.ip?.spent ?? 0);
  if (remaining >= cost) return true;
  await cdDialog({
    title: "Not Enough IP",
    content: `<p>You need <strong>${cost} IP</strong> but only have <strong>${remaining} IP</strong> remaining.</p>`,
    buttons: [{ value: "ok", label: "OK", icon: "fas fa-times", primary: true }],
  });
  return false;
}

async function spendIP(actor, cost) {
  await actor.update({ "system.ip.spent": (actor.system.ip?.spent ?? 0) + cost });
}

// ── Skill purchase ────────────────────────────────────────────────────────────
async function purchaseSkill(actor, skill, cost, specName, free = false) {
  const actorSkills = actor.items.filter(i => i.type === "skill");
  const prev = findPreviousEvolution(actorSkills, skill.name);

  // Vérifier si déjà sur la fiche
  if (actorSkills.some(s => s.name === skill.name)) {
    await cdDialog({
      title: "Already on Sheet",
      content: `<p><strong>${skill.name}</strong> is already on your sheet.</p>`,
      buttons: [{ value: "ok", label: "OK", primary: true }],
    });
    return false;
  }

  if (!free) {
    if (!await checkIP(actor, cost)) return false;
  }

  // Skill évolutive — confirmer le remplacement
  if (prev) {
    const confirm = await cdDialog({
      title: "Replace Skill",
      content: `<p><strong>${skill.name}</strong> replaces <strong>${prev.name}</strong>.<br>
        <span class="cd-dialog-hint">The previous version will be removed from your sheet.</span></p>`,
      buttons: [
        { value: "yes", label: "Replace", icon: "fas fa-check", primary: true },
        { value: "no",  label: "Cancel",  icon: "fas fa-times" },
      ],
    });
    if (confirm !== "yes") return false;
    await prev.delete();
  }

  // Créer la skill
  await actor.createEmbeddedDocuments("Item", [{
    name:   skill.name,
    type:   "skill",
    system: {
      description: skill.description ?? "",
      tier:        skill.tier,
      specialty:   skill.skillType === "universal" ? "universal" : specName,
      uses: {
        value: skill.uses ?? 0,
        max:   skill.uses ?? 0,
        per:   "day",
        type:  skill.uses > 0 ? "limited" : "unlimited",
      },
    },
  }]);

  if (!free) await spendIP(actor, cost);
  return true;
}

// ── Tier upgrade dialog ───────────────────────────────────────────────────────
async function promptTierUpgrade(actor, spec, newTier) {
  const rawSkills  = spec.system.skills ?? [];
  const skills     = Array.isArray(rawSkills) ? rawSkills : Object.values(rawSkills);
  const ownedNames = new Set(actor.items.filter(i => i.type === "skill").map(i => i.name));

  const choices = skills.filter(s => s.tier <= newTier && !ownedNames.has(s.name));

  if (choices.length === 0) {
    ui.notifications.info("No new skills available at this tier.");
    return;
  }

  const rows = choices.map((s, i) => {
    const badge = `<span class="cd-skill-badge ${s.skillType === 'universal' ? 'universal' : 'specialty'}">${s.skillType === 'universal' ? 'U' : 'S'}</span>`;
    return `
      <label class="cd-tier-choice-row">
        <input type="radio" name="freeSkill" value="${i}" ${i === 0 ? 'checked' : ''} />
        ${badge}
        <span class="cd-avail-skill-tier">T${s.tier}</span>
        <span class="cd-avail-skill-name">${s.name}</span>
      </label>`;
  }).join("");

  return new Promise((resolve) => {
    new Dialog({
      title: `Tier ${newTier} Unlocked — Choose a Free Skill`,
      content: `
        <div class="cd-dialog">
          <p class="cd-dialog-hint">Your Specialty is now Tier ${newTier}. Choose one skill to receive for free.</p>
          <div class="cd-tier-choices">${rows}</div>
        </div>`,
      buttons: {
        choose: {
          icon:  `<i class="fas fa-check"></i>`,
          label: "Choose",
          callback: async (html) => {
            const idx    = parseInt(html.find('[name="freeSkill"]:checked').val() ?? 0);
            const chosen = choices[idx];
            if (chosen) {
              await purchaseSkill(actor, chosen, 0, spec.name, true);
              ui.notifications.info(`${chosen.name} added to your sheet for free!`);
            }
            resolve();
          },
        },
        skip: { label: "Skip", callback: () => resolve() },
      },
      default: "choose",
    }).render(true);
  });
}

// ── Main dialog ───────────────────────────────────────────────────────────────
export async function openAvailableSkillsDialog(actor) {
  const spec = actor.items.find(i => i.type === "specialty");
  const tv   = actor.system.tierValue ?? 1;
  const ip   = (actor.system.ip?.gained ?? 0) - (actor.system.ip?.spent ?? 0);

  // Récupérer les universal skills depuis les items du système (compendium)
  const rawSpecSkills = spec ? (spec.system.skills ?? []) : [];
  const specSkills    = Array.isArray(rawSpecSkills) ? rawSpecSkills : Object.values(rawSpecSkills);

  // Construire la liste depuis les compendiums
  let universalSkills = [];
  const skillPack = game.packs.get("cthulhu-dreamt.skills");
  if (skillPack) {
    const docs = await skillPack.getDocuments();
    universalSkills = docs
      .filter(d => d.system.specialty === "universal")
      .map(d => ({
        name:        d.name,
        tier:        d.system.tier ?? 1,
        skillType:   "universal",
        uses:        d.system.uses?.max ?? 0,
        description: d.system.description ?? "",
      }));
  }

  const ownedNames = new Set(actor.items.filter(i => i.type === "skill").map(i => i.name));
  const actorSkills = actor.items.filter(i => i.type === "skill");

  const renderRow = (s, cost, sectionType) => {
    const owned    = ownedNames.has(s.name);
    const locked   = s.tier > tv;
    const prev     = isEvolutive(s.name) ? findPreviousEvolution(actorSkills, s.name) : null;
    const isUpgrade = prev !== null;
    const badge    = `<span class="cd-skill-badge ${s.skillType === 'universal' ? 'universal' : 'specialty'}">${s.skillType === 'universal' ? 'U' : 'S'}</span>`;
    const tierBadge = `<span class="cd-avail-skill-tier">T${s.tier}</span>`;
    const nameEl   = `<span class="cd-avail-skill-name ${isUpgrade ? 'upgrade' : ''}">${s.name}${isUpgrade ? ' <i class="fas fa-arrow-up cd-upgrade-icon"></i>' : ''}</span>`;
    const ipBadge  = `<span class="cd-avail-skill-ip ${locked ? 'locked' : ''}">${locked ? '<i class="fas fa-lock"></i>' : cost + ' IP'}</span>`;

    let action;
    if (owned) {
      action = `<span class="cd-avail-skill-owned"><i class="fas fa-check"></i></span>`;
    } else if (locked) {
      action = `<span class="cd-avail-skill-locked"><i class="fas fa-lock"></i></span>`;
    } else {
      action = `<button type="button" class="cd-avail-skill-add"
        data-skill-name="${s.name}" data-cost="${cost}" data-section="${sectionType}">
        ${cost} IP
      </button>`;
    }

    return `<div class="cd-avail-skill-row ${owned ? 'owned' : ''} ${locked ? 'locked' : ''}">
      ${badge}${tierBadge}${nameEl}${action}
    </div>`;
  };

  // Sections
  const specRows = spec
    ? specSkills.map(s => renderRow(s, COST_SPECIALTY, "specialty")).join("")
    : `<p class="cd-dialog-hint">No specialty equipped.</p>`;

  const univRows = universalSkills.map(s => renderRow(s, COST_UNIVERSAL, "universal")).join("");

  // Calculer le Total Max AP
  const totalMaxAP = Object.values(actor.system.attributes ?? {})
    .reduce((sum, a) => sum + (a.max ?? 0), 0);

  const TIER_REQ = { 2: 20, 3: 22 };
  const nextTier = tv + 1;
  const req      = TIER_REQ[nextTier] ?? 99;
  const canTierUp = totalMaxAP >= req;

  // Bouton upgrade tier
  const canUpgrade = spec && tv < 3;
  const upgradeRow = canUpgrade ? `
    <div class="cd-avail-tier-upgrade ${canTierUp ? '' : 'locked'}">
      <div class="cd-avail-tier-info">
        <span class="cd-avail-tier-label">Upgrade Specialty to Tier ${nextTier}</span>
        <span class="cd-dialog-hint">Unlocks Tier ${nextTier} skills + 1 free skill</span>
        <div class="cd-avail-tier-ap">
          <span class="cd-avail-tier-ap-val ${canTierUp ? 'ok' : ''}">${totalMaxAP}</span>
          <span class="cd-avail-tier-ap-sep">/</span>
          <span class="cd-avail-tier-ap-req">${req} Total Max AP</span>
          ${canTierUp ? '<i class="fas fa-check cd-avail-tier-ap-check"></i>' : '<i class="fas fa-lock cd-avail-tier-ap-lock"></i>'}
        </div>
      </div>
      <button type="button" class="cd-avail-tier-btn" data-action="tierUpgrade"
        ${canTierUp ? '' : 'disabled'}>
        ${COST_TIER_UP} IP
      </button>
    </div>` : "";

  const specName = spec?.name ?? "";

  new Dialog({
    title: `Available Skills${spec ? ` — ${specName}` : ''}`,
    content: `
      <div class="cd-dialog cd-avail-dialog">
        <div class="cd-avail-ip-bar">
          <span class="cd-label">IP REMAINING</span>
          <span class="cd-avail-ip-val">${ip}</span>
        </div>

        ${upgradeRow}

        ${spec ? `
        <div class="cd-avail-section">
          <div class="cd-avail-section-title">SPECIALTY SKILLS <span class="cd-avail-cost-hint">10 IP each</span></div>
          <div class="cd-avail-skill-list">${specRows}</div>
        </div>` : ""}

        <div class="cd-avail-section">
          <div class="cd-avail-section-title">UNIVERSAL SKILLS <span class="cd-avail-cost-hint">12 IP each</span></div>
          <div class="cd-avail-skill-list">${univRows}</div>
        </div>
      </div>
    `,
    buttons: { close: { label: "Close" } },
    default: "close",
    render: (html) => {
      // Achat de skill
      html.find(".cd-avail-skill-add").on("click", async (e) => {
        const btn      = e.currentTarget;
        const name     = btn.dataset.skillName;
        const cost     = parseInt(btn.dataset.cost);
        const section  = btn.dataset.section;

        const skillData = section === "universal"
          ? universalSkills.find(s => s.name === name)
          : specSkills.find(s => s.name === name);

        if (!skillData) return;

        const success = await purchaseSkill(actor, skillData, cost, specName);
        if (success) {
          // Mettre à jour l'affichage du bouton
          const row = btn.closest(".cd-avail-skill-row");
          btn.outerHTML = `<span class="cd-avail-skill-owned"><i class="fas fa-check"></i></span>`;
          row?.classList.add("owned");
          // Mettre à jour l'IP affiché
          const newIP = (actor.system.ip?.gained ?? 0) - (actor.system.ip?.spent ?? 0);
          html.find(".cd-avail-ip-val").text(newIP);
        }
      });

      // Upgrade tier
      html.find("[data-action='tierUpgrade']").on("click", async (e) => {
        if (e.currentTarget.disabled) return;
        if (!await checkIP(actor, COST_TIER_UP)) return;
        const newTier = tv + 1;
        await spendIP(actor, COST_TIER_UP);
        await actor.update({ "system.tierValue": newTier });
        await promptTierUpgrade(actor, spec, newTier);
        ui.notifications.info(`Specialty upgraded to Tier ${newTier}!`);
        // Fermer et rouvrir le dialog pour refléter le nouveau tier
        html.closest(".app").find(".header-button.close").trigger("click");
        setTimeout(() => openAvailableSkillsDialog(actor), 300);
      });
    },
  }).render(true);
}

// ── Specialty drop ────────────────────────────────────────────────────────────
export async function handleSpecialtyDrop(actor, itemData) {
  if (itemData.type !== "specialty") return false;

  const newSpec  = itemData.name;
  const tv       = actor.system.tierValue ?? 1;
  const oldSpec  = actor.items.find(i => i.type === "specialty");

  if (oldSpec) {
    const confirm = await cdDialog({
      title: "Replace Specialty",
      content: `
        <p>Replace <strong>${oldSpec.name}</strong> with <strong>${newSpec}</strong>?</p>
        <p class="cd-dialog-hint">Existing skills will remain. You can remove them manually.</p>
      `,
      buttons: [
        { value: "yes", label: "Yes", icon: "fas fa-check", primary: true },
        { value: "no",  label: "No",  icon: "fas fa-times" },
      ],
    });
    if (confirm !== "yes") return false;
    await oldSpec.delete();
  }

  await actor.createEmbeddedDocuments("Item", [itemData]);
  await actor.update({ "system.specialty": newSpec });

  const rawSkills = itemData.system?.skills ?? [];
  const skills    = Array.isArray(rawSkills) ? rawSkills : Object.values(rawSkills);
  const available = skills.filter(s => s.tier <= tv);

  if (available.length === 0) {
    ui.notifications.info(`Specialty changed to ${newSpec}.`);
    return true;
  }

  const skillList = available.map(s =>
    `<li><span class="cd-skill-badge ${s.skillType === 'universal' ? 'universal' : 'specialty'}">${s.skillType === 'universal' ? 'U' : 'S'}</span> <strong>${s.name}</strong> <span style="color:var(--cd-text-dim);font-size:10px">(Tier ${s.tier})</span></li>`
  ).join("");

  const doImport = await cdDialog({
    title: "Import Skills",
    content: `
      <p>Import Tier ≤ ${tv} skills from <strong>${newSpec}</strong> to your sheet?</p>
      <ul class="cd-dialog-skill-list">${skillList}</ul>
    `,
    buttons: [
      { value: "yes", label: "Import", icon: "fas fa-download", primary: true },
      { value: "no",  label: "Skip",   icon: "fas fa-times" },
    ],
  });

  if (doImport === "yes") {
    const skillItems = available.map(s => ({
      name:   s.name,
      type:   "skill",
      system: {
        description: s.description ?? "",
        tier:        s.tier,
        specialty:   newSpec,
        uses: { value: s.uses ?? 0, max: s.uses ?? 0, per: "day",
                type: s.uses > 0 ? "limited" : "unlimited" },
      },
    }));
    await actor.createEmbeddedDocuments("Item", skillItems);
  }

  ui.notifications.info(`Specialty changed to ${newSpec}.`);
  return true;
}

// ── Character Creation ─────────────────────────────────────────────────────────

export async function openCharacterCreation(actor) {
  // Charger les specialties depuis le compendium
  const pack = game.packs.get("cthulhu-dreamt.specialties");
  if (!pack) { ui.notifications.error("Specialties compendium not found."); return; }
  const specialties = await pack.getDocuments();
  specialties.sort((a, b) => a.name.localeCompare(b.name));

  // Étape 1 — Choisir une specialty
  const chosen = await _stepChooseSpecialty(specialties);
  if (!chosen) return;

  // Étape 2 — Choisir la skill de départ (Tier 1 uniquement)
  const rawSkills = chosen.system.skills ?? [];
  const skills    = Array.isArray(rawSkills) ? rawSkills : Object.values(rawSkills);
  const t1skills  = skills.filter(s => s.tier === 1);
  const startSkill = await _stepChooseStartSkill(chosen.name, t1skills);
  if (!startSkill) return;

  // Confirmation — avertir si attributs ou IP existants
  const hasData = Object.values(actor.system.attributes ?? {}).some(a => (a.value ?? 0) > 1)
    || (actor.system.ip?.gained ?? 0) > 0;

  if (hasData) {
    const confirm = await cdDialog({
      title: "Overwrite Character Data?",
      content: `
        <p>This will overwrite your current attributes and reset your IP.</p>
        <p class="cd-dialog-hint">This action cannot be undone.</p>
      `,
      buttons: [
        { value: "yes", label: "Continue", icon: "fas fa-check", primary: true },
        { value: "no",  label: "Cancel",   icon: "fas fa-times" },
      ],
    });
    if (confirm !== "yes") return;
  }

  // Appliquer
  await _applyCharacterCreation(actor, chosen, startSkill);
  ui.notifications.info(`Character created as ${chosen.name}. Good luck!`);
}

async function _stepChooseSpecialty(specialties) {
  return new Promise((resolve) => {
    let selected = null;

    const ATTR_LABELS = {
      strong: "STR", agile: "AGI", cunning: "CUN",
      vigilant: "VIG", careful: "CAR", tenacious: "TEN"
    };

    const cards = specialties.map((spec, i) => {
      const attrs = spec.system.skills ? "" : ""; // fallback
      // Attributs depuis le premier compendium entry
      const attrHtml = Object.entries(ATTR_LABELS).map(([key, label]) => {
        const val = spec.system.attributes?.[key]?.value
          ?? spec.system.attributes?.[key]
          ?? "—";
        return `<span class="cd-cc-attr"><span class="cd-cc-attr-label">${label}</span><span class="cd-cc-attr-val">${val}</span></span>`;
      }).join("");

      const rawDesc = spec.system.description ?? "";
      // Retirer les balises HTML pour afficher du texte propre
      const desc = rawDesc.replace(/<[^>]*>/g, "").slice(0, 140).trim();
      const descDisplay = desc.length >= 140 ? desc + "…" : desc;

      return `
        <div class="cd-cc-card" data-index="${i}" tabindex="0">
          <div class="cd-cc-card-name">${spec.name}</div>
          <div class="cd-cc-card-desc">${descDisplay}</div>
          <div class="cd-cc-attrs">${attrHtml}</div>
        </div>`;
    }).join("");

    const d = new Dialog({
      title: "Character Creation — Choose Your Specialty",
      content: `
        <div class="cd-dialog cd-cc-dialog">
          <p class="cd-dialog-hint">Choose the specialty that defines your character.</p>
          <div class="cd-cc-grid">${cards}</div>
        </div>
      `,
      buttons: {
        next: {
          icon:  `<i class="fas fa-arrow-right"></i>`,
          label: "Next →",
          callback: () => resolve(selected),
        },
        cancel: { label: "Cancel", callback: () => resolve(null) },
      },
      default: "next",
      render: (html) => {
        html.find(".cd-cc-card").on("click", function() {
          html.find(".cd-cc-card").removeClass("selected");
          $(this).addClass("selected");
          const idx = parseInt($(this).data("index"));
          selected = specialties[idx];
        });
        // Sélectionner la première par défaut
        html.find(".cd-cc-card").first().trigger("click");
      },
    });
    d.render(true);
  });
}

async function _stepChooseStartSkill(specName, t1skills) {
  return new Promise((resolve) => {
    let selected = null;

    const rows = t1skills.map((s, i) => {
      const badge = `<span class="cd-skill-badge ${s.skillType === 'universal' ? 'universal' : 'specialty'}">${s.skillType === 'universal' ? 'U' : 'S'}</span>`;
      const uses  = s.uses > 0 ? `<span class="cd-cc-uses">${s.uses}/day</span>` : "";
      const rawDesc = s.description ?? "";
      const desc = rawDesc.replace(/<[^>]*>/g, "").slice(0, 120).trim();
      return `
        <label class="cd-cc-skill-row" data-index="${i}">
          <input type="radio" name="startSkill" value="${i}" ${i === 0 ? 'checked' : ''} />
          <div class="cd-cc-skill-info">
            <div class="cd-cc-skill-header">${badge} <strong>${s.name}</strong> ${uses}</div>
            <div class="cd-cc-skill-desc">${desc}${desc.length >= 120 ? "…" : ""}</div>
          </div>
        </label>`;
    }).join("");

    new Dialog({
      title: `${specName} — Choose Your Starting Skill`,
      content: `
        <div class="cd-dialog cd-cc-dialog">
          <p class="cd-dialog-hint">Choose one Tier 1 skill from your specialty to start with.</p>
          <div class="cd-cc-skill-list">${rows}</div>
        </div>
      `,
      buttons: {
        confirm: {
          icon:  `<i class="fas fa-check"></i>`,
          label: "Confirm",
          callback: (html) => {
            const idx = parseInt(html.find('[name="startSkill"]:checked').val() ?? 0);
            resolve(t1skills[idx] ?? null);
          },
        },
        back: { label: "← Back", callback: () => resolve(null) },
      },
      default: "confirm",
    }).render(true);
  });
}

async function _applyCharacterCreation(actor, spec, startSkill) {
  const rawSkills = spec.system.skills ?? [];
  const skills    = Array.isArray(rawSkills) ? rawSkills : Object.values(rawSkills);

  // Attributs depuis la specialty
  const attrs = spec.system.attributes ?? {};
  const update = {
    "system.specialty":   spec.name,
    "system.tierValue":   1,
    "system.ip.gained":   6,
    "system.ip.spent":    0,
  };

  // Appliquer les attributs
  const ATTR_KEYS = ["strong","agile","cunning","vigilant","careful","tenacious"];
  for (const key of ATTR_KEYS) {
    const val = attrs[key]?.value ?? attrs[key] ?? 1;
    update[`system.attributes.${key}.value`] = val;
    update[`system.attributes.${key}.max`]   = val;
  }

  // Stress limits
  if (spec.system.physLimit) update["system.stress.physical.limit"] = spec.system.physLimit;
  if (spec.system.menLimit)  update["system.stress.mental.limit"]   = spec.system.menLimit;

  await actor.update(update);

  // Supprimer les anciennes skills si présentes
  const existingSkills = actor.items.filter(i => i.type === "skill");
  if (existingSkills.length) await Item.deleteDocuments(existingSkills.map(i => i.id), { parent: actor });

  // Supprimer l'ancienne specialty si présente
  const oldSpec = actor.items.find(i => i.type === "specialty");
  if (oldSpec) await oldSpec.delete();

  // Créer la specialty
  await actor.createEmbeddedDocuments("Item", [spec.toObject()]);

  // Créer la skill de départ
  await actor.createEmbeddedDocuments("Item", [{
    name:   startSkill.name,
    type:   "skill",
    system: {
      description: startSkill.description ?? "",
      tier:        1,
      specialty:   startSkill.skillType === "universal" ? "universal" : spec.name,
      uses: {
        value: startSkill.uses ?? 0,
        max:   startSkill.uses ?? 0,
        per:   "day",
        type:  startSkill.uses > 0 ? "limited" : "unlimited",
      },
    },
  }]);
}

// ── Progression Dialog (Attributes) ───────────────────────────────────────────

const ATTR_LABELS = {
  strong:    "Strong",
  agile:     "Agile",
  cunning:   "Cunning",
  vigilant:  "Vigilant",
  careful:   "Careful",
  tenacious: "Tenacious",
};

const MAX_INDIVIDUAL = 12;
const MAX_TOTAL_AP   = 40;

export async function openProgressionDialog(actor) {
  const spec = actor.items.find(i => i.type === "specialty");
  const tv   = actor.system.tierValue ?? 1;
  const ip   = (actor.system.ip?.gained ?? 0) - (actor.system.ip?.spent ?? 0);

  const attrs     = actor.system.attributes ?? {};
  const totalMaxAP = Object.values(attrs).reduce((s, a) => s + (a.max ?? 0), 0);
  const totalCap   = MAX_TOTAL_AP;

  // ── Section Tier Upgrade (identique au dialog skills) ──
  const TIER_REQ  = { 2: 20, 3: 22 };
  const nextTier  = tv + 1;
  const req       = TIER_REQ[nextTier] ?? 99;
  const canTierUp = totalMaxAP >= req;

  const upgradeRow = (spec && tv < 3) ? `
    <div class="cd-avail-tier-upgrade ${canTierUp ? '' : 'locked'}">
      <div class="cd-avail-tier-info">
        <span class="cd-avail-tier-label">Upgrade Specialty to Tier ${nextTier}</span>
        <span class="cd-dialog-hint">Unlocks Tier ${nextTier} skills + 1 free skill</span>
        <div class="cd-avail-tier-ap">
          <span class="cd-avail-tier-ap-val ${canTierUp ? 'ok' : ''}">${totalMaxAP}</span>
          <span class="cd-avail-tier-ap-sep">/</span>
          <span class="cd-avail-tier-ap-req">${req} Total Max AP</span>
          ${canTierUp
            ? '<i class="fas fa-check cd-avail-tier-ap-check"></i>'
            : '<i class="fas fa-lock cd-avail-tier-ap-lock"></i>'}
        </div>
      </div>
      <button type="button" class="cd-avail-tier-btn" data-action="tierUpgrade"
        ${canTierUp ? '' : 'disabled'}>
        ${COST_TIER_UP} IP
      </button>
    </div>` : "";

  // ── Section Abilities ──
  const attrRows = Object.entries(ATTR_LABELS).map(([key, label]) => {
    const attr    = attrs[key] ?? { value: 1, max: 1 };
    const curMax  = attr.max ?? 1;
    const newMax  = curMax + 1;
    const cost    = 2 * newMax;
    const atCap   = curMax >= MAX_INDIVIDUAL;
    const totalFull = totalMaxAP >= totalCap;
    const noIP    = ip < cost;
    const blocked = atCap || totalFull;
    const cantBuy = blocked || noIP;

    let action;
    if (atCap) {
      action = `<span class="cd-avail-skill-owned" title="Max reached"><i class="fas fa-check"></i> Max</span>`;
    } else {
      action = `<button type="button" class="cd-avail-skill-add cd-attr-upgrade-btn ${cantBuy ? 'disabled' : ''}"
        data-attr="${key}" data-cost="${cost}"
        ${cantBuy ? 'disabled' : ''}>
        ${cost} IP
      </button>`;
    }

    const totalWarning = totalFull
      ? `<span class="cd-attr-total-cap" title="Total Max AP cap reached"><i class="fas fa-lock"></i></span>`
      : "";

    return `
      <div class="cd-avail-skill-row ${atCap ? 'owned' : ''} ${totalFull ? 'locked' : ''}">
        <span class="cd-attr-upgrade-label">${label}</span>
        <span class="cd-attr-upgrade-cur">${attr.value} / <strong>${curMax}</strong></span>
        ${totalWarning}
        <span class="cd-attr-upgrade-next ${cantBuy && !atCap ? 'dimmed' : ''}">
          ${atCap ? '' : `→ ${newMax}`}
        </span>
        ${action}
      </div>`;
  }).join("");

  new Dialog({
    title: "Progression",
    content: `
      <div class="cd-dialog cd-avail-dialog">
        <div class="cd-avail-ip-bar">
          <span class="cd-label">IP REMAINING</span>
          <span class="cd-avail-ip-val">${ip}</span>
        </div>
        <div class="cd-avail-total-ap-bar">
          <span class="cd-label">TOTAL MAX AP</span>
          <span class="cd-avail-total-ap-val ${totalMaxAP >= totalCap ? 'capped' : ''}">
            ${totalMaxAP} / ${totalCap}
          </span>
        </div>

        ${upgradeRow}

        <div class="cd-avail-section">
          <div class="cd-avail-section-title">
            ABILITIES
            <span class="cd-avail-cost-hint">2 × new max IP each</span>
          </div>
          <div class="cd-avail-skill-list">${attrRows}</div>
        </div>
      </div>
    `,
    buttons: { close: { label: "Close" } },
    default: "close",
    render: (html) => {
      // Upgrade attribut
      html.find(".cd-attr-upgrade-btn:not([disabled])").on("click", async (e) => {
        const key  = e.currentTarget.dataset.attr;
        const cost = parseInt(e.currentTarget.dataset.cost);

        if (!await checkIP(actor, cost)) return;

        const curMax = actor.system.attributes?.[key]?.max ?? 1;
        await actor.update({ [`system.attributes.${key}.max`]: curMax + 1 });
        await spendIP(actor, cost);

        // Rafraîchir le dialog
        const newIP = (actor.system.ip?.gained ?? 0) - (actor.system.ip?.spent ?? 0);
        html.find(".cd-avail-ip-val").text(newIP);
        const newTotal = Object.values(actor.system.attributes ?? {})
          .reduce((s, a) => s + (a.max ?? 0), 0);
        html.find(".cd-avail-total-ap-val").text(`${newTotal} / ${totalCap}`);

        // Mettre à jour la ligne
        const row = e.currentTarget.closest(".cd-avail-skill-row");
        const newCost = 2 * (curMax + 2);
        const newMax  = curMax + 1;
        row.querySelector(".cd-attr-upgrade-cur").innerHTML =
          `${actor.system.attributes?.[key]?.value ?? 1} / <strong>${newMax}</strong>`;
        row.querySelector(".cd-attr-upgrade-next").textContent =
          newMax >= MAX_INDIVIDUAL ? "" : `→ ${newMax + 1}`;

        if (newMax >= MAX_INDIVIDUAL) {
          e.currentTarget.outerHTML = `<span class="cd-avail-skill-owned"><i class="fas fa-check"></i> Max</span>`;
        } else {
          e.currentTarget.textContent = `${newCost} IP`;
          e.currentTarget.dataset.cost = newCost;
        }
      });

      // Tier upgrade — même logique que le dialog skills
      html.find("[data-action='tierUpgrade']").on("click", async (e) => {
        if (e.currentTarget.disabled) return;
        if (!await checkIP(actor, COST_TIER_UP)) return;
        const newTier = (actor.system.tierValue ?? 1) + 1;
        await spendIP(actor, COST_TIER_UP);
        await actor.update({ "system.tierValue": newTier });
        const specItem = actor.items.find(i => i.type === "specialty");
        if (specItem) await promptTierUpgrade(actor, specItem, newTier);
        ui.notifications.info(`Specialty upgraded to Tier ${newTier}!`);
        html.closest(".app").find(".header-button.close").trigger("click");
      });
    },
  }).render(true);
}

// ── Specialty Progression Dialog ───────────────────────────────────────────────

export async function openSpecialtyProgressionDialog(actor) {
  const spec = actor.items.find(i => i.type === "specialty");
  if (!spec) { ui.notifications.warn("No specialty equipped."); return; }

  const tv         = actor.system.tierValue ?? 1;
  const ip         = (actor.system.ip?.gained ?? 0) - (actor.system.ip?.spent ?? 0);
  const attrs      = actor.system.attributes ?? {};
  const totalMaxAP = Object.values(attrs).reduce((s, a) => s + (a.max ?? 0), 0);

  const TIER_REQ  = { 2: 20, 3: 22 };
  const nextTier  = tv + 1;
  const req       = TIER_REQ[nextTier] ?? 99;
  const canTierUp = totalMaxAP >= req;

  if (tv >= 3) {
    await cdDialog({
      title: "Specialty Progression",
      content: `<p>Your specialty is already at maximum Tier 3.</p>`,
      buttons: [{ value: "ok", label: "OK", primary: true }],
    });
    return;
  }

  new Dialog({
    title: `Specialty Progression — ${spec.name}`,
    content: `
      <div class="cd-dialog cd-avail-dialog">
        <div class="cd-avail-ip-bar">
          <span class="cd-label">IP REMAINING</span>
          <span class="cd-avail-ip-val">${ip}</span>
        </div>

        <div class="cd-avail-tier-upgrade ${canTierUp ? '' : 'locked'}">
          <div class="cd-avail-tier-info">
            <span class="cd-avail-tier-label">Upgrade ${spec.name} to Tier ${nextTier}</span>
            <span class="cd-dialog-hint">Unlocks Tier ${nextTier} skills + 1 free skill</span>
            <div class="cd-avail-tier-ap">
              <span class="cd-avail-tier-ap-val ${canTierUp ? 'ok' : ''}">${totalMaxAP}</span>
              <span class="cd-avail-tier-ap-sep">/</span>
              <span class="cd-avail-tier-ap-req">${req} Total Max AP</span>
              ${canTierUp
                ? '<i class="fas fa-check cd-avail-tier-ap-check"></i>'
                : '<i class="fas fa-lock cd-avail-tier-ap-lock"></i>'}
            </div>
          </div>
          <button type="button" class="cd-avail-tier-btn" data-action="tierUpgrade"
            ${canTierUp ? '' : 'disabled'}>
            ${COST_TIER_UP} IP
          </button>
        </div>

        <p class="cd-dialog-hint" style="margin-top:8px">
          Current Tier: <strong style="color:var(--cd-accent)">${tv}</strong>
          &nbsp;·&nbsp;
          Max Tier: <strong style="color:var(--cd-frost)">3</strong>
        </p>
      </div>
    `,
    buttons: { close: { label: "Close" } },
    default: "close",
    render: (html) => {
      html.find("[data-action='tierUpgrade']").on("click", async (e) => {
        if (e.currentTarget.disabled) return;
        if (!await checkIP(actor, COST_TIER_UP)) return;
        const newTier = tv + 1;
        await spendIP(actor, COST_TIER_UP);
        await actor.update({ "system.tierValue": newTier });
        await promptTierUpgrade(actor, spec, newTier);
        ui.notifications.info(`${spec.name} upgraded to Tier ${newTier}!`);
        html.closest(".app").find(".header-button.close").trigger("click");
      });
    },
  }).render(true);
}
