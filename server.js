require("dotenv").config();

const express = require("express");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 4242;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

const STOCK_FILE = path.join(__dirname, "stock.json");
const ORDERS_FILE = path.join(__dirname, "orders.json");

// SIMPLE ADMIN LOGIN
// CHANGE THESE LATER
const ADMIN_USER = "admin";
const ADMIN_PASS = "hellyea2020!";

// -------------------------
// MIDDLEWARE
// -------------------------
app.use(cors());

// IMPORTANT: Stripe webhook must use raw body
app.use("/webhook", express.raw({ type: "application/json" }));

// Everything else can use normal JSON
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// -------------------------
// SIMPLE ADMIN LOGIN ROUTE
// -------------------------
app.post("/admin-login", (req, res) => {
    const { username, password } = req.body;

    if (username === ADMIN_USER && password === ADMIN_PASS) {
        return res.json({ success: true });
    } else {
        return res.status(401).json({
            success: false,
            message: "Invalid login"
        });
    }
});

// -------------------------
// FILE HELPERS
// -------------------------
function readJsonFile(filePath, fallbackValue) {
    try {
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, JSON.stringify(fallbackValue, null, 2));
            return fallbackValue;
        }

        const raw = fs.readFileSync(filePath, "utf8").trim();

        if (!raw) {
            fs.writeFileSync(filePath, JSON.stringify(fallbackValue, null, 2));
            return fallbackValue;
        }

        return JSON.parse(raw);
    } catch (error) {
        console.error(`FILE READ ERROR (${filePath}):`, error);
        return fallbackValue;
    }
}

function writeJsonFile(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// -------------------------
// STOCK HELPERS
// -------------------------
function readStock() {
    return readJsonFile(STOCK_FILE, {});
}

function saveStock(stock) {
    writeJsonFile(STOCK_FILE, stock);
}

// -------------------------
// ORDER HELPERS
// -------------------------
function readOrders() {
    return readJsonFile(ORDERS_FILE, []);
}

function saveOrders(orders) {
    writeJsonFile(ORDERS_FILE, orders);
}

function generateOrderNumber() {
    return `TFS-${Date.now()}`;
}

function findOrderBySessionId(sessionId) {
    const orders = readOrders();
    return orders.find(order => order.stripeSessionId === sessionId);
}

function findOrderByOrderNumber(orderNumber) {
    const orders = readOrders();
    return orders.find(order => order.orderNumber === orderNumber);
}

// -------------------------
// PAGE ROUTES
// -------------------------
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/success", (req, res) => {
    res.sendFile(path.join(__dirname, "success.html"));
});

app.get("/cart", (req, res) => {
    res.sendFile(path.join(__dirname, "cart.html"));
});

app.get("/orders", (req, res) => {
    res.sendFile(path.join(__dirname, "orders.html"));
});

// IMPORTANT:
// Going to /admin should send people to the login page first
app.get("/admin", (req, res) => {
    res.redirect("/admin-login.html");
});

// Optional direct route if you visit /admin-login
app.get("/admin-login", (req, res) => {
    res.sendFile(path.join(__dirname, "admin-login.html"));
});

// -------------------------
// API ROUTE - GET LIVE STOCK
// -------------------------
app.get("/api/stock", (req, res) => {
    try {
        const stock = readStock();
        res.json(stock);
    } catch (error) {
        console.error("STOCK READ ERROR:", error);
        res.status(500).json({
            error: "Failed to read stock."
        });
    }
});

// -------------------------
// API ROUTE - GET ALL ORDERS
// Customer-facing for now
// -------------------------
app.get("/api/orders", (req, res) => {
    try {
        const orders = readOrders();
        res.json(orders);
    } catch (error) {
        console.error("ORDERS READ ERROR:", error);
        res.status(500).json({
            error: "Failed to read orders."
        });
    }
});

