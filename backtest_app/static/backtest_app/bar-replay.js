function getCurrentTimeframe() {
    if (typeof currentTimeframe !== 'undefined') {
        return currentTimeframe;
    }
    const activeBtn = document.querySelector('.timeframe-btn.active');
    if (activeBtn) {
        return activeBtn.dataset.tf;
    }
    return null;
}

function getCurrentCandles() {
    const tf = getCurrentTimeframe();
    if (typeof chartData !== 'undefined' && chartData[tf]) {
        return chartData[tf];
    }
    return [];
}

// Przechowujemy poprzedni TF globalnie
let prevTimeframe = getCurrentTimeframe();

// Funkcja inicjalizująca replayIndex
function getInitialReplayIndex() {
    const tf = getCurrentTimeframe();
    const candles = getCurrentCandles();
    if (!tf || !candles.length) return 1;

    const tfMinutes = {
        '1m': 1,
        '5m': 5,
        '15m': 15,
        '1h': 60,
        '4h': 240,
        '1d': 1440
    };
    const minutes = tfMinutes[tf] || 1;
    const barsFor4h = Math.round(240 / minutes);
    return Math.min(barsFor4h, candles.length);
}

let replayIndex = getInitialReplayIndex();

function updateBarReplay() {
    const candles = getCurrentCandles();
    if (!candles.length) return;

    // Zabezpieczenie zakresu
    replayIndex = Math.max(1, Math.min(replayIndex, candles.length));

    // Pokazujemy replayIndex świeczek + 20 „niewidzialnych”
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

    if (typeof candleSeries !== 'undefined') {
        candleSeries.setData(prepareCandleData(displayCandles));
    }

    const status = document.getElementById('bar-replay-status');
    if (status) {
        status.textContent = `Pokazano ${replayIndex} z ${candles.length} świeczek`;
    }
}

// Przyciski sterujące
document.getElementById('bar-replay-prev').addEventListener('click', () => {
    replayIndex--;
    updateBarReplay();
});
document.getElementById('bar-replay-next').addEventListener('click', () => {
    replayIndex++;
    updateBarReplay();
});
document.getElementById('bar-replay-fast').addEventListener('click', () => {
    replayIndex += 5;
    updateBarReplay();
});
document.getElementById('bar-replay-reset').addEventListener('click', () => {
    replayIndex = getCurrentCandles().length;
    updateBarReplay();
});

// Obsługa zmiany timeframe
document.querySelectorAll('.timeframe-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        setTimeout(() => {
            const newTf = btn.dataset.tf;
            const tfMinutes = { '1m':1,'5m':5,'15m':15,'1h':60,'4h':240,'1d':1440 };
            const oldMinutes = tfMinutes[prevTimeframe] || 1;
            const newMinutes = tfMinutes[newTf] || 1;

            const candles = getCurrentCandles();
            if (candles.length) {
                // przeliczamy replayIndex proporcjonalnie do nowego TF
                replayIndex = Math.round(replayIndex * oldMinutes / newMinutes);
                replayIndex = Math.min(replayIndex, candles.length);
            } else {
                replayIndex = 1;
            }

            prevTimeframe = newTf;
            updateBarReplay();
        }, 0);
    });
});
