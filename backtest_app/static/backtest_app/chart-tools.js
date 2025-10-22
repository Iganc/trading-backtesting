// full modified file — wszystkie tryby zachowane, long/short: TP i SL jako dwa niezależne prostokąty
// zakładam, że chart, candleSeries, chartContainer, LightweightCharts itp. już są zainicjowane globalnie

console.log('chart global?', typeof chart !== 'undefined', chart);

// --- stan narzędzi ---
let isDrawingMode = false;
let isFibMode = false;
let isRectMode = false;
let drawingPoints = [];
let currentLine = null;
let savedLines = [];
let fibSets = [];
let rectLines = [];
let isShiftKeyPressed = false;
let isLongMode = false;
let isShortMode = false;
let candles = window.candles || [];
window.addEventListener('candlesUpdated', () => {
    candles = window.candles || [];
});

// --- nowe tablice dla pozycji (wielu) ---
// struktura pozycji:
// {
//   entryTime, endTime, entryPrice, slPrice, tpPrice,
//   tpSeries: {top,bottom,left,right,middle},
//   slSeries: {top,bottom,left,right,middle},
//   entryLine: LineSeries,
//   areaSeries: AreaSeries,
//   color, thin
// }
let longPositions = [];
let shortPositions = [];

// --- stan przeciągania ---
let isDragging = false;
let dragInfo = null; // { type: 'sl'|'tp'|'move', side: 'long'|'short', index: number }

// progi w pikselach, jak blisko krawędzi aby uznać kliknięcie za "grab"
const HIT_PIXEL_THRESHOLD = 20;

// Przyciski (zakładam, że istnieją w DOM)
const longToolBtn = document.getElementById('long-tool');
const shortToolBtn = document.getElementById('short-tool');
const lineToolBtn = document.getElementById('line-tool');
const fibToolBtn = document.getElementById('fib-tool');
const rectToolBtn = document.getElementById('rect-tool');
const clearDrawingsBtn = document.getElementById('clear-drawings');

// --- helpery konwersji ---
function clientXYToChartTimePrice(clientX, clientY) {
    const rect = chartContainer.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const time = snapTimeToCandle(chart.timeScale().coordinateToTime(x));
    const price = candleSeries.coordinateToPrice(y);
    return { time, price, x, y };
}
function priceToY(price) {
    return candleSeries.priceToCoordinate(price);
}
function timeToX(time) {
    return chart.timeScale().timeToCoordinate(time);
}
function pxDist(x1, y1, x2, y2) {
    return Math.hypot(x1 - x2, y1 - y2);
}