// -------------------------
// API ROUTE - GET ONE ORDER BY ORDER NUMBER
// -------------------------
app.get("/api/orders/:orderNumber", (req, res) => {
    try {
        const { orderNumber } = req.params;
        const order = findOrderByOrderNumber(orderNumber);

        if (!order) {
            return res.status(404).json({
                error: "Order not found."
            });
        }

        res.json(order);
    } catch (error) {
        console.error("ORDER LOOKUP ERROR:", error);
        res.status(500).json({
            error: "Failed to find order."
        });
    }
});

// -------------------------
// API ROUTE - GET ORDER BY STRIPE SESSION ID
// -------------------------
app.get("/api/order/session/:sessionId", (req, res) => {
    try {
        const { sessionId } = req.params;
        const order = findOrderBySessionId(sessionId);

        if (!order) {
            return res.status(404).json({
                error: "Order not found for this session."
            });
        }

        res.json(order);
    } catch (error) {
        console.error("SESSION ORDER LOOKUP ERROR:", error);
        res.status(500).json({
            error: "Failed to find session order."
        });
    }
});

// -------------------------
// ADMIN ROUTES
// TEMP VERSION ONLY
// Frontend admin.js still guards access too
// -------------------------
app.get("/api/admin/orders", (req, res) => {
    try {
        const orders = readOrders();
        res.json(orders);
    } catch (error) {
        console.error("ADMIN ORDERS READ ERROR:", error);
        res.status(500).json({
            error: "Failed to read admin orders."
        });
    }
});

app.post("/api/admin/update-stock", (req, res) => {
    try {
        const { productName, stock } = req.body;

        if (!productName || typeof stock !== "number" || stock < 0) {
            return res.status(400).json({
                error: "Valid productName and stock are required."
            });
        }

        const currentStock = readStock();
        currentStock[productName] = stock;
        saveStock(currentStock);

        res.json({
            success: true,
            message: `${productName} stock updated.`,
            stock: currentStock
        });
    } catch (error) {
        console.error("ADMIN STOCK UPDATE ERROR:", error);
        res.status(500).json({
            error: "Failed to update stock."
        });
    }
});

app.post("/api/admin/delete-order", (req, res) => {
    try {
        const { orderNumber } = req.body;

        if (!orderNumber) {
            return res.status(400).json({
                error: "Order number is required."
            });
        }

        const orders = readOrders();
        const updatedOrders = orders.filter(order => order.orderNumber !== orderNumber);

        if (updatedOrders.length === orders.length) {
            return res.status(404).json({
                error: "Order not found."
            });
        }

        saveOrders(updatedOrders);

        res.json({
            success: true,
            message: `Order ${orderNumber} deleted.`
        });
    } catch (error) {
        console.error("ADMIN DELETE ORDER ERROR:", error);
        res.status(500).json({
            error: "Failed to delete order."
        });
    }
});

// -------------------------
// CHECKOUT
// -------------------------
app.post("/checkout", async (req, res) => {
    try {
        const cart = req.body.cart || [];
        const shipping = Number(req.body.shipping || 0);
        const orderNumber = req.body.orderNumber || generateOrderNumber();

        if (cart.length === 0) {
            return res.status(400).json({
                error: "Cart is empty. Please add items before checkout."
            });
        }

        const stock = readStock();

        for (const item of cart) {
            const available = stock[item.name] ?? 0;

            if (available <= 0) {
                return res.status(400).json({
                    error: `${item.name} is sold out.`
                });
            }

            if (item.quantity > available) {
                return res.status(400).json({
                    error: `Not enough stock for ${item.name}. Only ${available} left.`
                });
            }
        }

        const lineItems = cart.map(item => ({
            price_data: {
                currency: "usd",
                product_data: {
                    name: item.name || "Soap Item"
                },
                unit_amount: Math.round((item.price || 0) * 100)
            },
            quantity: item.quantity || 1
        }));

        if (shipping > 0) {
            lineItems.push({
                price_data: {
                    currency: "usd",
                    product_data: {
                        name: "Shipping"
                    },
                    unit_amount: Math.round(shipping * 100)
                },
                quantity: 1
            });
        }

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            mode: "payment",
            billing_address_collection: "required",
            shipping_address_collection: {
                allowed_countries: ["US"]
            },
            line_items: lineItems,
            client_reference_id: orderNumber,
            metadata: {
                orderNumber,
                shipping: String(shipping)
            },
            success_url: `${BASE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${BASE_URL}/cart`
        });

        res.json({
            url: session.url,
            orderNumber
        });
    } catch (error) {
        console.error("CHECKOUT ERROR:", error);
        res.status(500).json({
            error: error.message
        });
    }
});

