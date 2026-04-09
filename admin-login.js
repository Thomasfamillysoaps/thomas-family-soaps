// =========================
// THOMAS FAMILY SOAPS
// ADMIN LOGIN
// =========================

const loginForm = document.getElementById("admin-login-form");
const loginMessage = document.getElementById("login-message");

if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const username = document.getElementById("admin-username")?.value.trim();
        const password = document.getElementById("admin-password")?.value;

        if (!username || !password) {
            if (loginMessage) {
                loginMessage.textContent = "Please enter your username and password.";
            }
            return;
        }

        try {
            const response = await fetch("/admin-login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || "Login failed.");
            }

            localStorage.setItem("adminAuth", "true");
            window.location.href = "/admin.html";
        } catch (error) {
            console.error("ADMIN LOGIN ERROR:", error);

            if (loginMessage) {
                loginMessage.textContent = error.message || "Login failed.";
            }
        }
    });
}