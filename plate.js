"use strict";

// Names the cell line behind a circle in the introduction's figure.
const plate = document.querySelector("#label-plate");

if (plate) {
  const readout = plate.querySelector(".plate-readout");
  const resting = readout.innerHTML;
  let picked = null;

  const show = well => {
    readout.textContent = well.dataset.line;
    readout.classList.add("is-live");
  };
  const rest = () => {
    if (picked) return show(picked);
    readout.innerHTML = resting;
    readout.classList.remove("is-live");
  };
  const wellAt = event => event.target.closest(".wells .well");

  plate.addEventListener("pointerover", event => {
    const well = wellAt(event);
    if (well) show(well);
  });
  plate.addEventListener("pointerout", event => {
    if (wellAt(event)) rest();
  });
  plate.addEventListener("click", event => {
    const well = wellAt(event);
    picked?.classList.remove("is-picked");
    picked = well && well !== picked ? well : null;
    picked?.classList.add("is-picked");
    rest();
  });
}
