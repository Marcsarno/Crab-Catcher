// Equipment upgrades.
// Every core station can be upgraded to a Standard (tier 2) or Advanced (tier 3) model from the
// upgrade kits shipped with the project. Upgrades cost money once and change how a room performs.
(function () {
  const YC = window.YC;
  const K = "/models/upgrades/";
  const defs = [
    ["work", "Anesthesia workstation", K + "02_anesthesia_monitoring/anesthesia_workstation_%.glb"],
    ["endoscopy", "Endoscopy tower", K + "03_endoscopy/endoscopy_tower_%.glb"],
    ["patient", "Procedure stretcher", K + "03_endoscopy/procedure_stretcher_%.glb"],
    ["table", "Operating table", K + "04_surgery/operating_table_%.glb"],
    ["air", "AirReady", K + "06_prep_airway/AirReady_%.glb"],
    ["seda", "SedaPrep", K + "06_prep_airway/SedaPrep_%.glb"],
    ["warm", "ThermaNest", K + "07_warmth_teamwork/ThermaNest_%.glb"],
    ["iv", "IV stand", K + "08_support_equipment/runtime/iv_stand_%.glb"],
    ["supply", "Supply cart", K + "08_support_equipment/runtime/supply_cart_%.glb"],
  ];
  YC.UPGRADE_NAMES = {};
  for (const [asset, name, pattern] of defs) {
    const base = Ur[asset] ?? 200;
    xl["kit-" + asset] = {
      id: "kit-" + asset,
      assets: [asset],
      baseTier: 1,
      modelTier2: true,
      tiers: {
        1: { name, investment: 0 },
        2: { name: "Standard " + name.toLowerCase(), url: pattern.replace("%", "standard"), investment: Math.round((base * 0.6) / 5) * 5 },
        3: { name: "Advanced " + name.toLowerCase(), url: pattern.replace("%", "advanced"), investment: Math.round((base * 1.2) / 5) * 5 },
      },
    };
    YC.UPGRADE_NAMES[asset] = name;
  }

  // What each tier does. speed/prep multiply stage durations, risk multiplies complication chance.
  YC.UPGRADE_FX = {
    work: { 2: { risk: 0.88 }, 3: { risk: 0.75 } },
    endoscopy: { 2: { speed: 0.93 }, 3: { speed: 0.85 } },
    patient: { 2: { speed: 0.97, risk: 0.97 }, 3: { speed: 0.94, risk: 0.92 } },
    table: { 2: { speed: 0.94 }, 3: { speed: 0.88 } },
    seda: { 2: { prep: 0.88 }, 3: { prep: 0.75 } },
    air: { 2: { risk: 0.92 }, 3: { risk: 0.82 } },
    warm: { 2: { risk: 0.94 }, 3: { risk: 0.86 } },
    iv: { 2: { prep: 0.96 }, 3: { prep: 0.92 } },
    supply: { 2: { prep: 0.96 }, 3: { prep: 0.92 } },
  };
  YC.UPGRADE_TEXT = {
    work: ["Safer anesthesia", "12% fewer complications", "25% fewer complications"],
    endoscopy: ["Faster scopes", "Scope cases 7% faster", "Scope cases 15% faster"],
    patient: ["Comfort and safety", "3% faster, slightly safer", "6% faster, 8% safer"],
    table: ["Surgical throughput", "Surgeries 6% faster", "Surgeries 12% faster"],
    seda: ["Quicker prep", "Prep 12% shorter", "Prep 25% shorter"],
    air: ["Airway safety", "8% fewer complications", "18% fewer complications"],
    warm: ["Patient warmth", "6% fewer complications", "14% fewer complications"],
    iv: ["Faster set-up", "Prep 4% shorter", "Prep 8% shorter"],
    supply: ["Faster set-up", "Prep 4% shorter", "Prep 8% shorter"],
  };

  const proto = $n.prototype;
  const roomOf = (sim, p) => (p.roomId ? sim.room(p.roomId) : null);
  const factor = (sim, p, key) => {
    const room = roomOf(sim, p);
    if (!room) return 1;
    let f = 1;
    for (const o of room.objects) {
      const fx = YC.UPGRADE_FX[o.asset]?.[o.tier];
      if (fx?.[key]) f *= fx[key];
    }
    return f;
  };
  proto.upgradeSpeedFactor = function (p) {
    return factor(this, p, "speed");
  };
  proto.upgradePrepFactor = function (p) {
    return factor(this, p, "prep");
  };
  proto.upgradeRiskFactor = function (p) {
    return factor(this, p, "risk");
  };
  // prep shortening uses the same caseDuration hook (wrap again so both factors apply)
  const baseDuration = proto.caseDuration;
  proto.caseDuration = function (p, stage) {
    let d = baseDuration.call(this, p, stage);
    if (this.careerOn() && stage === "prep") d *= this.upgradePrepFactor(p);
    return d;
  };
  proto.upgradedCount = function (tier = 3) {
    return this.build.objects.filter((o) => o.tier === tier && Br(o)).length;
  };

  // ---- UI: upgrade list injected into the room panel -----------------------------------------------------
  const baseQh = Qh;
  Qh = function (target, content) {
    const ctrl = YC.controller;
    if (target?.id === "management-panel" && target.dataset.context === "room" && ctrl?.sim) {
      const room = ctrl.sim.room(ctrl.selectedRoom);
      const items = (room?.objects ?? []).filter((o) => YC.UPGRADE_FX[o.asset]);
      if (items.length) {
        const box = document.createElement("div");
        box.className = "cx-upgrades";
        const rows = items
          .map((o) => {
            const tier = o.tier ?? 1;
            const nm = YC.UPGRADE_NAMES[o.asset];
            const info = YC.UPGRADE_TEXT[o.asset];
            const k = xl["kit-" + o.asset].tiers;
            const label = tier === 3 ? "Advanced" : tier === 2 ? "Standard" : "Starter";
            const btn = (t) =>
              `<button data-cx-upg="${o.id}" data-tier="${t}" ${ctrl.sim.state.funds < k[t].investment - k[tier].investment ? "disabled" : ""}>${t === 2 ? "Standard" : "Advanced"} · ${kt(k[t].investment - k[tier].investment)}<small>${He(info[t - 1])}</small></button>`;
            return `<div class="cx-card"><div class="cx-row"><h5>${He(nm)}</h5><span class="cx-pill">${label}</span></div>
              <div class="cx-meta">${tier >= 3 ? "✓ " + He(info[2]) : tier === 2 ? "✓ " + He(info[1]) : He(info[0])}</div>
              ${tier >= 3 ? "" : `<div class="cx-actions">${tier < 2 ? btn(2) : ""}${btn(3)}</div>`}</div>`;
          })
          .join("");
        box.innerHTML = `<h4>Equipment upgrades</h4>${rows}`;
        content.append(box);
      }
    }
    return baseQh(target, content);
  };

  document.addEventListener("click", (ev) => {
    const el = ev.target.closest?.("[data-cx-upg]");
    const ctrl = YC.controller;
    if (!el || !ctrl) return;
    ev.preventDefault();
    const tier = Number(el.dataset.tier);
    const sim = ctrl.sim;
    const h = sim.build;
    const p = h.objects.find((o) => o.id === el.dataset.cxUpg);
    if (!p) return;
    const m = qn(h, { type: "place", object: { ...p, tier }, movingId: p.id }, Ni);
    const err = m.error ?? ctrl.protect(m.state) ?? ctrl.previewCost(h, m.state);
    if (err) return ctrl.adapter.message(err, true);
    ctrl.adapter.history.replace(m.state);
    ctrl.edited(h, m.state);
    ctrl.adapter.refresh();
    ctrl.renderPanel();
    sim.careerNotice?.(`${YC.UPGRADE_NAMES[p.asset]} upgraded to ${tier === 3 ? "Advanced" : "Standard"}: ${YC.UPGRADE_TEXT[p.asset][tier - 1]}.`, "good");
    ctrl.adapter.message(`${YC.UPGRADE_NAMES[p.asset]} upgraded: ${YC.UPGRADE_TEXT[p.asset][tier - 1]}.`);
  });
})();
