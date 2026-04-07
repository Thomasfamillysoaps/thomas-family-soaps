require('dotenv').config();

const express = require("express");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 4242;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/success", (req, res) => {
    res.sendFile(path.join(__dirname, "success.html"));
});

app.get("/cart", (req, res) => {
    res.sendFile(path.join(__dirname, "cart.html"));
});

app.post("/checkout", async (req, res) => {
    try {
        const cart = req.body.cart || [];
        const shipping = req.body.shipping || 0;

        if (cart.length === 0) {
            return res.status(400).json({
                error: "Cart is empty. Please add items before checkout."
            });
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

app.listen(PORT, () => {
    console.log(`Server running at ${BASE_URL}`);
});