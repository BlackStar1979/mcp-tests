# Pressure Hypergraph Calculus (PHC) — Framework Eksperymentalny

> **Status:** Hipoteza robocza, wersja 0.1  
> **Data:** 2026-06-07  
> **Kontekst:** Autonomiczny system wieloagentowy, LAB mcp-tests  
> **Powiązane:** `_docs/sqlite-vec-upgrade/IMPLEMENTATION.md`, handbook L7/L9/L10

---

## 1. Hipoteza

### 1.1 Hipoteza główna

Skierowany hipergraf relacyjny z funkcją presji i pre-arbitrowanymi permutacjami stanów oraz faz może koordynować routing zadań w systemie wieloagentowym **bez centralnego koordynatora (roota)**, jednocześnie stabilizując się samodzielnie poprzez koherencję stan×faza — analogicznie do destruktywnej interferencji tłumiącej niekoherentne kombinacje.

### 1.2 Hipotezy cząstkowe (testowalne)

**H1 — Koherencja converge'uje:**  
Parametr porządku Kuramoto `r(t)` rośnie monotoniczne ku `r → 1` w miarę jak routing zadań stabilizuje się na preferowanych ścieżkach.

**H2 — Naturalna stabilizacja przez niekoherencję:**  
Niekoherentne pary stan×faza (cos(φ_state − φ_phase) < θ) są naturalnie odfiltrowane przez warunek pre-arbitracji bez zewnętrznego mechanizmu stabilizacji.

**H3 — Faza Berry jest mierzalna:**  
Pętle skrętne (twisted loops, typ A-Ü-A-U-A) akumulują mierzalne przesunięcie fazowe Δφ_Berry = const per traversal, niezależne od parametrów dynamicznych.

**H4 — Pętle pobudliwe są deterministyczne:**  
Otwarta pętla (excitable loop) po przekroczeniu progu presji P > P_threshold emituje zadanie deterministycznie do agenta o niższej energii — emisja nie może być zatrzymana w połowie.

**H5 — Informacja jest zachowana:**  
Suma presji w systemie Σ P(v,t) jest ograniczona z góry i nie dywerguje przy warunku |w| < 1 na krawędziach regulacyjnych.

**H6 — Zakaz, nie anihilacja:**  
Permutacja U↔Ü jest zakazana (arbiter zwraca `forbidden`) a nie anihilowana — presja pozostaje przy U, nic nie ginie. Całkowita presja systemu jest zachowana przy zdarzeniu inhibicji.

---

## 2. Obliczenia predykcyjne

### 2.1 Parametr porządku Kuramoto (koherencja)

Miara globalnej synchronizacji faz N agentów:

```
r(t) = (1/N) · |Σ_{k=1}^{N} e^{i·φ_k(t)}|

r ∈ [0, 1]
r = 0  →  pełna niekoherencja (fazy losowo rozproszone)
r = 1  →  pełna synchronizacja (wszystkie fazy równe)
```

**Predykcja:** w stabilnym routingu r(t) → r_∞ > 0.7 po czasie t_conv.

**Czas zbieżności** (szacunek z modelu Kuramoto z tłumieniem):

```
t_conv ~ 1 / (K · (r_∞ - r_0))

gdzie K = siła sprzężenia (average weight hipergrafu)
```

Dla K = 0.5, r_0 = 0.1, r_∞ = 0.8:  `t_conv ~ 1 / (0.5 · 0.7) ≈ 2.9 [jednostki czasu]`

### 2.2 Propagacja presji wzdłuż hiperkrawędzi

Dla hiperkrawędzi `e = (H_source ⊆ V, H_target ⊆ V, w)`:

```
ΔP(v ∈ H_target, t) = w(e) · (1/|H_source|) · Σ_{u ∈ H_source} P(u, t−1)

P(v, t) = P(v, t−1) + ΔP(v, t)   [jeśli pre-arbitracja: ALLOWED]
P(v, t) = P(v, t−1)               [jeśli pre-arbitracja: FORBIDDEN]
```

**Ograniczenie presji** (warunek konieczny stabilności, |w| < 1):

```
P(t) ≤ P(0) · 1/(1 − |w_max|)

Dla w_max = 0.7:  P(t) ≤ P(0) · 3.33  →  ograniczone
Dla w_max = 1.0:  P(t) → ∞             →  dywerguje (niedopuszczalne)
```

### 2.3 Warunek koherencji (pre-arbitracja)

Permutacja π jest dozwolona jeśli:

