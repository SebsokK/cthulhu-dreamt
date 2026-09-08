/**
 * Cthulhu Dreamt — NPC Sheet (v14)
 */

const BaseSheet = foundry.applications?.sheets?.ActorSheetV2 ?? ActorSheet;
const BaseMixin = foundry.applications?.api?.HandlebarsApplicationMixin ?? (cls => cls);

export class CthulhuDreamtNPCSheet extends BaseMixin(BaseSheet) {

  static DEFAULT_OPTIONS = {
    classes: ["cthulhu-dreamt", "sheet", "actor", "npc"],
    position: { width: 480, height: 680 },
    window: { resizable: true },
    form: { submitOnChange: true },
    actions: {
      npcPipClick:    CthulhuDreamtNPCSheet._onNpcPipClick,
      npcAddTrait:    CthulhuDreamtNPCSheet._onNpcAdd("traits",        { name: "", description: "" }),
      npcAddMajor:    CthulhuDreamtNPCSheet._onNpcAdd("majorActions",  { name: "", description: "", damage: "", damageType: "physical" }),
      npcAddMinor:    CthulhuDreamtNPCSheet._onNpcAdd("minorActions",  { name: "", description: "" }),
      npcRemoveEntry: CthulhuDreamtNPCSheet._onNpcRemove,
      npcRollDamage:  CthulhuDreamtNPCSheet._onNpcRollDamage,
      npcToggleDmgType: CthulhuDreamtNPCSheet._onNpcToggleDmgType,
    },
  };

  static PARTS = {
    sheet: { template: "systems/cthulhu-dreamt/templates/actors/npc-sheet.hbs" },
  };

  get title() { return this.actor.name; }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const system  = this.actor.system;
    context.actor  = this.actor;
    context.system = system;

    // Pips Physical
    const physMax = system.physLimit?.max ?? 10;
    const physVal = system.physLimit?.value ?? 0;
    context.physPips = Array.from({ length: physMax }, (_, i) => ({
      filled:  i < physVal,
      danger:  physVal >= physMax * 0.7 && i < physVal,
    }));

    // Pips Mental
    const menMax = system.menLimit?.max ?? 5;
    const menVal = system.menLimit?.value ?? 0;
    context.menPips = Array.from({ length: menMax }, (_, i) => ({
      filled: i < menVal,
      danger: menVal >= menMax * 0.7 && i < menVal,
    }));

    // Arrays — Foundry sérialise en objets
    const toArr = (raw) => Array.isArray(raw) ? [...raw] : Object.values(raw ?? {});
    context.traits       = toArr(system.traits);
    context.majorActions = toArr(system.majorActions);
    context.minorActions = toArr(system.minorActions);

    return context;
  }

  _onRender(context, options) {
    super._onRender?.(context, options);

    // Portrait — clic pour changer l'image
    const portrait = this.element.querySelector(".cd-npc-portrait");
    if (portrait) {
      portrait.addEventListener("click", () => {
        const fp = new FilePicker({
          type: "image",
          current: this.actor.img,
          callback: (path) => this.actor.update({ img: path }),
        });
        fp.render(true);
      });
    }

    // Auto-resize textareas
    this.element.querySelectorAll(".cd-npc-entry-desc").forEach(ta => {
      ta.style.height = "auto";
      ta.style.height = ta.scrollHeight + "px";
      ta.addEventListener("input", () => {
        ta.style.height = "auto";
        ta.style.height = ta.scrollHeight + "px";
      });
    });
  }

  // ── Actions ──────────────────────────────────────────────

  static async _onNpcPipClick(event, target) {
    const track = target.dataset.track;
    const index = parseInt(target.dataset.index);
    const field = track === "phys" ? "physLimit" : "menLimit";
    const cur   = this.actor.system[field]?.value ?? 0;
    // Clic sur pip déjà rempli → retirer, sinon ajouter
    const newVal = cur === index + 1 ? index : index + 1;
    await this.actor.update({ [`system.${field}.value`]: Math.max(0, newVal) });
  }

  static _onNpcAdd(block, template) {
    return async function(event, target) {
      const raw  = this.actor.system[block] ?? [];
      const arr  = Array.isArray(raw) ? [...raw] : Object.values(raw);
      arr.push({ ...template });
      await this.actor.update({ [`system.${block}`]: arr });
    };
  }

  static async _onNpcRemove(event, target) {
    const block = target.dataset.block;
    const index = parseInt(target.dataset.index);
    const raw   = this.actor.system[block] ?? [];
    const arr   = Array.isArray(raw) ? [...raw] : Object.values(raw);
    arr.splice(index, 1);
    await this.actor.update({ [`system.${block}`]: arr });
  }

  static async _onNpcToggleDmgType(event, target) {
    event.preventDefault();
    event.stopPropagation();
    const index = parseInt(target.dataset.index);
    const raw   = this.actor.system.majorActions ?? [];
    const arr   = Array.isArray(raw) ? [...raw] : Object.values(raw);
    const cur   = arr[index]?.damageType ?? "physical";
    arr[index]  = { ...arr[index], damageType: cur === "physical" ? "mental" : "physical" };
    await this.actor.update({ "system.majorActions": arr });
  }

  static async _onNpcRollDamage(event, target) {
    event.preventDefault();
    event.stopPropagation();
    const index  = parseInt(target.dataset.index);
    const raw    = this.actor.system.majorActions ?? [];
    const arr    = Array.isArray(raw) ? raw : Object.values(raw);
    const action = arr[index];
    if (!action) return;

    const formula    = action.damage?.trim();
    const dmgType    = action.damageType ?? "physical";
    const dmgLabel   = dmgType === "mental" ? "Mental Stress" : "Physical Stress";
    const dmgColor   = dmgType === "mental" ? "var(--cd-purple, #9b7dff)" : "var(--cd-red)";

    if (!formula) {
      ui.notifications.info(`${action.name} has no damage formula.`);
      return;
    }

    const rollCard = (result, label) => `
      <div class="cd-roll-card">
        <div class="cd-roll-header">
          <span class="cd-roll-actor">${this.actor.name}</span>
          <span class="cd-roll-sep">—</span>
          <span class="cd-roll-label">${action.name}</span>
        </div>
        <div class="cd-roll-body">
          <div class="cd-roll-dice-row">
            <div class="cd-roll-die">
              <span class="cd-roll-natural" style="font-size:28px">${result}</span>
              <span class="cd-roll-die-label">${label}</span>
            </div>
          </div>
          <div class="cd-roll-degree" style="color:${dmgColor}">
            <i class="fas fa-skull"></i> ${result} ${dmgLabel}
          </div>
        </div>
      </div>`;

    const isFixed = /^\d+$/.test(formula);

    if (isFixed) {
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: rollCard(parseInt(formula), "fixed"),
      });
      return;
    }

    const roll = new Roll(formula);
    await roll.evaluate();
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: rollCard(roll.total, formula),
      rolls: [roll],
      type: CONST.CHAT_MESSAGE_TYPES?.ROLL,
    });
  }
}
