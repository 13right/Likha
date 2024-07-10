document.addEventListener("DOMContentLoaded", function() {
    const userRole = localStorage.getItem("userRole");
    if (userRole !== "admin") {
        alert("You do not have permission to access this page.");
        window.location.href = "SignIn.html";
    }
});