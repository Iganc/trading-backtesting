export const store = {
    chart: null,
    candleSeries: null,
    chartContainer: null,
    candles: [],
    longPositions: [],
    shortPositions: [],
    isDrawingMode: false,
    isFibMode: false,
    isRectMode: false,
    isLongMode: false,
    isShortMode: false,
    isMagnetMode: false,
    isShiftKeyPressed: false,
    drawingPoints: [],
    currentLine: null,
    savedLines: [],
    fibSets: [],
    rectLines: [],
    isDragging: false,
    dragInfo: null
};

export function setChart(c) { store.chart = c; }
export function setCandleSeries(cs) { store.candleSeries = cs; }
export function setChartContainer(cont) { store.chartContainer = cont; }
export function setCandles(arr) { store.candles = arr; }
export function setLongPositions(arr) { store.longPositions = arr; }
export function setShortPositions(arr) { store.shortPositions = arr; }