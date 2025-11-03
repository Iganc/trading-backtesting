import { store } from './store.js';
document.addEventListener('mouseup', e => {
    if (store.isDragging) {
        store.chart.applyOptions({ handleScroll: true, handleScale: true });
        store.isDragging = false;
        store.dragInfo = null;
        store.chartContainer.style.cursor = (store.isLongMode || store.isShortMode || store.isDrawingMode || store.isRectMode || store.isFibMode) ? 'crosshair' : 'default';
        e.preventDefault();
        e.stopPropagation();
    }
});