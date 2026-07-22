(function (root) {
  'use strict';
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  var EPS = 1e-9;
  function sumRaw(raw) { var s = 0; for (var k in raw) s += raw[k]; return s; }
  function spreadOf(b) {
    var w = b.hi - b.lo;
    if (Math.abs(b.point) < EPS) return w < EPS ? 0 : Infinity;
    return w / Math.abs(b.point);
  }
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
  function num(v, d) { var n = parseFloat(v); return n || d || 0; }
  function test(p, ans, sc) {
    if (!p) return true;
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
  function factor(t, ans, sc) {
    if (t.lit   !== undefined) return t.lit;
    if (t.score !== undefined) return (100 - sc[t.score]) / t.pivot;
    if (t.oneMinus !== undefined) return 1 - factor(t.oneMinus, ans, sc);
    if (t.ans !== undefined) {
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
  function visible(q, ans, sc) { return !q.showIf || test(q.showIf, ans, sc); }
  function compute(cfg, answers) {
    var sc = {}, i;
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
    cfg.categories.forEach(function (c) {
      if (c.fallback && test(c.fallback.when, answers, sc)) sc[c.id] = c.fallback.score;
      sc[c.id] = clamp(sc[c.id], c.clamp[0], c.clamp[1]);
      if (c.invert) sc[c.id] = 100 - sc[c.id];
    });
    var overall = Math.round(cfg.categories.reduce(function (a, c) {
      return a + sc[c.id] * c.weight;
    }, 0));
    var mult = {};
    var ms = cfg.multipliers || [];
    for (i = 0; i < ms.length; i++) {
      if (test(ms[i].when, answers, sc)) { mult = ms[i].apply; break; }
    }
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
    (cfg.leaks || []).forEach(function (L) {
      [].concat(L.mul || [], L.minus || []).forEach(function (t) {
        if (t.ans !== undefined && t.range && answers[t.ans] === undefined) addRange(t.ans, t.range);
      });
    });
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
    var lossIds = (cfg.leaks || []).filter(function (L) { return kindOf(L) === 'loss'; })
                                   .map(function (L) { return L.id; });
    function sumLoss(raw) { var s = 0; lossIds.forEach(function (id) { s += raw[id]; }); return s; }
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
    var corners = 1 << dims.length, skipped = 0, used = 0;
    for (var c = 0; c < corners; c++) {
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
    var baseRes = (cfg.band && cfg.band.residual) || 0;
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
      contingent: point.contingent, unmeasurable: point.unmeasurable,
      kinds: (cfg.leaks || []).reduce(function (m, L) { m[L.id] = kindOf(L); return m; }, {}),
      precisionCount: n, refined: refined,
      lo: loU, hi: hiU,                                   // dollars, kept for callers
      denominator: denomPoint, denominatorId: denomId,
      usd: totUsd, pct: totPct, usdInput: inU, pctInput: inP, byLeak: perLeak,
      natural: naturalUnit(totUsd, totPct, inU, inP),
      implausible: !!(cfg.plausibleMax && pctTotalPoint > cfg.plausibleMax),
      plausibleMax: cfg.plausibleMax || null,
      largestLeak: maxLeak,
      cornersEvaluated: corners, cornersUsed: used, cornersSkipped: skipped,
      rangedInputs: dims.map(function (x) { return x.id; }),
      rangedTruncated: truncated
    };
  }
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