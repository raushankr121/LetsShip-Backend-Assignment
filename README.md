# LetsShyp-Backend-Project
## System Architecture & Design
<p>This project is built as a RESTful API using Node.js, Express, and MySQL, following a modular structure where business logic (courier selection, distance calculation) is separated from route handling. The core logic relies on a Finite State Machine (FSM) to enforce strict order lifecycle transitions (e.g., Created → Assigned → Picked Up → Delivered), ensuring invalid moves are rejected.</p>

<p>Concurrency & Safety: To prevent "Race Conditions" (where two users book the same courier simultaneously), the system uses MySQL Transactions with Row Locking (FOR UPDATE). This locks the selected courier row during the assignment process, ensuring that once a courier is being evaluated for an order, no other request can access them until the transaction commits.</p>

<p>Scalability Improvement: In a production environment, I would replace the current iterative distance calculation with Geospatial Indexing (MySQL Spatial or PostGIS). This would allow for efficient "K-Nearest Neighbor" queries instead of calculating the distance for every courier in the database. Additionally, integrating Redis to cache available courier locations would significantly reduce database read load.</p>

<br>
API Documentation (Postman)
To test the API, import the following requests into Postman or Thunder Client.

## 1. Create Order
Method: POST

URL: http://localhost:3000/orders

Headers: Content-Type: application/json

Body (JSON):

JSON
<br>
{
  "pickup_x": 0,
  "pickup_y": 0,
  "drop_x": 5,
  "drop_y": 5,
  "type": "normal",
  "package_details": "Laptop"
}
<br>
Description: Creates a new order. Automatically assigns the nearest available courier. Downgrades EXPRESS to NORMAL if the distance exceeds 20km.

Expected Type Output
{
    "success": true,
    "orderId": 52,
    "status": "ASSIGNED",
    "assignedCourier": "Courier A"
}

## 2. Update Order Status
Method: PATCH

URL: http://localhost:3000/orders/:id/status

e.g. http://localhost:3000/orders/52/status

(Replace :id with the actual Order ID, e.g., 1)

Headers: Content-Type: application/json

Body (JSON):

JSON
<br>
{
  "newStatus": "PICKED_UP"
}
<br>
Valid Transitions: PICKED_UP → IN_TRANSIT → DELIVERED (or CANCELLED at any stage).

Behavior:

CANCELLED: Immediately frees the courier.

DELIVERED: Frees the courier and updates their location to the drop coordinates.

## 3. Get All Orders
Method: GET

URL: http://localhost:3000/orders
<br>
e.g. http://localhost:3000/orders/

Description: Returns a list of all orders, sorted by newest first.

## 4. Get Single Order
Method: GET

URL: http://localhost:3000/orders/:id
e.g. http://localhost:3000/orders/52

Description: Returns detailed information for a specific order ID.