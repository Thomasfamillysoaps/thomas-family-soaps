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
// STOCK HELPERS
// -------------------------
function readStock() {
    if (!fs.existsSync(STOCK_FILE)) {
        return {};
    }

    const raw = fs.readFileSync(STOCK_FILE, "utf8");
    return JSON.parse(raw);
}

function saveStock(stock) {
    fs.writeFileSync(STOCK_FILE, JSON.stringify(stock, null, 2));
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
// CHECKOUT
// -------------------------
app.post("/checkout", async (req, res) => {
    try {
        const cart = req.body.cart || [];
        const shipping = req.body.shipping || 0;

        if (cart.length === 0) {
            return res.status(400).json({
                error: "Cart is empty. Please add items before checkout."
            });
        }

        const stock = readStock();

        // Make sure customer is not trying to buy more than available
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

            // Save cart data in Stripe session
            metadata: {
                cart: JSON.stringify(cart),
                shipping: String(shipping)
            },

            success_url: `${BASE_URL}/success.html`,
            cancel_url: `${BASE_URL}/cart.html`
        });

        res.json({ url: session.url });
    } catch (error) {
        console.error("CHECKOUT ERROR:", error);
        res.status(500).json({
            error: error.message
        });
    }
});

// -------------------------
// STRIPE WEBHOOK
// THIS updates stock ONLY after payment succeeds
// -------------------------
app.post("/webhook", (req, res) => {
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
            const cart = JSON.parse(session.metadata.cart || "[]");
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
        } catch (error) {
            console.error("STOCK UPDATE ERROR:", error);
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