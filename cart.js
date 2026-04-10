// =========================
// CART + INVENTORY SYSTEM
// Thomas Family Soaps
// =========================

// Default stock fallback
const defaultStock = {
    "Monkey Business": 10,
    "Just Peachy": 10,
    "Green Apple": 10,
    "Tropical Breeze": 10,
    "Beach Bum": 10,
    "Georgia Peaches": 10,
    "Midnight Freeze": 10,
    "Castaway Island": 10
};

let stockCache = { ...defaultStock };

// =========================
// INVENTORY
// =========================
async function getStock() {
    try {
        const response = await fetch("/api/stock");

        if (!response.ok) {
            throw new Error("Failed to load stock");
        }

        const stock = await response.json();
        stockCache = stock;
        return stock;
    } catch (error) {
        console.error("STOCK FETCH ERROR:", error);
        return stockCache;
    }
}

// =========================
// TOAST
// =========================
function showToast(message) {
    const toast = document.createElement("div");
    toast.className = "cart-toast";
    toast.textContent = message;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.add("show");
    }, 100);

    setTimeout(() => {
        toast.classList.remove("show");

        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 2500);
}

// =========================
// CART HELPERS
// =========================
function getCart() {
    return JSON.parse(localStorage.getItem("cart")) || [];
}

function saveCart(cart) {
    localStorage.setItem("cart", JSON.stringify(cart));
}

// =========================
// ADD TO CART
// =========================
function addToCart(name, price, image = "") {
    const cart = getCart();
    const existingItem = cart.find(item => item.name === name);

    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({
            name,
            price,
            image,
            quantity: 1
        });
    }

    saveCart(cart);
    updateCartCount();
    showToast(name + " added to cart!");
}

async function addToCartWithQuantity(name, price, image, qtyId, stockId, buttonId) {
    const stock = await getStock();
    const quantityInput = document.getElementById(qtyId);

    if (!quantityInput) return;

    const quantity = parseInt(quantityInput.value, 10);
    const currentStock = stock[name] ?? 0;

    if (isNaN(quantity) || quantity < 1) {
        showToast("Please select a valid quantity.");
        return;
    }

    if (currentStock <= 0) {
        updateStockDisplay(name, stockId, buttonId);
        return;
    }

    const cart = getCart();
    const existing = cart.find(item => item.name === name);
    const cartQty = existing ? existing.quantity : 0;

    if (cartQty + quantity > currentStock) {
        showToast("Not enough stock available!");
        return;
    }

    if (existing) {
        existing.quantity += quantity;
    } else {
        cart.push({
            name,
            price,
            image,
            quantity
        });
    }

    saveCart(cart);
    updateCartCount();
    showToast(quantity + " " + name + " added to cart!");
}

async function addToCartWithStock(name, price, image, stockId, buttonId) {
    const stock = await getStock();

    const stockElement = document.getElementById(stockId);
    const button = document.getElementById(buttonId);

    const currentStock = stock[name] ?? 0;

    if (currentStock <= 0) {
        if (stockElement) {
            stockElement.textContent = "SOLD OUT";
            stockElement.classList.add("sold-out");
        }

        if (button) {
            button.disabled = true;
            button.textContent = "SOLD OUT";
        }

        return;
    }

    const cart = getCart();
    const existing = cart.find(item => item.name === name);
    const cartQty = existing ? existing.quantity : 0;

    if (cartQty >= currentStock) {
        showToast("No more stock available!");
        return;
    }

    addToCart(name, price, image);
}

// =========================
// STOCK DISPLAY
// =========================
async function updateStockDisplay(name, stockId, buttonId) {
    const stock = await getStock();

    const stockElement = document.getElementById(stockId);
    const button = document.getElementById(buttonId);

    if (!stockElement || !button) return;

    const currentStock = stock[name] ?? 0;

    if (currentStock <= 0) {
        stockElement.textContent = "SOLD OUT";
        stockElement.classList.add("sold-out");
        button.disabled = true;
        button.textContent = "SOLD OUT";
    } else {
        stockElement.textContent = "In Stock: " + currentStock;
        stockElement.classList.remove("sold-out");
        button.disabled = false;
        button.textContent = "Add To Cart";
    }
}

