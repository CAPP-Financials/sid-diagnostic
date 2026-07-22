/* FROZEN ORACLE — do not edit, do not improve, do not refactor.
 *
 * A literal transcription of `recalculate()` from
 * leakage-iq/landing-page/diagnostic.html (lines 1517-1588), lifted verbatim apart from
 * returning `d` instead of calling updateDashboard()/setting window._dr.
 *
 * This is the known-good reference the generic engine is graded against. Its value comes
 * entirely from being untouched: the moment someone "cleans it up", it stops being evidence
 * that the refactor preserved the money math.
 */
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function frozenRecalculate(answers) {
  var rev = parseFloat(answers.revenue) || 0;
  var markets = parseInt(answers.markets) || 1;

  var dataScore = 70;
  if (answers.data_migration === 'messy') dataScore -= 30;
  else if (answers.data_migration === 'partial') dataScore -= 15;
  else if (answers.data_migration === 'clean') dataScore += 10;
  else if (answers.data_migration === 'none') dataScore += 5;
  dataScore += ((parseInt(answers.data_quality) || 5) - 5) * 5;
  if (answers.multi_currency === 'issues') dataScore -= 20;
  else if (answers.multi_currency === 'manual') dataScore -= 10;
  else if (answers.multi_currency === 'handled') dataScore += 5;
  dataScore = clamp(dataScore, 5, 100);

  var fraudExposure = 50;
  if (answers.fraud_detection === 'none') fraudExposure += 30;
  else if (answers.fraud_detection === 'basic') fraudExposure += 10;
  else if (answers.fraud_detection === 'advanced') fraudExposure -= 20;
  else if (answers.fraud_detection === 'unknown') fraudExposure += 20;
  if (answers.abuse_types === 'multiple') fraudExposure += 15;
  else if (answers.abuse_types === 'coupon' || answers.abuse_types === 'referral') fraudExposure += 8;
  fraudExposure -= ((parseInt(answers.fraud_threshold) || 3) - 5) * 4;
  fraudExposure = clamp(fraudExposure, 5, 100);
  var fraudHealth = 100 - fraudExposure;

  var roiScore = 60;
  if (answers.roi_subtract_fraud === 'yes') roiScore += 20;
  else if (answers.roi_subtract_fraud === 'no') roiScore -= 25;
  else if (answers.roi_subtract_fraud === 'partially') roiScore -= 5;
  else if (answers.roi_subtract_fraud === 'unsure') roiScore -= 15;
  if (answers.last_audit === 'never') roiScore -= 20;
  else if (answers.last_audit === 'old') roiScore -= 10;
  else if (answers.last_audit === 'recent') roiScore += 5;
  else if (answers.last_audit === 'current') roiScore += 15;
  roiScore += ((parseInt(answers.roi_confidence) || 4) - 5) * 4;
  roiScore = clamp(roiScore, 5, 100);

  var xmarketScore = 50;
  if (markets <= 1) { xmarketScore = 80; }
  else {
    if (answers.knowledge_sharing === 'none') xmarketScore -= 25;
    else if (answers.knowledge_sharing === 'adhoc') xmarketScore -= 10;
    else if (answers.knowledge_sharing === 'structured') xmarketScore += 10;
    else if (answers.knowledge_sharing === 'systematic') xmarketScore += 25;
    if (answers.cascading === 'never') xmarketScore -= 20;
    else if (answers.cascading === 'slow') xmarketScore -= 8;
    else if (answers.cascading === 'fast') xmarketScore += 10;
    else if (answers.cascading === 'instant') xmarketScore += 20;
    xmarketScore += ((parseInt(answers.market_maturity) || 4) - 5) * 4;
  }
  xmarketScore = clamp(xmarketScore, 5, 100);

  var overall = Math.round(dataScore * 0.3 + fraudHealth * 0.3 + roiScore * 0.25 + xmarketScore * 0.15);

  var fraudLeakRate = 0.03 * (fraudExposure / 50);
  var dataLeakRate = 0.02 * ((100 - dataScore) / 50);
  var roiLeakRate = 0.015 * ((100 - roiScore) / 50);
  var siloLeakRate = markets > 1 ? 0.01 * ((100 - xmarketScore) / 50) : 0;
  if (markets >= 7) { fraudLeakRate *= 1.3; dataLeakRate *= 1.4; }
  else if (markets >= 3) { fraudLeakRate *= 1.15; dataLeakRate *= 1.2; }

  var d = {
    overall: overall, dataScore: dataScore, fraudHealth: fraudHealth, roiScore: roiScore, xmarketScore: xmarketScore,
    fraudLeak: Math.round(rev * fraudLeakRate), dataLeak: Math.round(rev * dataLeakRate),
    roiLeak: Math.round(rev * roiLeakRate), siloLeak: Math.round(rev * siloLeakRate),
    totalLeak: 0, rev: rev, markets: markets, fraudExposure: fraudExposure
  };
  d.totalLeak = d.fraudLeak + d.dataLeak + d.roiLeak + d.siloLeak;
  return d;
}

module.exports = { frozenRecalculate: frozenRecalculate };
