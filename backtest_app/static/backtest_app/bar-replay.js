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

let replayIndex = 1;

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

replayIndex = getInitialReplayIndex();

function updateBarReplay() {
    const candles = getCurrentCandles();
    if (replayIndex < 1) replayIndex = 1;
    if (replayIndex > candles.length) replayIndex = candles.length;
    if (typeof candleSeries !== 'undefined') {
        candleSeries.setData(prepareCandleData(candles.slice(0, replayIndex)));
    }
    const status = document.getElementById('bar-replay-status');
    if (status) {
        status.textContent = `Pokazano ${replayIndex} z ${candles.length} świeczek`;
    }
}

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

document.querySelectorAll('.timeframe-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        setTimeout(() => { 
            replayIndex = getInitialReplayIndex();
            updateBarReplay();
        }, 0);
    });
});