// =========================
// SHIPPING
// =========================
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

// =========================
// CART DISPLAY
// =========================
function displayCart() {
    const cart = getCart();
    const cartItems = document.getElementById("cart-items");
    const totalPrice = document.getElementById("total-price");

    if (!cartItems || !totalPrice) return;

    cartItems.innerHTML = "";

    let subtotal = 0;

    if (cart.length === 0) {
        cartItems.innerHTML = "<p>Your cart is empty.</p>";
        totalPrice.innerHTML = "Subtotal: $0.00";
        updateTotal();
        updateCartCount();
        return;
    }

    cart.forEach((item, index) => {
        const itemTotal = item.price * item.quantity;
        subtotal += itemTotal;

        cartItems.innerHTML += `
            <div class="cart-item">
                <img src="${item.image}" alt="${item.name}" class="cart-item-image">

                <div class="cart-item-details">
                    <h3>${item.name}</h3>
                    <p>$${Number(item.price).toFixed(2)} each</p>

                    <div class="cart-quantity-controls">
                        <button type="button" onclick="changeQuantity(${index}, -1)">−</button>
                        <span>${item.quantity}</span>
                        <button type="button" onclick="changeQuantity(${index}, 1)">+</button>
                    </div>

                    <p><strong>Total: $${itemTotal.toFixed(2)}</strong></p>

                    <button type="button" onclick="removeFromCart(${index})">
                        Remove
                    </button>
                </div>
            </div>
        `;
    });

    totalPrice.innerHTML = `Subtotal: $${subtotal.toFixed(2)}`;
    updateTotal();
    updateCartCount();
}

function removeFromCart(index) {
    const cart = getCart();

    cart.splice(index, 1);

    saveCart(cart);
    displayCart();
    updateCartCount();
}

async function changeQuantity(index, change) {
    const cart = getCart();
    const stock = await getStock();

    const item = cart[index];
    if (!item) return;

    const newQuantity = item.quantity + change;

    if (newQuantity < 1) {
        removeFromCart(index);
        return;
    }

    if (newQuantity > (stock[item.name] ?? 0)) {
        showToast("Not enough stock available!");
        return;
    }

    item.quantity = newQuantity;

    saveCart(cart);
    displayCart();
    updateCartCount();
}

// =========================
// TOTALS
// =========================
function updateTotal() {
    const cart = getCart();

    const subtotalText = document.getElementById("total-price");
    const shippingText = document.getElementById("shipping-price");
    const finalTotalText = document.getElementById("final-total");
    const orderTotalField = document.getElementById("order-total-field");

    let subtotal = 0;

    cart.forEach(item => {
        subtotal += item.price * item.quantity;
    });

    const shipping = calculateShipping(cart);
    const finalTotal = subtotal + shipping;

    if (subtotalText) {
        subtotalText.textContent = `Subtotal: $${subtotal.toFixed(2)}`;
    }

    if (shippingText) {
        shippingText.textContent = `Shipping: $${shipping.toFixed(2)}`;
    }

    if (finalTotalText) {
        finalTotalText.textContent = `Final Total: $${finalTotal.toFixed(2)}`;
    }

    if (orderTotalField) {
        orderTotalField.value = `$${finalTotal.toFixed(2)}`;
    }
}

// =========================
// ORDER PREP
// =========================
function prepareOrder() {
    const cart = getCart();

    const orderItemsField = document.getElementById("order-items-field");
    const orderNumberField = document.getElementById("order-number-field");

    const orderText = cart.map(item => `${item.name} x${item.quantity}`).join(", ");

    let orderNumber = localStorage.getItem("pendingOrderNumber");

    if (!orderNumber) {
        orderNumber = "TFS-" + Date.now();
        localStorage.setItem("pendingOrderNumber", orderNumber);
    }

    if (orderItemsField) {
        orderItemsField.value = orderText;
    }

    if (orderNumberField) {
        orderNumberField.value = orderNumber;
    }

    updateTotal();
}