```
C_π(v, t) = cos(φ_state(v) − φ_phase(v)) > θ_π

gdzie:
  φ_state(v)  = faza przypisana do aktualnego stanu (U→0, Ü→π, ...)
  φ_phase(v)  = dynamiczna faza węzła (ciągła, zmienia się w czasie)
  θ_π         = próg koherencji dla permutacji π (konfigurowalny per typ)
```

Tabela wstępna progów:

| Permutacja       | θ_π   | Uzasadnienie                          |
|------------------|-------|---------------------------------------|
| U→U (tożsamość)  | -1.0  | Zawsze dozwolona                      |
| U→Ü (odwrócenie) | +0.9  | Bardzo restrykcyjne — normalnie zakaz |
| active→passive   | +0.5  | Umiarkowane                           |
| open→closed      | +0.7  | Wysoki próg — emisja po saturacji     |
| local→global     | +0.8  | Tylko przy silnej koherencji          |

### 2.4 Faza Berry dla pętli skrętnych

Dla pętli A-Ü-A-U-A (spin-1/2 analogia), faza geometryczna per traversal:

```
Δφ_Berry = Ω/2

gdzie Ω = bryłowy kąt zakreślony przez ścieżkę w przestrzeni stanów

Dla pętli dwustanowej (U/Ü):  Ω = 2π  →  Δφ_Berry = π
```

**Predykcja mierzalna:** po N traversalach pętli skrętnej:

```
φ_total(N) = φ_dynamic(N) + N · π

Różnica:  φ_total − φ_dynamic = N · π  [mierzalne z phc_snapshots]
```

### 2.5 Zachowanie informacji (zasada zachowania presji)

```
d/dt Σ_v P(v,t) = Σ_e [w(e) · inflow(e,t)] − Σ_v [emission(v,t)]

Przy pre-arbitracji:  inflow(e,t) = 0 gdy FORBIDDEN
                      Zakaz ≠ anihilacja: FORBIDDEN nie usuwa presji ze źródła
```

Predykcja: suma presji po zdarzeniu FORBIDDEN = suma presji przed zdarzeniem (± 0).

---

## 3. Warunki eksperymentu

### 3.1 Minimalna konfiguracja (Minimum Viable Experiment)

**Agenci (węzły):** 3

| Agent   | Rola         | Bias alignment | Analogia H3Fusion |
|---------|--------------|----------------|-------------------|
| Agent_A | Helpful      | wysoka pomocność| ekspert helpful   |
| Agent_B | Safe         | wysoka ostrożność| ekspert harmless |
| Agent_C | Truthful     | wysoka precyzja | ekspert honest    |

**Typy zadań:** 3

| Typ      | Opis                           | Oczekiwany routing          |
|----------|--------------------------------|-----------------------------|
| FACTUAL  | Proste zapytanie faktyczne     | A→C (helpful+truth-check)   |
| RISKY    | Potencjalnie szkodliwe         | A→B→C (filtrowanie+weryfikacja) |
| COMPLEX  | Wieloetapowe, złożone          | A→B→C→A (pętla z feedbackiem)|

**Hiperkrawędzie:**

| ID  | Źródło  | Cel     | w    | Typ        | Opis                          |
|-----|---------|---------|------|------------|-------------------------------|
| e1  | {A}     | {B}     | 0.70 | simple     | helpful → safety filter       |
| e2  | {B}     | {C}     | 0.60 | simple     | safe → truth-check            |
| e3  | {C}     | {A}     | 0.30 | regulatory | feedback: korekta strategii   |
| e4  | {A}     | {B,C}   | 0.50 | excitable  | broadcast przy saturacji      |
| e5  | {A,B,C} | {A,B,C} | 0.00 | observer   | tylko pomiar koherencji       |

Pętla skrętna: A→B→C→A (traversal = 1 cykl zadania COMPLEX)  
Pętla otwarta (excitable): B trzyma RISKY do momentu potwierdzenia przez C

### 3.2 Parametry pomiarowe

| Zmienna          | Symbol   | Miara                                   | Częstotliwość   |
|------------------|----------|-----------------------------------------|-----------------|
| Koherencja       | r(t)     | Kuramoto order parameter [0,1]          | każdy tick      |
| Presja węzła     | P(v,t)   | Float, snapshot do bazy                 | każda operacja  |
| Faza węzła       | φ(v,t)   | Radiany [0, 2π)                         | każda operacja  |
| Zdarzenia arbitra| —        | ALLOWED / FORBIDDEN + reason            | każda permutacja|
| Routing accuracy | —        | % zadań trafionych do właściwego agenta | per batch       |
| Faza Berry       | Δφ_B     | Różnica faz przed/po traversalu pętli   | per loop        |

