import * as store from './store.js';
import * as utils from './utils.js';
import * as seriesHelpers from './seriesHelpers.js';
import * as positions from './positions.js';
import * as drawing from './drawing.js';
import * as dragging from './dragging.js';
import * as ui from './ui.js';
import * as events from './events.js';
import * as barReplay from './barReplay.js';
import { setChart, setCandleSeries, setChartContainer } from './store.js';
import { handleDrawingMouseDown, handleDrawingMouseMove } from './drawing.js';
import { prepareCandleData } from './utils.js';

const chartContainer = document.getElementById('chart-container');
const legendElement = document.getElementById('legend');

const chartOptions = {
    layout: { background: { color: '#fff' }, textColor: '#333' },
    grid: { vertLines: { color: '#f0f0f0' }, horzLines: { color: '#f0f0f0' } },
    crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
    rightPriceScale: { borderColor: '#d1d4dc' },
    timeScale: { borderColor: '#d1d4dc', timeVisible: true, secondsVisible: false },
    handleScroll: { vertTouchDrag: false },
};

const chart = LightweightCharts.createChart(chartContainer, chartOptions);
const candleSeries = chart.addSeries(LightweightCharts.CandlestickSeries, {
    upColor: '#26a69a',
    downColor: '#ef5350',
    borderVisible: false,
    wickUpColor: '#26a69a',
    wickDownColor: '#ef5350'
});

setChart(chart);
setCandleSeries(candleSeries);
setChartContainer(chartContainer);

chart.applyOptions({
    handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
    },
    handleScale: {
        axisPressedMouseMove: true,
        axisDoubleClickReset: true,
        mouseWheel: true,
        pinch: true,
    },
    timeScale: {
        minBarSpacing: 0.5,
    },
    rightPriceScale: {
        scaleMargins: {
            top: 0.2,    
            bottom: 0.1  
        },
        mode: 1,        
        autoScale: true
    }
});

const chartData = window.chartData || {};
let currentTimeframe = '1h';

function loadTimeframeData(tf) {
    const tfData = chartData[tf] || [];
    if (!tfData.length) { alert('Brak danych dla tego timeframe'); return; }
    window.candles = tfData;
    if (!window.replayIndexInitialized && window.current_candle && Array.isArray(tfData)) {
        const idx = tfData.findIndex(
            c => c.time === window.current_candle.time
        );
        if (idx >= 0) {
            window.replayIndex = idx + 1;
            window.replayIndexInitialized = true;
        }
    }
    window.dispatchEvent(new Event('candlesUpdated'));
    document.querySelectorAll('.timeframe-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.timeframe-btn[data-tf="${tf}"]`)?.classList.add('active');
    barReplay.updateBarReplay();
}

document.querySelectorAll('.timeframe-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        currentTimeframe = btn.dataset.tf;
        loadTimeframeData(currentTimeframe);
    });
});

function resizeChart() {
    chart.applyOptions({ width: chartContainer.clientWidth, height: chartContainer.clientHeight });
}
window.addEventListener('resize', resizeChart);

chart.subscribeCrosshairMove(param => {
    if (!param.seriesPrices) return;
    const data = param.seriesPrices.get(candleSeries);
});

chartContainer.addEventListener('mousedown', handleDrawingMouseDown);
chartContainer.addEventListener('mousemove', handleDrawingMouseMove);

window.addEventListener('load', () => {
    resizeChart();
    loadTimeframeData(currentTimeframe);
    window.dispatchEvent(new Event('candlesUpdated'));
});

document.getElementById('save-session-btn').addEventListener('click', async () => {
    try {
        const candles = window.candles || [];
        const visibleCandles = window.replayIndex || candles.length;
        const totalCandles = candles.length;
        const currentCandleIndex = Math.max(0, visibleCandles - 1);
        const currentCandle = candles[currentCandleIndex] || null;
        
        const sessionData = {
            name: `${window.display_symbol || 'Sesja'} - ${window.start_date || ''}`,
            parameters: {
                symbol: window.display_symbol || '',
                timeframe: store.currentTimeframe || '1h',
                start_date: window.start_date || '',
                end_date: window.end_date || ''
            },
            result: {
                visible_candles: visibleCandles,
                total_candles: totalCandles,
                candles_data: candles,
                current_candle: currentCandle
            }
        };

        const response = await fetch(window.saveSessionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': window.csrf_token || ''
            },
            body: JSON.stringify(sessionData)
        });
        const data = await response.json();
        if (data.session_id) {
            alert('Sesja zapisana! ID: ' + data.session_id);
        } else if (data.error) {
            alert('Błąd: ' + data.error);
        }
        console.log("Session data: ", sessionData);
    } catch (err) {
        console.error(err);
        alert('Wystąpił błąd przy zapisie sesji.');
    }
});
//TODO: turn off magnet mode (temporarily) when pressing shift and drawing a line 