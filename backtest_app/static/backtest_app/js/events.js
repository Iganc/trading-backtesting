import { store } from './store.js';

document.addEventListener('keydown', (e) => {
    if (e.key === 'Shift') {
        store.isShiftKeyPressed = true;
    }
});

document.addEventListener('keyup', (e) => {
    if (e.key === 'Shift') {
        store.isShiftKeyPressed = false;
    }
});

window.addEventListener('candlesUpdated', () => {
    store.candles.length = 0;
    if (window.candles) store.candles.push(...window.candles);
});