### 3.3 Warunki kontrolne (baseline)

- **Kontrola A:** routing losowy (bez presji, bez koherencji) — pomiar routing accuracy
- **Kontrola B:** centralny koordynator (root dispatches) — pomiar latency i stabilności
- **Kontrola C:** PHC bez twisted loops — weryfikacja braku fazy Berry

### 3.4 Kryteria sukcesu / porażki

| Kryterium              | Sukces            | Porażka           |
|------------------------|-------------------|-------------------|
| r(t) po stabilizacji   | r > 0.70          | r < 0.40          |
| Routing accuracy       | > 80% vs baseline | < 60%             |
| Presja nie dywerguje   | P(t) < 10·P(0)   | P(t) → ∞         |
| Faza Berry mierzalna   | Δφ_B = π ± 0.1  | Brak sygnału      |
| Excitable deterministy | 100% po progu     | < 90%             |
| Czas stabilizacji      | < 20 ticków       | > 100 ticków      |

---

## 4. Konstrukcja modelu

### 4.1 Schemat SQLite (rozszerzenie istniejącej bazy)

```sql
-- ============================================================
-- PHC: węzły (agenci)
-- ============================================================
CREATE TABLE IF NOT EXISTS phc_nodes (
  id          TEXT    PRIMARY KEY,          -- agent_name z agent_state
  state       TEXT    NOT NULL DEFAULT 'U', -- U | Ü | active | passive | ...
  phase       REAL    NOT NULL DEFAULT 0.0, -- faza dynamiczna [0, 2π)
  pressure    REAL    NOT NULL DEFAULT 0.0, -- aktualna presja
  twist_count INTEGER NOT NULL DEFAULT 0,   -- liczba traversali pętli skrętnych
  energy_bias REAL    NOT NULL DEFAULT 1.0, -- specjalizacja agenta (niższe = stabilniejsze)
  updated_at  TEXT    NOT NULL
);

-- ============================================================
-- PHC: hiperkrawędzie
-- ============================================================
CREATE TABLE IF NOT EXISTS phc_edges (
  id                   TEXT    PRIMARY KEY,
  source_ids           TEXT    NOT NULL,          -- JSON array agent ids
  target_ids           TEXT    NOT NULL,          -- JSON array agent ids
  weight               REAL    NOT NULL           -- arbiter weight
                               CHECK(weight <= 1.0),
  edge_type            TEXT    NOT NULL DEFAULT 'simple', -- simple|twisted|excitable|regulatory|observer
  coherence_threshold  REAL    NOT NULL DEFAULT 0.5,
  excitation_threshold REAL    NOT NULL DEFAULT 2.0,      -- dla excitable loops
  is_active            INTEGER NOT NULL DEFAULT 1,
  created_at           TEXT    NOT NULL
);

-- ============================================================
-- PHC: snapshots presji i fazy (do obliczania pochodnych)
-- ============================================================
CREATE TABLE IF NOT EXISTS phc_snapshots (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  node_id     TEXT    NOT NULL,
  state       TEXT    NOT NULL,
  phase       REAL    NOT NULL,
  pressure    REAL    NOT NULL,
  coherence_r REAL,                               -- Kuramoto r w tym momencie
  ts          TEXT    NOT NULL,                   -- ISO 8601 z ms
  global_seq  INTEGER NOT NULL DEFAULT 0          -- monotonicznie rosnący
);

-- ============================================================
-- PHC: log zdarzeń (permutacje, emisje, inhibicje)
-- ============================================================
CREATE TABLE IF NOT EXISTS phc_events (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type      TEXT    NOT NULL, -- permutation|emission|absorption|inhibition|propagation
  node_id         TEXT    NOT NULL,
  edge_id         TEXT,
  permutation     TEXT,             -- nazwa permutacji (np. "U→Ü")
  from_state      TEXT,
  to_state        TEXT,
  phase_before    REAL,
  phase_after     REAL,
  pressure_before REAL,
  pressure_after  REAL,
  arbiter_result  TEXT    NOT NULL, -- ALLOWED | FORBIDDEN
  coherence_value REAL,             -- cos(φ_state - φ_phase) w momencie zdarzenia
  reason          TEXT,
  ts              TEXT    NOT NULL,
  global_seq      INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_phc_snapshots_node_ts ON phc_snapshots(node_id, ts);
CREATE INDEX IF NOT EXISTS idx_phc_events_ts         ON phc_events(ts, global_seq);
CREATE INDEX IF NOT EXISTS idx_phc_events_node       ON phc_events(node_id, event_type);
```

