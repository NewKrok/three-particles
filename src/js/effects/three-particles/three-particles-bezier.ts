import { BezierPoint, CurveFunction } from './types.js';

const cache: Array<{
  bezierPoints: Array<BezierPoint>;
  curveFunction: CurveFunction;
  referencedBy: Array<number>;
}> = [];

const nCr = (n: number, k: number) => {
  let z = 1;
  for (let i = 1; i <= k; i++) z *= (n + 1 - i) / i;
  return z;
};

export const createBezierCurveFunction = (
  particleSystemId: number,
  bezierPoints: Array<BezierPoint>
) => {
  const cacheEntry = cache.find((item) => item.bezierPoints === bezierPoints);

  if (cacheEntry) {
    if (!cacheEntry.referencedBy.includes(particleSystemId))
      cacheEntry.referencedBy.push(particleSystemId);
    return cacheEntry.curveFunction;
  }

  const entry = {
    referencedBy: [particleSystemId],
    bezierPoints,
    curveFunction: (percentage: number): number => {
      if (percentage < 0) return bezierPoints[0].y;
      if (percentage > 1) return bezierPoints[bezierPoints.length - 1].y;

      let start = 0;
      let stop = bezierPoints.length - 1;

      bezierPoints.find((point, index) => {
        const result = percentage < (point.percentage ?? 0);
        if (result) stop = index;
        else if (point.percentage !== undefined) start = index;
        return result;
      });

      const n = stop - start;
      const calculatedPercentage =
        (percentage - (bezierPoints[start].percentage ?? 0)) /
        ((bezierPoints[stop].percentage ?? 0) -
          (bezierPoints[start].percentage ?? 0));

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
    },
  };

  cache.push(entry);
  return entry.curveFunction;
};

export const removeBezierCurveFunction = (particleSystemId: number) => {
  while (true) {
    const index = cache.findIndex((item) =>
      item.referencedBy.includes(particleSystemId)
    );
    if (index === -1) break;
    const entry = cache[index];
    entry.referencedBy = entry.referencedBy.filter(
      (id) => id !== particleSystemId
    );
    if (entry.referencedBy.length === 0) cache.splice(index, 1);
  }
};
