import { store } from './store.js';
import { prepareCandleData } from './utils.js';

const tfMinutes = {
    '1m': 1,
    '5m': 5,
    '15m': 15,
    '1h': 60,
    '4h': 240,
    '1d': 1440
};

export function getCurrentTimeframe() {
    const activeBtn = document.querySelector('.timeframe-btn.active');
    return activeBtn ? activeBtn.dataset.tf : null;
}

export function getCurrentCandles() {
    const tf = getCurrentTimeframe();
    if (typeof chartData !== 'undefined' && chartData[tf]) {
        return chartData[tf];
    }
    return [];
}

let prevTimeframe = getCurrentTimeframe();

export function getInitialReplayIndex() {
    const tf = getCurrentTimeframe();
    const candles = getCurrentCandles();
    if (!tf || !candles.length) return 1;

    const minutes = tfMinutes[tf] || 1;
    const barsFor4h = Math.round(240 / minutes);
    console.log("WYWOŁANO getInitialReplayIndex ")
    return Math.min(barsFor4h, candles.length);
}

let replayIndex = (typeof window.replayIndex !== 'undefined' && Number.isFinite(window.replayIndex))
    ? window.replayIndex
    : getInitialReplayIndex();

export function updateBarReplay() {
    if (typeof window.replayIndex !== 'undefined' && Number.isFinite(window.replayIndex) && window.replayIndex !== replayIndex) {
        replayIndex = window.replayIndex;
    }
    const candles = getCurrentCandles();
    if (!candles.length) return;

    replayIndex = Math.max(1, Math.min(replayIndex, candles.length));
    window.replayIndex = replayIndex;
    const visibleCount = replayIndex;
    const totalCount = Math.min(candles.length, visibleCount + 20);

    const displayCandles = candles.slice(0, totalCount).map((c, i) => {
        if (i >= visibleCount) {
            return {
                ...c,
                open: NaN,
                high: c.close,
                low: c.close,
                color: 'rgba(0,0,0,0)', 
                borderColor: 'rgba(0,0,0,0)',
                wickColor: 'rgba(0,0,0,0)'
            };
        }
        return c;
    });

    
    if (typeof store.candleSeries !== 'undefined') {
        store.candleSeries.setData(prepareCandleData(displayCandles));

        if (store.lastPriceLine) {
            store.candleSeries.removePriceLine(store.lastPriceLine);
            store.lastPriceLine = null;
        }

        if (visibleCount > 0) {
            const lastVisibleCandle = displayCandles[visibleCount - 1];
            if (lastVisibleCandle && !isNaN(lastVisibleCandle.close)) {
                store.lastPriceLine = store.candleSeries.createPriceLine({
                    price: lastVisibleCandle.close,
                    color: 'red',
                    lineWidth: 1,
                    lineStyle: 2,
                    axisLabelVisible: true,
                });
            }
        }
    }
    store.candleSeries.applyOptions({
        lastValueVisible: false,      
        priceLineVisible: false 
    });

    const status = document.getElementById('bar-replay-status');
    if (status) {
        const candles = getCurrentCandles();
        const totalCount = candles.length;
        status.innerHTML = `
            <span class="material-symbols-outlined" style="font-size:20px; color:#007bff; vertical-align:middle;">candlestick_chart</span>
            Pokazano <b>${replayIndex}</b> z <b>${totalCount}</b> świeczek
        `;
    }
}

document.getElementById('bar-replay-prev').addEventListener('click', () => {
    replayIndex--;
    window.replayIndex = replayIndex;
    updateBarReplay();
});
document.getElementById('bar-replay-next').addEventListener('click', () => {
    replayIndex++;
    window.replayIndex = replayIndex;
    updateBarReplay();
});
document.getElementById('bar-replay-fast').addEventListener('click', () => {
    replayIndex += 5;
    window.replayIndex = replayIndex;
    updateBarReplay();
});
document.getElementById('bar-replay-reset').addEventListener('click', () => {
    replayIndex = window.replayIndex || getCurrentCandles().length;
    window.replayIndex = replayIndex;
    updateBarReplay();
});

document.querySelectorAll('.timeframe-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const oldTf = getCurrentTimeframe();
        const newTf = btn.dataset.tf;

        document.querySelectorAll('.timeframe-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const oldMinutes = tfMinutes[oldTf] || 1;
        const newMinutes = tfMinutes[newTf] || 1;

        const newCandles = chartData[newTf] || [];
        const newCount = newCandles.length;

        let newReplayIndex = Math.round(replayIndex * (oldMinutes / newMinutes));
        newReplayIndex = Math.max(1, Math.min(newReplayIndex, newCount));

        replayIndex = newReplayIndex;
        window.replayIndex = replayIndex;

        updateBarReplay();
    });
});