// -------------------------
// STRIPE WEBHOOK
// Save order + update stock after successful payment
// -------------------------
app.post("/webhook", async (req, res) => {
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    let event;

    try {
        event = stripe.webhooks.constructEvent(
            req.body,
            req.headers["stripe-signature"],
            endpointSecret
        );
    } catch (error) {
        console.error("WEBHOOK ERROR:", error.message);
        return res.status(400).send(`Webhook Error: ${error.message}`);
    }

    if (event.type === "checkout.session.completed") {
        const session = event.data.object;

        try {
            const orderNumber =
                session.metadata?.orderNumber ||
                session.client_reference_id ||
                generateOrderNumber();

            const shipping = Number(session.metadata?.shipping || 0);

            const existingOrder = findOrderBySessionId(session.id);

            if (!existingOrder) {
                const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
                    limit: 100
                });

                const cart = lineItems.data
                    .filter(item => item.description !== "Shipping")
                    .map(item => ({
                        name: item.description || "Soap Item",
                        price: Number(item.amount_total || 0) / 100 / Number(item.quantity || 1),
                        quantity: Number(item.quantity || 1)
                    }));

                const subtotal = cart.reduce((total, item) => {
                    return total + (Number(item.price || 0) * Number(item.quantity || 0));
                }, 0);

                const total = subtotal + shipping;

                const customerName =
                    session.shipping_details?.name ||
                    session.customer_details?.name ||
                    "Not provided";

                const customerEmail =
                    session.customer_details?.email ||
                    session.customer_email ||
                    "Not provided";

                const shippingAddressObject =
                    session.shipping_details?.address ||
                    session.customer_details?.address ||
                    {};

                const shippingAddress = [
                    shippingAddressObject.line1,
                    shippingAddressObject.line2,
                    shippingAddressObject.city,
                    shippingAddressObject.state,
                    shippingAddressObject.postal_code,
                    shippingAddressObject.country
                ]
                    .filter(Boolean)
                    .join(", ");

                console.log("SESSION SHIPPING DETAILS:", session.shipping_details);
                console.log("SESSION CUSTOMER DETAILS:", session.customer_details);

                const newOrder = {
                    orderNumber,
                    stripeSessionId: session.id,
                    stripePaymentIntent: session.payment_intent || "",
                    items: cart,
                    subtotal,
                    shipping,
                    total,
                    status: "Paid",
                    date: new Date().toLocaleString(),
                    customerName,
                    customerEmail,
                    shippingMethod: shipping > 0 ? `Shipping - $${shipping.toFixed(2)}` : "Free",
                    shippingAddress,
                    street: shippingAddressObject.line1 || "",
                    city: shippingAddressObject.city || "",
                    state: shippingAddressObject.state || "",
                    zip: shippingAddressObject.postal_code || ""
                };

                const orders = readOrders();
                orders.unshift(newOrder);
                saveOrders(orders);
                console.log(`✅ Order saved: ${orderNumber}`);

                const stock = readStock();

                cart.forEach(item => {
                    if (stock[item.name] !== undefined) {
                        stock[item.name] -= item.quantity;

                        if (stock[item.name] < 0) {
                            stock[item.name] = 0;
                        }
                    }
                });

                saveStock(stock);
                console.log("✅ Stock updated after successful payment.");
            } else {
                console.log(`ℹ️ Order already exists for session ${session.id}`);
            }
        } catch (error) {
            console.error("WEBHOOK ORDER/STOCK ERROR:", error);
        }
    }

    res.json({ received: true });
});

// -------------------------
// START SERVER
// -------------------------
app.listen(PORT, () => {
    console.log(`Server running at ${BASE_URL}`);
});