const nCr = (n, k) => {
  let z = 1;
  for (let i = 1; i <= k; i++) z *= (n + 1 - i) / i;
  return z;
};

export const createBezierCurveFunction = (bezierPoints) => (percentage) => {
  if (percentage < 0) return bezierPoints[0];
  if (percentage > 1) return bezierPoints[bezierPoints.length - 1];

  let start = 0;
  let stop = bezierPoints.length - 1;

  bezierPoints.find((point, index) => {
    const result = percentage < point.percentage;
    if (result) stop = index;
    else if (point.percentage !== undefined) start = index;
    return result;
  });

  const n = stop - start;
  const calculatedPercentage =
    (percentage - bezierPoints[start].percentage) /
    (bezierPoints[stop].percentage - bezierPoints[start].percentage);

  let value = 0;
  for (let i = 0; i <= n; i++) {
    const p = bezierPoints[start + i];
    const c =
      nCr(n, i) *
      Math.pow(1 - calculatedPercentage, n - i) *
      Math.pow(calculatedPercentage, i);
    value += c * p.y;
  }
  return value;
};
