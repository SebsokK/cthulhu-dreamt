/**
 * Cthulhu Dreamt — Actor Sheet
 * Foundry VTT v14
 * Utilise ActorSheetV2 si disponible, sinon ActorSheet en fallback
 */

import { activateEditors } from "../editor-helper.mjs";
import { handleSpecialtyDrop, openAvailableSkillsDialog, openCharacterCreation, openProgressionDialog, openSpecialtyProgressionDialog } from "../specialty.mjs";
import { openRestDialog } from "../rest.mjs";
import { cdConfirm } from "../dialog.mjs";

// v14 expose ActorSheetV2 dans foundry.applications.sheets
const BaseSheet = foundry.applications?.sheets?.ActorSheetV2 ?? ActorSheet;
const BaseMixin = foundry.applications?.api?.HandlebarsApplicationMixin ?? (cls => cls);

export class CthulhuDreamtActorSheet extends BaseMixin(BaseSheet) {

  get title() {
    return this.actor.name;
  }

  // ── OPTIONS ──────────────────────────────────────────────
  static DEFAULT_OPTIONS = {
    classes: ["cthulhu-dreamt", "sheet", "actor"],
    position: { width: 860, height: 680 },
    window: { resizable: true },
    actions: {
      rollAttribute: CthulhuDreamtActorSheet._onRollAttribute,
      pipClick:      CthulhuDreamtActorSheet._onPipClick,
      stressClick:   CthulhuDreamtActorSheet._onStressClick,
      itemEdit:      CthulhuDreamtActorSheet._onItemEdit,
      itemDelete:    CthulhuDreamtActorSheet._onItemDelete,
      itemCreate:    CthulhuDreamtActorSheet._onItemCreate,
      itemEquip:           CthulhuDreamtActorSheet._onItemEquip,
      skillUse:            CthulhuDreamtActorSheet._onSkillUse,
      availableSkills:     CthulhuDreamtActorSheet._onAvailableSkills,
      createCharacter:     CthulhuDreamtActorSheet._onCreateCharacter,
      rollWeapon:          CthulhuDreamtActorSheet._onRollWeapon,
      reloadWeapon:        CthulhuDreamtActorSheet._onReloadWeapon,
      profPipClick:        CthulhuDreamtActorSheet._onProfPipClick,
      specialtyProgression: CthulhuDreamtActorSheet._onSpecialtyProgression,
      progressionDialog:    CthulhuDreamtActorSheet._onProgressionDialog,
      woundTrackClick:      CthulhuDreamtActorSheet._onWoundTrackClick,
      rest:                 CthulhuDreamtActorSheet._onRest,
      showSpecialtySkills: CthulhuDreamtActorSheet._onShowSpecialtySkills,
      addSpecialtySkill:   CthulhuDreamtActorSheet._onAddSpecialtySkill,
      removeSpecialty:     CthulhuDreamtActorSheet._onRemoveSpecialty,
      goalAdd:       CthulhuDreamtActorSheet._onGoalAdd,
      goalComplete:  CthulhuDreamtActorSheet._onGoalComplete,
      goalRestore:   CthulhuDreamtActorSheet._onGoalRestore,
      goalDelete:    CthulhuDreamtActorSheet._onGoalDelete,
    },
    form: { submitOnChange: true },
  };

  static PARTS = {
    sheet: {
      template: "systems/cthulhu-dreamt/templates/actors/actor-sheet.hbs",
    },
  };

  // ── TAB STATE ────────────────────────────────────────────
  #currentTab = "stats";

  // ── CONTEXT ──────────────────────────────────────────────
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor   = this.actor;
    const system  = actor.system;

    context.actor      = actor;
    context.system     = system;
    context.currentTab = this.#currentTab;

    // Enrichissement V14 — lire depuis _source pour avoir la string brute
    const enrich = (field) => foundry.applications.ux.TextEditor.implementation.enrichHTML(
      actor._source?.system?.[field] ?? system[field] ?? "",
      { async: true, relativeTo: actor }
    );

    context.enriched = {
      background: await enrich("background"),
      notes:      await enrich("notes"),
    };