// =========================
// CHECKOUT
// =========================
async function startCheckout() {
    const cart = getCart();

    if (cart.length === 0) {
        showToast("Your cart is empty.");
        return;
    }

    const shipping = calculateShipping(cart);

    let orderNumber = localStorage.getItem("pendingOrderNumber");
    if (!orderNumber) {
        orderNumber = "TFS-" + Date.now();
        localStorage.setItem("pendingOrderNumber", orderNumber);
    }

    try {
        const response = await fetch("/checkout", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                cart,
                shipping,
                orderNumber
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Checkout failed.");
        }

        window.location.href = data.url;
    } catch (error) {
        console.error("CHECKOUT START ERROR:", error);
        alert(error.message || "Checkout failed.");
    }
}

// =========================
// SUCCESS PAGE
// =========================
async function loadOrderFromSession() {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");

    const summary = document.getElementById("order-summary");
    const orderNumberDisplay = document.getElementById("order-number-display");

    if (!summary || !orderNumberDisplay) return;

    if (!sessionId) {
        orderNumberDisplay.textContent = "We could not find your order session.";
        summary.innerHTML = "<p>Please contact us if your payment went through but this page did not load correctly.</p>";
        return;
    }

    summary.innerHTML = "<p>Loading your order...</p>";

    try {
        const response = await fetch(`/api/order/session/${encodeURIComponent(sessionId)}`);
        const order = await response.json();

        if (!response.ok) {
            throw new Error(order.error || "Could not load order.");
        }

        localStorage.removeItem("cart");
        localStorage.removeItem("pendingOrderNumber");

        orderNumberDisplay.textContent = "Order #: " + (order.order_number || "N/A");

        let html = "<h3>Your Order Summary</h3>";

        (order.items || []).forEach(item => {
            const itemTotal = Number(item.price || 0) * Number(item.quantity || 0);

            html += `
                <p>${item.name} × ${item.quantity}</p>
                <p>$${itemTotal.toFixed(2)}</p>
            `;
        });

        html += "<hr>";
        html += `<p>Subtotal: $${Number(order.subtotal || 0).toFixed(2)}</p>`;
        html += `<p>Shipping: $${Number(order.shipping_total || 0).toFixed(2)}</p>`;
        html += `<p><strong>Total Paid: $${Number(order.total || 0).toFixed(2)}</strong></p>`;

        summary.innerHTML = html;
    } catch (error) {
        console.error("SUCCESS ORDER LOAD ERROR:", error);
        orderNumberDisplay.textContent = "We could not load your order details.";
        summary.innerHTML = "<p>Please contact us if your payment went through but this page did not load correctly.</p>";
    }
}

// =========================
// ORDERS PAGE
// =========================
async function displayOrders() {
    const container = document.getElementById("orders-list");

    if (!container) return;

    container.innerHTML = "<p>Loading your orders...</p>";

    try {
        const response = await fetch("/api/orders");
        const orders = await response.json();

        if (!response.ok) {
            throw new Error(orders.error || "Could not load orders.");
        }

        if (!Array.isArray(orders) || orders.length === 0) {
            container.innerHTML = "<p>No previous orders found.</p>";
            return;
        }

        let html = "";

        orders.forEach(order => {
            let itemsHtml = "";

            (order.items || []).forEach(item => {
                itemsHtml += `
                    <p>${item.name} × ${item.quantity}</p>
                `;
            });

            html += `
                <div class="order-summary">
                    <h3>${order.order_number || "Order"}</h3>
                    <p>${order.created_at || ""}</p>
                    <p>Status: ${order.status || "Paid"}</p>

                    <div class="order-items-list">
                        <h4>Items Ordered:</h4>
                        ${itemsHtml}
                    </div>

                    <p>Subtotal: $${Number(order.subtotal || 0).toFixed(2)}</p>
                    <p>Shipping: $${Number(order.shipping_total || 0).toFixed(2)}</p>
                    <p><strong>Total: $${Number(order.total || 0).toFixed(2)}</strong></p>
                </div>
            `;
        });

        container.innerHTML = html;
    } catch (error) {
        console.error("DISPLAY ORDERS ERROR:", error);
        container.innerHTML = "<p>Could not load orders right now.</p>";
    }
}

