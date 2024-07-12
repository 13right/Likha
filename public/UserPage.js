document.addEventListener("DOMContentLoaded", function() {
    const userRole = localStorage.getItem("userRole");
    if (userRole !== "customer") {
        alert("You do not have permission to access this page.");
        window.history.back();
    }
});