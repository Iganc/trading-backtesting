import { store } from './store.js';
export function pxDist(x1, y1, x2, y2) {
    return Math.hypot(x1 - x2, y1 - y2);
}

export function getTimeValue(time) {
    if (time == null) return 0;
    if (typeof time === 'number') return time;
    return new Date(time.year, time.month - 1, time.day).getTime() / 1000;
}

export function snapTimeToCandle(time) {
    if (!candles || !candles.length) return time;
    let closest = candles[0];
    let minDist = Math.abs(getTimeValue(time) - getTimeValue(closest.time));
    for (const c of candles) {
        const dist = Math.abs(getTimeValue(time) - getTimeValue(c.time));
        if (dist < minDist) {
            closest = c;
            minDist = dist;
        }
    }
    return closest.time;
}

export function pointToLineDistance(px, py, x1, y1, x2, y2) {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;
    const dot = A * C + B * D;
    const len_sq = C * C + D * D;
    let param = -1;
    if (len_sq !== 0) param = dot / len_sq;
    let xx, yy;
    if (param < 0) { xx = x1; yy = y1; }
    else if (param > 1) { xx = x2; yy = y2; }
    else { xx = x1 + param * C; yy = y1 + param * D; }
    return Math.hypot(px - xx, py - yy);
}

export function getCurrentCandleIntervalSec(candles) {
    if (candles.length > 1) {
        return Math.abs(getTimeValue(candles[1].time) - getTimeValue(candles[0].time));
    }
    return 3600;
}

function deltaPxToTime(dx) {
    const scale = store.chart.timeScale();
    const visibleRange = scale.getVisibleRange();
    if (!visibleRange) return 0;
    const bars = visibleRange.to - visibleRange.from;
    if (bars < 2) return 0;
    const pxPerBar = store.chartContainer.offsetWidth / bars;
    const candleInterval = getCurrentCandleIntervalSec();
    let barsDelta = dx / pxPerBar;
    if (Math.abs(barsDelta) > 1) barsDelta = Math.sign(barsDelta);
    return barsDelta * candleInterval;
}

function deltaPxToPrice(dy) {
    const p0 = store.candleSeries.coordinateToPrice(0);
    const p1 = store.candleSeries.coordinateToPrice(dy);
    return p1 - p0;
}

export function clientXYToChartTimePrice(clientX, clientY) {
    const rect = store.chartContainer.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const time = snapTimeToCandle(store.chart.timeScale().coordinateToTime(x));
    const price = store.candleSeries.coordinateToPrice(y);
    return { time, price, x, y };
}

export function priceToY(price) {
    return store.candleSeries.priceToCoordinate(price);
}

export function timeToX(time) {
    return store.chart.timeScale().timeToCoordinate(time);
}

export function prepareCandleData(data) {
    return data.map(d => ({
        time: Number(d.time),
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close
    }));
}
