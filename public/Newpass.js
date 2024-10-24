document.addEventListener("DOMContentLoaded", function() {
    const User = sessionStorage.getItem("userID");
    if (User == null) {
        alert("You do not have permission to access this page.");
        window.history.back();
    }
});