### 4.2 Automaty stanów agentów

Stany nominalne (rozszerzalne):

```
U (nominal)
│
├─[coherence OK]──→  active   (agent inicjuje presję)
│                       │
│                    passive  (agent odbiera presję)
│                       │
└─[forbidden]────→  U        (zakaz: powrót bez zmiany)

Ü (inverted, rzadki, wysokie θ)
│
└─[coherence > 0.9]─→ dozwolone tylko specjalne przypadki
```

### 4.3 Definicja typów permutacji

| Nazwa            | Opis                                    | φ_state  | θ_π  |
|------------------|-----------------------------------------|----------|------|
| `U→U`            | Tożsamość, propagacja bez zmiany stanu  | 0        | -1.0 |
| `U→Ü`            | Odwrócenie (zakaz przy normalnej pracy) | π        | +0.9 |
| `active→passive` | Zmiana roli w hiperkrawędzi             | π/2      | +0.5 |
| `open→closed`    | Zamknięcie pętli pobudliwej             | 3π/2     | +0.7 |
| `local→global`   | Rozszerzenie zakresu presji             | π/4      | +0.8 |
| `absorb`         | Pochłonięcie zadania (wzbudzenie)       | 0        | +0.3 |
| `emit`           | Emisja zadania do niższego węzła        | π        | +0.6 |

---

## 5. Pseudokod pomocniczy

### 5.1 Inicjalizacja grafu

```javascript
function initPHC(db, agents, edges) {
  const stmt_node = db.prepare(`
    INSERT OR REPLACE INTO phc_nodes
      (id, state, phase, pressure, twist_count, energy_bias, updated_at)
    VALUES (?, 'U', 0.0, 0.0, 0, ?, datetime('now'))
  `);
  const stmt_edge = db.prepare(`
    INSERT OR REPLACE INTO phc_edges
      (id, source_ids, target_ids, weight, edge_type,
       coherence_threshold, excitation_threshold, is_active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))
  `);

  const txn = db.transaction(() => {
    for (const a of agents) {
      stmt_node.run(a.id, a.energy_bias ?? 1.0);
    }
    for (const e of edges) {
      stmt_edge.run(
        e.id,
        JSON.stringify(e.source_ids),
        JSON.stringify(e.target_ids),
        e.weight,
        e.type,
        e.coherence_threshold ?? 0.5,
        e.excitation_threshold ?? 2.0
      );
    }
  });
  txn();
}
```

### 5.2 Pre-arbitracja (guard function)

```javascript
// Kluczowa funkcja: sprawdza PRZED permutacją
function preArbitrate(db, node_id, permutation_name, PERMUTATION_THRESHOLDS) {
  const node = db.prepare(
    `SELECT state, phase FROM phc_nodes WHERE id = ?`
  ).get(node_id);

  const STATE_PHASES = { 'U': 0, 'Ü': Math.PI, 'active': Math.PI/2,
                         'passive': 3*Math.PI/2, 'open': Math.PI/4 };

  const phi_state = STATE_PHASES[node.state] ?? 0;
  const phi_phase = node.phase;
  const coherence = Math.cos(phi_state - phi_phase);
  const threshold = PERMUTATION_THRESHOLDS[permutation_name] ?? 0.5;

  const result = coherence > threshold ? 'ALLOWED' : 'FORBIDDEN';

  // Zawsze loguj zdarzenie arbitra
  db.prepare(`
    INSERT INTO phc_events
      (event_type, node_id, permutation, from_state, arbiter_result,
       coherence_value, reason, ts, global_seq)
    VALUES ('permutation', ?, ?, ?, ?, ?, ?, datetime('now'),
            (SELECT COALESCE(MAX(global_seq),0)+1 FROM phc_events))
  `).run(
    node_id, permutation_name, node.state, result, coherence,
    result === 'FORBIDDEN'
      ? `coherence ${coherence.toFixed(3)} < threshold ${threshold}`
      : null
  );

  return { result, coherence, threshold };
}
```

### 5.3 Propagacja presji

