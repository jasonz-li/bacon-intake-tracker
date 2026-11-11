/* Bacon Intake Tracker — a free, local-first calorie & macro tracker. */
(() => {
  "use strict";

  // ---------- Storage ----------
  const KEY = "bacon-intake-v1";
  const MEALS = ["Breakfast", "Lunch", "Dinner", "Snacks"];
  const defaults = () => ({
    goals: { calories: 2000, protein: 30, carbs: 40, fat: 30, water: 8, macroMode: "pct" },
    profile: { unit: "imperial" },
    days: {},
    foods: [],
    savedMeals: [],
    weights: [],
  });

  let state;
  try {
    state = Object.assign(defaults(), JSON.parse(localStorage.getItem(KEY)) || {});
  } catch {
    state = defaults();
  }
  const save = () => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { toast("Couldn't save — storage full?"); }
  };

  // ---------- Helpers ----------
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
  const r0 = (n) => Math.round(n);
  const r1 = (n) => Math.round(n * 10) / 10;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const iso = (d) => { const z = new Date(d); z.setMinutes(z.getMinutes() - z.getTimezoneOffset()); return z.toISOString().slice(0, 10); };
  const fromIso = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = fromIso(s); d.setDate(d.getDate() + n); return iso(d); };
  const today = () => iso(new Date());

  let current = today();

  const day = (date = current, create = false) => {
    let d = state.days[date];
    if (!d && create) {
      d = state.days[date] = { meals: Object.fromEntries(MEALS.map((m) => [m, []])), exercise: [], water: 0, notes: "" };
    }
    return d || { meals: Object.fromEntries(MEALS.map((m) => [m, []])), exercise: [], water: 0, notes: "" };
  };

  // Each entry: { id, name, serving, qty, cal, p, c, f } where cal/p/c/f are PER serving.
  const entryTotals = (e) => ({ cal: e.cal * e.qty, p: e.p * e.qty, c: e.c * e.qty, f: e.f * e.qty });
  const sum = (list) => list.reduce((a, e) => { const t = entryTotals(e); a.cal += t.cal; a.p += t.p; a.c += t.c; a.f += t.f; return a; }, { cal: 0, p: 0, c: 0, f: 0 });
  const dayTotals = (date) => sum(Object.values(day(date).meals).flat());
  const exerciseTotal = (date) => day(date).exercise.reduce((a, x) => a + num(x.cal), 0);
  const hasLog = (date) => { const d = state.days[date]; return !!d && (Object.values(d.meals).some((m) => m.length) || d.exercise.length > 0); };

  // Goals in grams regardless of mode
  const macroGrams = () => {
    const g = state.goals;
    if (g.macroMode === "pct") {
      return { p: (g.calories * g.protein) / 100 / 4, c: (g.calories * g.carbs) / 100 / 4, f: (g.calories * g.fat) / 100 / 9 };
    }
    return { p: g.protein, c: g.carbs, f: g.fat };
  };

  let toastTimer;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), 2200);
  }

  // ---------- Navigation ----------
  $$(".tabbar button").forEach((b) =>
    b.addEventListener("click", () => {
      $$(".tabbar button").forEach((x) => x.classList.toggle("on", x === b));
      $$(".view").forEach((v) => v.classList.toggle("active", v.id === "view-" + b.dataset.view));
      $("#datenav").style.visibility = b.dataset.view === "diary" ? "visible" : "hidden";
      render();
      window.scrollTo(0, 0);
    })
  );

  $("#prevDay").onclick = () => { current = addDays(current, -1); render(); };
  $("#nextDay").onclick = () => { current = addDays(current, 1); render(); };
  $("#datePicker").onchange = (e) => { if (e.target.value) { current = e.target.value; render(); } };

  function dateLabel(s) {
    const t = today();
    if (s === t) return "Today";
    if (s === addDays(t, -1)) return "Yesterday";
    if (s === addDays(t, 1)) return "Tomorrow";
    return fromIso(s).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  }

  // ---------- Diary ----------
  function renderDiary() {
    $("#dateLabel").textContent = dateLabel(current);
    $("#datePicker").value = current;
    const d = day();
    const tot = dayTotals(current);
    const ex = exerciseTotal(current);
    const goal = state.goals.calories;
    const remaining = goal - tot.cal + ex;

    $("#sumGoal").textContent = r0(goal);
    $("#sumFood").textContent = r0(tot.cal);
    $("#sumExercise").textContent = r0(ex);
    $("#sumRemaining").textContent = r0(remaining);
    $("#sumRemaining").parentElement.classList.toggle("over", remaining < 0);

    const budget = goal + ex;
    const pct = budget > 0 ? tot.cal / budget : 0;
    const ring = $("#calRing");
    ring.style.strokeDashoffset = 314.16 * (1 - Math.min(pct, 1));
    ring.classList.toggle("over", pct > 1);
    $("#ringPct").textContent = r0(pct * 100) + "%";

    const mg = macroGrams();
    const macros = [
      ["Protein", tot.p, mg.p, "var(--protein)"],
      ["Carbs", tot.c, mg.c, "var(--carbs)"],
      ["Fat", tot.f, mg.f, "var(--fat)"],
    ];
    $("#macroBars").innerHTML = macros
      .map(([name, have, want, color]) => {
        const left = want - have;
        const w = want > 0 ? Math.min(100, (have / want) * 100) : 0;
        return `<div class="macro ${left < 0 ? "over" : ""}">
          <div class="name"><span>${name}</span><span>${r0(have)}/${r0(want)}g</span></div>
          <div class="bar"><i style="width:${w}%;background:${color}"></i></div>
          <div class="left">${left >= 0 ? r0(left) + "g left" : r0(-left) + "g over"}</div>
        </div>`;
      })
      .join("");

    // Meals
    $("#meals").innerHTML = MEALS.map((m) => {
      const list = d.meals[m] || [];
      const t = sum(list);
      const items = list.length
        ? list.map((e) => {
            const et = entryTotals(e);
            return `<li data-meal="${m}" data-id="${e.id}">
              <div class="main" data-act="edit">
                <div class="title">${esc(e.name)}</div>
                <div class="sub">${e.serving || e.qty !== 1 ? (e.qty !== 1 ? r1(e.qty) + " × " : "") + esc(e.serving || "serving") + " · " : ""}P ${r1(et.p)} · C ${r1(et.c)} · F ${r1(et.f)}</div>
              </div>
              <span class="kcal">${r0(et.cal)}</span>
              <button class="del" data-act="del" aria-label="Remove">✕</button>
            </li>`;
          }).join("")
        : `<li class="empty">Nothing logged yet</li>`;
      return `<div class="card">
        <div class="card-head"><h2>${m}</h2><span class="muted">${r0(t.cal)} kcal</span></div>
        <ul class="entries">${items}</ul>
        <div class="row" style="justify-content:space-between;flex-wrap:wrap">
          <button class="add" data-add="${m}">+ Add food</button>
          <span>
            <button class="link" data-copy="${m}">Copy from yesterday</button>
            ${list.length ? `<button class="link" data-savemeal="${m}">Save as meal</button>` : ""}
          </span>
        </div>
      </div>`;
    }).join("");

    // Exercise
    $("#exTotal").textContent = r0(ex) + " kcal";
    $("#exerciseList").innerHTML = d.exercise.length
      ? d.exercise.map((x) => `<li data-id="${x.id}">
          <div class="main"><div class="title">${esc(x.name)}</div><div class="sub">${x.min ? r0(x.min) + " min" : ""}</div></div>
          <span class="kcal">${r0(x.cal)}</span>
          <button class="del" data-act="delex" aria-label="Remove">✕</button>
        </li>`).join("")
      : `<li class="empty">No exercise logged</li>`;

    // Water
    const wg = state.goals.water || 8;
    $("#waterLabel").textContent = `${d.water} / ${wg} cups`;
    $("#waterCups").innerHTML = Array.from({ length: Math.max(wg, d.water) }, (_, i) => `<div class="cup ${i < d.water ? "full" : ""}"></div>`).join("");

    const notes = $("#dayNotes");
    if (document.activeElement !== notes) notes.value = d.notes || "";
  }

  $("#meals").addEventListener("click", (e) => {
    const t = e.target;
    if (t.dataset.add) return openFoodDialog(t.dataset.add);
    if (t.dataset.copy) return copyMeal(t.dataset.copy);
    if (t.dataset.savemeal) return saveMeal(t.dataset.savemeal);
    const li = t.closest("li[data-id]");
    if (!li) return;
    const act = t.closest("[data-act]")?.dataset.act;
    const list = day(current, true).meals[li.dataset.meal];
    const idx = list.findIndex((x) => x.id === li.dataset.id);
    if (idx < 0) return;
    if (act === "del") {
      const [removed] = list.splice(idx, 1);
      save(); render();
      toast(`Removed ${removed.name}`);
    } else if (act === "edit") {
      const entry = list[idx];
      const q = prompt(`Servings of “${entry.name}” (${entry.serving || "serving"}):`, entry.qty);
      if (q === null) return;
      const n = num(q);
      if (n <= 0) list.splice(idx, 1); else entry.qty = n;
      save(); render();
    }
  });

  function copyMeal(meal) {
    const src = day(addDays(current, -1)).meals[meal] || [];
    if (!src.length) return toast(`Nothing in yesterday's ${meal.toLowerCase()}`);
    const dst = day(current, true).meals[meal];
    src.forEach((e) => dst.push({ ...e, id: uid() }));
    save(); render();
    toast(`Copied ${src.length} item(s)`);
  }

  function saveMeal(meal) {
    const list = day().meals[meal];
    const name = prompt("Name this meal:", `My ${meal.toLowerCase()}`);
    if (!name) return;
    state.savedMeals.push({ id: uid(), name, items: list.map((e) => ({ ...e })) });
    save(); render();
    toast("Meal saved");
  }

  $("#exerciseList").addEventListener("click", (e) => {
    if (e.target.dataset.act !== "delex") return;
    const id = e.target.closest("li").dataset.id;
    const d = day(current, true);
    d.exercise = d.exercise.filter((x) => x.id !== id);
    save(); render();
  });

  $("#waterPlus").onclick = () => { day(current, true).water++; save(); render(); };
  $("#waterMinus").onclick = () => { const d = day(current, true); d.water = Math.max(0, d.water - 1); save(); render(); };
  $("#dayNotes").addEventListener("input", (e) => { day(current, true).notes = e.target.value; save(); });

  // ---------- Add food dialog ----------
  const foodDlg = $("#foodDialog");
  let targetMeal = "Breakfast";

  function setFoodTab(tab) {
    $$("#foodTabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === tab));
    $$("#foodDialog .tab").forEach((t) => (t.hidden = t.dataset.tab !== tab));
    if (tab === "mine") renderMine();
  }
  $$("#foodTabs button").forEach((b) => (b.onclick = () => setFoodTab(b.dataset.tab)));

  function openFoodDialog(meal) {
    targetMeal = meal;
    $("#foodDlgTitle").textContent = `Add to ${meal}`;
    clearManual();
    ["#qCal", "#qP", "#qC", "#qF"].forEach((s) => ($(s).value = ""));
    setFoodTab(state.foods.length || state.savedMeals.length ? "mine" : "search");
    foodDlg.showModal();
  }
  foodDlg.addEventListener("close", stopScan);

  function addEntry(e, meal = targetMeal) {
    day(current, true).meals[meal].push({ id: uid(), name: e.name, serving: e.serving || "", qty: num(e.qty) || 1, cal: num(e.cal), p: num(e.p), c: num(e.c), f: num(e.f) });
    save(); render();
  }

  function rememberFood(f) {
    const key = (f.name + "|" + f.serving).toLowerCase();
    const existing = state.foods.find((x) => (x.name + "|" + x.serving).toLowerCase() === key);
    const data = { name: f.name, serving: f.serving || "", cal: num(f.cal), p: num(f.p), c: num(f.c), f: num(f.f) };
    if (existing) Object.assign(existing, data, { used: Date.now() });
    else state.foods.push({ id: uid(), ...data, used: Date.now() });
  }

  // Manual
  function clearManual() {
    ["#fName", "#fServing", "#fCal", "#fP", "#fC", "#fF"].forEach((s) => ($(s).value = ""));
    $("#fQty").value = 1;
    $("#fSave").checked = true;
    $("#fCalcHint").textContent = "";
  }
  function fillManual(f) {
    $("#fName").value = f.name || "";
    $("#fServing").value = f.serving || "";
    $("#fCal").value = f.cal != null ? r0(f.cal) : "";
    $("#fP").value = f.p != null ? r1(f.p) : "";
    $("#fC").value = f.c != null ? r1(f.c) : "";
    $("#fF").value = f.f != null ? r1(f.f) : "";
    $("#fQty").value = 1;
    updateCalcHint();
    setFoodTab("manual");
  }
  function updateCalcHint() {
    const est = num($("#fP").value) * 4 + num($("#fC").value) * 4 + num($("#fF").value) * 9;
    $("#fCalcHint").textContent = est > 0 ? `Macros add up to ~${r0(est)} kcal per serving${!$("#fCal").value ? " (used if calories left blank)" : ""}.` : "";
  }
  ["#fP", "#fC", "#fF", "#fCal"].forEach((s) => $(s).addEventListener("input", updateCalcHint));

  $("#fAdd").onclick = () => {
    const name = $("#fName").value.trim();
    if (!name) { $("#fName").focus(); return toast("Give it a name"); }
    const p = num($("#fP").value), c = num($("#fC").value), f = num($("#fF").value);
    const cal = $("#fCal").value !== "" ? num($("#fCal").value) : p * 4 + c * 4 + f * 9;
    const food = { name, serving: $("#fServing").value.trim(), cal, p, c, f, qty: num($("#fQty").value) || 1 };
    if ($("#fSave").checked) rememberFood(food);
    addEntry(food);
    foodDlg.close();
    toast(`Added ${name}`);
  };

  // Quick add
  $("#qAdd").onclick = () => {
    const p = num($("#qP").value), c = num($("#qC").value), f = num($("#qF").value);
    const cal = $("#qCal").value !== "" ? num($("#qCal").value) : p * 4 + c * 4 + f * 9;
    if (!cal && !p && !c && !f) return toast("Enter at least one number");
    addEntry({ name: "Quick add", serving: "", cal, p, c, f, qty: 1 });
    foodDlg.close();
    toast(`Quick added ${r0(cal)} kcal`);
  };

  // My foods (in dialog)
  function renderMine() {
    const q = $("#mineFilter").value.trim().toLowerCase();
    const meals = state.savedMeals.filter((m) => m.name.toLowerCase().includes(q));
    const foods = [...state.foods].filter((f) => f.name.toLowerCase().includes(q)).sort((a, b) => (b.used || 0) - (a.used || 0));
    const mealHtml = meals.map((m) => {
      const t = sum(m.items);
      return `<li data-meal-id="${m.id}">
        <div class="main"><div class="title">🍽️ ${esc(m.name)}</div><div class="sub">${m.items.length} items · P ${r1(t.p)} · C ${r1(t.c)} · F ${r1(t.f)}</div></div>
        <span class="kcal">${r0(t.cal)}</span><button class="pick" type="button" data-act="meal">+</button></li>`;
    }).join("");
    const foodHtml = foods.map((f) => `<li data-food-id="${f.id}">
        <div class="main" data-act="custom"><div class="title">${esc(f.name)}</div><div class="sub">${esc(f.serving || "serving")} · P ${r1(f.p)} · C ${r1(f.c)} · F ${r1(f.f)}</div></div>
        <span class="kcal">${r0(f.cal)}</span><button class="pick" type="button" data-act="add">+</button></li>`).join("");
    $("#mineList").innerHTML = mealHtml + foodHtml || `<li class="empty">No saved foods yet. Search or add one manually.</li>`;
  }
  $("#mineFilter").addEventListener("input", renderMine);
  $("#mineList").addEventListener("click", (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    const li = e.target.closest("li");
    if (!act || !li) return;
    if (act === "meal") {
      const m = state.savedMeals.find((x) => x.id === li.dataset.mealId);
      m.items.forEach((it) => addEntry(it));
      foodDlg.close();
      return toast(`Added ${m.name}`);
    }
    const f = state.foods.find((x) => x.id === li.dataset.foodId);
    if (!f) return;
    if (act === "add") {
      f.used = Date.now();
      addEntry({ ...f, qty: 1 });
      foodDlg.close();
      toast(`Added ${f.name}`);
    } else {
      fillManual(f); // tweak servings before adding
    }
  });

  // Search (Open Food Facts)
  const OFF = "https://world.openfoodfacts.org";
  function offToFood(p) {
    const n = p.nutriments || {};
    const kcal = (k) => n[`energy-kcal_${k}`] ?? (n[`energy_${k}`] != null ? n[`energy_${k}`] / 4.184 : undefined);
    const name = [p.product_name || p.generic_name || "Unnamed", p.brands ? `(${p.brands.split(",")[0].trim()})` : ""].join(" ").trim();
    if (p.serving_size && kcal("serving") != null) {
      return { name, serving: p.serving_size, cal: kcal("serving"), p: n.proteins_serving || 0, c: n.carbohydrates_serving || 0, f: n.fat_serving || 0 };
    }
    return { name, serving: "100 g", cal: kcal("100g") || 0, p: n.proteins_100g || 0, c: n.carbohydrates_100g || 0, f: n.fat_100g || 0 };
  }
  let lastResults = [];
  async function doSearch() {
    const q = $("#searchInput").value.trim();
    if (!q) return;
    const out = $("#searchResults");
    out.innerHTML = `<li class="empty">Searching…</li>`;
    try {
      let products;
      if (/^\d{8,14}$/.test(q)) {
        const r = await fetch(`${OFF}/api/v2/product/${q}.json`);
        const j = await r.json();
        products = j.status === 1 ? [j.product] : [];
      } else {
        const r = await fetch(`${OFF}/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=25&fields=product_name,generic_name,brands,serving_size,nutriments`);
        const j = await r.json();
        products = j.products || [];
      }
      lastResults = products.map(offToFood).filter((f) => f.cal > 0 || f.p || f.c || f.f);
      out.innerHTML = lastResults.length
        ? lastResults.map((f, i) => `<li data-i="${i}">
            <div class="main" data-act="custom"><div class="title">${esc(f.name)}</div><div class="sub">${esc(f.serving)} · P ${r1(f.p)} · C ${r1(f.c)} · F ${r1(f.f)}</div></div>
            <span class="kcal">${r0(f.cal)}</span><button class="pick" type="button" data-act="add">+</button></li>`).join("")
        : `<li class="empty">No results. Try another term, or add it manually.</li>`;
    } catch {
      out.innerHTML = `<li class="empty">Search failed — check your connection, or add it manually.</li>`;
    }
  }
  $("#searchBtn").onclick = doSearch;
  $("#searchInput").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); doSearch(); } });
  $("#searchResults").addEventListener("click", (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    const li = e.target.closest("li[data-i]");
    if (!act || !li) return;
    const f = lastResults[li.dataset.i];
    if (act === "add") {
      rememberFood(f);
      addEntry({ ...f, qty: 1 });
      foodDlg.close();
      toast(`Added ${f.name}`);
    } else fillManual(f);
  });

  // Barcode scan. Uses the built-in BarcodeDetector where it exists (Android Chrome),
  // otherwise the bundled ZXing decoder (iPhone Safari has no BarcodeDetector).
  let scanStream = null;
  if (navigator.mediaDevices?.getUserMedia) $("#scanBtn").hidden = false;
  let zxingLoad = null;
  const loadZxing = () =>
    (zxingLoad ||= new Promise((ok, fail) => {
      const sc = document.createElement("script");
      sc.src = "vendor/zxing.min.js";
      sc.onload = () => ok(window.ZXing);
      sc.onerror = () => { zxingLoad = null; fail(new Error("zxing")); };
      document.head.appendChild(sc);
    }));
  async function makeDecoder() {
    if ("BarcodeDetector" in window) {
      try {
        const d = new BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e"] });
        return async (v) => (await d.detect(v))[0]?.rawValue;
      } catch {}
    }
    const Z = await loadZxing();
    const hints = new Map([[Z.DecodeHintType.POSSIBLE_FORMATS, [Z.BarcodeFormat.EAN_13, Z.BarcodeFormat.EAN_8, Z.BarcodeFormat.UPC_A, Z.BarcodeFormat.UPC_E]], [Z.DecodeHintType.TRY_HARDER, true]]);
    const reader = new Z.MultiFormatReader();
    reader.setHints(hints);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    return async (v) => {
      if (!v.videoWidth) return;
      const scale = Math.min(1, 960 / v.videoWidth);
      canvas.width = v.videoWidth * scale; canvas.height = v.videoHeight * scale;
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
      try {
        const bmp = new Z.BinaryBitmap(new Z.HybridBinarizer(new Z.HTMLCanvasElementLuminanceSource(canvas)));
        return reader.decodeWithState(bmp).getText();
      } catch { return undefined; } finally { reader.reset(); }
    };
  }
  $("#scanBtn").onclick = async () => {
    if (scanStream) return stopScan();
    try {
      const decode = await makeDecoder();
      scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1280 } }, audio: false });
      const v = $("#scanVideo");
      v.setAttribute("playsinline", ""); // required on iOS or the video goes fullscreen
      v.srcObject = scanStream; v.hidden = false; await v.play();
      toast("Point the camera at a barcode");
      const tick = async () => {
        if (!scanStream) return;
        const code = await decode(v).catch(() => undefined);
        if (code) {
          if (navigator.vibrate) navigator.vibrate(60);
          $("#searchInput").value = code; stopScan(); return doSearch();
        }
        setTimeout(tick, 120);
      };
      tick();
    } catch { stopScan(); toast("Camera not available — allow camera access in Settings"); }
  };
  function stopScan() {
    if (scanStream) scanStream.getTracks().forEach((t) => t.stop());
    scanStream = null;
    const v = $("#scanVideo"); v.hidden = true; v.srcObject = null;
  }

  // ---------- Exercise dialog ----------
  // MET values; kcal = MET * kg * hours
  const EX = { Walking: 3.5, "Walking (brisk)": 4.3, Running: 9.8, Cycling: 7.5, Swimming: 7, "Weight lifting": 5, HIIT: 8, Yoga: 2.5, Hiking: 6, Elliptical: 5, Rowing: 7, Dancing: 5, Basketball: 6.5, Soccer: 7 };
  $("#exPresets").innerHTML = Object.keys(EX).map((k) => `<option value="${k}">`).join("");
  const exDlg = $("#exDialog");
  $("#addExercise").onclick = () => { $("#exForm").reset(); exDlg.showModal(); };
  const latestKg = () => {
    const w = [...state.weights].sort((a, b) => a.date.localeCompare(b.date)).pop();
    return w ? w.kg : 75;
  };
  function estimateEx() {
    const met = EX[$("#exName").value];
    const min = num($("#exMin").value);
    if (met && min) {
      $("#exCal").value = r0(met * latestKg() * (min / 60));
      $("#exHint").textContent = `Estimated from your latest weight. Edit if your watch says otherwise.`;
    }
  }
  $("#exName").addEventListener("input", estimateEx);
  $("#exMin").addEventListener("input", estimateEx);
  $("#exAdd").onclick = () => {
    const name = $("#exName").value.trim() || "Exercise";
    const cal = num($("#exCal").value);
    if (!cal) return toast("Enter calories burned");
    day(current, true).exercise.push({ id: uid(), name, min: num($("#exMin").value), cal });
    save(); exDlg.close(); render();
  };

  // ---------- Foods view ----------
  $("#newFoodBtn").onclick = () => {
    openFoodDialog(defaultMeal());
    clearManual();
    setFoodTab("manual");
  };
  function defaultMeal() {
    const h = new Date().getHours();
    return h < 11 ? "Breakfast" : h < 15 ? "Lunch" : h < 21 ? "Dinner" : "Snacks";
  }
  function renderFoods() {
    const q = $("#myFoodsFilter").value.trim().toLowerCase();
    const foods = state.foods.filter((f) => f.name.toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name));
    $("#myFoodsList").innerHTML = foods.length
      ? foods.map((f) => `<li data-id="${f.id}">
          <div class="main"><div class="title">${esc(f.name)}</div><div class="sub">${esc(f.serving || "serving")} · P ${r1(f.p)} · C ${r1(f.c)} · F ${r1(f.f)}</div></div>
          <span class="kcal">${r0(f.cal)}</span><button class="del" data-act="delfood" aria-label="Delete">✕</button></li>`).join("")
      : `<li class="empty">Foods you add or search get saved here.</li>`;
    $("#myMealsList").innerHTML = state.savedMeals.length
      ? state.savedMeals.map((m) => {
          const t = sum(m.items);
          return `<li data-id="${m.id}"><div class="main"><div class="title">${esc(m.name)}</div><div class="sub">${m.items.map((i) => esc(i.name)).join(", ")}</div></div>
            <span class="kcal">${r0(t.cal)}</span><button class="del" data-act="delmeal" aria-label="Delete">✕</button></li>`;
        }).join("")
      : `<li class="empty">No saved meals yet.</li>`;
  }
  $("#myFoodsFilter").addEventListener("input", renderFoods);
  $("#myFoodsList").addEventListener("click", (e) => {
    if (e.target.dataset.act !== "delfood") return;
    const id = e.target.closest("li").dataset.id;
    state.foods = state.foods.filter((f) => f.id !== id);
    save(); renderFoods();
  });
  $("#myMealsList").addEventListener("click", (e) => {
    if (e.target.dataset.act !== "delmeal") return;
    const id = e.target.closest("li").dataset.id;
    state.savedMeals = state.savedMeals.filter((m) => m.id !== id);
    save(); renderFoods();
  });

  // ---------- Progress ----------
  const isMetric = () => state.profile.unit === "metric";
  const toDisp = (kg) => (isMetric() ? kg : kg * 2.20462);
  const fromDisp = (v) => (isMetric() ? v : v / 2.20462);
  const wUnit = () => (isMetric() ? "kg" : "lb");

  function barChart(values, labels, goal) {
    const W = 320, H = 160, pad = 22, bw = (W - pad * 2) / values.length;
    const max = Math.max(goal * 1.2, ...values, 1);
    const y = (v) => H - pad - (v / max) * (H - pad * 2);
    const bars = values.map((v, i) => {
      const x = pad + i * bw + bw * 0.18;
      return `<rect class="bar ${v > goal ? "over" : ""}" x="${x}" y="${y(v)}" width="${bw * 0.64}" height="${H - pad - y(v)}" rx="3"><title>${r0(v)} kcal</title></rect>
        <text x="${x + bw * 0.32}" y="${H - 6}" text-anchor="middle">${labels[i]}</text>
        ${v ? `<text x="${x + bw * 0.32}" y="${y(v) - 3}" text-anchor="middle">${r0(v)}</text>` : ""}`;
    }).join("");
    return `<svg viewBox="0 0 ${W} ${H}">${bars}<line class="goal-line" x1="${pad}" x2="${W - pad}" y1="${y(goal)}" y2="${y(goal)}"/><text x="${W - pad}" y="${y(goal) - 3}" text-anchor="end">goal</text></svg>`;
  }

  function lineChart(points) {
    const W = 320, H = 150, pad = 26;
    if (points.length < 2) return `<p class="empty">Log at least two weigh-ins to see a trend.</p>`;
    const vals = points.map((p) => p.v);
    const min = Math.min(...vals), max = Math.max(...vals);
    const span = max - min || 1;
    const t0 = fromIso(points[0].date).getTime(), t1 = fromIso(points[points.length - 1].date).getTime();
    const x = (d) => pad + ((fromIso(d).getTime() - t0) / (t1 - t0 || 1)) * (W - pad * 2);
    const y = (v) => H - pad - ((v - min) / span) * (H - pad * 2);
    const path = points.map((p, i) => `${i ? "L" : "M"}${x(p.date)},${y(p.v)}`).join(" ");
    const dots = points.map((p) => `<circle class="dot" cx="${x(p.date)}" cy="${y(p.v)}" r="3"><title>${p.date}: ${r1(p.v)}</title></circle>`).join("");
    return `<svg viewBox="0 0 ${W} ${H}"><path class="line" d="${path}"/>${dots}
      <text x="4" y="${y(max) + 4}">${r1(max)}</text><text x="4" y="${y(min) + 4}">${r1(min)}</text>
      <text x="${pad}" y="${H - 6}">${fromIso(points[0].date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</text>
      <text x="${W - pad}" y="${H - 6}" text-anchor="end">${fromIso(points[points.length - 1].date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</text></svg>`;
  }

  function renderProgress() {
    const t = today();
    const dates = Array.from({ length: 7 }, (_, i) => addDays(t, i - 6));
    const totals = dates.map(dayTotals);
    const cals = totals.map((x) => x.cal);
    const labels = dates.map((d) => fromIso(d).toLocaleDateString(undefined, { weekday: "narrow" }));
    $("#calChart").innerHTML = barChart(cals, labels, state.goals.calories);
    const logged = dates.filter(hasLog);
    const avg = (k) => logged.length ? totals.filter((_, i) => hasLog(dates[i])).reduce((a, x) => a + x[k], 0) / logged.length : 0;
    $("#avgCal").textContent = logged.length ? `avg ${r0(avg("cal"))} kcal` : "";

    const mg = macroGrams();
    $("#macroAvg").innerHTML = logged.length
      ? [["Protein", avg("p"), mg.p, "var(--protein)"], ["Carbs", avg("c"), mg.c, "var(--carbs)"], ["Fat", avg("f"), mg.f, "var(--fat)"]]
          .map(([n, have, want, col]) => `<div class="macro" style="margin-bottom:10px"><div class="name"><span>${n}</span><span>${r0(have)} / ${r0(want)} g</span></div>
            <div class="bar"><i style="width:${want ? Math.min(100, (have / want) * 100) : 0}%;background:${col}"></i></div></div>`).join("")
      : `<p class="empty">Log some food to see averages.</p>`;

    // Weight
    $("#weightUnitLabel").textContent = wUnit();
    const ws = [...state.weights].sort((a, b) => a.date.localeCompare(b.date));
    $("#weightChart").innerHTML = lineChart(ws.map((w) => ({ date: w.date, v: toDisp(w.kg) })));
    if (ws.length >= 2) {
      const d = toDisp(ws[ws.length - 1].kg) - toDisp(ws[0].kg);
      $("#weightDelta").textContent = `${d > 0 ? "+" : ""}${r1(d)} ${wUnit()} total`;
    } else $("#weightDelta").textContent = "";
    $("#weightList").innerHTML = ws.slice(-10).reverse().map((w) => `<li data-date="${w.date}">
      <div class="main"><div class="title">${r1(toDisp(w.kg))} ${wUnit()}</div><div class="sub">${dateLabel(w.date)}</div></div>
      <button class="del" data-act="delw" aria-label="Delete">✕</button></li>`).join("");

    // Streak
    let s = 0, d = hasLog(t) ? t : addDays(t, -1);
    while (hasLog(d)) { s++; d = addDays(d, -1); }
    $("#streak").textContent = s;
  }
  $("#weightForm").onsubmit = (e) => {
    e.preventDefault();
    const v = num($("#weightInput").value);
    if (v <= 0) return;
    const date = today();
    state.weights = state.weights.filter((w) => w.date !== date);
    state.weights.push({ date, kg: fromDisp(v) });
    $("#weightInput").value = "";
    save(); renderProgress();
    toast("Weight logged");
  };
  $("#weightList").addEventListener("click", (e) => {
    if (e.target.dataset.act !== "delw") return;
    const date = e.target.closest("li").dataset.date;
    state.weights = state.weights.filter((w) => w.date !== date);
    save(); renderProgress();
  });

  // ---------- Goals ----------
  function renderGoals() {
    const g = state.goals;
    $("#goalCalories").value = g.calories;
    $("#goalProtein").value = r0(g.protein);
    $("#goalCarbs").value = r0(g.carbs);
    $("#goalFat").value = r0(g.fat);
    $("#goalWater").value = g.water;
    $$("#macroMode button").forEach((b) => b.classList.toggle("on", b.dataset.mode === g.macroMode));
    updateGoalHints();
    const u = state.profile.unit;
    $$("#unitSeg button").forEach((b) => b.classList.toggle("on", b.dataset.unit === u));
    $("#cWeightUnit").textContent = u === "metric" ? "kg" : "lb";
    $("#cHeightUnit").textContent = u === "metric" ? "cm" : "in";
    const pr = state.profile;
    if (pr.sex) $("#cSex").value = pr.sex;
    if (pr.age) $("#cAge").value = pr.age;
    if (pr.activity) $("#cActivity").value = pr.activity;
    if (pr.goal) $("#cGoal").value = pr.goal;
    if (pr.heightCm) $("#cHeight").value = r1(u === "metric" ? pr.heightCm : pr.heightCm / 2.54);
    if (!$("#cWeight").value) {
      const w = [...state.weights].sort((a, b) => a.date.localeCompare(b.date)).pop();
      if (w) $("#cWeight").value = r1(toDisp(w.kg));
    }
  }
  const curMode = () => $("#macroMode button.on").dataset.mode;
  function updateGoalHints() {
    const mode = curMode();
    const cal = num($("#goalCalories").value);
    const P = num($("#goalProtein").value), C = num($("#goalCarbs").value), F = num($("#goalFat").value);
    if (mode === "pct") {
      $("#hintP").textContent = `% · ${r0((cal * P) / 400)}g`;
      $("#hintC").textContent = `% · ${r0((cal * C) / 400)}g`;
      $("#hintF").textContent = `% · ${r0((cal * F) / 900)}g`;
      const tot = P + C + F;
      $("#pctCheck").textContent = tot === 100 ? "✓ Adds up to 100%" : `Adds up to ${r0(tot)}% — should be 100%`;
    } else {
      $("#hintP").textContent = "g";
      $("#hintC").textContent = "g";
      $("#hintF").textContent = "g";
      const kc = P * 4 + C * 4 + F * 9;
      $("#pctCheck").textContent = `Macros = ${r0(kc)} kcal (${cal ? r0((kc / cal) * 100) : 0}% of goal)`;
    }
  }
  ["#goalCalories", "#goalProtein", "#goalCarbs", "#goalFat"].forEach((s) => $(s).addEventListener("input", updateGoalHints));
  $$("#macroMode button").forEach((b) =>
    (b.onclick = () => {
      if (b.classList.contains("on")) return;
      // convert values between % and g so switching doesn't lose the plan
      const cal = num($("#goalCalories").value) || 1;
      const P = num($("#goalProtein").value), C = num($("#goalCarbs").value), F = num($("#goalFat").value);
      if (b.dataset.mode === "g") {
        $("#goalProtein").value = r0((cal * P) / 400); $("#goalCarbs").value = r0((cal * C) / 400); $("#goalFat").value = r0((cal * F) / 900);
      } else {
        $("#goalProtein").value = r0((P * 400) / cal); $("#goalCarbs").value = r0((C * 400) / cal); $("#goalFat").value = r0((F * 900) / cal);
      }
      $$("#macroMode button").forEach((x) => x.classList.toggle("on", x === b));
      updateGoalHints();
    })
  );
  $("#goalsForm").onsubmit = (e) => {
    e.preventDefault();
    const mode = curMode();
    const P = num($("#goalProtein").value), C = num($("#goalCarbs").value), F = num($("#goalFat").value);
    if (mode === "pct" && r0(P + C + F) !== 100) return toast("Macro % must add up to 100");
    state.goals = { calories: num($("#goalCalories").value), protein: P, carbs: C, fat: F, water: num($("#goalWater").value) || 8, macroMode: mode };
    save(); render();
    toast("Goals saved");
  };

  $$("#unitSeg button").forEach((b) =>
    (b.onclick = () => {
      if (b.dataset.unit === state.profile.unit) return;
      const toMetric = b.dataset.unit === "metric";
      const w = num($("#cWeight").value), h = num($("#cHeight").value);
      if (w) $("#cWeight").value = r1(toMetric ? w / 2.20462 : w * 2.20462);
      if (h) $("#cHeight").value = r1(toMetric ? h * 2.54 : h / 2.54);
      state.profile.unit = b.dataset.unit;
      save(); renderGoals();
    })
  );
  $("#calcForm").onsubmit = (e) => {
    e.preventDefault();
    const metric = isMetric();
    const kg = metric ? num($("#cWeight").value) : num($("#cWeight").value) / 2.20462;
    const cm = metric ? num($("#cHeight").value) : num($("#cHeight").value) * 2.54;
    const age = num($("#cAge").value), sex = $("#cSex").value;
    const act = num($("#cActivity").value), adj = num($("#cGoal").value);
    const bmr = 10 * kg + 6.25 * cm - 5 * age + (sex === "m" ? 5 : -161);
    const tdee = bmr * act;
    const floor = sex === "m" ? 1500 : 1200;
    const target = Math.max(floor, r0((tdee + adj) / 10) * 10);
    Object.assign(state.profile, { sex, age, activity: $("#cActivity").value, goal: $("#cGoal").value, heightCm: cm });
    save();
    const res = $("#calcResult");
    res.hidden = false;
    res.innerHTML = `<div>Maintenance: ~${r0(tdee)} kcal/day</div>
      <div>Your target: <strong>${target}</strong> kcal/day</div>
      ${target === floor && tdee + adj < floor ? `<div class="muted small">Capped at a ${floor} kcal minimum.</div>` : ""}
      <button type="button" class="btn small" id="useCalc" style="margin-top:8px">Use as my goal</button>`;
    $("#useCalc").onclick = () => {
      $("#goalCalories").value = target;
      updateGoalHints();
      $("#goalsForm").requestSubmit();
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
  };

  // Data
  $("#exportBtn").onclick = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `bacon-intake-backup-${today()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  $("#importFile").onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!data || typeof data !== "object" || !data.goals || !data.days) throw new Error();
      if (!confirm("Replace all current data with this backup?")) return;
      state = Object.assign(defaults(), data);
      save(); render();
      toast("Backup restored");
    } catch { toast("That file isn't a valid backup"); }
    e.target.value = "";
  };
  $("#resetBtn").onclick = () => {
    if (!confirm("Erase ALL your data? This can't be undone.")) return;
    state = defaults();
    save(); render();
    toast("All data erased");
  };

  // ---------- Render ----------
  function render() {
    const view = $(".view.active").id;
    if (view === "view-diary") renderDiary();
    else if (view === "view-foods") renderFoods();
    else if (view === "view-progress") renderProgress();
    else if (view === "view-goals") renderGoals();
  }

  // Roll over to the new day if the app is left open past midnight
  let lastToday = today();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && today() !== lastToday) {
      if (current === lastToday) current = today();
      lastToday = today();
      render();
    }
  });

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }

  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});

  render();
})();