    const PROF_LABELS = {
      closeQuarters: "Close Quarters",
      smallArms:     "Small Arms",
      longArms:      "Long Arms",
      thrown:        "Thrown",
      unarmed:       "Unarmed",
      edge:          "EDGe",
    };
    const profs = system.proficiencies ?? {};
    context.proficiencyList = Object.entries(PROF_LABELS).map(([key, label]) => {
      const val = profs[key] ?? 0;
      return {
        key, label, value: val,
        pips: Array.from({ length: 3 }, (_, i) => ({ filled: i < val })),
      };
    });
    context.weapons    = actor.items.filter(i => i.type === "weapon");
    context.armors     = actor.items.filter(i => i.type === "armor");
    context.tools      = actor.items.filter(i => i.type === "tool");
    context.gears      = actor.items.filter(i => i.type === "gear");
    context.skills     = actor.items.filter(i => i.type === "skill");
    context.equippedSpecialty = actor.items.find(i => i.type === "specialty") ?? null;

    context.attributeList = Object.entries(system.attributes ?? {}).map(([key, attr]) => ({
      key,
      label:    game.i18n.localize(`CD-Attr-${key}`),
      subtitle: game.i18n.localize(`CD-Attr-${key}Sub`),
      value: attr.value,
      max:   attr.max,
      pips:  this._buildPips(attr.value, attr.max),
    }));

    const pStress = system.stress?.physical ?? { value: 0, limit: 8 };
    const mStress = system.stress?.mental   ?? { value: 0, limit: 3 };
    context.physicalStress  = pStress;
    context.mentalStress    = mStress;
    context.physicalPct     = Math.round((pStress.value / Math.max(pStress.limit, 1)) * 100);
    context.mentalPct       = Math.round((mStress.value / Math.max(mStress.limit, 1)) * 100);
    context.physicalDanger  = pStress.value >= pStress.limit * 0.75;
    context.mentalDanger    = mStress.value >= mStress.limit * 0.75;

    context.physicalWounds = system.wounds?.physical ?? {};
    context.mentalWounds   = system.wounds?.mental   ?? {};
    context.currentGoals   = system.goals?.current   ?? [];
    context.completedGoals = system.goals?.completed ?? [];
    context.ip   = system.ip ?? { gained: 0, spent: 0, remaining: 0 };
    context.cc   = system.carryingCapacity ?? { base: 7, bonus: 0, total: 7 };
    context.load = {
      ...(system.load ?? { current: 0 }),
      overloaded: (system.load?.current ?? 0) > (system.carryingCapacity?.total ?? 0),
    };
    context.config  = CONFIG.CD;
    context.isOwner = actor.isOwner;

