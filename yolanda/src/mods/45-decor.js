// Clinical decor.
// Wall art, service headwalls, signs and the tiered lobby fittings. Assets come from the
// Assessment/Recovery Clinical Identity Kit (models/decor2) and the saved Lobby designs
// (models/upgrades/12_lobby). Placement works on any wall of any room, so rotated or rebuilt rooms
// keep their decor.
(function () {
  const YC = window.YC;
  const D2 = "/models/decor2/";
  const L = "/models/upgrades/12_lobby/";
  YC.DECOR = {
    Art_Heart: D2 + "Clinical_Art_Heart.glb",
    Art_Lungs: D2 + "Clinical_Art_Lungs.glb",
    Art_Airway: D2 + "Clinical_Art_Airway.glb",
    Headwall: D2 + "Clinical_Service_Headwall.glb",
    ExamSet: D2 + "Clinical_Wall_Exam_Set.glb",
    Sign_Assessment: D2 + "Clinical_Sign_Assessment.glb",
    Sign_Bay: D2 + "Clinical_Sign_Bay01.glb",
    Sign_Recovery: D2 + "Clinical_Sign_Recovery.glb",
  };
  for (const t of [1, 2, 3]) {
    YC.DECOR["Lobby_Way_" + t] = L + `lobby_T${t}_wayfinding.glb`;
    YC.DECOR["Lobby_Poster_" + t] = L + `lobby_T${t}_health_poster.glb`;
  }

  YC.probeDecor = () => Promise.allSettled(Object.entries(YC.DECOR).map(async ([n, u]) => { const g = await Nt(u); return n + ':' + !!g.scene; })).then((r) => r.map((x) => x.status + ':' + (x.value ?? String(x.reason?.message ?? x.reason))));
  // The base decor set is loaded once at module start, so load ours separately and re-sync the scene.
  const loadExtra = () =>
    Promise.allSettled(Object.entries(YC.DECOR).map(async ([name, url]) => Os.set(name, (await Nt(url)).scene))).then(() => {
      try {
        YC.controller?.adapter.view.refreshAssets();
      } catch {}
    });
  YC.decorLoaded = loadExtra();

  const OPPOSITE = { N: "S", S: "N", W: "E", E: "W" };

  // Sides of a rectangular room: wall cells and door cells per side, in grid indices.
  function sides(a, room) {
    const cells = room.cells.map($e);
    const x0 = Math.min(...cells.map((c) => c.x)), x1 = Math.max(...cells.map((c) => c.x));
    const y0 = Math.min(...cells.map((c) => c.y)), y1 = Math.max(...cells.map((c) => c.y));
    const edge = (axis, x, y) => a.edges.find((e) => e.axis === axis && e.x === x && e.y === y);
    const out = {};
    const make = (name, axis, fixedX, fixedY, from, to) => {
      const walls = [], doors = [];
      for (let i = from; i <= to; i++) {
        const e = axis === "h" ? edge("h", i, fixedY) : edge("v", fixedX, i);
        if (e?.kind === "door") doors.push(i);
        else if (e?.kind === "wall") walls.push(i);
      }
      out[name] = { name, walls, doors };
    };
    make("N", "h", 0, y0, x0, x1);
    make("S", "h", 0, y1 + 1, x0, x1);
    make("W", "v", x0, 0, y0, y1);
    make("E", "v", x1 + 1, 0, y0, y1);
    return { out, x0, x1, y0, y1 };
  }

  function place(a, geo, side, idx, asset, y = 0, push = 0) {
    const t = a.config.cellSize, i = a.config.wallThickness / 2 + 0.006 + push;
    const mid = (idx + 0.5) * t;
    if (side === "N") return { asset, x: mid, y, z: geo.y0 * t + i, yaw: 0 };
    if (side === "S") return { asset, x: mid, y, z: (geo.y1 + 1) * t - i, yaw: Math.PI };
    if (side === "W") return { asset, x: geo.x0 * t + i, y, z: mid, yaw: Math.PI / 2 };
    return { asset, x: (geo.x1 + 1) * t - i, y, z: mid, yaw: -Math.PI / 2 };
  }

  const deskTier = (a, room) => {
    const d = a.objects.find((o) => (o.asset === "reception-equipped" || o.asset === "reception") && room.cells.includes(F(o)));
    return Math.max(1, Math.min(3, d?.tier ?? 1));
  };

  // Decor only goes on walls that stay full height in the default camera (north, and west when the
  // wall is not shared with the room next door); the near walls are cut away.
  function clinicalDecor(a) {
    const items = [];
    for (const room of a.rooms) {
      const asm = a.assemblies?.find((m) => m.roomId === room.id);
      const fn = room.function;
      if (!["Assessment", "Recovery", "Reception"].includes(fn)) continue;
      if (asm && !["assessment", "recovery", "lobby-starter", "lobby-a", "lobby-b"].includes(asm.templateId)) continue;
      const { out: s, ...geo } = sides(a, room);
      const N = s.N;
      const put = (side, idx, asset, y = 0, push = 0) => items.push(place(a, geo, side, idx, asset, y, push));
      if (fn === "Assessment") {
        const w = N.walls;
        const want = ["Art_Heart", "Art_Lungs", "Art_Airway", "ExamSet"];
        // spread over the wall cells that are not doors
        const pick = w.length > 4 ? [w[0], w[1], w[w.length - 1], w[w.length - 2]] : w.slice(0, 4);
        pick.forEach((idx, n) => put("N", idx, want[n]));
        N.doors.length && put("N", N.doors.reduce((p, q) => p + q, 0) / N.doors.length, "Sign_Assessment");
      }
      if (fn === "Recovery") {
        for (const o of a.objects.filter((o) => o.asset === "patient" && room.cells.includes(F(o)))) {
          const cs = Ht(o);
          if (Math.min(...cs.map((c) => c.y)) !== geo.y0) continue;
          const cx = cs.reduce((p, c) => p + c.x, 0) / cs.length;
          if (!N.walls.includes(Math.round(cx - 0.01))) continue;
          put("N", cx, "Headwall");
          put("N", cx, "Sign_Bay");
        }
        N.doors.length && put("N", N.doors.reduce((p, q) => p + q, 0) / N.doors.length, "Sign_Recovery");
      }
      if (fn === "Reception") {
        const tier = deskTier(a, room);
        const desk = a.objects.find((o) => (o.asset === "reception-equipped" || o.asset === "reception") && room.cells.includes(F(o)));
        if (desk) {
          const cs = Ht(desk);
          const cx = cs.reduce((p, c) => p + c.x, 0) / cs.length;
          if (N.walls.includes(Math.round(cx - 0.01))) put("N", cx, "Lobby_Way_" + tier, 1.9, 0.01);
        }
        const west = s.W.walls.filter((y) => {
          const nb = a.rooms.find((r) => r.cells.includes(F({ x: geo.x0 - 1, y })));
          return !nb;
        });
        if (west.length >= 3) put("W", west[Math.floor(west.length / 2)], "Lobby_Poster_" + tier, 1.75, 0.01);
      }
    }
    return items;
  }

  YC.debugDecor = (build) => ({ items: clinicalDecor(build), loaded: Object.keys(YC.DECOR).filter((k) => Os.has(k)) });
  // Lobby floor follows the desk tier: plain beige starter, pale checker standard, blue checker advanced.
  const LOBBY_FLOOR = { 1: [0xd9d1ba, 0xd3cab2], 2: [0xc9e1ea, 0xece6d4], 3: [0x86c6de, 0xefe8d6] };
  YC.lobbyFloor = (a, asm) => {
    const room = a.rooms.find((r) => r.id === asm.roomId) ?? { cells: asm.cells };
    return LOBBY_FLOOR[deskTier(a, room)];
  };
  const baseFb = Fb;
  Fb = function (a) {
    let base = [];
    try {
      base = baseFb(a);
    } catch (err) {
      console.warn("decor", err);
    }
    try {
      return [...base, ...clinicalDecor(a)];
    } catch (err) {
      console.warn("clinical decor", err);
      return base;
    }
  };
})();
