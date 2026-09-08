/**
 * Cthulhu Dreamt — Specialty Item Sheet
 */

import { activateEditors } from "../editor-helper.mjs";

const BaseSheet = foundry.applications?.sheets?.ItemSheetV2 ?? ItemSheet;
const BaseMixin = foundry.applications?.api?.HandlebarsApplicationMixin ?? (cls => cls);

export class CthulhuDreamtSpecialtySheet extends BaseMixin(BaseSheet) {

  static DEFAULT_OPTIONS = {
    classes: ["cthulhu-dreamt", "sheet", "item", "specialty"],
    position: { width: 560, height: 600 },
    window: { resizable: true },
    form: { submitOnChange: true },
    actions: {
      addSpecialtySkill:    CthulhuDreamtSpecialtySheet._onAddSkill,
      removeSpecialtySkill: CthulhuDreamtSpecialtySheet._onRemoveSkill,
      editImage:            CthulhuDreamtSpecialtySheet._onEditImage,
    },
  };

  static PARTS = {
    sheet: { template: "systems/cthulhu-dreamt/templates/items/specialty-sheet.hbs" },
  };

  get title() {
    return this.item.name;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.item   = this.item;
    context.system = this.item.system;
    context.config = CONFIG.CD;

    const rawDesc = this.item._source?.system?.description ?? "";
    context.enriched = {
      description: await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        rawDesc, { async: true, relativeTo: this.item }
      ),
    };
    return context;
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    activateEditors(this.element, this.item, this);
  }

  _canRender(options) {
    if (this._editorActive) return false;
    return super._canRender?.(options) ?? true;
  }

  _onChangeForm(formConfig, event) {
    if (this._editorActive) return;
    super._onChangeForm(formConfig, event);
  }

  static async _onAddSkill(event, target) {
    const skills = this._getSkillsArray();
    const tier   = parseInt(target.dataset.tier ?? 1);
    skills.push({ name: "", tier, skillType: "specialty", uses: 1, description: "" });
    await this.item.update({ "system.skills": skills });
  }

  static async _onRemoveSkill(event, target) {
    const index  = parseInt(target.dataset.skillIndex);
    const skills = this._getSkillsArray();
    skills.splice(index, 1);
    await this.item.update({ "system.skills": skills });
  }

  static async _onEditImage(event, target) {
    const fp = new FilePicker({
      type: "image",
      current: this.item.img,
      callback: (path) => this.item.update({ img: path }),
    });
    fp.render(true);
  }

  _getSkillsArray() {
    const raw = this.item.system.skills ?? [];
    return Array.isArray(raw) ? [...raw] : Object.values(raw);
  }
}
