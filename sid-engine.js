/* SID engine — pure, deterministic, no DOM, no network, no model.
 *
 * Every constant lives on the domain config; this file contains only mechanism.
 * Plain script (not an ES module) on purpose: `<script type="module">` is blocked by CORS
 * over file://, and the diagnostics must open as a single local file. CommonJS export is
 * attached so tests import the SHIPPED engine rather than a copy of it.
 */
(function (root) {
  'use strict';

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  var EPS = 1e-9;
  function sumRaw(raw) { var s = 0; for (var k in raw) s += raw[k]; return s; }

  /* Relative width of an interval. Used to pick which unit to lead with: whichever is
   * narrower relative to its own magnitude is the one actually known. */
  function spreadOf(b) {
    var w = b.hi - b.lo;
    if (Math.abs(b.point) < EPS) return w < EPS ? 0 : Infinity;
    return w / Math.abs(b.point);
  }

  /* IMPORTANT distinction:
   *   inputSpread — uncertainty from the ANSWERS. This is where volume cancellation shows
   *                 up: a leak linear in the denominator has an input-driven % spread of
   *                 zero, meaning the figure does not depend on the volume estimate at all.
   *   spread      — the reportable band, input uncertainty PLUS `residual`, which covers the
   *                 practitioner rate constants themselves.
   * "0.100% of volume" is exact given the model; the model's rate is still an estimate.
   * Claiming a flat "exact" would repeat the false-precision mistake this work removed. */
  function naturalUnit(u, p, iu, ip) {
    var su = spreadOf(u), sp = spreadOf(p);
    return {
      unit: sp <= su ? 'pct' : 'usd',
      spreadUsd: su, spreadPct: sp,
      inputSpreadUsd: spreadOf(iu), inputSpreadPct: spreadOf(ip),
      denominatorIndependent: spreadOf(ip) < EPS,   // volume cancels
      valueIndependent: spreadOf(iu) < EPS          // dollars fixed regardless of denominator
    };
  }

  /* Replicates the original engine's `parseFloat(x) || default` semantics exactly,
   * including the quirk that 0 falls through to the default. Parity depends on it. */
  function num(v, d) { var n = parseFloat(v); return n || d || 0; }

  function test(p, ans, sc) {
    if (!p) return true;

    /* Equality compares the RAW answer. Routing it through num() first coerces a string
     * option like 'auto' to NaN and then to 0, so `{op:'!=', v:'auto'}` compared '0'
     * against 'auto' and was always true — which silently made every showIf question
     * visible and scoring. Only the ordering operators may coerce. */
    if (p.op === '==' || p.op === '!=') {
      var lv = p.ans !== undefined
        ? (ans[p.ans] === undefined ? (p.def !== undefined ? p.def : '') : ans[p.ans])
        : sc[p.score];
      var same = String(lv) === String(p.v);
      return p.op === '==' ? same : !same;
    }

    var lhs = p.ans !== undefined ? num(ans[p.ans], p.def)
            : p.score !== undefined ? sc[p.score]
            : 0;
    switch (p.op) {
      case '>=': return lhs >= p.v;
      case '>':  return lhs >  p.v;
      case '<=': return lhs <= p.v;
      case '<':  return lhs <  p.v;
    }
    return false;
  }

  /* A leak term is one of:
   *   {lit:n}                 a constant
   *   {ans:'id', def:n}       an answer value
   *   {score:'cat', pivot:n}  (100 - categoryScore) / pivot
   * Product of terms, optionally minus a second product. Verified to cover all 18
   * golden-dataset dollar_rules and the original loyalty engine's four leak rates. */
  /* Uncertainty is PROPAGATED from the inputs, never asserted as a flat percentage.
   * A banded answer ("$500M–$4B") genuinely is a range; an exact typed value collapses it
   * to a point. Ranged inputs are substituted into a corner answer-set before evaluation
   * (see cornerBands), so factor() itself stays a plain lookup. */
  function factor(t, ans, sc) {
    if (t.lit   !== undefined) return t.lit;
    if (t.score !== undefined) return (100 - sc[t.score]) / t.pivot;
    /* 1 − x, so two leaks can split one pool instead of double-counting it. C4 is the spend
     * that HAS a baseline but sits on unfit data; C5 is the spend with no baseline. Without
     * a complement both would draw on the same pilot budget and inflate the total. */
    if (t.oneMinus !== undefined) return 1 - factor(t.oneMinus, ans, sc);
    if (t.ans !== undefined) {
      /* An explicitly supplied value wins outright, including zero. num()'s `|| default`
       * treats 0 as falsy, so a typed "0 incidents" silently became the default 12.
       * num() itself must NOT change — its falsy-fallback is exactly what Stage B parity
       * replicates from the frozen original, which never sets exact_ flags. */
      if (ans['exact_' + t.ans]) {
        var ex = parseFloat(ans[t.ans]);
        if (isFinite(ex)) return ex;
      }
      return num(ans[t.ans], t.def);
    }
    return 1;
  }
  function product(terms, ans, sc) {
    return terms.reduce(function (a, t) { return a * factor(t, ans, sc); }, 1);
  }

  function eachQuestion(cfg, fn) {
    (cfg.steps || [{ questions: cfg.questions || [] }]).forEach(function (s) {
      (s.questions || []).forEach(fn);
    });
  }

  /* A question hidden by its showIf predicate contributes nothing to any score.
   * Asked and skipped are different states; skipped must not silently score. */
  function visible(q, ans, sc) { return !q.showIf || test(q.showIf, ans, sc); }

  function compute(cfg, answers) {
    var sc = {}, i;
    /* Domain-supplied derivation, e.g. turning a "don't know" into a volume-scaled
     * estimate. Kept in config so the render layer never does arithmetic.
     *
     * CRITICAL: keep the RAW answers. A derived value like "per_hr scaled from volume"
     * must be recomputed at every corner, because it moves with the input it derives from.
     * Deriving once here and then copying the result into each corner froze the auto-scaled
     * rate at the point volume and reported a band width of zero where the true span was
     * $8.5M — false precision on the option a prospect is most likely to pick. */
    var rawAns = answers;
    function derived(a) { return cfg.derive ? cfg.derive(Object.assign({}, a)) : a; }
    answers = derived(rawAns);
    cfg.categories.forEach(function (c) { sc[c.id] = c.base; });

    eachQuestion(cfg, function (q) {
      if (!visible(q, answers, sc)) return;
      var raw = answers[q.id];
      if (q.type === 'slider') {
        var n = num(raw, q.default);
        for (var k in q.k) sc[k] += (n - q.pivot) * q.k[k];
      } else if (q.options) {
        var o = null;
        for (i = 0; i < q.options.length; i++) {
          if (String(q.options[i].v) === String(raw)) { o = q.options[i]; break; }
        }
        if (o && o.d) for (var j in o.d) sc[j] += o.d[j];
      }
    });

    /* fallback replaces accumulated deltas outright (the original hard-sets a score in
     * one branch and skips the delta block entirely), then clamp, then invert. Order matters. */
    cfg.categories.forEach(function (c) {
      if (c.fallback && test(c.fallback.when, answers, sc)) sc[c.id] = c.fallback.score;
      sc[c.id] = clamp(sc[c.id], c.clamp[0], c.clamp[1]);
      if (c.invert) sc[c.id] = 100 - sc[c.id];
    });

    var overall = Math.round(cfg.categories.reduce(function (a, c) {
      return a + sc[c.id] * c.weight;
    }, 0));

    /* first matching multiplier wins, mirroring if / else-if */
    var mult = {};
    var ms = cfg.multipliers || [];
    for (i = 0; i < ms.length; i++) {
      if (test(ms[i].when, answers, sc)) { mult = ms[i].apply; break; }
    }

    /* ── which inputs are still ranges rather than points ───────────────────────── */
    var ranged = [];                                   // [{id, lo, hi}]
    var seen = {};
    function addRange(id, r) {
      if (!r || seen[id] || answers['exact_' + id]) return;   // typed exactly → collapsed
      seen[id] = 1; ranged.push({ id: id, lo: r[0], hi: r[1] });
    }
    eachQuestion(cfg, function (q) {
      if (!visible(q, answers, sc)) return;
      if (q.options) {
        for (var i = 0; i < q.options.length; i++) {
          if (String(q.options[i].v) === String(answers[q.id])) { addRange(q.id, q.options[i].range); return; }
        }
      } else if (q.range) addRange(q.id, q.range);
    });
    // factor-level ranges cover drivers the current depth never asked for
    (cfg.leaks || []).forEach(function (L) {
      [].concat(L.mul || [], L.minus || []).forEach(function (t) {
        if (t.ans !== undefined && t.range && answers[t.ans] === undefined) addRange(t.ans, t.range);
      });
    });

    /* A leak's kind decides whether it counts toward the headline.
     *   loss          — expected annual loss. Default. Summed into the total.
     *   contingent    — exposure if something happens (shared-vendor blast radius). Real
     *                   dollars, but NOT an expected annual loss, and adding it to one would
     *                   inflate the headline by category error.
     *   unmeasurable  — spend whose true return is unknowable (shadow usage cuts both ways).
     *                   Also a real figure, also not a loss.
     * Both non-loss kinds are reported with a dollar figure and excluded from the total. */
    function kindOf(L) { return L.kind || 'loss'; }

    function evalLeaks(ans) {
      var out = {}, raw = {}, sum = 0, cont = 0, unm = 0;
      (cfg.leaks || []).forEach(function (L) {
        var v = 0;
        if (!L.when || test(L.when, ans, sc)) {
          v = product(L.mul, ans, sc);
          if (L.minus) v -= product(L.minus, ans, sc);
          v = v * (mult[L.id] || 1);
          if (L.floor !== undefined) v = Math.max(L.floor, v);
        }
        raw[L.id] = v;                                  // unrounded: keeps % exact
        out[L.id] = Math.round(v);
        var k = kindOf(L);
        if (k === 'loss') sum += out[L.id];
        else if (k === 'contingent') cont += out[L.id];
        else unm += out[L.id];
      });
      return { leaks: out, raw: raw, total: sum, contingent: cont, unmeasurable: unm };
    }

    var denomId = cfg.denominator;
    var point = evalLeaks(answers);
    var denomPoint = denomId ? num(answers[denomId], 0) : 0;
    // percentages of the headline follow the headline: loss leaks only
    var lossIds = (cfg.leaks || []).filter(function (L) { return kindOf(L) === 'loss'; })
                                   .map(function (L) { return L.id; });
    function sumLoss(raw) { var s = 0; lossIds.forEach(function (id) { s += raw[id]; }); return s; }

    /* ── corner enumeration ──────────────────────────────────────────────────────
     * Each ranged input sits at its lo or its hi; the formulas are monotonic in every
     * input, so the corners contain the true extremes. Evaluating BOTH units at each
     * corner is what makes volume cancel: a leak linear in volume divided by the same
     * corner's volume is constant, so its % band collapses to zero width — exactly.
     *
     * This also fixes a real bug in the previous single-sweep approach, which put every
     * factor at its low end INCLUDING inside the `minus` arm. A larger subtraction makes
     * the total smaller, so that "lo" was not a lower bound at all.
     *
     * Category scores are held fixed across corners: they are set by which option was
     * chosen, not by where inside that option's band the true value lies. */
    /* Truncating silently would understate the band without a word to anyone. If it ever
     * happens the result says so, so an under-stated interval is visible rather than assumed. */
    var MAX_DIM = 12;
    var dims = ranged.slice(0, MAX_DIM);
    var truncated = ranged.length > MAX_DIM ? ranged.length - MAX_DIM : 0;
    var loU = point.total, hiU = point.total;
    var loP = {}, hiP = {}, loUl = {}, hiUl = {};
    var pctPoint = {}, pctTotalPoint = denomPoint ? sumLoss(point.raw) / denomPoint : 0;
    (cfg.leaks || []).forEach(function (L) {
      pctPoint[L.id] = denomPoint ? point.raw[L.id] / denomPoint : 0;
      loP[L.id] = hiP[L.id] = pctPoint[L.id];
      loUl[L.id] = hiUl[L.id] = point.leaks[L.id];
    });
    var loPT = pctTotalPoint, hiPT = pctTotalPoint;

    /* Corners are the cross-product of input extremes, and some of those combinations
     * cannot physically coexist — two disjoint shares of one budget, both at their maximum,
     * sum to more than the whole. Including them produced an upper bound of 140% of spend:
     * "you lost more than you spent." A domain may declare `feasible(answers)` to rule such
     * corners out. Skipped corners are counted, not hidden. */
    var corners = 1 << dims.length, skipped = 0, used = 0;
    for (var c = 0; c < corners; c++) {
      /* built from RAW answers, then derived AFTER substitution, so anything scaled from a
         ranged input moves with it */
      var ac = {}; for (var k in rawAns) ac[k] = rawAns[k];
      for (var d = 0; d < dims.length; d++) ac[dims[d].id] = (c >> d) & 1 ? dims[d].hi : dims[d].lo;
      ac = derived(ac);
      if (cfg.feasible && !cfg.feasible(ac)) { skipped++; continue; }
      used++;
      var e = evalLeaks(ac);
      var dv = denomId ? num(ac[denomId], 0) : 0;
      if (e.total < loU) loU = e.total;
      if (e.total > hiU) hiU = e.total;
      var pt = dv ? sumLoss(e.raw) / dv : 0;
      if (pt < loPT) loPT = pt;
      if (pt > hiPT) hiPT = pt;
      (cfg.leaks || []).forEach(function (L) {
        var p = dv ? e.raw[L.id] / dv : 0;
        if (p < loP[L.id]) loP[L.id] = p;
        if (p > hiP[L.id]) hiP[L.id] = p;
        if (e.leaks[L.id] < loUl[L.id]) loUl[L.id] = e.leaks[L.id];
        if (e.leaks[L.id] > hiUl[L.id]) hiUl[L.id] = e.leaks[L.id];
      });
    }

    /* residual covers uncertainty in the practitioner rate constants themselves, which no
     * input range captures. It applies to BOTH units — the rates are uncertain regardless
     * of how the result is expressed. */
    /* `residual` covers uncertainty in the PRACTITIONER RATE CONSTANTS — the bare literals
     * like 0.0009 or 0.15. A leak built entirely from answered values contains no such
     * constant, so charging it a rate residual invents uncertainty that does not exist.
     * Applying it flat pushed the enterprise-AI upper bound to 110% of spend: a loss larger
     * than the outlay, for leaks that are by definition portions of that outlay.
     * Per leak it applies in full or not at all; for the total it is weighted by how much
     * of the answer actually rests on those constants. */
    var baseRes = (cfg.band && cfg.band.residual) || 0;
    /* A "rate constant" is a number chosen by judgment — 0.0009, 0.15 — and therefore the
     * thing that could be tuned to make cases pass. A literal marked `fixed` is an arithmetic
     * fact (250 working days in a year) with no judgment in it; counting those would both
     * charge a rate residual that is not owed and wrongly classify an unfittable leak as
     * fittable, which is the basis of the held-out split. */
    function hasRateConstant(L) {
      return [].concat(L.mul || [], L.minus || [])
        .some(function (t) { return t.lit !== undefined && t.lit !== 1 && !t.fixed; });
    }
    var rateBorne = 0;
    (cfg.leaks || []).forEach(function (L) {
      if (kindOf(L) === 'loss' && hasRateConstant(L)) rateBorne += Math.abs(point.leaks[L.id]);
    });
    var res = point.total ? baseRes * (rateBorne / Math.abs(point.total)) : baseRes;

    var inU = { point: point.total, lo: loU, hi: hiU };          // input-only, pre-residual
    var inP = { point: pctTotalPoint, lo: loPT, hi: hiPT };
    loU *= (1 - res); hiU *= (1 + res);
    loPT *= (1 - res); hiPT *= (1 + res);

    var perLeak = {};
    (cfg.leaks || []).forEach(function (L) {
      var iu = { point: point.leaks[L.id], lo: loUl[L.id], hi: hiUl[L.id] };   // input-only
      var ip = { point: pctPoint[L.id],   lo: loP[L.id],  hi: hiP[L.id]  };
      var lr = hasRateConstant(L) ? baseRes : 0;                 // full rate residual, or none
      var u  = { point: iu.point, lo: iu.lo * (1 - lr), hi: iu.hi * (1 + lr) };
      var p  = { point: ip.point, lo: ip.lo * (1 - lr), hi: ip.hi * (1 + lr) };
      perLeak[L.id] = { usd: u, pct: p, usdInput: iu, pctInput: ip, natural: naturalUnit(u, p, iu, ip) };
    });

    var n = (cfg.band && cfg.band.precisionInputs || [])
      .filter(function (k) { return answers['exact_' + k]; }).length;
    var refined = cfg.band ? n >= (cfg.refinedAt || 3) : false;

    var totUsd = { point: point.total, lo: loU, hi: hiU };
    var totPct = { point: pctTotalPoint, lo: loPT, hi: hiPT };
    var maxLeak = null;
    (cfg.leaks || []).forEach(function (L) {
      if (kindOf(L) !== 'loss') return;          // the warning names a loss driver, not exposure
      if (!maxLeak || point.leaks[L.id] > point.leaks[maxLeak]) maxLeak = L.id;
    });

    return {
      scores: sc, overall: overall, leaks: point.leaks, total: point.total,
      /* reported alongside the headline, never inside it */
      contingent: point.contingent, unmeasurable: point.unmeasurable,
      kinds: (cfg.leaks || []).reduce(function (m, L) { m[L.id] = kindOf(L); return m; }, {}),
      precisionCount: n, refined: refined,
      lo: loU, hi: hiU,                                   // dollars, kept for callers
      denominator: denomPoint, denominatorId: denomId,
      usd: totUsd, pct: totPct, usdInput: inU, pctInput: inP, byLeak: perLeak,
      natural: naturalUnit(totUsd, totPct, inU, inP),
      /* An implausible share of the business almost always means a bad input. Report the
       * real figure and flag it — clamping would hide the very error worth surfacing. */
      implausible: !!(cfg.plausibleMax && pctTotalPoint > cfg.plausibleMax),
      plausibleMax: cfg.plausibleMax || null,
      largestLeak: maxLeak,
      cornersEvaluated: corners, cornersUsed: used, cornersSkipped: skipped,
      rangedInputs: dims.map(function (x) { return x.id; }),
      /* > 0 means the band is narrower than the truth: that many ranged inputs were dropped */
      rangedTruncated: truncated
    };
  }

  /* Bidirectional exact entry. The unit the user typed is AUTHORITATIVE and is returned
   * bit-identical; the other unit is derived fresh from the denominator every render.
   * Never derive from a displayed (rounded) figure — "0.10%" converted back is not the
   * dollars that produced it, and that is precisely how reversibility breaks. */
  function resolveExact(entry, denom) {
    if (!entry || entry.value === undefined || entry.value === null || entry.value === '') return null;
    var v = parseFloat(entry.value);
    if (!isFinite(v)) return null;
    if (entry.unit === 'pct') return { pct: v, usd: denom ? v * denom : null, entered: 'pct' };
    return { usd: v, pct: denom ? v / denom : null, entered: 'usd' };
  }

  var API = { compute: compute, clamp: clamp, num: num, test: test, product: product,
              factor: factor, spreadOf: spreadOf, resolveExact: resolveExact, EPS: EPS };
  root.SIDEngine = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