```javascript
function propagatePressure(db, edge_id, tick) {
  const edge = db.prepare(
    `SELECT * FROM phc_edges WHERE id = ? AND is_active = 1`
  ).get(edge_id);
  if (!edge) return;

  const source_ids = JSON.parse(edge.source_ids);
  const target_ids = JSON.parse(edge.target_ids);

  // Średnia presja ze źródeł
  const sources = db.prepare(
    `SELECT pressure FROM phc_nodes WHERE id IN (${source_ids.map(()=>'?').join(',')})`
  ).all(...source_ids);
  const avg_source_pressure = sources.reduce((s,n)=>s+n.pressure,0) / sources.length;
  const delta = edge.weight * avg_source_pressure;

  const txn = db.transaction(() => {
    for (const target_id of target_ids) {
      const arb = preArbitrate(db, target_id, 'U→U', PERMUTATION_THRESHOLDS);
      if (arb.result === 'ALLOWED') {
        const before = db.prepare(`SELECT pressure, phase FROM phc_nodes WHERE id=?`)
                         .get(target_id);
        const new_pressure = before.pressure + delta;
        const new_phase = updatePhase(db, target_id, edge, before.phase);

        db.prepare(`
          UPDATE phc_nodes SET pressure=?, phase=?, updated_at=datetime('now')
          WHERE id=?
        `).run(new_pressure, new_phase, target_id);

        snapshotNode(db, target_id, new_pressure, new_phase, tick);

        db.prepare(`
          INSERT INTO phc_events
            (event_type, node_id, edge_id, pressure_before, pressure_after,
             phase_before, phase_after, arbiter_result, ts, global_seq)
          VALUES ('propagation', ?, ?, ?, ?, ?, ?, 'ALLOWED', datetime('now'),
                  (SELECT COALESCE(MAX(global_seq),0)+1 FROM phc_events))
        `).run(target_id, edge_id, before.pressure, new_pressure,
               before.phase, new_phase);
      }
      // FORBIDDEN: presja pozostaje niezmieniona (zakaz ≠ anihilacja)
    }
  });
  txn();
}
```

### 5.4 Aktualizacja fazy + faza Berry

```javascript
const DYNAMIC_PHASE_INCREMENT = 0.1; // radiany per tick — konfigurowalny

function updatePhase(db, node_id, edge, current_phase) {
  let delta_dynamic = DYNAMIC_PHASE_INCREMENT;
  let delta_berry = 0;

  if (edge.edge_type === 'twisted') {
    // Faza Berry dla pętli skrętnej: π per traversal (spin-1/2 analogia)
    const node = db.prepare(
      `SELECT twist_count FROM phc_nodes WHERE id=?`
    ).get(node_id);
    db.prepare(
      `UPDATE phc_nodes SET twist_count = twist_count + 1 WHERE id=?`
    ).run(node_id);
    delta_berry = Math.PI; // Δφ_Berry = π per full twisted loop traversal
  }

  return (current_phase + delta_dynamic + delta_berry) % (2 * Math.PI);
}
```

### 5.5 Koherencja — parametr Kuramoto

```javascript
function measureCoherence(db) {
  const nodes = db.prepare(
    `SELECT phase FROM phc_nodes`
  ).all();
  const N = nodes.length;
  if (N === 0) return 0;

  const sum_cos = nodes.reduce((s, n) => s + Math.cos(n.phase), 0) / N;
  const sum_sin = nodes.reduce((s, n) => s + Math.sin(n.phase), 0) / N;
  const r = Math.sqrt(sum_cos ** 2 + sum_sin ** 2);
  return r; // [0, 1]
}
```

### 5.6 Routing zadania (bez roota)

```javascript
// Agenci sami licytują zadanie — brak centralnego dispatcha
function routeTask(db, task_id) {
  const task = db.prepare(`SELECT * FROM tasks WHERE id=?`).get(task_id);
  const agents = db.prepare(
    `SELECT n.id, n.pressure, n.phase, n.state, n.energy_bias
     FROM phc_nodes n
     JOIN agent_state a ON a.agent_name = n.id
     WHERE a.current_task = ''` // tylko wolni agenci
  ).all();

  const scored = agents.map(a => {
    const phi_state = STATE_PHASES[a.state] ?? 0;
    const coherence = Math.cos(phi_state - a.phase);
    // Wynik: wysoka koherencja + niski bias energetyczny (specjalizacja)
    const score = coherence / (a.pressure + a.energy_bias);
    return { ...a, score, coherence };
  }).filter(a => a.coherence > ROUTING_THRESHOLD); // pre-arbitracja

  if (scored.length === 0) {
    // Brak koherentnych kandydatów — zadanie czeka
    db.prepare(`UPDATE tasks SET status='pending' WHERE id=?`).run(task_id);
    return null;
  }

  // Wygrywa najwyższy score (bez roota — agent sam "bierze" zadanie)
  scored.sort((a, b) => b.score - a.score);
  const winner = scored[0];

  db.prepare(`
    UPDATE tasks SET status='in_progress', assigned_to=? WHERE id=?
  `).run(winner.id, task_id);

  // Aktualizuj presję zwycięzcy (pochłonięcie = wzbudzenie)
  db.prepare(`
    UPDATE phc_nodes SET pressure = pressure + ?, updated_at=datetime('now')
    WHERE id=?
  `).run(task.priority ?? 1.0, winner.id);

  return winner.id;
}
```

