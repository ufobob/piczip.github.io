"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const imageInput = document.getElementById("imageInput");
  const fileSummary = document.getElementById("fileSummary");
  const fileList = document.getElementById("fileList");

  const recipientInput = document.getElementById("recipient");
  const subjectInput = document.getElementById("subject");
  const messageInput = document.getElementById("message");

  const createZipButton = document.getElementById("createZipButton");
  const shareButton = document.getElementById("shareButton");
  const downloadButton = document.getElementById("downloadButton");

  const statusBox = document.getElementById("statusBox");
  const statusText = document.getElementById("statusText");

  let selectedFiles = [];
  let generatedZipBlob = null;
  let generatedZipFile = null;
  let generatedZipUrl = null;

  imageInput.addEventListener("change", handleFileSelection);
  createZipButton.addEventListener("click", createZip);
  shareButton.addEventListener("click", shareZip);
  downloadButton.addEventListener("click", downloadZip);

  function handleFileSelection(event) {
    selectedFiles = Array.from(event.target.files || []);

    generatedZipBlob = null;
    generatedZipFile = null;

    revokeZipUrl();

    shareButton.disabled = true;
    downloadButton.disabled = true;

    renderSelectedFiles();

    if (selectedFiles.length > 0) {
      createZipButton.disabled = false;
      setStatus(
        `${selectedFiles.length} Bild${selectedFiles.length === 1 ? "" : "er"} ausgewählt.`,
        "info"
      );
    } else {
      createZipButton.disabled = true;
      setStatus("Noch keine Bilder ausgewählt.", "info");
    }
  }

  function renderSelectedFiles() {
    fileList.innerHTML = "";

    if (selectedFiles.length === 0) {
      fileList.hidden = true;
      fileSummary.textContent = "Noch keine Bilder ausgewählt.";
      return;
    }

    fileList.hidden = false;

    const totalBytes = selectedFiles.reduce(
      (sum, file) => sum + file.size,
      0
    );

    fileSummary.textContent =
      `${selectedFiles.length} Bild${selectedFiles.length === 1 ? "" : "er"} · ` +
      `${formatBytes(totalBytes)}`;

    selectedFiles.forEach((file) => {
      const listItem = document.createElement("li");

      const fileName = document.createElement("span");
      fileName.className = "file-name";
      fileName.textContent = file.name;

      const fileSize = document.createElement("span");
      fileSize.className = "file-size";
      fileSize.textContent = formatBytes(file.size);

      listItem.append(fileName, fileSize);
      fileList.appendChild(listItem);
    });
  }

  async function createZip() {
    if (selectedFiles.length === 0) {
      setStatus("Bitte wählen Sie zuerst mindestens ein Bild aus.", "error");
      return;
    }

    if (typeof JSZip === "undefined") {
      setStatus("JSZip konnte nicht geladen werden.", "error");
      return;
    }

    setBusy(true);
    setStatus("ZIP-Datei wird lokal erstellt …", "info");

    try {
      const zip = new JSZip();

      selectedFiles.forEach((file, index) => {
        const safeName = createUniqueFileName(file.name, index);
        zip.file(safeName, file);
      });

      generatedZipBlob = await zip.generateAsync({
        type: "blob",
        mimeType: "application/zip",
        compression: "DEFLATE",
        compressionOptions: {
          level: 6
        }
      });

      generatedZipFile = new File(
        [generatedZipBlob],
        createZipFileName(),
        {
          type: "application/zip",
          lastModified: Date.now()
        }
      );

      generatedZipUrl = URL.createObjectURL(generatedZipBlob);

      shareButton.disabled = false;
      downloadButton.disabled = false;

      setStatus(
        `ZIP-Datei erstellt · ${formatBytes(generatedZipBlob.size)}`,
        "success"
      );
    } catch (error) {
      console.error("Fehler beim Erstellen der ZIP-Datei:", error);
      setStatus(
        "Die ZIP-Datei konnte nicht erstellt werden.",
        "error"
      );
    } finally {
      setBusy(false);
    }
  }

  async function shareZip() {
  if (!generatedZipFile) {
    setStatus("Bitte erstellen Sie zuerst die ZIP-Datei.", "error");
    return;
  }

  if (
    typeof navigator.share !== "function" ||
    typeof navigator.canShare !== "function"
  ) {
    setStatus(
      "Das direkte Teilen von Dateien wird in diesem Browser nicht unterstützt. " +
      "Bitte speichern Sie die ZIP-Datei und teilen Sie sie über die Dateien-App.",
      "warning"
    );
    return;
  }

  const shareData = {
    files: [generatedZipFile]
  };

  let canShareFiles = false;

  try {
    canShareFiles = navigator.canShare(shareData);
  } catch (error) {
    console.error("Fehler bei navigator.canShare():", error);
  }

  if (!canShareFiles) {
    setStatus(
      "Die ZIP-Datei kann aus diesem Browser nicht direkt geteilt werden. " +
      "Bitte speichern Sie sie und teilen Sie sie über die Dateien-App.",
      "warning"
    );
    return;
  }

  try {
    setBusy(true);
    setStatus("Teilen-Menü wird geöffnet …", "info");

    await navigator.share(shareData);

    setStatus(
      "Die ZIP-Datei wurde an das iOS-Teilen-Menü übergeben.",
      "success"
    );
  } catch (error) {
    if (error.name === "AbortError") {
      setStatus("Das Teilen wurde abgebrochen.", "info");
      return;
    }

    console.error("Fehler beim Teilen:", error);

    setStatus(
      "Die ZIP-Datei konnte nicht direkt geteilt werden. " +
      "Bitte speichern Sie sie und wählen Sie Boxer über die Dateien-App.",
      "error"
    );
  } finally {
    setBusy(false);
  }
}

  function downloadZip() {
    if (!generatedZipBlob || !generatedZipUrl) {
      setStatus("Bitte erstellen Sie zuerst die ZIP-Datei.", "error");
      return;
    }

    const link = document.createElement("a");

    link.href = generatedZipUrl;
    link.download = generatedZipFile.name;
    link.rel = "noopener";

    document.body.appendChild(link);
    link.click();
    link.remove();

    setStatus(
      "Die ZIP-Datei wurde zum Speichern bereitgestellt. " +
      "Öffnen Sie sie anschließend über die Dateien-App und wählen Sie Boxer.",
      "success"
    );
  }

  function createShareText() {
    const recipient = recipientInput.value.trim();
    const message = messageInput.value.trim();

    const lines = [];

    if (recipient) {
      lines.push(`Empfänger: ${recipient}`);
    }

    if (message) {
      lines.push(message);
    } else {
      lines.push("Anbei die Bilder als ZIP-Datei.");
    }

    return lines.join("\n\n");
  }

  function createZipFileName() {
    const date = new Date();

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `bilder-${year}-${month}-${day}.zip`;
  }

  function createUniqueFileName(originalName, index) {
    const cleanedName = originalName
      .replace(/[\/\\:*?"<>|]/g, "_")
      .trim();

    if (cleanedName.length > 0) {
      return cleanedName;
    }

    return `bild-${index + 1}.jpg`;
  }

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) {
      return "0 Bytes";
    }

    const units = ["Bytes", "KB", "MB", "GB"];
    const unitIndex = Math.min(
      Math.floor(Math.log(bytes) / Math.log(1024)),
      units.length - 1
    );

    const value = bytes / Math.pow(1024, unitIndex);
    const decimals = unitIndex === 0 ? 0 : 2;

    return `${value.toFixed(decimals)} ${units[unitIndex]}`;
  }

  function setStatus(message, type = "info") {
    statusText.textContent = message;
    statusBox.className = `status-box status-${type}`;
    statusBox.hidden = false;
  }

  function setBusy(isBusy) {
    createZipButton.disabled = isBusy || selectedFiles.length === 0;
    shareButton.disabled = isBusy || !generatedZipFile;
    downloadButton.disabled = isBusy || !generatedZipBlob;

    createZipButton.classList.toggle("is-loading", isBusy);
  }

  function revokeZipUrl() {
    if (generatedZipUrl) {
      URL.revokeObjectURL(generatedZipUrl);
      generatedZipUrl = null;
    }
  }

  window.addEventListener("beforeunload", revokeZipUrl);
});
