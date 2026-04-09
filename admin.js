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
    if (order.shippingAddress) {
        return order.shippingAddress;
    }

    const parts = [
        order.street,
        order.city,
        order.state,
        order.zip
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
        const response = await fetch("/api/admin/orders", {
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

        const itemsHtml = items.map(item => `
            <p>
                ${escapeHtml(item.name)} × ${Number(item.quantity || 0)}
                — ${formatMoney(Number(item.price || 0) * Number(item.quantity || 0))}
            </p>
        `).join("");

        const shippingAddress = formatShippingAddress(order);

        return `
            <div class="order-card">
                <h3>Order #${escapeHtml(order.orderNumber || "N/A")}</h3>

                <div class="order-meta">
                    <p><strong>Status:</strong> ${escapeHtml(order.status || "Paid")}</p>
                    <p><strong>Date:</strong> ${escapeHtml(order.date || "Not provided")}</p>
                    <p><strong>Name:</strong> ${escapeHtml(order.customerName || "Not provided")}</p>
                    <p><strong>Email:</strong> ${escapeHtml(order.customerEmail || "Not provided")}</p>
                    <p><strong>Shipping Method:</strong> ${escapeHtml(order.shippingMethod || "Not provided")}</p>
                    <p><strong>Address:</strong> ${escapeHtml(shippingAddress)}</p>
                    <p><strong>Subtotal:</strong> ${formatMoney(order.subtotal)}</p>
                    <p><strong>Shipping:</strong> ${formatMoney(order.shipping)}</p>
                    <p><strong>Total:</strong> ${formatMoney(order.total)}</p>
                </div>

                <div class="order-items">
                    <h4>Items Ordered</h4>
                    ${itemsHtml || "<p>No items found.</p>"}
                </div>

                <button
                    class="delete-btn"
                    type="button"
                    onclick="deleteOrder('${escapeSingleQuotes(order.orderNumber || "")}')"
                >
                    Delete Order
                </button>
            </div>
        `;
    }).join("");
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