### 5.7 Pętla pobudliwa (excitable — deterministic emission)

```javascript
// Sprawdza czy agent powinien emitować trzymane zadanie
function checkExcitableEmission(db, agent_id) {
  const node = db.prepare(
    `SELECT pressure FROM phc_nodes WHERE id=?`
  ).get(agent_id);

  const edges = db.prepare(
    `SELECT * FROM phc_edges
     WHERE edge_type='excitable' AND source_ids LIKE ? AND is_active=1`
  ).all(`%"${agent_id}"%`);

  for (const edge of edges) {
    if (node.pressure < edge.excitation_threshold) continue;

    // Próg przekroczony — emisja deterministyczna
    const target_ids = JSON.parse(edge.target_ids);

    // Znajdź cel o najniższej presji (najstabilniejszy stan — analogia fotonu)
    const targets = db.prepare(
      `SELECT id, pressure, energy_bias FROM phc_nodes
       WHERE id IN (${target_ids.map(()=>'?').join(',')})
       ORDER BY (pressure + energy_bias) ASC LIMIT 1`
    ).all(...target_ids);

    if (targets.length === 0) continue;
    const best_target = targets[0];

    if (best_target.pressure + best_target.energy_bias >= node.pressure) continue;
    // Warunek "niższy poziom energetyczny" musi być spełniony

    const emitted_energy = node.pressure * edge.weight;

    db.transaction(() => {
      db.prepare(`
        UPDATE phc_nodes SET pressure = pressure - ?, updated_at=datetime('now')
        WHERE id=?
      `).run(emitted_energy, agent_id);
      db.prepare(`
        UPDATE phc_nodes SET pressure = pressure + ?, updated_at=datetime('now')
        WHERE id=?
      `).run(emitted_energy, best_target.id);
      db.prepare(`
        INSERT INTO phc_events
          (event_type, node_id, edge_id, pressure_before, pressure_after,
           arbiter_result, reason, ts, global_seq)
        VALUES ('emission', ?, ?, ?, ?, 'ALLOWED', 'excitable threshold reached',
                datetime('now'),
                (SELECT COALESCE(MAX(global_seq),0)+1 FROM phc_events))
      `).run(agent_id, edge.id, node.pressure, node.pressure - emitted_energy);
    })();
  }
}
```

### 5.8 Snapshot i analiza pochodnej presji

```javascript
function snapshotNode(db, node_id, pressure, phase, tick) {
  const r = measureCoherence(db);
  db.prepare(`
    INSERT INTO phc_snapshots (node_id, state, phase, pressure, coherence_r, ts, global_seq)
    SELECT ?, state, ?, ?, ?, datetime('now'),
           (SELECT COALESCE(MAX(global_seq),0)+1 FROM phc_snapshots)
    FROM phc_nodes WHERE id=?
  `).run(node_id, phase, pressure, r, node_id);
}

// Oblicz dP/dt dla węzła z historii snapshotów
function pressureDerivative(db, node_id, window_ms = 500) {
  const rows = db.prepare(`
    SELECT pressure, ts FROM phc_snapshots
    WHERE node_id=? AND ts >= datetime('now', ? || ' milliseconds')
    ORDER BY global_seq ASC
  `).all(node_id, -window_ms);

  if (rows.length < 2) return null;

  const dt = (new Date(rows.at(-1).ts) - new Date(rows[0].ts)) / 1000; // sekundy
  const dP = rows.at(-1).pressure - rows[0].pressure;
  return dP / dt; // dP/dt — gradient presji w oknie czasowym
}
```

---

## 6. Plan uruchomienia eksperymentu

### 6.1 Faza 0 — Setup (jednorazowo)

```bash
# 1. Zainstaluj zależności (jeśli nie ma)
npm install better-sqlite3 sqlite-vec

# 2. Uruchom migrację schema
node scripts/phc_migrate.js

# 3. Zweryfikuj tabele
sqlite3 logs/.mcp-agent-store.db ".tables"
# Oczekiwane: memory memory_vec agent_state tasks phc_nodes phc_edges phc_snapshots phc_events
```

```javascript
// scripts/phc_migrate.js
const { getDb } = require('../src/db/store');
const db = getDb();
// Wykonaj CREATE TABLE IF NOT EXISTS z Sekcji 4.1
// ...
console.log('PHC schema OK');
```

