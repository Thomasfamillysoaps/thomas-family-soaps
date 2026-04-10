require("dotenv").config();

const express = require("express");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const session = require("express-session");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 4242;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const STOCK_FILE = path.join(__dirname, "stock.json");

// SIMPLE ADMIN LOGIN
// CHANGE THESE LATER
const ADMIN_USER = "admin";
const ADMIN_PASS = "hellyea2020!";

// -------------------------
// CACHE FIX FOR cart.js?v=2
// -------------------------
app.use((req, res, next) => {
    if (req.url.startsWith("/cart.js")) {
        req.url = "/cart.js";
    }
    next();
});

// -------------------------
// MIDDLEWARE
// -------------------------
app.use(cors());

app.use(session({
    secret: process.env.SESSION_SECRET || "tfs-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 2
    }
}));

// Stripe webhook must use raw body
app.use("/webhook", express.raw({ type: "application/json" }));

// Everything else uses JSON
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// -------------------------
// ADMIN SESSION GUARD
// -------------------------
function requireAdmin(req, res, next) {
    if (req.session && req.session.isAdmin) {
        return next();
    }

    return res.status(401).json({
        error: "Unauthorized"
    });
}

// -------------------------
// HELPERS
// -------------------------
function generateOrderNumber() {
    return `TFS-${Date.now()}`;
}

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
async function readStock() {
    const { data, error } = await supabase
        .from("stock")
        .select("*");

    if (error) {
        console.error("Supabase readStock error:", error);
        throw error;
    }

    const stockMap = {};

    (data || []).forEach(item => {
        stockMap[item.product_name] = Number(item.quantity || 0);
    });

    return stockMap;
}

async function updateStockItem(productName, quantity) {
    const { data, error } = await supabase
        .from("stock")
        .update({ quantity: Number(quantity) })
        .eq("product_name", productName)
        .select()
        .single();

    if (error) {
        console.error("Supabase updateStockItem error:", error);
        throw error;
    }

    return data;
}

// -------------------------
// SUPABASE ORDER HELPERS
// -------------------------
async function getAllOrders() {
    const { data, error } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Supabase getAllOrders error:", error);
        throw error;
    }

    return data || [];
}

async function getOrderByOrderNumber(orderNumber) {
    const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("order_number", orderNumber)
        .maybeSingle();

    if (error) {
        console.error("Supabase getOrderByOrderNumber error:", error);
        throw error;
    }

    return data;
}

async function getOrderBySessionId(sessionId) {
    const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("stripe_session_id", sessionId)
        .maybeSingle();

    if (error) {
        console.error("Supabase getOrderBySessionId error:", error);
        throw error;
    }

    return data;
}

async function getOrderByOrderNumberAndEmail(orderNumber, email) {
    const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("order_number", orderNumber)
        .ilike("customer_email", email)
        .maybeSingle();

    if (error) {
        console.error("Supabase getOrderByOrderNumberAndEmail error:", error);
        throw error;
    }

    return data;
}

async function createOrder(orderData) {
    const { data, error } = await supabase
        .from("orders")
        .insert([orderData])
        .select()
        .single();

    if (error) {
        console.error("Supabase createOrder error:", error);
        throw error;
    }

    return data;
}

async function deleteOrderByOrderNumber(orderNumber) {
    const { error } = await supabase
        .from("orders")
        .delete()
        .eq("order_number", orderNumber);

    if (error) {
        console.error("Supabase deleteOrderByOrderNumber error:", error);
        throw error;
    }
}

// -------------------------
// ADMIN LOGIN ROUTES
// -------------------------
app.post("/admin-login", (req, res) => {
    const { username, password } = req.body;

    if (username === ADMIN_USER && password === ADMIN_PASS) {
        req.session.isAdmin = true;
        return res.json({ success: true });
    }

    return res.status(401).json({
        success: false,
        message: "Invalid login"
    });
});

app.post("/admin-logout", (req, res) => {
    req.session.destroy(() => {
        res.json({ success: true });
    });
});

app.get("/api/admin/check", (req, res) => {
    if (req.session && req.session.isAdmin) {
        return res.json({ loggedIn: true });
    }

    return res.status(401).json({ loggedIn: false });
});

