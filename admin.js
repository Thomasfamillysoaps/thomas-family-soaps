// =========================
// THOMAS FAMILY SOAPS ADMIN
// SERVER-BASED VERSION
// =========================

const inventoryList = document.getElementById("inventory-list");
const ordersList = document.getElementById("orders-list");
const adminStatusMessage = document.getElementById("admin-status-message");
const refreshStockBtn = document.getElementById("refresh-stock-btn");
const refreshOrdersBtn = document.getElementById("refresh-orders-btn");

// -------------------------
// HELPERS
// -------------------------
function setStatus(message, type = "") {
    if (!adminStatusMessage) return;

    adminStatusMessage.textContent = message;
    adminStatusMessage.className = "admin-status-message";

    if (type === "success") {
        adminStatusMessage.classList.add("success-text");
    }

    if (type === "error") {
        adminStatusMessage.classList.add("error-text");
    }
}

function formatMoney(amount) {
    return `$${Number(amount || 0).toFixed(2)}`;
}

function escapeHtml(text) {
    return String(text || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function slugify(text) {
    return String(text || "")
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");
}

function escapeSingleQuotes(text) {
    return String(text || "").replace(/'/g, "\\'");
}

function formatShippingAddress(order) {
    if (order.shipping_address) {
        return order.shipping_address;
    }

    const parts = [
        order.street,
        order.line2,
        order.city,
        order.state,
        order.zip,
        order.country
    ].filter(Boolean);

    return parts.length ? parts.join(", ") : "Not provided";
}
// -------------------------
// SERVER AUTH CHECK
// -------------------------
async function checkAdminAuth() {
    try {
        const response = await fetch("/api/admin/check", {
            method: "GET",
            credentials: "include"
        });

        if (!response.ok) {
            window.location.href = "/admin-login.html";
            return false;
        }

        return true;
    } catch (error) {
        console.error("ADMIN CHECK ERROR:", error);
        window.location.href = "/admin-login.html";
        return false;
    }
}

// -------------------------
// LOGOUT
// -------------------------
async function logout() {
    try {
        await fetch("/admin-logout", {
            method: "POST",
            credentials: "include"
        });
    } catch (error) {
        console.error("LOGOUT ERROR:", error);
    }

    localStorage.removeItem("adminAuth");
    window.location.href = "/admin-login.html";
}

// -------------------------
// STOCK
// -------------------------
async function loadStock() {
    if (!inventoryList) return;

    inventoryList.innerHTML = `<p class="empty-message">Loading inventory...</p>`;

    try {
        const response = await fetch("/api/admin/stock", {
            method: "GET",
            credentials: "include"
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Failed to load stock.");
        }

        renderStock(data);
        setStatus("Admin data loaded.", "success");
    } catch (error) {
        console.error("LOAD STOCK ERROR:", error);
        inventoryList.innerHTML = `<p class="empty-message">Could not load inventory.</p>`;
        setStatus(error.message || "Could not load inventory from server.", "error");
    }
}

function renderStock(stock) {
    const entries = Object.entries(stock || {});

    if (entries.length === 0) {
        inventoryList.innerHTML = `<p class="empty-message">No stock found.</p>`;
        return;
    }

    inventoryList.innerHTML = entries.map(([productName, quantity]) => `
        <div class="inventory-item">
            <div class="inventory-row">
                <div>
                    <h3>${escapeHtml(productName)}</h3>
                    <p>Current Stock: <strong>${Number(quantity)}</strong></p>
                </div>

                <div class="stock-edit-group">
                    <input
                        type="number"
                        min="0"
                        id="stock-input-${slugify(productName)}"
                        value="${Number(quantity)}"
                    >
                    <button
                        class="save-btn"
                        type="button"
                        onclick="updateStock('${escapeSingleQuotes(productName)}')"
                    >
                        Save Stock
                    </button>
                </div>
            </div>
        </div>
    `).join("");
}

async function updateStock(productName) {
    const input = document.getElementById(`stock-input-${slugify(productName)}`);
    if (!input) return;

    const newStock = parseInt(input.value, 10);

    if (isNaN(newStock) || newStock < 0) {
        alert("Put in a real stock number, you menace.");
        return;
    }

    try {
        const response = await fetch("/api/admin/update-stock", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "include",
            body: JSON.stringify({
                productName,
                stock: newStock
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Failed to update stock.");
        }

        setStatus(`${productName} stock updated to ${newStock}.`, "success");
        loadStock();
    } catch (error) {
        console.error("UPDATE STOCK ERROR:", error);
        setStatus(error.message || "Could not update stock.", "error");
    }
}

// -------------------------
// ORDERS
// -------------------------
async function loadOrders() {
    if (!ordersList) return;

    ordersList.innerHTML = `<p class="empty-message">Loading orders...</p>`;

    try {
        const response = await fetch("/api/orders", {

            method: "GET",
            credentials: "include"
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Failed to load orders.");
        }

        renderOrders(data);
    } catch (error) {
        console.error("LOAD ORDERS ERROR:", error);
        ordersList.innerHTML = `<p class="empty-message">Could not load orders.</p>`;
        setStatus(error.message || "Could not load orders from server.", "error");
    }
}

function renderOrders(orders) {
    if (!Array.isArray(orders) || orders.length === 0) {
        ordersList.innerHTML = `<p class="empty-message">No orders found yet.</p>`;
        return;
    }

    ordersList.innerHTML = orders.map(order => {
        const items = Array.isArray(order.items) ? order.items : [];

        const itemsHtml = items.length
            ? items.map(item => `
                <p>
                    🧼 ${escapeHtml(item.name)} — Qty: ${Number(item.quantity || 0)}
                    — ${formatMoney(Number(item.price || 0) * Number(item.quantity || 0))}
                </p>
            `).join("")
            : `<p>No items found for this order.</p>`;

        const shippingAddress = formatShippingAddress(order);
        const safeOrderNumber = escapeHtml(order.order_number || "N/A");
        const safeOrderNumberForJs = escapeSingleQuotes(order.order_number || "");
        const currentStatus = escapeHtml(order.status || "Paid");
        const currentTracking = escapeHtml(order.tracking_number || "");

        return `
            <div class="order-card">
                <div class="order-card-top">
                    <h3>Order #${safeOrderNumber}</h3>
                    <p class="order-status"><strong>Status:</strong> ${currentStatus}</p>
                </div>

                <div class="order-meta">
                    <p><strong>Date:</strong> ${escapeHtml(order.created_at || "Not provided")}</p>
                    <p><strong>Name:</strong> ${escapeHtml(order.customer_name || "Not provided")}</p>
                    <p><strong>Email:</strong> ${escapeHtml(order.customer_email || "Not provided")}</p>
                    <p><strong>Shipping Method:</strong> ${escapeHtml(order.shipping_method || "Not provided")}</p>
                    <p><strong>Shipping Address:</strong> ${escapeHtml(shippingAddress || "Not provided")}</p>
                    <p><strong>Tracking:</strong> ${currentTracking || "Not added yet"}</p>
                </div>

                <div class="order-items">
                    <h4>Items</h4>
                    ${itemsHtml}
                </div>

                <div class="order-shipping-tools">
                    <input
                        type="text"
                        id="tracking-${escapeHtml(order.order_number || "")}"
                        class="tracking-input"
                        placeholder="Enter tracking number"
                        value="${currentTracking}"
                    >

                    <button
                        class="save-btn"
                        type="button"
                        onclick="markOrderShipped('${safeOrderNumberForJs}')"
                    >
                        Mark Shipped
                    </button>

                    <button
                        class="delete-order-btn"
                        type="button"
                        onclick="deleteOrder('${safeOrderNumberForJs}')"
                    >
                        Delete Order
                    </button>
                </div>
            </div>
        `;
    }).join("");
}

async function markOrderShipped(orderNumber) {
    if (!orderNumber) {
        alert("This order is missing an order number.");
        return;
    }

    const trackingInput = document.getElementById(`tracking-${orderNumber}`);
    const trackingNumber = trackingInput ? trackingInput.value.trim() : "";

    if (!trackingNumber) {
        alert("Add a tracking number before marking this order shipped.");
        return;
    }

    try {
        const response = await fetch("/api/admin/update-order-shipping", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "include",
            body: JSON.stringify({
                orderNumber,
                status: "Shipped",
                trackingNumber
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Failed to update shipping info.");
        }

        setStatus(`Order ${orderNumber} marked as shipped.`, "success");
        loadOrders();
    } catch (error) {
        console.error("MARK SHIPPED ERROR:", error);
        setStatus(error.message || "Could not update shipping info.", "error");
    }
}

async function deleteOrder(orderNumber) {
    if (!orderNumber) {
        alert("This order is missing an order number.");
        return;
    }

    const confirmed = confirm(`Delete order ${orderNumber}?`);
    if (!confirmed) return;

    try {
        const response = await fetch("/api/admin/delete-order", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "include",
            body: JSON.stringify({ orderNumber })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Failed to delete order.");
        }

        setStatus(`Order ${orderNumber} deleted.`, "success");
        loadOrders();
    } catch (error) {
        console.error("DELETE ORDER ERROR:", error);
        setStatus(error.message || "Could not delete order.", "error");
    }
}

// -------------------------
// BUTTON EVENTS
// -------------------------
if (refreshStockBtn) {
    refreshStockBtn.addEventListener("click", loadStock);
}

if (refreshOrdersBtn) {
    refreshOrdersBtn.addEventListener("click", loadOrders);
}

// -------------------------
// PAGE LOAD
// -------------------------
window.addEventListener("DOMContentLoaded", async () => {
    const isAuthed = await checkAdminAuth();
    if (!isAuthed) return;

    loadStock();
    loadOrders();
});