### 6.2 Faza 1 — Inicjalizacja i baseline (tick 0–10)

```javascript
// Inicjalizuj 3 agentów i 5 hiperkrawędzi
initPHC(db, [
  { id: 'agent_helpful',  energy_bias: 1.0 },
  { id: 'agent_safe',     energy_bias: 0.8 },
  { id: 'agent_truthful', energy_bias: 0.6 }
], [
  { id:'e1', source_ids:['agent_helpful'],  target_ids:['agent_safe'],
    weight:0.7, type:'simple',     coherence_threshold:0.4 },
  { id:'e2', source_ids:['agent_safe'],     target_ids:['agent_truthful'],
    weight:0.6, type:'simple',     coherence_threshold:0.4 },
  { id:'e3', source_ids:['agent_truthful'], target_ids:['agent_helpful'],
    weight:0.3, type:'regulatory', coherence_threshold:0.5 },  // |w|<0.5 ✓
  { id:'e4', source_ids:['agent_helpful'],  target_ids:['agent_safe','agent_truthful'],
    weight:0.5, type:'excitable',  excitation_threshold:2.0 },
  { id:'e5', source_ids:['agent_helpful','agent_safe','agent_truthful'],
    target_ids:['agent_helpful','agent_safe','agent_truthful'],
    weight:0.0, type:'observer',   coherence_threshold:-1.0 }
]);

// Zmierz r_0 (baseline coherence)
const r0 = measureCoherence(db);
console.log(`r_0 = ${r0.toFixed(4)}`); // Oczekiwane: ~0.1–0.3 (losowe fazy)
```

### 6.3 Faza 2 — Injekcja zadań i obserwacja (tick 10–50)

```javascript
async function runExperiment(db, n_tasks = 20, tick_ms = 50) {
  const TASK_TYPES = ['FACTUAL', 'RISKY', 'COMPLEX'];

  for (let tick = 0; tick < n_tasks; tick++) {
    const type = TASK_TYPES[tick % 3];
    const task_id = crypto.randomUUID();

    // Wstaw zadanie
    db.prepare(`
      INSERT INTO tasks (id, created_by, title, priority, status, created_at)
      VALUES (?, 'experiment', ?, ?, 'pending', datetime('now'))
    `).run(task_id, `Task_${tick}_${type}`, tick % 5 + 1);

    // Routing bez roota
    const winner = routeTask(db, task_id);
    console.log(`Tick ${tick}: ${type} → ${winner ?? 'PENDING (no coherent agent)'}`);

    // Propagacja presji wzdłuż wszystkich aktywnych krawędzi
    const edges = db.prepare(`SELECT id FROM phc_edges WHERE is_active=1`).all();
    for (const e of edges) {
      propagatePressure(db, e.id, tick);
    }

    // Sprawdź emisje pobudliwe
    const agents = db.prepare(`SELECT id FROM phc_nodes`).all();
    for (const a of agents) {
      checkExcitableEmission(db, a.id);
    }

    // Snapshot koherencji
    const r = measureCoherence(db);
    console.log(`  r(${tick}) = ${r.toFixed(4)}`);

    // Czekaj tick_ms między iteracjami
    await new Promise(res => setTimeout(res, tick_ms));
  }
}
```

### 6.4 Faza 3 — Pomiar fazy Berry (pętla skrętna)

```javascript
function measureBerryPhase(db, loop_agent_id = 'agent_helpful', n_loops = 5) {
  const results = [];

  for (let i = 0; i < n_loops; i++) {
    const before = db.prepare(`SELECT phase, twist_count FROM phc_nodes WHERE id=?`)
                     .get(loop_agent_id);

    // Wymuś traversal pętli skrętnej przez krawędź e1→e2→e3 (A→B→C→A)
    propagatePressure(db, 'e1', i);
    propagatePressure(db, 'e2', i);
    propagatePressure(db, 'e3', i); // e3 = regulatory, twisted semantics

    const after = db.prepare(`SELECT phase, twist_count FROM phc_nodes WHERE id=?`)
                    .get(loop_agent_id);

    const delta_total   = ((after.phase - before.phase) + 2*Math.PI) % (2*Math.PI);
    const delta_dynamic = DYNAMIC_PHASE_INCREMENT * 3; // 3 krawędzie
    const delta_berry   = delta_total - delta_dynamic;

    results.push({ loop: i+1, delta_total, delta_dynamic, delta_berry });
    console.log(`Loop ${i+1}: Δφ_total=${delta_total.toFixed(4)}, Δφ_Berry=${delta_berry.toFixed(4)} (expected: π=${Math.PI.toFixed(4)})`);
  }

  const avg_berry = results.reduce((s,r) => s + r.delta_berry, 0) / results.length;
  console.log(`\nŚrednia faza Berry: ${avg_berry.toFixed(4)}, odchylenie od π: ${Math.abs(avg_berry - Math.PI).toFixed(4)}`);
  return results;
}
```