// -------------------------
// TEST SUPABASE
// -------------------------
app.get("/test-supabase", async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("orders")
            .select("*")
            .limit(1);

        if (error) {
            throw error;
        }

        res.json({
            success: true,
            message: "Supabase connection worked",
            data
        });
    } catch (err) {
        console.error("Supabase test failed:", err.message);
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

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

app.get("/admin", (req, res) => {
    res.redirect("/admin-login.html");
});

app.get("/admin-login", (req, res) => {
    res.sendFile(path.join(__dirname, "admin-login.html"));
});

// -------------------------
// STOCK ROUTES
// -------------------------
// -------------------------
// STOCK ROUTES (SUPABASE VERSION)
// -------------------------

app.get("/api/stock", async (req, res) => {
    try {
        const stock = await readStock();
        res.json(stock);
    } catch (error) {
        console.error("STOCK READ ERROR:", error);
        res.status(500).json({
            error: "Failed to read stock."
        });
    }
});

app.get("/api/admin/stock", requireAdmin, async (req, res) => {
    try {
        const stock = await readStock();
        res.json(stock);
    } catch (error) {
        console.error("ADMIN STOCK READ ERROR:", error);
        res.status(500).json({
            error: "Failed to read admin stock."
        });
    }
});

app.post("/api/admin/update-stock", requireAdmin, async (req, res) => {
    try {
        const { productName, stock } = req.body;

        if (!productName || typeof stock !== "number" || stock < 0) {
            return res.status(400).json({
                error: "Valid productName and stock are required."
            });
        }

        await updateStockItem(productName, stock);
        const updatedStock = await readStock();

        res.json({
            success: true,
            message: `${productName} stock updated.`,
            stock: updatedStock
        });
    } catch (error) {
        console.error("ADMIN STOCK UPDATE ERROR:", error);
        res.status(500).json({
            error: "Failed to update stock."
        });
    }
});

// -------------------------
// ORDER ROUTES
// -------------------------
app.get("/api/orders", requireAdmin, async (req, res) => {
    try {
        const orders = await getAllOrders();
        res.json(orders);
    } catch (error) {
        console.error("ORDERS READ ERROR:", error);
        res.status(500).json({
            error: "Failed to read orders."
        });
    }
});

app.get("/api/order/:orderNumber", requireAdmin, async (req, res) => {
    try {
        const { orderNumber } = req.params;
        const order = await getOrderByOrderNumber(orderNumber);

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

app.get("/api/order/session/:sessionId", async (req, res) => {
    try {
        const { sessionId } = req.params;
        const order = await getOrderBySessionId(sessionId);

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

app.post("/lookup-order", async (req, res) => {
    try {
        const { orderNumber, email } = req.body;

        if (!orderNumber || !email) {
            return res.status(400).json({
                error: "Order number and email are required."
            });
        }

        const order = await getOrderByOrderNumberAndEmail(
            orderNumber.trim(),
            email.trim()
        );

        if (!order) {
            return res.status(404).json({
                error: "Order not found."
            });
        }

        res.json(order);
    } catch (error) {
        console.error("PRIVATE ORDER LOOKUP ERROR:", error);
        res.status(500).json({
            error: "Failed to look up order."
        });
    }
});

app.post("/api/admin/delete-order", requireAdmin, async (req, res) => {
    try {
        const { orderNumber } = req.body;

        if (!orderNumber) {
            return res.status(400).json({
                error: "Order number is required."
            });
        }

        const existingOrder = await getOrderByOrderNumber(orderNumber);

        if (!existingOrder) {
            return res.status(404).json({
                error: "Order not found."
            });
        }

        await deleteOrderByOrderNumber(orderNumber);

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
function calculateShipping(cart) {
    let totalQuantity = 0;

    cart.forEach(item => {
        totalQuantity += Number(item.quantity || 0);
    });

    if (totalQuantity === 0) {
        return 0;
    } else if (totalQuantity <= 2) {
        return 5.95;
    } else if (totalQuantity <= 5) {
        return 8.95;
    } else {
        return 12.95;
    }
}

app.post("/checkout", async (req, res) => {
    try {
        const cart = req.body.cart || [];
        const orderNumber = req.body.orderNumber || generateOrderNumber();

        if (cart.length === 0) {
            return res.status(400).json({
                error: "Cart is empty. Please add items before checkout."
            });
        }

        const shipping = calculateShipping(cart);
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

        const checkoutSession = await stripe.checkout.sessions.create({
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
            url: checkoutSession.url,
            orderNumber
        });
    } catch (error) {
        console.error("CHECKOUT ERROR:", error);
        res.status(500).json({
            error: error.message || "Checkout failed."
        });
    }
});

// -------------------------
// STRIPE WEBHOOK
// Save order to Supabase + update stock.json
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
        const checkoutSession = event.data.object;

        try {
            console.log("WEBHOOK HIT:", event.type);
            console.log("WEBHOOK SESSION ID:", checkoutSession.id);

            const orderNumber =
                checkoutSession.metadata?.orderNumber ||
                checkoutSession.client_reference_id ||
                generateOrderNumber();

            const shipping = Number(checkoutSession.metadata?.shipping || 0);
            const existingOrder = await getOrderBySessionId(checkoutSession.id);

            if (existingOrder) {
                console.log(`ℹ️ Order already exists for session ${checkoutSession.id}`);
                return res.json({ received: true });
            }

            const lineItems = await stripe.checkout.sessions.listLineItems(checkoutSession.id, {
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

            const shippingAddressObject =
                checkoutSession.shipping_details?.address ||
                checkoutSession.customer_details?.address ||
                {};

            const shippingAddress = [
                shippingAddressObject.line1,
                shippingAddressObject.line2,
                shippingAddressObject.city,
                shippingAddressObject.state,
                shippingAddressObject.postal_code,
                shippingAddressObject.country
            ].filter(Boolean).join(", ");

            const newOrder = {
                order_number: orderNumber,
                stripe_session_id: checkoutSession.id,
                stripe_payment_intent: checkoutSession.payment_intent || "",

                items: cart,
                subtotal: Number(subtotal || 0),
                total: Number(total || 0),
                status: "Paid",

                customer_name:
                    checkoutSession.customer_details?.name ||
                    checkoutSession.shipping_details?.name ||
                    "Not provided",

                customer_email:
                    checkoutSession.customer_details?.email ||
                    checkoutSession.customer_email ||
                    "Not provided",

                shipping_method: shipping > 0 ? `Shipping - $${shipping.toFixed(2)}` : "Free",

                shipping_address: shippingAddress || "",
                street: shippingAddressObject.line1 || "",
                line2: shippingAddressObject.line2 || "",
                city: shippingAddressObject.city || "",
                state: shippingAddressObject.state || "",
                zip: shippingAddressObject.postal_code || "",
                country: shippingAddressObject.country || "",

                shipping: {
                    full_address: shippingAddress || "",
                    street: shippingAddressObject.line1 || "",
                    line2: shippingAddressObject.line2 || "",
                    city: shippingAddressObject.city || "",
                    state: shippingAddressObject.state || "",
                    zip: shippingAddressObject.postal_code || "",
                    country: shippingAddressObject.country || ""
                }
            };

            console.log("TRYING TO SAVE ORDER:", newOrder);

            await createOrder(newOrder);

            console.log("ORDER SAVE SUCCESS");
            console.log(`✅ Order saved to Supabase: ${orderNumber}`);
            console.log("CART FOR STOCK UPDATE:", cart);

            
const stock = await readStock();

for (const item of cart) {
    if (stock[item.name] !== undefined) {
        const newQuantity = Math.max(
            0,
            Number(stock[item.name]) - Number(item.quantity || 0)
        );

        await updateStockItem(item.name, newQuantity);
    }
}

console.log("✅ Stock updated in Supabase");
            saveStock(stock);
            console.log("✅ Stock updated");
        } catch (error) {
            console.error("WEBHOOK PROCESS ERROR FULL:", error);
            return res.status(500).json({
                error: error.message || "Webhook failed"
            });
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