export function estimateRevenue({ pageViews, slotsPerPage, fillRate, cpm, ctr, cpc }) {
  const impressions = Math.round(Number(pageViews) * Number(slotsPerPage) * Number(fillRate));
  const estimatedClicks = Math.round(impressions * Number(ctr));
  const cpmBasedRevenue = Number(((impressions / 1000) * Number(cpm)).toFixed(4));
  const cpcBasedRevenue = Number((estimatedClicks * Number(cpc)).toFixed(4));
  const estimatedRevenue = Number(Math.max(cpmBasedRevenue, cpcBasedRevenue).toFixed(4));
  const projectedMonthlyRevenue = Number(((estimatedRevenue / 14) * 30).toFixed(4));

  return {
    impressions,
    estimatedClicks,
    cpmBasedRevenue,
    cpcBasedRevenue,
    estimatedRevenue,
    projectedMonthlyRevenue,
  };
}