### 6.5 Faza 4 — Analiza wyników (SQL)

```sql
-- Koherencja w czasie (czy r(t) rośnie?)
SELECT
  strftime('%M:%S', ts) AS czas,
  node_id,
  ROUND(coherence_r, 4) AS r,
  ROUND(pressure, 4)    AS P
FROM phc_snapshots
ORDER BY global_seq ASC;

-- Histogram decyzji arbitra (ile FORBIDDEN vs ALLOWED)
SELECT
  arbiter_result,
  permutation,
  COUNT(*) AS cnt,
  ROUND(AVG(coherence_value), 4) AS avg_coherence
FROM phc_events
WHERE event_type='permutation'
GROUP BY arbiter_result, permutation
ORDER BY cnt DESC;

-- Weryfikacja zachowania presji przy FORBIDDEN (H6)
SELECT
  e.ts,
  e.node_id,
  e.pressure_before,
  e.pressure_after,
  ROUND(e.pressure_after - e.pressure_before, 6) AS delta
FROM phc_events e
WHERE e.arbiter_result='FORBIDDEN'
ORDER BY e.ts;
-- Oczekiwane: delta = 0.000000 dla wszystkich wierszy

-- Routing accuracy per typ zadania
SELECT
  t.title LIKE '%FACTUAL%' AS is_factual,
  t.title LIKE '%RISKY%'   AS is_risky,
  t.title LIKE '%COMPLEX%' AS is_complex,
  t.assigned_to,
  COUNT(*) AS cnt
FROM tasks t
WHERE t.status != 'pending'
GROUP BY 1, 2, 3, 4
ORDER BY cnt DESC;

-- Gradient presji (dP/dt) per węzeł
SELECT
  node_id,
  ROUND(
    (MAX(pressure) - MIN(pressure)) /
    ((julianday(MAX(ts)) - julianday(MIN(ts))) * 86400.0),
    6
  ) AS dP_dt
FROM phc_snapshots
GROUP BY node_id;
```

### 6.6 Faza 5 — Weryfikacja hipotez

Po zebraniu danych przejrzyj wyniki według listy kontrolnej:

```
[ ] H1: r(t) po 50 tickach > 0.70
[ ] H2: 100% zdarzeń FORBIDDEN ma delta_pressure = 0 (zakaz ≠ anihilacja)
[ ] H3: avg(Δφ_Berry) = π ± 0.1 po 5 traversalach pętli skrętnej
[ ] H4: każde przekroczenie progu excitable → emisja w tym samym ticku
[ ] H5: MAX(P) / P_0 < 1/(1-0.7) = 3.33 (krawędź e1 z w=0.7 jest najsilniejsza)
[ ] H6: wszystkie zdarzenia FORBIDDEN mają delta_pressure = 0
[ ] Bonus: routing accuracy (FACTUAL→truthful, RISKY→safe) > 80% vs losowy baseline
```

---

## 7. Dalsze kroki i otwarte pytania

**Otwarte:**
- Jak dobrać θ_π dla permutacji empirycznie zamiast ręcznie?
- Czy Δφ_Berry = π dokładnie, czy zależy od weight krawędzi?
- Jak zachowuje się system przy N > 3 agentach (skalowanie koherencji)?
- Czy model Kuramoto z tłumieniem poprawnie przewiduje t_conv?

**Następne eksperymenty:**
- Dodanie 4. agenta z losową fazą → obserwacja wpływu na r(t)
- Test `|w| = 0.99` vs `|w| = 0.3` — granica stabilności
- Eksperymenty z wieloma typami permutacji jednocześnie
- Integracja z routingiem zadań z `memory_store.searchMemory()` (semantic routing)

**Powiązanie z handbokiem:**
- L7/L8: PHC jako model orkiestracji bez centralnego agenta
- L10: koherencja stan×faza jako runtime alignment proxy (alternatywa dla H3Fusion MoE)
- Rozdziały 26-28: PHC jako formalizm łączący DA (L6) + H3Fusion (L10) + red-teaming (L4)

---

*Dokument roboczy — wymaga weryfikacji eksperymentalnej przed włączeniem do handbooku.*
