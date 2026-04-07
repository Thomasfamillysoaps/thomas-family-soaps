// =========================
// CART + INVENTORY SYSTEM
// Thomas Family Soaps
// =========================

// Default stock
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

// =========================
// INVENTORY
// =========================
function getStock() {
    let stock = JSON.parse(localStorage.getItem("inventory"));

    if (!stock) {
        localStorage.setItem("inventory", JSON.stringify(defaultStock));
        return { ...defaultStock };
    }

    return stock;
}

function saveStock(stock) {
    localStorage.setItem("inventory", JSON.stringify(stock));
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

function getOrders() {
    return JSON.parse(localStorage.getItem("orders")) || [];
}

function saveOrders(orders) {
    localStorage.setItem("orders", JSON.stringify(orders));
}

// =========================
// ADD TO CART
// =========================
function addToCart(name, price, image = "") {
    localStorage.removeItem("orderCompleted");
    localStorage.removeItem("lastCompletedOrder");

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

function addToCartWithQuantity(name, price, image, qtyId, stockId, buttonId) {
    let stock = getStock();
    let quantityInput = document.getElementById(qtyId);

    if (!quantityInput) return;

    let quantity = parseInt(quantityInput.value);
    let currentStock = stock[name];

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
    localStorage.removeItem("orderCompleted");
    localStorage.removeItem("lastCompletedOrder");
    updateCartCount();

    showToast(quantity + " " + name + " added to cart!");
}

function addToCartWithStock(name, price, image, stockId, buttonId) {
    let stock = getStock();

    let stockElement = document.getElementById(stockId);
    let button = document.getElementById(buttonId);

    let currentStock = stock[name];

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
function updateStockDisplay(name, stockId, buttonId) {
    let stock = getStock();

    let stockElement = document.getElementById(stockId);
    let button = document.getElementById(buttonId);

    if (!stockElement || !button) return;

    let currentStock = stock[name];

    if (currentStock <= 0) {
        stockElement.textContent = "SOLD OUT";
        stockElement.classList.add("sold-out");
        button.disabled = true;
        button.textContent = "SOLD OUT";
    } else {
        stockElement.textContent = "In Stock: " + currentStock;
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

function changeQuantity(index, change) {
    let cart = getCart();
    let stock = getStock();

    let item = cart[index];
    if (!item) return;

    let newQuantity = item.quantity + change;

    if (newQuantity < 1) {
        removeFromCart(index);
        return;
    }

    if (newQuantity > stock[item.name]) {
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

    let orderNumber = localStorage.getItem("orderNumber");

    if (!orderNumber) {
        orderNumber = "TFS-" + Date.now();
        localStorage.setItem("orderNumber", orderNumber);
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
// COMPLETE PURCHASE
// =========================
function completePurchase() {
    if (localStorage.getItem("checkoutStarted") !== "true") return;
    if (localStorage.getItem("orderCompleted")) return;

    let cart = getCart();
    if (cart.length === 0) return;

    let stock = getStock();
    let shipping = parseFloat(localStorage.getItem("lastShipping")) || 0;
    let orderNumber = localStorage.getItem("orderNumber");

    if (!orderNumber) {
        orderNumber = "TFS-" + Date.now();
        localStorage.setItem("orderNumber", orderNumber);
    }

    let subtotal = 0;

    cart.forEach(item => {
        subtotal += item.price * item.quantity;

        if (stock[item.name] !== undefined) {
            stock[item.name] -= item.quantity;

            if (stock[item.name] < 0) {
                stock[item.name] = 0;
            }
        }
    });

    let total = subtotal + shipping;
    let orders = getOrders();

    const newOrder = {
        orderNumber,
        items: cart,
        subtotal,
        shipping,
        total,
        date: new Date().toLocaleString(),
        status: "Paid"
    };

    orders.unshift(newOrder);

    saveOrders(orders);
    localStorage.setItem("lastCompletedOrder", JSON.stringify(newOrder));

    saveStock(stock);

    localStorage.removeItem("cart");
    localStorage.removeItem("checkoutInfo");
    localStorage.removeItem("orderNumber");
    localStorage.setItem("orderCompleted", "true");
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
// SUCCESS PAGE
// =========================
function displayOrderSummary() {
    let savedOrder = JSON.parse(localStorage.getItem("lastCompletedOrder"));
    let summary = document.getElementById("order-summary");

    if (!summary || !savedOrder) return;

    let html = "<h3>Your Order Summary</h3>";

    savedOrder.items.forEach(item => {
        let itemTotal = item.price * item.quantity;

        html += `
            <p>${item.name} × ${item.quantity}</p>
            <p>$${itemTotal.toFixed(2)}</p>
        `;
    });

    html += `<hr>`;
    html += `<p>Subtotal: $${savedOrder.subtotal.toFixed(2)}</p>`;
    html += `<p>Shipping: $${savedOrder.shipping.toFixed(2)}</p>`;
    html += `<p><strong>Total Paid: $${savedOrder.total.toFixed(2)}</strong></p>`;

    summary.innerHTML = html;
}

function displayOrderNumber() {
    let savedOrder = JSON.parse(localStorage.getItem("lastCompletedOrder"));
    let display = document.getElementById("order-number-display");

    if (!display || !savedOrder) return;

    display.textContent = "Order #: " + savedOrder.orderNumber;
}

// =========================
// ORDERS PAGE
// =========================
function displayOrders() {
    let orders = getOrders();
    let container = document.getElementById("orders-list");

    if (!container) return;

    if (orders.length === 0) {
        container.innerHTML = "<p>No previous orders found.</p>";
        return;
    }

    let html = "";

    orders.forEach(order => {
        let itemsHtml = "";

        order.items.forEach(item => {
            itemsHtml += `
                <p>${item.name} × ${item.quantity}</p>
            `;
        });

        html += `
            <div class="order-summary">
                <h3>${order.orderNumber}</h3>
                <p>${order.date}</p>
                <p>Status: ${order.status}</p>

                <div class="order-items-list">
                    <h4>Items Ordered:</h4>
                    ${itemsHtml}
                </div>

                <p>Subtotal: $${order.subtotal.toFixed(2)}</p>
                <p>Shipping: $${order.shipping.toFixed(2)}</p>
                <p><strong>Total: $${order.total.toFixed(2)}</strong></p>
            </div>
        `;
    });

    container.innerHTML = html;
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