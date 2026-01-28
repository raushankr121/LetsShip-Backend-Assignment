const express = require('express');
const app = express();
const db = require('./db');
const { findBestCourier } = require('./courierLogic');

app.use(express.json());
const MAX_DELIVERY_RANGE = 20;   // maximum delivery range for express 


app.get('/orders/:id', async (req, res) => {
    const orderId = req.params.id;
    const connection = await db.getConnection();
    
    try {
        const [orders] = await connection.query('SELECT * FROM orders WHERE id = ?', [orderId]);
        
        if (orders.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        res.json(orders[0]);
    } catch (e) {
        res.status(500).json({ error: e.message });
    } finally {
        connection.release();
    }
});

// --- GET All Orders API ---
app.get('/orders', async (req, res) => {
    const connection = await db.getConnection();
    try {
        const [orders] = await connection.query('SELECT * FROM orders ORDER BY id DESC');
        res.json(orders);
    } catch (e) {
        res.status(500).json({ error: e.message });
    } finally {
        connection.release();
    }
});


app.post('/orders', async (req, res) => {
    const { pickup_x, pickup_y, drop_x, drop_y, type, package_details } = req.body;

    // checking the missing values
    if (pickup_x === undefined || pickup_y === undefined ||
        drop_x === undefined || drop_y === undefined ||
        !type || !package_details) {
        return res.status(400).json({ error: 'Missing required fields (x, y, type, details)' });
    }

    //making case-insensitive
    const standardType = type.toUpperCase();
    const validTypes = ['NORMAL', 'EXPRESS'];
    if (!validTypes.includes(standardType)) {
        return res.status(400).json({ error: 'Invalid type. Must be NORMAL or EXPRESS' });
    }


    // calculate the distance
    const distance =
        Math.abs(drop_x - pickup_x) +
        Math.abs(drop_y - pickup_y);

    if (distance > MAX_DELIVERY_RANGE && standardType === 'EXPRESS') {
    return res.status(400).json({
        error: `Delivery distance ${distance} exceeds maximum allowed range of ${MAX_DELIVERY_RANGE}`
    });
}




    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
        const [couriers] = await connection.query(
            'SELECT * FROM couriers WHERE is_available = TRUE FOR UPDATE'   //free couriers table
        );

        // Run Logic
        const bestCourier = findBestCourier(couriers, pickup_x, pickup_y, standardType);

        let assignedCourierId = null;
        let orderStatus = 'CREATED';

        if (bestCourier) {
            assignedCourierId = bestCourier.id;
            orderStatus = 'ASSIGNED';

            // Mark courier busy
            await connection.query(
                'UPDATE couriers SET is_available = FALSE WHERE id = ?',   
                [assignedCourierId]
            );
        }

        // Save Order 
        const [result] = await connection.query(
            `INSERT INTO orders 
            (pickup_x, pickup_y, drop_x, drop_y, type, status, courier_id) 
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [pickup_x, pickup_y, drop_x, drop_y, standardType, orderStatus, assignedCourierId]
        );

        await connection.commit();

        res.status(201).json({
            success: true,
            orderId: result.insertId,
            status: orderStatus,
            assignedCourier: bestCourier ? bestCourier.name : 'Courier not available!'
        });

    } catch (error) {
        await connection.rollback();
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        connection.release();
    }
});

const PORT = 3000;
app.get('/', (req, res) => {
    res.send('Let\'s Shyp API is running! 🚀 Send POST requests to /orders');
});


// UPDATE Status (The Full Lifecycle)
app.patch('/orders/:id/status', async (req, res) => {
    const orderId = req.params.id;
    const { newStatus } = req.body;

    // Strict State Machine: We can only move one step forward at a time!
    const validTransitions = {
        'ASSIGNED': ['PICKED_UP','CANCELLED'],
        'PICKED_UP': ['IN_TRANSIT','CANCELLED'],
        'IN_TRANSIT': ['DELIVERED','CANCELLED']
    };

    const connection = await db.getConnection();
    try {
        const [orders] = await connection.query('SELECT * FROM orders WHERE id = ?', [orderId]);
        if (orders.length === 0) return res.status(404).json({ error: 'Order not found' });

        const order = orders[0];

        // Validate the move
        const allowedMoves = validTransitions[order.status];
        if (!allowedMoves || !allowedMoves.includes(newStatus)) {
            return res.status(400).json({
                error: `Invalid move. You are at ${order.status}. Allowed moves: ${allowedMoves}`
            });
        }


        // Update Status
        await connection.query('UPDATE orders SET status = ? WHERE id = ?', [newStatus, orderId]);


        // If CANCELLED, free the courier immediately
        if (newStatus === 'CANCELLED' && order.courier_id) {
            await connection.query('UPDATE couriers SET is_available = TRUE WHERE id = ?', [order.courier_id]);
        }

        // If DELIVERED, free the courier!
        if (newStatus === 'DELIVERED') {
            await connection.query('UPDATE couriers SET is_available = TRUE WHERE id = ?', [order.courier_id]);
        }
        res.json({ success: true, oldStatus: order.status, newStatus: newStatus });

        
    } catch (e) {
        res.status(500).json({ error: e.message });
    } finally {
        connection.release();
    }
});



app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
});