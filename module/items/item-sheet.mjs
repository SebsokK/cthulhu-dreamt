/**
 * Cthulhu Dreamt — Item Sheet (v14)
 */

import { activateEditors } from "../editor-helper.mjs";

const BaseSheet = foundry.applications?.sheets?.ItemSheetV2 ?? ItemSheet;
const BaseMixin = foundry.applications?.api?.HandlebarsApplicationMixin ?? (cls => cls);

export class CthulhuDreamtItemSheet extends BaseMixin(BaseSheet) {

  static DEFAULT_OPTIONS = {
    classes: ["cthulhu-dreamt", "sheet", "item"],
    position: { width: 520, height: 420 },
    window: { resizable: true },
    form: { submitOnChange: true },
  };

  static PARTS = {
    sheet: { template: "systems/cthulhu-dreamt/templates/items/item-sheet.hbs" },
  };

  get title() {
    return this.item.name;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.item   = this.item;
    context.system = this.item.system;
    context.type   = this.item.type;
    context.config = CONFIG.CD;

    const rawDesc = this.item._source?.system?.description ?? this.item.system.description ?? "";
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
}
