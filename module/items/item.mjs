/**
 * Cthulhu Dreamt — Item Document Class
 */

export class CthulhuDreamtItem extends Item {

  prepareDerivedData() {
    super.prepareDerivedData();

    // Reset skill uses at dawn (handled via macro / rest logic)
    // Nothing extra for now — placeholder for future hooks
  }

  /**
   * Returns a short display string for the item's main stat,
   * useful in chat cards and tooltips.
   */
  get displayTag() {
    switch (this.type) {
      case "weapon":
        return `STR: ${this.system.stress ?? "—"} | RNG: ${this.system.range ?? "—"}`;
      case "armor":
        return `AV: ${this.system.armorValue ?? 0}`;
      case "skill":
        return this.system.uses?.type === "limited"
          ? `${this.system.uses.value}/${this.system.uses.max} uses`
          : "Passive";
      default:
        return `Size: ${this.system.size ?? 1}`;
    }
  }
}