// =========================
// CART COUNT
// =========================
function updateCartCount() {
    const cart = getCart();
    const cartLink = document.getElementById("cart-link");

    if (!cartLink) return;

    let totalItems = 0;

    cart.forEach(item => {
        totalItems += item.quantity;
    });

    cartLink.textContent = `🛒 View Your Cart (${totalItems})`;
}

// =========================
// ORDER LOOKUP PAGE
// =========================
async function lookupOrder() {
    const orderNumber = document.getElementById("order-number")?.value.trim();
    const email = document.getElementById("order-email")?.value.trim();

    const messageBox = document.getElementById("order-lookup-message");
    const resultsBox = document.getElementById("order-results");

    if (messageBox) messageBox.innerHTML = "";
    if (resultsBox) resultsBox.innerHTML = "";

    if (!orderNumber || !email) {
        if (messageBox) {
            messageBox.innerHTML = `<p style="color:red;">Please enter both your order number and email.</p>`;
        }
        return;
    }

    try {
        const res = await fetch("/lookup-order", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ orderNumber, email })
        });

        const data = await res.json();

        if (!res.ok) {
            if (messageBox) {
                messageBox.innerHTML = `<p style="color:red;">${data.error || "Order not found. Check your info."}</p>`;
            }
            return;
        }

        renderLookupOrder(data);
    } catch (error) {
        console.error("ORDER LOOKUP ERROR:", error);

        if (messageBox) {
            messageBox.innerHTML = `<p style="color:red;">Something went wrong while looking up your order.</p>`;
        }
    }
}

function renderLookupOrder(order) {
    const resultsBox = document.getElementById("order-results");
    if (!resultsBox) return;

    let itemsHtml = "";

    (order.items || []).forEach(item => {
        const itemTotal = Number(item.price || 0) * Number(item.quantity || 0);

        itemsHtml += `
            <p>${item.name} × ${item.quantity} — $${itemTotal.toFixed(2)}</p>
        `;
    });

    resultsBox.innerHTML = `
        <div class="order-summary">
            <h3>Order ${order.order_number || ""}</h3>
            <p>${order.created_at || ""}</p>
            <p>Status: ${order.status || "Paid"}</p>
            <p><strong>Name:</strong> ${order.customer_name || "Not provided"}</p>
            <p><strong>Email:</strong> ${order.customer_email || "Not provided"}</p>
            <p><strong>Shipping Address:</strong> ${order.shipping_address || "Not provided"}</p>

            <div class="order-items-list">
                <h4>Items Ordered:</h4>
                ${itemsHtml}
            </div>

            <p>Subtotal: $${Number(order.subtotal || 0).toFixed(2)}</p>
            <p>Shipping: $${Number(order.shipping_total || 0).toFixed(2)}</p>
            <p><strong>Total: $${Number(order.total || 0).toFixed(2)}</strong></p>
        </div>
    `;
}

// =========================
// PAGE LOAD
// =========================
window.onload = function () {
    updateStockDisplay("Monkey Business", "stock-monkey", "btn-monkey");
    updateStockDisplay("Just Peachy", "stock-peachy", "btn-peachy");
    updateStockDisplay("Green Apple", "stock-apple", "btn-apple");
    updateStockDisplay("Tropical Breeze", "stock-breeze", "btn-breeze");
    updateStockDisplay("Beach Bum", "stock-beachbum", "btn-beachbum");
    updateStockDisplay("Georgia Peaches", "stock-georgia", "btn-georgia");
    updateStockDisplay("Midnight Freeze", "stock-freeze", "btn-freeze");
    updateStockDisplay("Castaway Island", "stock-castaway", "btn-castaway");

    displayCart();
    updateCartCount();

    const findOrderBtn = document.getElementById("find-order-btn");

    if (findOrderBtn) {
        findOrderBtn.addEventListener("click", lookupOrder);
    }
};