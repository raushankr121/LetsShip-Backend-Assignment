//distance calculating
function calculateDistance(x1, y1, x2, y2) {
    const xDiff = Math.abs(x2 - x1);
    const yDiff = Math.abs(y2 - y1);
    return xDiff + yDiff;
}

function findBestCourier(couriers, pickupX, pickupY, type) {
    let bestCourier = null;
    let minDistance = Infinity;
    const MAX_EXPRESS_DISTANCE = 5;   // threshold distance
    for (let courier of couriers) {
        const distance = calculateDistance(pickupX, pickupY, courier.current_x, courier.current_y);
        if (type === 'EXPRESS' && distance > MAX_EXPRESS_DISTANCE) {
            continue; // Skip this courier, they are too far!
        }
        if (distance < minDistance) {
            minDistance = distance;
            bestCourier = courier;
        }
    }
    return bestCourier;
}

module.exports = {findBestCourier};