import { store } from './store.js';
import { getTimeValue } from './utils.js';

export function createBoxSeries(color, thinColor) {
    const top = store.chart.addSeries(LightweightCharts.LineSeries, { color, lineWidth: 2, lastValueVisible: false, priceLineVisible: false });
    const bottom = store.chart.addSeries(LightweightCharts.LineSeries, { color, lineWidth: 2, lastValueVisible: false, priceLineVisible: false });
    const left = store.chart.addSeries(LightweightCharts.LineSeries, { color, lineWidth: 2, lastValueVisible: false, priceLineVisible: false });
    const right = store.chart.addSeries(LightweightCharts.LineSeries, { color, lineWidth: 2, lastValueVisible: false, priceLineVisible: false });
    const middle = store.chart.addSeries(LightweightCharts.LineSeries, { color: thinColor || '#333', lineWidth: 1, lineStyle: LightweightCharts.LineStyle.Dashed, lastValueVisible: false, priceLineVisible: false });
    return { top, bottom, left, right, middle };
}

export function setTwoBoxesForPosition(pos) {
    if (
        pos.entryTime == null || pos.endTime == null ||
        pos.entryPrice == null || pos.slPrice == null || pos.tpPrice == null
    ) {
        return;
    }
    const timeA = Math.min(pos.entryTime, pos.endTime);
    const timeB = Math.max(pos.entryTime, pos.endTime);

    const tpTop = Math.max(pos.entryPrice, pos.tpPrice);
    const tpBottom = Math.min(pos.entryPrice, pos.tpPrice);

    pos.tpSeries.top.setData([{ time: timeA, value: tpTop }, { time: timeB, value: tpTop }]);
    pos.tpSeries.bottom.setData([{ time: timeA, value: tpBottom }, { time: timeB, value: tpBottom }]);
    pos.tpSeries.left.setData([{ time: timeA, value: tpBottom }, { time: timeA, value: tpTop }]);
    pos.tpSeries.right.setData([{ time: timeB, value: tpBottom }, { time: timeB, value: tpTop }]);
    pos.tpSeries.middle.setData([{ time: timeA, value: (tpTop + tpBottom)/2 }, { time: timeB, value: (tpTop + tpBottom)/2 }]);

    const slTop = Math.max(pos.entryPrice, pos.slPrice);
    const slBottom = Math.min(pos.entryPrice, pos.slPrice);

    pos.slSeries.top.setData([{ time: timeA, value: slTop }, { time: timeB, value: slTop }]);
    pos.slSeries.bottom.setData([{ time: timeA, value: slBottom }, { time: timeB, value: slBottom }]);
    pos.slSeries.left.setData([{ time: timeA, value: slBottom }, { time: timeA, value: slTop }]);
    pos.slSeries.right.setData([{ time: timeB, value: slBottom }, { time: timeB, value: slTop }]);
    pos.slSeries.middle.setData([{ time: timeA, value: (slTop + slBottom)/2 }, { time: timeB, value: (slTop + slBottom)/2 }]);

    if (pos.entryLine) {
        pos.entryLine.setData([{ time: timeA, value: pos.entryPrice }, { time: timeB, value: pos.entryPrice }]);
    }

    if (pos.areaSeries) {
        const minP = Math.min(pos.slPrice, pos.tpPrice);
        const maxP = Math.max(pos.slPrice, pos.tpPrice);
        pos.areaSeries.setData([
            { time: timeA, value: minP },
            { time: timeA, value: maxP },
            { time: timeB, value: maxP },
            { time: timeB, value: minP },
            { time: timeA, value: minP }
        ]);
    }
}

export function removePositionSeries(pos) {
    try {
        if (pos.areaSeries) store.chart.removeSeries(pos.areaSeries);
        if (pos.entryLine) store.chart.removeSeries(pos.entryLine);

        if (pos.tpSeries) {
            store.chart.removeSeries(pos.tpSeries.top);
            store.chart.removeSeries(pos.tpSeries.bottom);
            store.chart.removeSeries(pos.tpSeries.left);
            store.chart.removeSeries(pos.tpSeries.right);
            store.chart.removeSeries(pos.tpSeries.middle);
        }
        if (pos.slSeries) {
            store.chart.removeSeries(pos.slSeries.top);
            store.chart.removeSeries(pos.slSeries.bottom);
            store.chart.removeSeries(pos.slSeries.left);
            store.chart.removeSeries(pos.slSeries.right);
            store.chart.removeSeries(pos.slSeries.middle);
        }
    } catch (e) {
        // ignore
    }
}

export function safeRemoveLine(line) {
    if (line && line.store.chart) {
        store.chart.removeSeries(line);
    }
    return null;
}

export function snapPriceToCandleLevels(time, price) {
    if (!store.isMagnetMode || !store.candles || !store.candles.length) return price;
    const candle = store.candles.find(c => getTimeValue(c.time) === getTimeValue(time));
    if (!candle) return price;
    const levels = [candle.open, candle.close, candle.high, candle.low];
    let closest = levels[0];
    let minDist = Math.abs(price - closest);
    for (const lvl of levels) {
        const dist = Math.abs(price - lvl);
        if (dist < minDist) {
            closest = lvl;
            minDist = dist;
        }
    }
    return closest;
}
