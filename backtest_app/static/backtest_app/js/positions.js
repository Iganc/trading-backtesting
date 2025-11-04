import { store } from './store.js';
import { setTwoBoxesForPosition, removePositionSeries } from './seriesHelpers.js';
import { priceToY, timeToX, getTimeValue } from './utils.js';

const HIT_PIXEL_THRESHOLD = 20;
const ENTRY_HIT_PIXEL_THRESHOLD = 15;

export function findNearestPosition(clientX, clientY) {
    const rect = store.chartContainer.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const checkPositions = (positions, side) => {
        for (let i = positions.length - 1; i >= 0; i--) {
            const p = positions[i];
            const minTime = Math.min(p.entryTime, p.endTime || p.entryTime);
            const maxTime = Math.max(p.entryTime, p.endTime || p.entryTime);
            const topY = priceToY(p.tpPrice);
            const bottomY = priceToY(p.slPrice);
            const leftX = timeToX(minTime);
            const rightX = timeToX(maxTime);
            const entryY = priceToY(p.entryPrice);

            if (topY == null || bottomY == null || leftX == null || rightX == null) continue;

            if (Math.abs(y - topY) <= HIT_PIXEL_THRESHOLD && x >= leftX - HIT_PIXEL_THRESHOLD && x <= rightX + HIT_PIXEL_THRESHOLD)
                return { side, index: i, type: 'tp' };
            if (Math.abs(y - bottomY) <= HIT_PIXEL_THRESHOLD && x >= leftX - HIT_PIXEL_THRESHOLD && x <= rightX + HIT_PIXEL_THRESHOLD)
                return { side, index: i, type: 'sl' };

            if (entryY != null && Math.abs(y - entryY) <= ENTRY_HIT_PIXEL_THRESHOLD) {
                if (Math.abs(leftX - rightX) < 2 * ENTRY_HIT_PIXEL_THRESHOLD) {
                    if (Math.abs(x - leftX) <= ENTRY_HIT_PIXEL_THRESHOLD)
                        return { side, index: i, type: 'entry' };
                } else if (x >= leftX && x <= rightX) {
                    return { side, index: i, type: 'entry' };
                }
            }

            const midY = (topY + bottomY) / 2;
            if (
                (Math.abs(y - midY) <= HIT_PIXEL_THRESHOLD && x >= leftX && x <= rightX) ||
                (y > Math.min(topY, bottomY) + HIT_PIXEL_THRESHOLD && y < Math.max(topY, bottomY) - HIT_PIXEL_THRESHOLD && x >= leftX && x <= rightX)
            ) {
                return { side, index: i, type: 'move' };
            }
        }
        return null;
    };

    return checkPositions(store.longPositions, 'long') || checkPositions(store.shortPositions, 'short');
}