function snapTimeToCandle(time) {
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

function getTimeValue(time) {
    if (time == null) return 0;
    if (typeof time === 'number') return time;
    return new Date(time.year, time.month - 1, time.day).getTime() / 1000;
}

// --- tworzenie serii dla boxa (zwrot obiektu series) ---
function createBoxSeries(color, thinColor) {
    const top = chart.addSeries(LightweightCharts.LineSeries, { color, lineWidth: 2, lastValueVisible: false, priceLineVisible: false });
    const bottom = chart.addSeries(LightweightCharts.LineSeries, { color, lineWidth: 2, lastValueVisible: false, priceLineVisible: false });
    const left = chart.addSeries(LightweightCharts.LineSeries, { color, lineWidth: 2, lastValueVisible: false, priceLineVisible: false });
    const right = chart.addSeries(LightweightCharts.LineSeries, { color, lineWidth: 2, lastValueVisible: false, priceLineVisible: false });
    const middle = chart.addSeries(LightweightCharts.LineSeries, { color: thinColor || '#333', lineWidth: 1, lineStyle: LightweightCharts.LineStyle.Dashed, lastValueVisible: false, priceLineVisible: false });

    return { top, bottom, left, right, middle };
}

function removeActive(){
    isDrawingMode = false;
    isFibMode = false;
    isRectMode = false;
    isShortMode = false;
    isLongMode = false;
    lineToolBtn.classList.remove('active');
    fibToolBtn.classList.remove('active');
    rectToolBtn.classList.remove('active');
    shortToolBtn.classList.remove('active');
    longToolBtn.classList.remove('active');
    chartContainer.style.cursor = 'default';
}

// --- ustawienie danych dla dwóch boxów w pozycji ---
function setTwoBoxesForPosition(pos) {
    if (
        pos.entryTime == null || pos.endTime == null ||
        pos.entryPrice == null || pos.slPrice == null || pos.tpPrice == null
    ) {
        return;
    }
    const timeA = Math.min(pos.entryTime, pos.endTime);
    const timeB = Math.max(pos.entryTime, pos.endTime);

    // TP box = obszar między entryPrice i tpPrice
    const tpTop = Math.max(pos.entryPrice, pos.tpPrice);
    const tpBottom = Math.min(pos.entryPrice, pos.tpPrice);

    pos.tpSeries.top.setData([{ time: timeA, value: tpTop }, { time: timeB, value: tpTop }]);
    pos.tpSeries.bottom.setData([{ time: timeA, value: tpBottom }, { time: timeB, value: tpBottom }]);
    pos.tpSeries.left.setData([{ time: timeA, value: tpBottom }, { time: timeA, value: tpTop }]);
    pos.tpSeries.right.setData([{ time: timeB, value: tpBottom }, { time: timeB, value: tpTop }]);
    pos.tpSeries.middle.setData([{ time: timeA, value: (tpTop + tpBottom)/2 }, { time: timeB, value: (tpTop + tpBottom)/2 }]);

    // SL box = obszar między entryPrice i slPrice
    const slTop = Math.max(pos.entryPrice, pos.slPrice);
    const slBottom = Math.min(pos.entryPrice, pos.slPrice);

    pos.slSeries.top.setData([{ time: timeA, value: slTop }, { time: timeB, value: slTop }]);
    pos.slSeries.bottom.setData([{ time: timeA, value: slBottom }, { time: timeB, value: slBottom }]);
    pos.slSeries.left.setData([{ time: timeA, value: slBottom }, { time: timeA, value: slTop }]);
    pos.slSeries.right.setData([{ time: timeB, value: slBottom }, { time: timeB, value: slTop }]);
    pos.slSeries.middle.setData([{ time: timeA, value: (slTop + slBottom)/2 }, { time: timeB, value: (slTop + slBottom)/2 }]);

    // entry line (pozioma przez entryPrice)
    if (pos.entryLine) {
        pos.entryLine.setData([{ time: timeA, value: pos.entryPrice }, { time: timeB, value: pos.entryPrice }]);
    }

    // areaSeries to tło pomiędzy min i max (jak wcześniej)
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

// --- usuń boxy serii pozycji ---
function removePositionSeries(pos) {
    try {
        if (pos.areaSeries) chart.removeSeries(pos.areaSeries);
        if (pos.entryLine) chart.removeSeries(pos.entryLine);

        // tp series
        if (pos.tpSeries) {
            chart.removeSeries(pos.tpSeries.top);
            chart.removeSeries(pos.tpSeries.bottom);
            chart.removeSeries(pos.tpSeries.left);
            chart.removeSeries(pos.tpSeries.right);
            chart.removeSeries(pos.tpSeries.middle);
        }
        // sl series
        if (pos.slSeries) {
            chart.removeSeries(pos.slSeries.top);
            chart.removeSeries(pos.slSeries.bottom);
            chart.removeSeries(pos.slSeries.left);
            chart.removeSeries(pos.slSeries.right);
            chart.removeSeries(pos.slSeries.middle);
        }
    } catch (e) {
        // ignore
    }
}

// --- toggle przycisków ---
longToolBtn.addEventListener('click', () => {
    removeActive();
    isLongMode = !isLongMode;
    longToolBtn.classList.toggle('active', isLongMode);
    chartContainer.style.cursor = isLongMode ? 'crosshair' : 'default';
    drawingPoints = [];
    if (currentLine) {
        chart.removeSeries(currentLine);
        currentLine = null;
    }
});

shortToolBtn.addEventListener('click', () => {
    removeActive();
    isShortMode = !isShortMode;
    shortToolBtn.classList.toggle('active', isShortMode);
    chartContainer.style.cursor = isShortMode ? 'crosshair' : 'default';
    drawingPoints = [];
    if (currentLine) {
        chart.removeSeries(currentLine);
        currentLine = null;
    }
});

lineToolBtn.addEventListener('click', () => {
    removeActive();
    isDrawingMode = !isDrawingMode;
    lineToolBtn.classList.toggle('active', isDrawingMode);
    chartContainer.style.cursor = isDrawingMode ? 'crosshair' : 'default';
    if (!isDrawingMode && drawingPoints.length === 1) {
        drawingPoints = [];
        if (currentLine) {
            chart.removeSeries(currentLine);
            currentLine = null;
        }
    }
});

fibToolBtn.addEventListener('click', () => {
    removeActive();
    isFibMode = !isFibMode;
    fibToolBtn.classList.toggle('active', isFibMode);
    chartContainer.style.cursor = isFibMode ? 'crosshair' : 'default';
    if (currentLine) {
        chart.removeSeries(currentLine);
        currentLine = null;
    }
    drawingPoints = [];
});

rectToolBtn.addEventListener('click', () => {
    removeActive();
    isRectMode = !isRectMode;
    rectToolBtn.classList.toggle('active', isRectMode);
    chartContainer.style.cursor = isRectMode ? 'crosshair' : 'default';
    if (currentLine) {
        chart.removeSeries(currentLine);
        currentLine = null;
    }
    drawingPoints = [];
});

document.addEventListener('keydown', (e)=>{
    if (e.key === 'Shift') isShiftKeyPressed = true;
});
document.addEventListener('keyup', (e)=>{
    if (e.key === 'Shift') isShiftKeyPressed = false;
});

// --- Clear All rozszerzony o pozycje long/short ---
clearDrawingsBtn.addEventListener('click', () => {
    savedLines.forEach(l => chart.removeSeries(l));
    savedLines = [];

    fibSets.forEach(set => {
        set.levels.forEach(l => chart.removeSeries(l));
        chart.removeSeries(set.trend);
    });
    fibSets = [];

    rectLines.forEach(l => chart.removeSeries(l));
    rectLines = [];

    longPositions.forEach(p => removePositionSeries(p));
    longPositions = [];
    shortPositions.forEach(p => removePositionSeries(p));
    shortPositions = [];

    if (currentLine) {
        chart.removeSeries(currentLine);
        currentLine = null;
        drawingPoints = [];
    }
});

function safeRemoveLine(line) {
    if (line && line.chart) {
        chart.removeSeries(line);
    }
    return null;
}

// --- find nearest editable element (top/bottom/middle) dla interakcji ---
// zwraca { side, index, type } tak jak wcześniej; działa dla obu list
function findNearestPosition(clientX, clientY) {
    const rect = chartContainer.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // sprawdź longPositions
    for (let i = longPositions.length - 1; i >= 0; i--) {
        const p = longPositions[i];
        const minTime = Math.min(p.entryTime, p.endTime || p.entryTime);
        const maxTime = Math.max(p.entryTime, p.endTime || p.entryTime);
        const topY = priceToY(p.tpPrice);
        const bottomY = priceToY(p.slPrice);
        const leftX = timeToX(minTime);
        const rightX = timeToX(maxTime);
        const entryY = priceToY(p.entryPrice);

        if (topY != null && bottomY != null && leftX != null && rightX != null) {
            if (Math.abs(y - topY) <= HIT_PIXEL_THRESHOLD && x >= leftX - HIT_PIXEL_THRESHOLD && x <= rightX + HIT_PIXEL_THRESHOLD) {
                return { side: 'long', index: i, type: 'tp' };
            }
            if (Math.abs(y - bottomY) <= HIT_PIXEL_THRESHOLD && x >= leftX - HIT_PIXEL_THRESHOLD && x <= rightX + HIT_PIXEL_THRESHOLD) {
                return { side: 'long', index: i, type: 'sl' };
            }
            const midY = (topY + bottomY) / 2;
            if (Math.abs(y - midY) <= HIT_PIXEL_THRESHOLD && x >= leftX && x <= rightX) {
                return { side: 'long', index: i, type: 'move' };
            }
            if (entryY != null && Math.abs(y - entryY) <= HIT_PIXEL_THRESHOLD && x >= leftX && x <= rightX) {
                return { side: 'long', index: i, type: 'entry' };
            }
            if ( y > Math.min(topY, bottomY) + HIT_PIXEL_THRESHOLD && y < Math.max(topY, bottomY) - HIT_PIXEL_THRESHOLD && x >= leftX && x <= rightX) {
                return { side: 'long', index: i, type: 'move' };
            }
        }
    }

    // sprawdź shortPositions
    for (let i = shortPositions.length - 1; i >= 0; i--) {
        const p = shortPositions[i];
        const minTime = Math.min(p.entryTime, p.endTime || p.entryTime);
        const maxTime = Math.max(p.entryTime, p.endTime || p.entryTime);
        const topY = priceToY(p.tpPrice);
        const bottomY = priceToY(p.slPrice);
        const leftX = timeToX(minTime);
        const rightX = timeToX(maxTime);
        const entryY = priceToY(p.entryPrice);

        if (topY != null && bottomY != null && leftX != null && rightX != null) {
            if (Math.abs(y - topY) <= HIT_PIXEL_THRESHOLD && x >= leftX - HIT_PIXEL_THRESHOLD && x <= rightX + HIT_PIXEL_THRESHOLD) {
                return { side: 'short', index: i, type: 'tp' };
            }
            if (Math.abs(y - bottomY) <= HIT_PIXEL_THRESHOLD && x >= leftX - HIT_PIXEL_THRESHOLD && x <= rightX + HIT_PIXEL_THRESHOLD) {
                return { side: 'short', index: i, type: 'sl' };
            }
            const midY = (topY + bottomY) / 2;
            if (Math.abs(y - midY) <= HIT_PIXEL_THRESHOLD && x >= leftX && x <= rightX) {
                return { side: 'short', index: i, type: 'move' };
            }
            if ( entryY != null && Math.abs(y - entryY) <= HIT_PIXEL_THRESHOLD && x >= leftX && x <= rightX) {
                return { side: 'short', index: i, type: 'entry' };
            }
            if ( y > Math.min(topY, bottomY) + HIT_PIXEL_THRESHOLD && y < Math.max(topY, bottomY) - HIT_PIXEL_THRESHOLD && x >= leftX && x <= rightX) {
                return { side: 'long', index: i, type: 'move' };
            }
        }
    }
    return null;
}

function pointToLineDistance(px, py, x1, y1, x2, y2) {
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

function getCurrentCandleIntervalSec() {
    if (candles.length > 1) {
        return Math.abs(getTimeValue(candles[1].time) - getTimeValue(candles[0].time));
    }
    return 3600;
}
function deltaPxToTime(dx) {
    const scale = chart.timeScale();
    const visibleRange = scale.getVisibleRange();
    if (!visibleRange) return 0;
    const bars = visibleRange.to - visibleRange.from;
    if (bars < 2) return 0;
    const pxPerBar = chartContainer.offsetWidth / bars;
    const candleInterval = getCurrentCandleIntervalSec();
    let barsDelta = dx / pxPerBar;
    if (Math.abs(barsDelta) > 1) barsDelta = Math.sign(barsDelta);
    return barsDelta * candleInterval;
}
function deltaPxToPrice(dy) {
    const p0 = candleSeries.coordinateToPrice(0);
    const p1 = candleSeries.coordinateToPrice(dy);
    return p1 - p0;
}

// --- mousedown: tworzenie lub rozpoczęcie drag ---
chartContainer.addEventListener('mousedown', e => {
    if (isDragging) return;

    const hit = findNearestPosition(e.clientX, e.clientY);
    if (hit) {
        // jeśli klikamy na istniejący box (grab) tylko wtedy, gdy nie jesteśmy w trybach rysowania
        if (!isDrawingMode && !isFibMode && !isRectMode && !isLongMode && !isShortMode) {
            const arr = hit.side === 'long' ? longPositions : shortPositions;
            const pos = arr[hit.index];
            if (!pos) return;
            isDragging = true;
            dragInfo = {
                ...hit,
                startX: e.clientX,
                startY: e.clientY,
                startEntryPrice: arr[hit.index].entryPrice,
                startSlPrice: arr[hit.index].slPrice,
                startTpPrice: arr[hit.index].tpPrice,
                startEntryTime: arr[hit.index].entryTime,
                startEndTime: arr[hit.index].endTime
            };
            chart.applyOptions({ handleScroll: false, handleScale: false });
            chartContainer.style.cursor = 'grabbing';
        }
        return;
    }

    // normalne rysowanie / tworzenie long/short
    if (!isDrawingMode && !isFibMode && !isRectMode && !isLongMode && !isShortMode) return;

    const { time, price, x, y } = clientXYToChartTimePrice(e.clientX, e.clientY);
    if (time == null || price == null) {
        console.warn("Clicked outside valid chart area, ignoring.");
        return;
    }

    try {
        if (isLongMode || isShortMode) {
            const entryTime = time;
            const entryPrice = price;

            const defaultDelta = Math.max((chart.priceScale().height || 100) * 0.01, Math.abs(entryPrice) * 0.01);
            let slPrice, tpPrice;
            if (isLongMode) {
                slPrice = entryPrice - defaultDelta;
                tpPrice = entryPrice + (defaultDelta * 2);
            } else {
                slPrice = entryPrice + defaultDelta;
                tpPrice = entryPrice - (defaultDelta * 2);
            }

            const entryIdx = candles.findIndex(c => getTimeValue(c.time) === getTimeValue(entryTime));
            let maxTime;
            if (entryIdx !== -1 && candles.length > entryIdx + 7) {
                maxTime = candles[entryIdx + 7].time;
            } else if (candles.length > 0) {
                maxTime = candles[Math.min(candles.length - 1, entryIdx + 4)].time;
            } else {
                maxTime = entryTime + 60 * 60;
            }
            const minTime = entryTime;
            //TODO: WHEN hovering then enter into EDIT MODE, block the chart from moving
            const color = isLongMode ? '#00f2ffff' : '#ff0400ff';
            const thin = isLongMode ? '#37ff00ff' : '#ff00d0ff';

            // areaSeries (tło) - pokazuje cały zakres od min to max pomiędzy minP,maxP
            const areaSeries = chart.addSeries(LightweightCharts.AreaSeries, {
                topColor: isLongMode ? 'rgba(139,195,74,0.12)' : 'rgba(239,83,80,0.12)',
                bottomColor: isLongMode ? 'rgba(139,195,74,0.08)' : 'rgba(239,83,80,0.08)',
                lineColor: isLongMode ? 'rgba(139,195,74,0.18)' : 'rgba(239,83,80,0.18)',
                lineWidth: 1,
                priceLineVisible: false,
                lastValueVisible: false,
                baseValue: { type: 'price', price: Math.min(slPrice, tpPrice) }
            });

            // tworzymy oddzielne boxy: tp (między entry a tp) oraz sl (między entry a sl)
            const tpSeries = createBoxSeries(color, thin);
            const slSeries = createBoxSeries(color, thin);

            // entry line
            const entryLine = chart.addSeries(LightweightCharts.LineSeries, {
                color: '#333333',
                lineWidth: 1,
                lineStyle: LightweightCharts.LineStyle.Dashed,
                lastValueVisible: false,
                priceLineVisible: false
            });

            const pos = {
                entryTime,
                endTime: maxTime,
                entryPrice,
                slPrice,
                tpPrice,
                tpSeries,
                slSeries,
                entryLine,
                areaSeries,
                color,
                thin
            };

            // ustaw dane dla obu boxów
            setTwoBoxesForPosition(pos);

            if (isLongMode) longPositions.push(pos); else shortPositions.push(pos);

            isDragging = true;
            const arrIndex = isLongMode ? longPositions.length - 1 : shortPositions.length - 1;
            dragInfo = { side: isLongMode ? 'long' : 'short', index: arrIndex, type: 'move' };
            chartContainer.style.cursor = 'grabbing';

            removeActive();
            return;
        } else if (isDrawingMode) {
            // rysowanie linii - twoja istniejąca logika
            if (drawingPoints.length === 0) {
                drawingPoints.push({ time, price });
                currentLine = chart.addSeries(LightweightCharts.LineSeries, {
                    color: '#2196F3',
                    lineWidth: 2,
                    lastValueVisible: false,
                    priceLineVisible: false
                });

                currentLine.setData([
                    { time: drawingPoints[0].time, value: drawingPoints[0].price },
                    { time: drawingPoints[0].time, value: drawingPoints[0].price }
                ]);
            } else if (drawingPoints.length === 1) {
                let finalTime = time;
                let finalPrice = price;
                if (isShiftKeyPressed) {
                    const startX = chart.timeScale().timeToCoordinate(drawingPoints[0].time);
                    const startY = candleSeries.priceToCoordinate(drawingPoints[0].price);
                    if (startX !== null && startY !== null) {
                        const deltaX = x - startX;
                        const deltaY = y - startY;
                        let angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
                        angle = Math.round(angle / 45) * 45;
                        const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
                        const newEndX = startX + length * Math.cos(angle * Math.PI / 180);
                        const newEndY = startY + length * Math.sin(angle * Math.PI / 180);
                        const newTime = chart.timeScale().coordinateToTime(newEndX);
                        const newPrice = candleSeries.coordinateToPrice(newEndY);
                        if (newTime !== null && newPrice !== null) {
                            finalTime = newTime;
                            finalPrice = newPrice;
                        }
                    }
                }
                drawingPoints.push({ time: finalTime, price: finalPrice });
                if (currentLine) {
                    chart.removeSeries(currentLine);
                }
                const newLine = chart.addSeries(LightweightCharts.LineSeries, {
                    color: '#2196F3',
                    lineWidth: 2,
                    lastValueVisible: false,
                    priceLineVisible: false
                });
                const pointsForLibrary = [
                    { time: drawingPoints[0].time, value: drawingPoints[0].price },
                    { time: drawingPoints[1].time, value: drawingPoints[1].price }
                ].sort((a, b) => a.time - b.time);
                newLine.setData(pointsForLibrary);
                savedLines.push(newLine);
                currentLine = null;
                drawingPoints = [];
                removeActive();
            }
        } else if (isFibMode) {
            // fibo logic (bez zmian)
            if (drawingPoints.length === 0) {
                drawingPoints.push({ time, price });
                currentLine = chart.addSeries(LightweightCharts.LineSeries, {
                    color: '#2962FF',
                    lineWidth: 2,
                    lastValueVisible: false,
                    priceLineVisible: false
                });
                currentLine.setData([
                    { time: drawingPoints[0].time, value: drawingPoints[0].price },
                    { time: drawingPoints[0].time, value: drawingPoints[0].price }
                ]);
            } else if (drawingPoints.length === 1) {
                drawingPoints.push({ time, price });
                if (currentLine) {
                    try { chart.removeSeries(currentLine); } catch (error) {}
                    currentLine = null;
                }
                const fibStart = { time: getTimeValue(drawingPoints[0].time), price: drawingPoints[0].price };
                const fibEnd = { time: getTimeValue(drawingPoints[1].time), price: drawingPoints[1].price };
                const fibLevels = [-0.5, 0, 0.5, 0.62, 0.705, 0.79, 1];
                const levels = [];
                for (const level of fibLevels) {
                    const fibPrice = fibStart.price * (1 - level) + fibEnd.price * level;
                    let color = '#000000ff';
                    if (level === 0.62 || level === 0.79) color = '#f30400ff';
                    if (level === 0.705) color = '#2fd537ff';
                    const fibLine = chart.addSeries(LightweightCharts.LineSeries, {
                        color,
                        lineWidth: level === 0 || level === 1 ? 2 : 1,
                        lastValueVisible: true,
                        lastValueAlign: 'right',
                        title: `Fib ${level}`,
                        priceLineVisible: false
                    });
                    const sortedPoints = [
                        { time: fibStart.time, value: fibPrice },
                        { time: fibEnd.time, value: fibPrice }
                    ].sort((a, b) => a.time - b.time);
                    fibLine.setData(sortedPoints);
                    fibLine.applyOptions({
                        lastValueText: `${level} (${fibPrice.toFixed(2)})`
                    });
                    levels.push(fibLine);
                }
                const trendLine = chart.addSeries(LightweightCharts.LineSeries, {
                    color: '#FF6D00',
                    lineWidth: 0,
                    lastValueVisible: false,
                    priceLineVisible: false
                });
                const sortedTrend = [
                    { time: fibStart.time, value: fibStart.price },
                    { time: fibEnd.time, value: fibEnd.price }
                ].sort((a, b) => a.time - b.time);
                trendLine.setData(sortedTrend);
                if (!window.fibSets) window.fibSets = [];
                fibSets.push({
                    levels,
                    trend: trendLine,
                    start: { ...fibStart },
                    end: { ...fibEnd },
                    trendPoints: sortedTrend
                });
                drawingPoints = [];
                removeActive();
            }
        } else if (isRectMode) {
            // prostokąty (bez zmian)
            if (drawingPoints.length === 0) {
                drawingPoints.push({ time, price });
                currentLine = chart.addSeries(LightweightCharts.LineSeries, {
                    color: '#2196F3',
                    lineWidth: 2,
                    lastValueVisible: false,
                    priceLineVisible: false
                });
                currentLine.setData([
                    { time: drawingPoints[0].time, value: drawingPoints[0].price },
                    { time: drawingPoints[0].time, value: drawingPoints[0].price }
                ]);
            } else if (drawingPoints.length === 1) {
                drawingPoints.push({ time, price });

                const t0 = drawingPoints[0].time;
                const t1 = drawingPoints[1].time;
                const minTime = getTimeValue(t0) < getTimeValue(t1) ? t0 : t1;
                const maxTime = getTimeValue(t0) > getTimeValue(t1) ? t0 : t1;
                const minPrice = Math.min(drawingPoints[0].price, drawingPoints[1].price);
                const maxPrice = Math.max(drawingPoints[0].price, drawingPoints[1].price);

                const areaSeries = chart.addSeries(LightweightCharts.AreaSeries, {
                    topColor: 'rgba(33,150,243,0.15)',
                    bottomColor: 'rgba(33,150,243,0.15)',
                    lineColor: 'rgba(33,150,243,0.3)',
                    lineWidth: 1,
                    priceLineVisible: false,
                    lastValueVisible: false,
                    baseValue: { type: 'price', price: minPrice }
                });
                areaSeries.setData([
                    { time: minTime, value: minPrice },
                    { time: minTime, value: maxPrice },
                    { time: maxTime, value: maxPrice },
                    { time: maxTime, value: minPrice },
                    { time: minTime, value: minPrice }
                ]);

                const topLine = chart.addSeries(LightweightCharts.LineSeries, {
                    color: '#2196F3',
                    lineWidth: 2,
                    lastValueVisible: false,
                    priceLineVisible: false
                });
                topLine.setData([
                    { time: minTime, value: maxPrice },
                    { time: maxTime, value: maxPrice }
                ]);
                const bottomLine = chart.addSeries(LightweightCharts.LineSeries, {
                    color: '#2196F3',
                    lineWidth: 2,
                    lastValueVisible: false,
                    priceLineVisible: false
                });
                bottomLine.setData([
                    { time: minTime, value: minPrice },
                    { time: maxTime, value: minPrice }
                ]);
                const leftLine = chart.addSeries(LightweightCharts.LineSeries, {
                    color: '#2196F3',
                    lineWidth: 2,
                    lastValueVisible: false,
                    priceLineVisible: false
                });
                leftLine.setData([
                    { time: minTime, value: minPrice },
                    { time: minTime, value: maxPrice }
                ]);
                const rightLine = chart.addSeries(LightweightCharts.LineSeries, {
                    color: '#2196F3',
                    lineWidth: 2,
                    lastValueVisible: false,
                    priceLineVisible: false
                });
                rightLine.setData([
                    { time: maxTime, value: minPrice },
                    { time: maxTime, value: maxPrice }
                ]);
                const horizontalLine = chart.addSeries(LightweightCharts.LineSeries, {
                    color: '#333333',
                    lineWidth: 1,
                    lineStyle: LightweightCharts.LineStyle.Dashed,
                    lastValueVisible: false,
                    priceLineVisible: false
                });
                const middlePrice = (minPrice + maxPrice) / 2;
                horizontalLine.setData([
                    { time: minTime, value: middlePrice },
                    { time: maxTime, value: middlePrice }
                ]);
                rectLines.push(areaSeries, topLine, bottomLine, leftLine, rightLine, horizontalLine);
                drawingPoints = [];
                removeActive();
            }
        }
    } catch (err) {
        console.error("Error during drawing:", err);
        if (currentLine) {
            chart.removeSeries(currentLine);
            currentLine = null;
        }
        drawingPoints = [];
        removeActive();
    }
});

// --- mousemove: update rysowania lub przeciągania pozycji ---
chartContainer.addEventListener('mousemove', e => {
    if (!isDragging) {
        const hit = findNearestPosition(e.clientX, e.clientY);
        if (hit) {
            if (hit.type === 'tp' || hit.type === 'sl' || hit.type === 'entry') {
                chartContainer.style.cursor = 'ns-resize';
            } else if (hit.type === 'move') {
                chartContainer.style.cursor = 'move';
            } else {
                chartContainer.style.cursor = 'pointer';
            }
        } else {
            chartContainer.style.cursor = (isLongMode || isShortMode || isDrawingMode || isRectMode || isFibMode) ? 'crosshair' : 'default';
        }
    }

    if (isDragging && dragInfo) {
        const { time, price } = clientXYToChartTimePrice(e.clientX, e.clientY);
        if (time == null || price == null) return;

        const arr = dragInfo.side === 'long' ? longPositions : shortPositions;
        const p = arr[dragInfo.index];
        if (!p) return;

        try {
            if (dragInfo.type === 'tp') {
                p.tpPrice = price;
            } else if (dragInfo.type === 'sl') {
                p.slPrice = price;
            } else if (dragInfo.type === 'entry') {
                p.entryPrice = price;
            } else if (dragInfo.type === 'move') {
                // Przesuwanie w pionie (cena)
                const deltaPrice = price - dragInfo.startEntryPrice;
            
                // Przesuwanie w poziomie (czas) - snap do świeczek!
                const rect = chartContainer.getBoundingClientRect();
                const currentX = e.clientX - rect.left;
                const startX = dragInfo.startX - rect.left;
            
                // znajdź indeks świecy na początku i teraz
                const startTime = snapTimeToCandle(chart.timeScale().coordinateToTime(startX));
                const currentTime = snapTimeToCandle(chart.timeScale().coordinateToTime(currentX));
                if (startTime == null || currentTime == null) return;
            
                const startIdx = candles.findIndex(c => getTimeValue(c.time) === getTimeValue(startTime));
                const currentIdx = candles.findIndex(c => getTimeValue(c.time) === getTimeValue(currentTime));
                if (startIdx === -1 || currentIdx === -1) return;
            
                const deltaIdx = currentIdx - startIdx;
            
                // przesuń entryTime i endTime o deltaIdx świec
                const entryIdx = candles.findIndex(c => getTimeValue(c.time) === getTimeValue(dragInfo.startEntryTime));
                const endIdx = candles.findIndex(c => getTimeValue(c.time) === getTimeValue(dragInfo.startEndTime));
                if (entryIdx === -1 || endIdx === -1) return;
            
                const newEntryIdx = entryIdx + deltaIdx;
                const newEndIdx = endIdx + deltaIdx;
            
                // zabezpieczenie przed wyjściem poza zakres
                if (newEntryIdx < 0 || newEndIdx < 0 || newEntryIdx >= candles.length || newEndIdx >= candles.length) return;
            
                p.entryPrice = dragInfo.startEntryPrice + deltaPrice;
                p.slPrice = dragInfo.startSlPrice + deltaPrice;
                p.tpPrice = dragInfo.startTpPrice + deltaPrice;
            
                p.entryTime = candles[newEntryIdx].time;
                p.endTime = candles[newEndIdx].time;
            }

            // zaktualizuj serię dla tej pozycji
            setTwoBoxesForPosition(p);
        } catch (err) {
            console.error("Error during dragging:", err);
        }
        return;
    }

    // jeśli rysujemy new rect/line/fib (Twoja istniejąca logika)
    if ((!isDrawingMode && !isFibMode && !isRectMode) || drawingPoints.length !== 1 || !currentLine) return;

    const rect = chartContainer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const time = snapTimeToCandle(chart.timeScale().coordinateToTime(x));
    const price = candleSeries.coordinateToPrice(y);

    if (time == null || price == null) return;

    try {
        let finalTime = time;
        let finalPrice = price;

        if (isShiftKeyPressed) {
            const startX = chart.timeScale().timeToCoordinate(drawingPoints[0].time);
            const startY = candleSeries.priceToCoordinate(drawingPoints[0].price);

            if (startX !== null && startY !== null) {
                if (isDrawingMode) {
                    const deltaX = x - startX;
                    const deltaY = y - startY;
                    let angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
                    angle = Math.round(angle / 45) * 45;
                    const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
                    const newEndX = startX + length * Math.cos(angle * Math.PI / 180);
                    const newEndY = startY + length * Math.sin(angle * Math.PI / 180);
                    const newTime = chart.timeScale().coordinateToTime(newEndX);
                    const newPrice = candleSeries.coordinateToPrice(newEndY);
                    if (newTime !== null && newPrice !== null) {
                        finalTime = newTime;
                        finalPrice = newPrice;
                    }
                } else if (isRectMode) {
                    const deltaX = x - startX;
                    const deltaY = y - startY;
                    const minDelta = Math.min(Math.abs(deltaX), Math.abs(deltaY));
                    const newEndX = startX + (minDelta * Math.sign(deltaX));
                    const newEndY = startY + (minDelta * Math.sign(deltaY));
                    const newTime = chart.timeScale().coordinateToTime(newEndX);
                    const newPrice = candleSeries.coordinateToPrice(newEndY);
                    if (newTime !== null && newPrice !== null) {
                        finalTime = newTime;
                        finalPrice = newPrice;
                    }
                }
            }
        }

        if (isRectMode) {
            const minTime = Math.min(drawingPoints[0].time, finalTime);
            const maxTime = Math.max(drawingPoints[0].time, finalTime);
            const minPrice = Math.min(drawingPoints[0].price, finalPrice);
            const maxPrice = Math.max(drawingPoints[0].price, finalPrice);

            currentLine.setData([
                { time: minTime, value: minPrice },
                { time: minTime, value: maxPrice },
                { time: maxTime, value: maxPrice },
                { time: maxTime, value: minPrice },
                { time: minTime, value: minPrice }
            ]);
        } else {
            const sortedPoints = [
                { time: drawingPoints[0].time, value: drawingPoints[0].price },
                { time: finalTime, value: finalPrice }
            ].sort((a, b) => a.time - b.time);

            currentLine.setData(sortedPoints);
        }
    } catch (err) {
        console.error("Error updating drawing:", err);
    }
});

// --- mouseup: zakończ drag ---
document.addEventListener('mouseup', e => {
    if (isDragging) {
        chart.applyOptions({ handleScroll: true, handleScale: true });
        isDragging = false;
        dragInfo = null;
        chartContainer.style.cursor = (isLongMode || isShortMode || isDrawingMode || isRectMode || isFibMode) ? 'crosshair' : 'default';
        e.preventDefault();
        e.stopPropagation();
    }
});

// --- (opcjonalne) aktualizacja końców boxów przy zmianie widoku ---
// jeśli chcesz żeby box rozciągał się do widocznego zakresu, odkomentuj i dopasuj
// chart.timeScale().subscribeVisibleTimeRangeChange(() => {
//     [...longPositions, ...shortPositions].forEach(p => {
//         const visibleRange = chart.timeScale().getVisibleRange();
//         if (visibleRange) {
//             p.endTime = visibleRange.to;
//             setTwoBoxesForPosition(p);
//         }
//     });
// });
