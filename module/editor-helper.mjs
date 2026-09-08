/**
 * Cthulhu Dreamt — Helper ProseMirror V14
 */

export function activateEditors(element, doc, sheet) {
  element.querySelectorAll("a.editor-edit").forEach(btn => {
    btn.addEventListener("click", async (event) => {
      event.preventDefault();

      const editorDiv  = btn.closest(".editor");
      const contentDiv = editorDiv?.querySelector(".editor-content[data-edit]");
      if (!contentDiv) return;
      if (editorDiv.classList.contains("cd-editor-active")) return;

      const path     = contentDiv.dataset.edit;
      const fieldKey = path.replace("system.", "");
      const src      = doc._source?.system?.[fieldKey] ?? "";

      editorDiv.classList.add("cd-editor-active");
      if (sheet) sheet._editorActive = true;
      btn.style.display = "none";

      try {
        await foundry.applications.ux.TextEditor.implementation.create({
          target:      contentDiv,
          fieldName:   path,
          document:    doc,
          engine:      "prosemirror",
          collaborate: false,
          editable:    true,
        }, src);
      } catch (err) {
        console.error("CD | Editor activation failed:", err);
        btn.style.display = "";
        editorDiv.classList.remove("cd-editor-active");
        if (sheet) sheet._editorActive = false;
        return;
      }

      // Overlay Save + Close — en dehors du DOM ProseMirror
      editorDiv.style.position = "relative";
      const overlay = window.document.createElement("div");
      overlay.className = "cd-editor-overlay";
      overlay.innerHTML = `
        <button type="button" class="cd-editor-save-btn">
          <i class="fas fa-check"></i> Save
        </button>
        <button type="button" class="cd-editor-close-btn" title="Close editor">
          <i class="fas fa-times"></i>
        </button>
      `;
      editorDiv.appendChild(overlay);

      // SAVE — sauvegarde sans fermer l'éditeur
      overlay.querySelector(".cd-editor-save-btn").addEventListener("click", async () => {
        const html = contentDiv.innerHTML ?? "";
        await doc.update({ [path]: html });
        const btn = overlay.querySelector(".cd-editor-save-btn");
        btn.innerHTML = `<i class="fas fa-check"></i> Saved!`;
        btn.classList.add("cd-saved");
        setTimeout(() => {
          btn.innerHTML = `<i class="fas fa-check"></i> Save`;
          btn.classList.remove("cd-saved");
        }, 1500);
      });

      // CLOSE — sauvegarde et ferme l'éditeur
      overlay.querySelector(".cd-editor-close-btn").addEventListener("click", async () => {
        const html = contentDiv.innerHTML ?? "";
        await doc.update({ [path]: html });
        overlay.remove();
        editorDiv.classList.remove("cd-editor-active");
        if (sheet) {
          sheet._editorActive = false;
          sheet.render();
        }
      });
    });
  });

  // Nettoyer _editorActive à la fermeture de la sheet
  if (sheet && !sheet._cdClosePatched) {
    sheet._cdClosePatched = true;
    const origClose = sheet.close.bind(sheet);
    sheet.close = async function(...args) {
      sheet._editorActive = false;
      return origClose(...args);
    };
  }
}
