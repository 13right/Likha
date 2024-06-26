function submitForm() {
    var nameValue = document.getElementById("Usernametxt").value;
    var numValue = document.getElementById("Numbertxt").value;
    var Password = document.getElementById("Passwordtxt").value;

   var formData = {
        name: nameValue,
        num: numValue,
        Password: Password
   };
   console.log(formData);

    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function() {
        if (xhr.readyState === XMLHttpRequest.DONE) {
            if (xhr.status === 500) {
                nameValue = document.getElementById("Usernametxt").value = "";
                numValue = document.getElementById("Numbertxt").value = "";
                Password = document.getElementById("Passwordtxt").value = "";
                window.location.href = "SignIn.html"
            } else {
                alert("Error: " + xhr.status);
            }
        }
    };
    xhr.open("POST", "/SignUp");
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.send(JSON.stringify(formData));
    

}
function LogIn() {
    var Name = document.getElementById("Usernametxt").value;
    var Password = document.getElementById("Passwordtxt").value;

    var Data = {
        username: Name,
        password: Password
    };

    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function() {
        if (xhr.readyState === XMLHttpRequest.DONE) {
            if (xhr.status === 200) {
                alert("Login successful");
                window.location.href = "Home.html";
            } else if (xhr.status === 401) {
                alert("Invalid username or password");
            }  else if (xhr.status === 250) {
                alert("Admin");
                window.location.href = "AdminHome.html"
            }
            else {
                alert("Error: " + xhr.status);
            }
        }
    };
    
    xhr.open("POST", "/LogIn");
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.send(JSON.stringify(Data));
}
async function fetchCurrentUser() {
    const response = await fetch('/api/current_user');
    if (response.ok) {
        const user = await response.json();
        document.getElementById('userInfo').innerText = `Logged in as: ${user.UserID}`;
    } else {
        document.getElementById('userInfo').innerText = 'Not logged in';
        window.location.href = "SignIn.html";
    }
    }
fetchCurrentUser();