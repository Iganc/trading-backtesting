const longToolBtn = document.getElementById('long-tool');
const shortToolBtn = document.getElementById('short-tool');
const lineToolBtn = document.getElementById('line-tool');
const fibToolBtn = document.getElementById('fib-tool');
const rectToolBtn = document.getElementById('rect-tool');
const clearDrawingsBtn = document.getElementById('clear-drawings');
const magnetToolBtn = document.getElementById('magnet-tool');
import { store } from './store.js';
import { removePositionSeries } from './seriesHelpers.js';

export function removeActive() {
    store.isDrawingMode = false;
    store.isFibMode = false;
    store.isRectMode = false;
    store.isShortMode = false;
    store.isLongMode = false;

    lineToolBtn.classList.remove('active');
    fibToolBtn.classList.remove('active');
    rectToolBtn.classList.remove('active');
    shortToolBtn.classList.remove('active');
    longToolBtn.classList.remove('active');

    store.chartContainer.style.cursor = 'default';
}

// Przykład: aktywacja narzędzi
magnetToolBtn.addEventListener('click', () => {
    store.isMagnetMode = !store.isMagnetMode;
    magnetToolBtn.classList.toggle('active', store.isMagnetMode);
});

longToolBtn.addEventListener('click', () => {
    removeActive();
    store.isLongMode = !store.isLongMode;
    longToolBtn.classList.toggle('active', store.isLongMode);
    store.chartContainer.style.cursor = store.isLongMode ? 'crosshair' : 'default';
    store.drawingPoints.length = 0;
    if (store.currentLine) {
        store.chart.removeSeries(store.currentLine);
        store.currentLine = null;
    }
});

shortToolBtn.addEventListener('click', () => {
    removeActive();
    store.isShortMode = !store.isShortMode;
    shortToolBtn.classList.toggle('active', store.isShortMode);
    store.chartContainer.style.cursor = store.isShortMode ? 'crosshair' : 'default';
    store.drawingPoints.length = 0;
    if (store.currentLine) {
        store.chart.removeSeries(store.currentLine);
        store.currentLine = null;
    }
});

lineToolBtn.addEventListener('click', () => {
    removeActive();
    store.isDrawingMode = !store.isDrawingMode;
    lineToolBtn.classList.toggle('active', store.isDrawingMode);
    store.chartContainer.style.cursor = store.isDrawingMode ? 'crosshair' : 'default';
    if (!store.isDrawingMode && store.drawingPoints.length === 1) {
        store.drawingPoints.length = 0;
        if (store.currentLine) {
            store.chart.removeSeries(store.currentLine);
            store.currentLine = null;
        }
    }
});

fibToolBtn.addEventListener('click', () => {
    removeActive();
    store.isFibMode = !store.isFibMode;
    fibToolBtn.classList.toggle('active', store.isFibMode);
    store.chartContainer.style.cursor = store.isFibMode ? 'crosshair' : 'default';
    if (store.currentLine) {
        store.chart.removeSeries(store.currentLine);
        store.currentLine = null;
    }
    store.drawingPoints.length = 0;
});

rectToolBtn.addEventListener('click', () => {
    removeActive();
    store.isRectMode = !store.isRectMode;
    rectToolBtn.classList.toggle('active', store.isRectMode);
    store.chartContainer.style.cursor = store.isRectMode ? 'crosshair' : 'default';
    if (store.currentLine) {
        store.chart.removeSeries(store.currentLine);
        store.currentLine = null;
    }
    store.drawingPoints.length = 0;
});

clearDrawingsBtn.addEventListener('click', () => {
    store.savedLines.forEach(l => store.chart.removeSeries(l));
    store.savedLines.length = 0;

    store.fibSets.forEach(set => {
        set.levels.forEach(l => store.chart.removeSeries(l));
        store.chart.removeSeries(set.trend);
    });
    store.fibSets.length = 0;

    store.rectLines.forEach(l => store.chart.removeSeries(l));
    store.rectLines.length = 0;

    store.longPositions.forEach(p => removePositionSeries(p));
    store.longPositions.length = 0;

    store.shortPositions.forEach(p => removePositionSeries(p));
    store.shortPositions.length = 0;

    if (store.currentLine) {
        store.chart.removeSeries(store.currentLine);
        store.currentLine = null;
        store.drawingPoints.length = 0;
    }
});
