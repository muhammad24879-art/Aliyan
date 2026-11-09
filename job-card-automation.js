(() => {
  const DRAFT_KEY = "sc-job-card-draft";

  const number = (value) => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const format = (value) =>
    Number.isFinite(value)
      ? value.toLocaleString(undefined, {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        })
      : "—";

  const field = (key) =>
    document.querySelector(`[data-k="${key}"]`);

  // Assumption: the paper sheet length is C + R inches.
  // Change this function if your plant uses a different sheet-size formula.
  const getSheetLengthInches = () =>
    number(field("cInch")?.value) + number(field("rInch")?.value);

  function calculate() {
    const sheetQty = number(field("sheetQty")?.value);
    const ups = number(field("ups")?.value);
    const wastage = number(field("wastage")?.value);
    const cartonQty = sheetQty * ups;

    const cartonQtyDisplay = document.querySelector("#cq");
    if (cartonQtyDisplay) {
      cartonQtyDisplay.textContent = format(cartonQty);
    }

    const sheetLengthInches = getSheetLengthInches();
    const wastageMultiplier = 1 + wastage / 100;
    let totalOpen = 0;
    let totalRequired = 0;
    let totalClose = 0;

    document.querySelectorAll("#lines tbody tr").forEach((row) => {
      const rowIndex = row.querySelector("[data-i]")?.dataset.i;
      if (rowIndex === undefined) return;

      const getValue = (name) =>
        number(row.querySelector(`[data-i="${rowIndex}"][data-l="${name}"]`)?.value);

      const reelWidthInches = getValue("reel");
      const gsm = getValue("gsm");
      const takeUp = getValue("takeUp");
      const normalizedTakeUp = Number.isFinite(takeUp) && takeUp > 0 ? takeUp : 1;
      const openBalance = getValue("open");

      // kg = area (m²) × GSM (g/m²) ÷ 1000 × quantity × take-up.
      // Inches are converted to metres; wastage is included.
      const hasMaterialInputs =
        sheetQty > 0 &&
        sheetLengthInches > 0 &&
        reelWidthInches > 0 &&
        gsm > 0;

      const requiredKg = hasMaterialInputs
        ? reelWidthInches *
          0.0254 *
          sheetLengthInches *
          0.0254 *
          gsm /
          1000 *
          sheetQty *
          normalizedTakeUp *
          wastageMultiplier
        : null;

      const requiredDisplay = document.querySelector(`#rq${rowIndex}`);
      const closeDisplay = document.querySelector(`#cl${rowIndex}`);
      const statusDisplay = document.querySelector(`#st${rowIndex}`);

      if (requiredKg === null) {
        if (requiredDisplay) requiredDisplay.textContent = "—";
        if (closeDisplay) closeDisplay.textContent = "—";
        if (statusDisplay) {
          statusDisplay.textContent = "";
          statusDisplay.className = "";
        }
        totalOpen += openBalance;
        return;
      }

      const closeBalance = openBalance - requiredKg;

      if (requiredDisplay) requiredDisplay.textContent = format(requiredKg);
      if (closeDisplay) closeDisplay.textContent = format(closeBalance);

      if (statusDisplay) {
        const hasOpenBalance = openBalance > 0;

        statusDisplay.textContent = hasOpenBalance
          ? closeBalance < 0
            ? "Short"
            : "OK"
          : "";
        statusDisplay.className = hasOpenBalance
          ? closeBalance < 0
            ? "status-short"
            : "status-ok"
          : "";
      }

      totalOpen += openBalance;
      totalRequired += requiredKg;
      totalClose += closeBalance;
    });

    const setText = (selector, value) => {
      const element = document.querySelector(selector);
      if (element) element.textContent = format(value);
    };

    setText("#tO", totalOpen);
    setText("#tR", totalRequired);
    setText("#tC", totalClose);
  }

  function saveDraft() {
    const values = {};

    document
      .querySelectorAll("[data-k], [data-i][data-l]")
      .forEach((element) => {
        const key = element.dataset.k
          ? `field:${element.dataset.k}`
          : `row:${element.dataset.i}:${element.dataset.l}`;

        values[key] = element.value;
      });

    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(values));
    } catch (error) {
      console.warn("Could not save the job-card draft.", error);
    }
  }

  function restoreDraft() {
    try {
      const values = JSON.parse(localStorage.getItem(DRAFT_KEY) || "{}");

      document
        .querySelectorAll("[data-k], [data-i][data-l]")
        .forEach((element) => {
          const key = element.dataset.k
            ? `field:${element.dataset.k}`
            : `row:${element.dataset.i}:${element.dataset.l}`;

          if (Object.hasOwn(values, key)) {
            element.value = values[key];
          }
        });
    } catch (error) {
      console.warn("Could not restore the job-card draft.", error);
    }
  }

  // Restore saved values, then calculate the initial totals.
  restoreDraft();
  calculate();

  // Recalculate and save a draft as the user edits the form.
  document.addEventListener("input", (event) => {
    if (event.target.matches("[data-k], [data-i][data-l]")) {
      calculate();
      saveDraft();
    }
  });

  document.addEventListener("change", (event) => {
    if (event.target.matches("[data-k], [data-i][data-l]")) {
      calculate();
      saveDraft();
    }
  });

  // Recalculate after adding or removing material rows.
  document.querySelector("#lines")?.addEventListener("click", () => {
    setTimeout(() => {
      calculate();
      saveDraft();
    }, 0);
  });

  // Clear the saved draft after a successful save, if the app shows a
  // success message inside #errs. Adjust this selector to match your app.
  const errors = document.querySelector("#errs");
  if (errors) {
    new MutationObserver(() => {
      if (/saved successfully|job card saved/i.test(errors.textContent)) {
        localStorage.removeItem(DRAFT_KEY);
      }
    }).observe(errors, { childList: true, subtree: true, characterData: true });
  }
})();