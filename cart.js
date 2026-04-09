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
    let toast = document.createElement("div");
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
    let cart = getCart();
    let existingItem = cart.find(item => item.name === name);

    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({
            name: name,
            price: price,
            image: image,
            quantity: 1
        });
    }

    saveCart(cart);
    updateCartCount();
    showToast(name + " added to cart!");
}

async function addToCartWithQuantity(name, price, image, qtyId, stockId, buttonId) {
    let stock = await getStock();
    let quantityInput = document.getElementById(qtyId);

    if (!quantityInput) return;

    let quantity = parseInt(quantityInput.value, 10);
    let currentStock = stock[name] ?? 0;

    if (isNaN(quantity) || quantity < 1) {
        showToast("Please select a valid quantity.");
        return;
    }

    if (currentStock <= 0) {
        updateStockDisplay(name, stockId, buttonId);
        return;
    }

    let cart = getCart();
    let existing = cart.find(item => item.name === name);
    let cartQty = existing ? existing.quantity : 0;

    if (cartQty + quantity > currentStock) {
        showToast("Not enough stock available!");
        return;
    }

    if (existing) {
        existing.quantity += quantity;
    } else {
        cart.push({
            name: name,
            price: price,
            image: image,
            quantity: quantity
        });
    }

    saveCart(cart);
    updateCartCount();
    showToast(quantity + " " + name + " added to cart!");
}

async function addToCartWithStock(name, price, image, stockId, buttonId) {
    let stock = await getStock();

    let stockElement = document.getElementById(stockId);
    let button = document.getElementById(buttonId);

    let currentStock = stock[name] ?? 0;

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

    let cart = getCart();
    let existing = cart.find(item => item.name === name);
    let cartQty = existing ? existing.quantity : 0;

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
    let stock = await getStock();

    let stockElement = document.getElementById(stockId);
    let button = document.getElementById(buttonId);

    if (!stockElement || !button) return;

    let currentStock = stock[name] ?? 0;

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
// CART DISPLAY
// =========================
function displayCart() {
    let cart = getCart();
    let cartItems = document.getElementById("cart-items");
    let totalPrice = document.getElementById("total-price");

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
        let itemTotal = item.price * item.quantity;
        subtotal += itemTotal;

        cartItems.innerHTML += `
            <div class="cart-item">
                <img src="${item.image}" alt="${item.name}" class="cart-item-image">

                <div class="cart-item-details">
                    <h3>${item.name}</h3>
                    <p>$${item.price.toFixed(2)} each</p>

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
    let cart = getCart();

    cart.splice(index, 1);

    saveCart(cart);
    displayCart();
    updateCartCount();
}

async function changeQuantity(index, change) {
    let cart = getCart();
    let stock = await getStock();

    let item = cart[index];
    if (!item) return;

    let newQuantity = item.quantity + change;

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
    let cart = getCart();

    let shippingDropdown = document.getElementById("shipping-method");
    let finalTotalText = document.getElementById("final-total");
    let orderTotalField = document.getElementById("order-total-field");

    if (!shippingDropdown || !finalTotalText) return;

    let shipping = parseFloat(shippingDropdown.value) || 0;

    let subtotal = 0;
    cart.forEach(item => {
        subtotal += item.price * item.quantity;
    });

    let finalTotal = subtotal + shipping;

    finalTotalText.innerHTML = `Final Total: $${finalTotal.toFixed(2)}`;

    if (orderTotalField) {
        orderTotalField.value = `$${finalTotal.toFixed(2)}`;
    }
}

// =========================
// ORDER PREP
// =========================
function prepareOrder() {
    let cart = getCart();

    let orderItemsField = document.getElementById("order-items-field");
    let orderNumberField = document.getElementById("order-number-field");

    let orderText = cart.map(item => `${item.name} x${item.quantity}`).join(", ");

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
// CHECKOUT INFO
// =========================
function saveCheckoutInfo() {
    const fields = {
        customer_name: document.getElementById("customer-name")?.value || "",
        street_address: document.getElementById("street-address")?.value || "",
        city: document.getElementById("city")?.value || "",
        state: document.getElementById("state")?.value || "",
        zip: document.getElementById("zip")?.value || "",
        customer_email: document.getElementById("customer-email")?.value || "",
        shipping_method: document.getElementById("shipping-method")?.value || "5.99"
    };

    localStorage.setItem("checkoutInfo", JSON.stringify(fields));
}

function loadCheckoutInfo() {
    const saved = JSON.parse(localStorage.getItem("checkoutInfo"));
    if (!saved) return;

    if (document.getElementById("customer-name")) {
        document.getElementById("customer-name").value = saved.customer_name || "";
    }

    if (document.getElementById("street-address")) {
        document.getElementById("street-address").value = saved.street_address || "";
    }

    if (document.getElementById("city")) {
        document.getElementById("city").value = saved.city || "";
    }

    if (document.getElementById("state")) {
        document.getElementById("state").value = saved.state || "";
    }

    if (document.getElementById("zip")) {
        document.getElementById("zip").value = saved.zip || "";
    }

    if (document.getElementById("customer-email")) {
        document.getElementById("customer-email").value = saved.customer_email || "";
    }

    if (document.getElementById("shipping-method")) {
        document.getElementById("shipping-method").value = saved.shipping_method || "5.99";
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

    const shippingDropdown = document.getElementById("shipping-method");
    const shipping = parseFloat(shippingDropdown?.value || 0) || 0;

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
        localStorage.removeItem("checkoutInfo");
        localStorage.removeItem("pendingOrderNumber");

        orderNumberDisplay.textContent = "Order #: " + (order.orderNumber || "N/A");

        let html = "<h3>Your Order Summary</h3>";

        (order.items || []).forEach(item => {
            let itemTotal = Number(item.price || 0) * Number(item.quantity || 0);

            html += `
                <p>${item.name} × ${item.quantity}</p>
                <p>$${itemTotal.toFixed(2)}</p>
            `;
        });

        html += "<hr>";
        html += `<p>Subtotal: $${Number(order.subtotal || 0).toFixed(2)}</p>`;
        html += `<p>Shipping: $${Number(order.shipping || 0).toFixed(2)}</p>`;
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
    let container = document.getElementById("orders-list");

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
                    <h3>${order.orderNumber || "Order"}</h3>
                    <p>${order.date || ""}</p>
                    <p>Status: ${order.status || "Paid"}</p>

                    <div class="order-items-list">
                        <h4>Items Ordered:</h4>
                        ${itemsHtml}
                    </div>

                    <p>Subtotal: $${Number(order.subtotal || 0).toFixed(2)}</p>
                    <p>Shipping: $${Number(order.shipping || 0).toFixed(2)}</p>
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
    let cart = getCart();
    let cartLink = document.getElementById("cart-link");

    if (!cartLink) return;

    let totalItems = 0;

    cart.forEach(item => {
        totalItems += item.quantity;
    });

    cartLink.textContent = `🛒 View Your Cart (${totalItems})`;
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
    loadCheckoutInfo();

    [
        "customer-name",
        "street-address",
        "city",
        "state",
        "zip",
        "customer-email",
        "shipping-method"
    ].forEach(id => {
        let field = document.getElementById(id);
        if (field) {
            field.addEventListener("input", saveCheckoutInfo);
            field.addEventListener("change", saveCheckoutInfo);
        }
    });
};