    return context;
  }

  _buildPips(value, max) {
    const pips = [];
    for (let i = 1; i <= max; i++) pips.push({ index: i, filled: i <= value });
    return pips;
  }

  // Bloquer tout re-render quand un éditeur ProseMirror est actif
  _canRender(options) {
    if (this._editorActive) return false;
    return super._canRender?.(options) ?? true;
  }

  // Bloquer le submitOnChange quand un éditeur ProseMirror est actif
  _onChangeForm(formConfig, event) {
    if (this._editorActive) return;
    super._onChangeForm(formConfig, event);
  }

  // ── POST-RENDER ──────────────────────────────────────────
  _onRender(context, options) {
    super._onRender?.(context, options);
    const html = this.element;

    // Fix hauteur : forcer cd-body à prendre l'espace restant après le header
    const headerRow = html.querySelector(".cd-header-row");
    const body      = html.querySelector(".cd-body");
    if (headerRow && body) {
      const totalH  = html.offsetHeight;
      const headerH = headerRow.offsetHeight;
      body.style.height = `${totalH - headerH}px`;
    }

    // Recalculer au resize de la fenêtre
    new ResizeObserver(() => {
      const h = html.offsetHeight;
      const hh = html.querySelector(".cd-header-row")?.offsetHeight ?? 0;
      if (body) body.style.height = `${h - hh}px`;
    }).observe(html);

    // Tab switching manuel
    html.querySelectorAll(".cd-tab-btn").forEach(btn => {
      btn.addEventListener("click", e => {
        e.preventDefault();
        const tab = btn.dataset.tab;
        this.#currentTab = tab;
        html.querySelectorAll(".cd-tab-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        html.querySelectorAll(".cd-tab-panel").forEach(p => p.classList.remove("active"));
        html.querySelector(`.cd-tab-panel[data-tab="${tab}"]`)?.classList.add("active");
      });
    });

    // Activer l'onglet courant
    html.querySelector(`.cd-tab-btn[data-tab="${this.#currentTab}"]`)?.classList.add("active");
    html.querySelector(`.cd-tab-panel[data-tab="${this.#currentTab}"]`)?.classList.add("active");

    // Accordéons onglet Goals
    html.querySelectorAll(".cd-accordion-header").forEach(header => {
      const key     = header.dataset.accordion;
      const body    = html.querySelector(`[data-accordion-body="${key}"]`);
      const chevron = header.querySelector(".cd-accordion-chevron");
      if (!body) return;

      // Restaurer l'état (ouvert par défaut si classe "open" présente)
      const isOpen = this.#accordionOpen[key] ?? body.classList.contains("open");
      body.classList.toggle("open", isOpen);
      chevron?.classList.toggle("rotated", isOpen);
      this.#accordionOpen[key] = isOpen;

      header.addEventListener("click", e => {
        if (e.target.closest("button, input")) return;
        const open = body.classList.toggle("open");
        chevron?.classList.toggle("rotated", open);
        this.#accordionOpen[key] = open;
      });
    });
    // Specialty drop zone — highlight au survol
    const dropZone = html.querySelector(".cd-specialty-drop-zone");
    if (dropZone) {
      dropZone.addEventListener("dragover",  (e) => { e.preventDefault(); dropZone.classList.add("drag-over"); });
      dropZone.addEventListener("dragleave", ()  => dropZone.classList.remove("drag-over"));
      dropZone.addEventListener("drop",      ()  => dropZone.classList.remove("drag-over"));
    }

    // Auto-resize des textareas de goals
    html.querySelectorAll(".cd-goal-desc").forEach(ta => {
      const resize = () => {
        ta.style.height = "auto";
        ta.style.height = ta.scrollHeight + "px";
      };
      resize();
      ta.addEventListener("input", resize);
    });
    // Stress inputs — débounce pour garder le focus pendant la saisie au clavier
    const stressDebounce = {};
    html.querySelectorAll('input[name^="system.stress"]').forEach(input => {
      input.addEventListener("input", () => {
        const name = input.name;
        clearTimeout(stressDebounce[name]);
        stressDebounce[name] = setTimeout(async () => {
          const val = parseInt(input.value);
          if (isNaN(val)) return;
          await this.actor.update({ [name]: val });
          requestAnimationFrame(() => {
            const restored = this.element?.querySelector(`input[name="${name}"]`);
            if (restored) { restored.focus(); restored.select(); }
          });
        }, 500);
      });
      // Bloquer le change natif pour éviter le double-submit avec submitOnChange
      input.addEventListener("change", e => e.stopPropagation());
    });

    html.querySelector(".cd-portrait")?.addEventListener("click", () => {
      const fp = new FilePicker({
        type:     "image",
        current:  this.actor.img,
        callback: (path) => this.actor.update({ img: path }),
      });
      fp.render(true);
    });

    // Activer les éditeurs ProseMirror (background, notes)
    activateEditors(html, this.actor, this);

    html.querySelectorAll(".cd-stress-toggle").forEach(toggle => {
      const type      = toggle.dataset.stress;
      const panel     = html.querySelector(`.cd-stress-panel[data-stress="${type}"]`);
      const collaps   = panel?.querySelector(".cd-wounds-collapsible");
      const chevron   = toggle.querySelector(".cd-stress-chevron");

      // Restaurer l'état sauvegardé (fermé par défaut)
      const isOpen = this.#woundsOpen[type] ?? false;
      if (isOpen) {
        collaps?.classList.add("open");
        chevron?.classList.add("rotated");
      }

      toggle.addEventListener("click", e => {
        // Ne pas déclencher si on clique sur un input
        if (e.target.closest("input")) return;
        const open = collaps?.classList.toggle("open");
        chevron?.classList.toggle("rotated", open);
        this.#woundsOpen[type] = open;
      });
    });
  }

  // État d'ouverture des wounds (persiste pendant la session)
  #woundsOpen = { physical: false, mental: false };
  #accordionOpen = {};

  // ── ACTIONS ──────────────────────────────────────────────

  static async _onRollAttribute(event, target) {
    const key = target.closest("[data-attribute]")?.dataset.attribute;
    if (key) await this.actor.rollAttribute(key);
  }

  static async _onPipClick(event, target) {
    const key  = target.closest("[data-attribute]")?.dataset.attribute;
    const idx  = parseInt(target.dataset.pipIndex);
    const attr = this.actor.system.attributes?.[key];
    if (!attr) return;
    const newVal = attr.value === idx ? idx - 1 : idx;
    await this.actor.update({ [`system.attributes.${key}.value`]: Math.max(0, Math.min(newVal, attr.max)) });
  }

  static async _onStressClick(event, target) {
    const type   = target.dataset.stressType;
    const cur    = this.actor.system.stress?.[type]?.value ?? 0;
    const limit  = this.actor.system.stress?.[type]?.limit ?? 8;
    const newVal = event.shiftKey ? Math.max(0, cur - 1) : Math.min(limit, cur + 1);
    await this.actor.update({ [`system.stress.${type}.value`]: newVal });
  }

  static async _onItemEdit(event, target) {
    const id = target.closest("[data-item-id]")?.dataset.itemId;
    this.actor.items.get(id)?.sheet.render(true);
  }

  static async _onItemDelete(event, target) {
    const id   = target.closest("[data-item-id]")?.dataset.itemId;
    const item = this.actor.items.get(id);
    if (!item) return;
    const yes = await cdConfirm({
      title:   game.i18n.localize("CD-Item-deleteTitle"),
      content: `<p>${game.i18n.format("CD-Item-deleteConfirm", { name: item.name })}</p>`,
    });
    if (yes) await item.delete();
  }

  static async _onItemCreate(event, target) {
    const type = target.dataset.type ?? "gear";
    const key  = `CD-Item-new${type.charAt(0).toUpperCase()}${type.slice(1)}`;
    await Item.create({ name: game.i18n.localize(key), type }, { parent: this.actor });
  }

  static async _onItemEquip(event, target) {
    const id   = target.closest("[data-item-id]")?.dataset.itemId;
    const item = this.actor.items.get(id);
    if (item) await item.update({ "system.equipped": !item.system.equipped });
  }

  static async _onSkillUse(event, target) {
    const id   = target.closest("[data-item-id]")?.dataset.itemId;
    const item = this.actor.items.get(id);
    if (!item) return;
    const cur = item.system.uses?.value ?? 0;
    if (cur <= 0) { ui.notifications.warn(game.i18n.localize("CD-Skill-noUses")); return; }
    await item.update({ "system.uses.value": cur - 1 });
  }

  static async _onAvailableSkills(event, target) {
    await openAvailableSkillsDialog(this.actor);
  }

  static async _onCreateCharacter(event, target) {
    await openCharacterCreation(this.actor);
  }

  static async _onRollWeapon(event, target) {
    const id     = target.closest("[data-item-id]")?.dataset.itemId;
    const weapon = this.actor.items.get(id);
    if (!weapon) return;
    await this.actor.rollWeapon(weapon);
  }

  static async _onReloadWeapon(event, target) {
    const id     = target.closest("[data-item-id]")?.dataset.itemId;
    const weapon = this.actor.items.get(id);
    if (!weapon) return;

    // Les thrown ne se rechargent pas
    if (weapon.system.category === "thrown") {
      ui.notifications.warn(`Thrown weapons can't be reloaded — buy new ones.`);
      return;
    }

    const ammoType = weapon.system.ammoType?.trim();

    // Si l'arme a un type de munition défini, vérifier l'inventaire
    if (ammoType) {
      const ammoItem = this.actor.items.find(i =>
        (i.type === "tool" || i.type === "gear") &&
        i.name === ammoType &&
        (i.system.quantity ?? 1) > 0
      );

      if (!ammoItem) {
        ui.notifications.warn(`No ${ammoType} in inventory!`);
        return;
      }

      // Consommer 1 unité
      const newQty = (ammoItem.system.quantity ?? 1) - 1;
      if (newQty <= 0) {
        await ammoItem.delete();
      } else {
        await ammoItem.update({ "system.quantity": newQty });
      }
    }

    await weapon.update({ "system.shots.value": weapon.system.shots.max });
    ui.notifications.info(`${weapon.name} reloaded.${ammoType ? ` (${ammoType} consumed)` : ''}`);
  }

  static async _onProfPipClick(event, target) {
    const key   = target.dataset.proficiency;
    const index = parseInt(target.dataset.pipIndex);
    const cur   = this.actor.system.proficiencies?.[key] ?? 0;
    // Clic sur pip déjà rempli → descendre, sinon monter
    const newVal = cur === index ? index - 1 : index;
    await this.actor.update({ [`system.proficiencies.${key}`]: Math.max(0, Math.min(3, newVal)) });
  }

  static async _onProgressionDialog(event, target) {
    await openProgressionDialog(this.actor);
  }

  static async _onRest(event, target) {
    await openRestDialog(this.actor);
  }

  static async _onWoundTrackClick(event, target) {
    const stressType = target.dataset.stressType; // "physical" | "mental"
    const level      = target.dataset.level;       // "mild" | "serious" | "severe"
    const index      = parseInt(target.dataset.index); // 0-5
    const cur        = this.actor.system.wounds?.[stressType]?.[level]?.track ?? 0;
    // Clic sur cellule déjà remplie → vider jusqu'à elle, sinon remplir jusqu'à elle
    const newVal = cur === index + 1 ? index : index + 1;
    await this.actor.update({
      [`system.wounds.${stressType}.${level}.track`]: Math.max(0, Math.min(6, newVal))
    });
  }

  static async _onSpecialtyProgression(event, target) {
    await openSpecialtyProgressionDialog(this.actor);
  }

  // Override drop pour intercepter les Specialty
  async _onDropItem(event, data) {
    const item = await Item.fromDropData(data);
    if (!item) return super._onDropItem(event, data);
    if (item.type === "specialty") {
      return handleSpecialtyDrop(this.actor, item.toObject());
    }
    return super._onDropItem(event, data);
  }

  static async _onGoalAdd(event, target) {
    const type  = target.dataset.goalType ?? "current";
    // Foundry stocke les tableaux comme objets indexés — forcer la conversion
    const raw   = this.actor.system.goals?.[type] ?? [];
    const goals = Array.isArray(raw) ? [...raw] : Object.values(raw);
    goals.push({ description: "", ip: 0 });
    await this.actor.update({ [`system.goals.${type}`]: goals });
  }

  static async _onGoalComplete(event, target) {
    const row   = target.closest("[data-goal-index]");
    const index = parseInt(row?.dataset.goalIndex);

    const rawCur  = this.actor.system.goals?.current   ?? [];
    const rawDone = this.actor.system.goals?.completed ?? [];
    const cur  = Array.isArray(rawCur)  ? [...rawCur]  : Object.values(rawCur);
    const done = Array.isArray(rawDone) ? [...rawDone] : Object.values(rawDone);

    const [goal] = cur.splice(index, 1);
    if (!goal) return;
    done.push(goal);

    await this.actor.update({
      "system.goals.current":   cur,
      "system.goals.completed": done,
      "system.ip.gained": (this.actor.system.ip?.gained ?? 0) + (goal.ip ?? 0),
    });
    ui.notifications.info(game.i18n.format("CD-Goal-completedMsg", { ip: goal.ip ?? 0 }));
  }

  static async _onGoalRestore(event, target) {
    const row   = target.closest("[data-goal-index]");
    const index = parseInt(row?.dataset.goalIndex);

    const rawCur  = this.actor.system.goals?.current   ?? [];
    const rawDone = this.actor.system.goals?.completed ?? [];
    const cur  = Array.isArray(rawCur)  ? [...rawCur]  : Object.values(rawCur);
    const done = Array.isArray(rawDone) ? [...rawDone] : Object.values(rawDone);

    const [goal] = done.splice(index, 1);
    if (!goal) return;
    cur.push(goal);

    // Retirer l'IP accordé lors de la complétion
    const newGained = Math.max(0, (this.actor.system.ip?.gained ?? 0) - (goal.ip ?? 0));
    await this.actor.update({
      "system.goals.current":   cur,
      "system.goals.completed": done,
      "system.ip.gained":       newGained,
    });
  }

  static async _onGoalDelete(event, target) {
    const row   = target.closest("[data-goal-index]");
    const index = parseInt(row?.dataset.goalIndex);
    const type  = row?.dataset.goalType ?? "current";

    const raw   = this.actor.system.goals?.[type] ?? [];
    const goals = Array.isArray(raw) ? [...raw] : Object.values(raw);
    goals.splice(index, 1);
    await this.actor.update({ [`system.goals.${type}`]: goals });
  }

  /* -------------------------------------------------------
   *  SPECIALTY ACTIONS
   *  ------------------------------------------------------- */

  static async _onRemoveSpecialty(event, target) {
    const specialty = this.actor.items.find(i => i.type === "specialty");
    const confirmed = await cdConfirm({
      title: "Remove Specialty",
      content: `<p>Remove <strong>${specialty?.name ?? "this specialty"}</strong> from this character? Their skills will remain.</p>`,
    });
    if (!confirmed) return;
    if (specialty) await specialty.delete();
    await this.actor.update({ "system.specialty": "" });
  }

  static async _onShowSpecialtySkills(event, target) {
    await openAvailableSkillsDialog(this.actor);
  }

  static async _onAddSpecialtySkill(event, target) {
    // géré dans le render callback du dialog
  }

  /* -------------------------------------------------------
   *  DROP — Specialty sur l'acteur
   *  ------------------------------------------------------- */
  async _onDropItem(event, data) {
    const item = await fromUuid(data.uuid);
    if (!item) return super._onDropItem?.(event, data);
    if (item.type === "specialty") {
      return handleSpecialtyDrop(this.actor, item.toObject());
    }
    return super._onDropItem?.(event, data);
  }
}
