import { removeActive } from './ui.js';
import { store } from './store.js';
import { snapPriceToCandleLevels, createBoxSeries, setTwoBoxesForPosition } from './seriesHelpers.js';
import { snapTimeToCandle, getTimeValue, clientXYToChartTimePrice } from './utils.js';
import { findNearestPosition } from './positions.js';
export function handleDrawingMouseDown(e){
    if (store.isDragging) return;

    const hit = findNearestPosition(e.clientX, e.clientY);
    if (hit) {
        // jeśli klikamy na istniejący box (grab) tylko wtedy, gdy nie jesteśmy w trybach rysowania
        if (!store.isDrawingMode && !store.isFibMode && !store.isRectMode && !store.isLongMode && !store.isShortMode) {
            const arr = hit.side === 'long' ? store.longPositions : store.shortPositions;
            const pos = arr[hit.index];
            if (!pos) return;
            store.isDragging = true;
            store.dragInfo = {
                ...hit,
                startX: e.clientX,
                startY: e.clientY,
                startEntryPrice: arr[hit.index].entryPrice,
                startSlPrice: arr[hit.index].slPrice,
                startTpPrice: arr[hit.index].tpPrice,
                startEntryTime: arr[hit.index].entryTime,
                startEndTime: arr[hit.index].endTime
            };
            store.chart.applyOptions({ handleScroll: false, handleScale: false });
            store.chartContainer.style.cursor = 'grabbing';
        }
        return;
    }

    // normalne rysowanie / tworzenie long/short
    if (!store.isDrawingMode && !store.isFibMode && !store.isRectMode && !store.isLongMode && !store.isShortMode) return;

    const { time, price, x, y } = clientXYToChartTimePrice(e.clientX, e.clientY);
    const snappedPrice = snapPriceToCandleLevels(time, price);

    if (time == null || price == null) {
        console.warn("Clicked outside valid store.chart area, ignoring.");
        return;
    }

    try {
        if (store.isLongMode || store.isShortMode) {
            const entryTime = time;
            const entryPrice = snappedPrice;

            const defaultDelta = Math.abs(entryPrice) * 0.002;
            let slPrice, tpPrice;
            if (store.isLongMode) {
                slPrice = entryPrice - defaultDelta;
                tpPrice = entryPrice + defaultDelta;
            } else {
                slPrice = entryPrice + defaultDelta;
                tpPrice = entryPrice - defaultDelta;
            }

            const entryIdx = store.candles.findIndex(c => getTimeValue(c.time) === getTimeValue(entryTime));
            let maxTime;
            if (entryIdx !== -1 && store.candles.length > entryIdx + 7) {
                maxTime = store.candles[entryIdx + 7].time;
            } else if (store.candles.length > 0) {
                maxTime = store.candles[Math.min(store.candles.length - 1, entryIdx + 4)].time;
            } else {
                maxTime = entryTime + 60 * 60;
            }
            const minTime = entryTime;
            //TODO: WHEN hovering then enter into EDIT MODE, block the store.chart from moving
            const color = store.isLongMode ? '#00f2ffff' : '#ff0400ff';
            const thin = store.isLongMode ? '#37ff00ff' : '#ff00d0ff';

            // areaSeries (tło) - pokazuje cały zakres od min do max pomiędzy minP,maxP
            const areaSeries = store.chart.addSeries(LightweightCharts.AreaSeries, {
                topColor: store.isLongMode ? 'rgba(139,195,74,0.12)' : 'rgba(239,83,80,0.12)',
                bottomColor: store.isLongMode ? 'rgba(139,195,74,0.08)' : 'rgba(239,83,80,0.08)',
                lineColor: store.isLongMode ? 'rgba(139,195,74,0.18)' : 'rgba(239,83,80,0.18)',
                lineWidth: 1,
                priceLineVisible: false,
                lastValueVisible: false,
                baseValue: { type: 'price', price: Math.min(slPrice, tpPrice) }
            });

            // tworzymy oddzielne boxy: tp (między entry a tp) oraz sl (między entry a sl)
            const tpSeries = createBoxSeries(color, thin);
            const slSeries = createBoxSeries(color, thin);

            // entry line
            const entryLine = store.chart.addSeries(LightweightCharts.LineSeries, {
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

            if (store.isLongMode) store.longPositions.push(pos); else store.shortPositions.push(pos);

            store.isDragging = true;
            const arrIndex = store.isLongMode ? store.longPositions.length - 1 : store.shortPositions.length - 1;
            store.dragInfo = { side: store.isLongMode ? 'long' : 'short', index: arrIndex, type: 'move' };
            store.chartContainer.style.cursor = 'grabbing';

            removeActive();
            return;
        } else if (store.isDrawingMode) {
            if (store.drawingPoints.length === 0) {
                store.drawingPoints.push({ time, price: snappedPrice });
                store.currentLine = store.chart.addSeries(LightweightCharts.LineSeries, {
                    color: '#2196F3',
                    lineWidth: 2,
                    lastValueVisible: false,
                    priceLineVisible: false
                });
                store.currentLine.setData([
                    { time: store.drawingPoints[0].time, value: store.drawingPoints[0].price },
                    { time: store.drawingPoints[0].time, value: store.drawingPoints[0].price }
                ]);
            } else if (store.drawingPoints.length === 1) {
                let finalTime = time;
                let finalPrice = snappedPrice;
                if (store.isShiftKeyPressed) {
                    const startX = store.chart.timeScale().timeToCoordinate(store.drawingPoints[0].time);
                    const startY = store.candleSeries.priceToCoordinate(store.drawingPoints[0].price);
                    if (startX !== null && startY !== null) {
                        const deltaX = x - startX;
                        const deltaY = y - startY;
                        let angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
                        angle = Math.round(angle / 45) * 45;
                        const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
                        const newEndX = startX + length * Math.cos(angle * Math.PI / 180);
                        const newEndY = startY + length * Math.sin(angle * Math.PI / 180);
                        const newTime = store.chart.timeScale().coordinateToTime(newEndX);
                        const newPrice = store.candleSeries.coordinateToPrice(newEndY);
                        if (newTime !== null && newPrice !== null) {
                            finalTime = newTime;
                            finalPrice = snapPriceToCandleLevels(finalTime, newPrice);
                        }
                    }
                }
                store.drawingPoints.push({ time: finalTime, price: finalPrice });
                if (store.currentLine) {
                    store.chart.removeSeries(store.currentLine);
                }
                const newLine = store.chart.addSeries(LightweightCharts.LineSeries, {
                    color: '#2196F3',
                    lineWidth: 2,
                    lastValueVisible: false,
                    priceLineVisible: false
                });
                const pointsForLibrary = [
                    { time: store.drawingPoints[0].time, value: store.drawingPoints[0].price },
                    { time: store.drawingPoints[1].time, value: store.drawingPoints[1].price }
                ].sort((a, b) => a.time - b.time);
                newLine.setData(pointsForLibrary);
                console.log('Rysuję linię:', store.drawingPoints[0], store.drawingPoints[1]);
                console.log('Dodano serię:', store.currentLine);
                store.savedLines.push(newLine);
                store.currentLine = null;
                store.drawingPoints = [];
                removeActive();
                
            }
        } else if (store.isFibMode) {
            // fibo logic (bez zmian poza snap przy zapisie punktów)
            if (store.drawingPoints.length === 0) {
                store.drawingPoints.push({ time, price: snappedPrice });
                store.currentLine = store.chart.addSeries(LightweightCharts.LineSeries, {
                    color: '#2962FF',
                    lineWidth: 2,
                    lastValueVisible: false,
                    priceLineVisible: false
                });
                store.currentLine.setData([
                    { time: store.drawingPoints[0].time, value: store.drawingPoints[0].price },
                    { time: store.drawingPoints[0].time, value: store.drawingPoints[0].price }
                ]);
            } else if (store.drawingPoints.length === 1) {
                store.drawingPoints.push({ time, price: snappedPrice });
                if (store.currentLine) {
                    try { store.chart.removeSeries(store.currentLine); } catch (error) {}
                    store.currentLine = null;
                }
                const fibStart = { time: getTimeValue(store.drawingPoints[0].time), price: store.drawingPoints[0].price };
                const fibEnd = { time: getTimeValue(store.drawingPoints[1].time), price: store.drawingPoints[1].price };
                const fibLevels = [-0.5, 0, 0.5, 0.62, 0.705, 0.79, 1];
                const levels = [];
                for (const level of fibLevels) {
                    const fibPrice = fibStart.price * (1 - level) + fibEnd.price * level;
                    let color = '#000000ff';
                    if (level === 0.62 || level === 0.79) color = '#f30400ff';
                    if (level === 0.705) color = '#2fd537ff';
                    const fibLine = store.chart.addSeries(LightweightCharts.LineSeries, {
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
                const trendLine = store.chart.addSeries(LightweightCharts.LineSeries, {
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
                store.fibSets.push({
                    levels,
                    trend: trendLine,
                    start: { ...fibStart },
                    end: { ...fibEnd },
                    trendPoints: sortedTrend
                });
                store.drawingPoints = [];
                removeActive();
            }
        } else if (store.isRectMode) {
            // prostokąty (bez zmian poza snap przy zapisie punktów)
            if (store.drawingPoints.length === 0) {
                store.drawingPoints.push({ time, price: snappedPrice });
                store.currentLine = store.chart.addSeries(LightweightCharts.LineSeries, {
                    color: '#2196F3',
                    lineWidth: 2,
                    lastValueVisible: false,
                    priceLineVisible: false
                });
                store.currentLine.setData([
                    { time: store.drawingPoints[0].time, value: store.drawingPoints[0].price },
                    { time: store.drawingPoints[0].time, value: store.drawingPoints[0].price }
                ]);
            } else if (store.drawingPoints.length === 1) {
                store.drawingPoints.push({ time, price: snappedPrice });

                const t0 = store.drawingPoints[0].time;
                const t1 = store.drawingPoints[1].time;
                const minTime = getTimeValue(t0) < getTimeValue(t1) ? t0 : t1;
                const maxTime = getTimeValue(t0) > getTimeValue(t1) ? t0 : t1;
                const minPrice = Math.min(store.drawingPoints[0].price, store.drawingPoints[1].price);
                const maxPrice = Math.max(store.drawingPoints[0].price, store.drawingPoints[1].price);

                const areaSeries = store.chart.addSeries(LightweightCharts.AreaSeries, {
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

                const topLine = store.chart.addSeries(LightweightCharts.LineSeries, {
                    color: '#2196F3',
                    lineWidth: 2,
                    lastValueVisible: false,
                    priceLineVisible: false
                });
                topLine.setData([
                    { time: minTime, value: maxPrice },
                    { time: maxTime, value: maxPrice }
                ]);
                const bottomLine = store.chart.addSeries(LightweightCharts.LineSeries, {
                    color: '#2196F3',
                    lineWidth: 2,
                    lastValueVisible: false,
                    priceLineVisible: false
                });
                bottomLine.setData([
                    { time: minTime, value: minPrice },
                    { time: maxTime, value: minPrice }
                ]);
                const leftLine = store.chart.addSeries(LightweightCharts.LineSeries, {
                    color: '#2196F3',
                    lineWidth: 2,
                    lastValueVisible: false,
                    priceLineVisible: false
                });
                leftLine.setData([
                    { time: minTime, value: minPrice },
                    { time: minTime, value: maxPrice }
                ]);
                const rightLine = store.chart.addSeries(LightweightCharts.LineSeries, {
                    color: '#2196F3',
                    lineWidth: 2,
                    lastValueVisible: false,
                    priceLineVisible: false
                });
                rightLine.setData([
                    { time: maxTime, value: minPrice },
                    { time: maxTime, value: maxPrice }
                ]);
                const horizontalLine = store.chart.addSeries(LightweightCharts.LineSeries, {
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
                store.rectLines.push(areaSeries, topLine, bottomLine, leftLine, rightLine, horizontalLine);
                store.drawingPoints = [];
                removeActive();
            }
        }
    } catch (err) {
        console.error("Error during drawing:", err);
        if (store.currentLine) {
            store.chart.removeSeries(store.currentLine);
            store.currentLine = null;
        }
        store.drawingPoints = [];
        removeActive();
    }
};

export function handleDrawingMouseMove(e){
    if (!store.isDragging) {
        const hit = findNearestPosition(e.clientX, e.clientY);
        if (hit) {
            if (hit.type === 'tp' || hit.type === 'sl' || hit.type === 'entry') {
                store.chartContainer.style.cursor = 'ns-resize';
            } else if (hit.type === 'move') {
                store.chartContainer.style.cursor = 'move';
            } else {
                store.chartContainer.style.cursor = 'pointer';
            }
        } else {
            store.chartContainer.style.cursor = (store.isLongMode || store.isShortMode || store.isDrawingMode || store.isRectMode || store.isFibMode) ? 'crosshair' : 'default';
        }
    }

    if (store.isDragging && store.dragInfo) {
        const { time, price } = clientXYToChartTimePrice(e.clientX, e.clientY);
        const snappedPrice = snapPriceToCandleLevels(time, price);
        if (time == null || price == null) return;

        const arr = store.dragInfo.side === 'long' ? store.longPositions : store.shortPositions;
        const p = arr[store.dragInfo.index];
        if (!p) return;

        try {
            if (store.dragInfo.type === 'tp') {
                p.tpPrice = snappedPrice;
            } else if (store.dragInfo.type === 'sl') {
                p.slPrice = snappedPrice;
            } else if (store.dragInfo.type === 'entry') {
                p.entryPrice = snappedPrice;
            } else if (store.dragInfo.type === 'move') {
                // Przesuwanie w pionie (cena)
                const deltaPrice = snappedPrice - store.dragInfo.startEntryPrice;
            
                // Przesuwanie w poziomie (czas) - snap do świeczek!
                const rect = store.chartContainer.getBoundingClientRect();
                const currentX = e.clientX - rect.left;
                const startX = store.dragInfo.startX - rect.left;
            
                // znajdź indeks świecy na początku i teraz
                const startTime = snapTimeToCandle(store.chart.timeScale().coordinateToTime(startX));
                const currentTime = snapTimeToCandle(store.chart.timeScale().coordinateToTime(currentX));
                if (startTime == null || currentTime == null) return;
            
                const startIdx = store.candles.findIndex(c => getTimeValue(c.time) === getTimeValue(startTime));
                const currentIdx = store.candles.findIndex(c => getTimeValue(c.time) === getTimeValue(currentTime));
                if (startIdx === -1 || currentIdx === -1) return;
            
                const deltaIdx = currentIdx - startIdx;
            
                // przesuń entryTime i endTime o deltaIdx świec
                const entryIdx = store.candles.findIndex(c => getTimeValue(c.time) === getTimeValue(store.dragInfo.startEntryTime));
                const endIdx = store.candles.findIndex(c => getTimeValue(c.time) === getTimeValue(store.dragInfo.startEndTime));
                if (entryIdx === -1 || endIdx === -1) return;
            
                const newEntryIdx = entryIdx + deltaIdx;
                const newEndIdx = endIdx + deltaIdx;
            
                // zabezpieczenie przed wyjściem poza zakres
                if (newEntryIdx < 0 || newEndIdx < 0 || newEntryIdx >= store.candles.length || newEndIdx >= store.candles.length) return;
            
                p.entryPrice = store.dragInfo.startEntryPrice + deltaPrice;
                p.slPrice = store.dragInfo.startSlPrice + deltaPrice;
                p.tpPrice = store.dragInfo.startTpPrice + deltaPrice;
            
                p.entryTime = store.candles[newEntryIdx].time;
                p.endTime = store.candles[newEndIdx].time;
            }

            // zaktualizuj serię dla tej pozycji
            setTwoBoxesForPosition(p);
        } catch (err) {
            console.error("Error during dragging:", err);
        }
        return;
    }

    // jeśli rysujemy new rect/line/fib (Twoja istniejąca logika)
    if ((!store.isDrawingMode && !store.isFibMode && !store.isRectMode) || store.drawingPoints.length !== 1 || !store.currentLine) return;

    const rect = store.chartContainer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const time = snapTimeToCandle(store.chart.timeScale().coordinateToTime(x));
    const price = store.candleSeries.coordinateToPrice(y);
    const snappedPrice = snapPriceToCandleLevels(time, price);

    if (time == null || price == null) return;

    try {
        let finalTime = time;
        let finalPrice = snappedPrice;

        if (store.isShiftKeyPressed) {
            const startX = store.chart.timeScale().timeToCoordinate(store.drawingPoints[0].time);
            const startY = store.candleSeries.priceToCoordinate(store.drawingPoints[0].price);

            if (startX !== null && startY !== null) {
                if (store.isDrawingMode) {
                    const deltaX = x - startX;
                    const deltaY = y - startY;
                    let angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
                    angle = Math.round(angle / 45) * 45;
                    const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
                    const newEndX = startX + length * Math.cos(angle * Math.PI / 180);
                    const newEndY = startY + length * Math.sin(angle * Math.PI / 180);
                    const newTime = store.chart.timeScale().coordinateToTime(newEndX);
                    const newPrice = store.candleSeries.coordinateToPrice(newEndY);
                    if (newTime !== null && newPrice !== null) {
                        finalTime = newTime;
                        finalPrice = snapPriceToCandleLevels(finalTime, newPrice);
                    }
                } else if (store.isRectMode) {
                    const deltaX = x - startX;
                    const deltaY = y - startY;
                    const minDelta = Math.min(Math.abs(deltaX), Math.abs(deltaY));
                    const newEndX = startX + (minDelta * Math.sign(deltaX));
                    const newEndY = startY + (minDelta * Math.sign(deltaY));
                    const newTime = store.chart.timeScale().coordinateToTime(newEndX);
                    const newPrice = store.candleSeries.coordinateToPrice(newEndY);
                    if (newTime !== null && newPrice !== null) {
                        finalTime = newTime;
                        finalPrice = snapPriceToCandleLevels(finalTime, newPrice);
                    }
                }
            }
        }

        if (store.isRectMode) {
            const minTime = Math.min(store.drawingPoints[0].time, finalTime);
            const maxTime = Math.max(store.drawingPoints[0].time, finalTime);
            const minPrice = Math.min(store.drawingPoints[0].price, finalPrice);
            const maxPrice = Math.max(store.drawingPoints[0].price, finalPrice);

            store.currentLine.setData([
                { time: minTime, value: minPrice },
                { time: minTime, value: maxPrice },
                { time: maxTime, value: maxPrice },
                { time: maxTime, value: minPrice },
                { time: minTime, value: minPrice }
            ]);
        } else {
            const sortedPoints = [
                { time: store.drawingPoints[0].time, value: store.drawingPoints[0].price },
                { time: finalTime, value: finalPrice }
            ].sort((a, b) => a.time - b.time);

            store.currentLine.setData(sortedPoints);
        }
    } catch (err) {
        console.error("Error updating drawing:", err);
    }
};