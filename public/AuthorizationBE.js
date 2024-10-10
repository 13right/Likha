async function fetchCurrentUser() {
    try {
        const response = await fetch('/api/current_user');
        if (response.ok) {
            
            const user = await response.json();
            if (user && user.UserID) {  // Ensure user and UserID are defined
                const userID = parseInt(user.UserID);
                document.getElementById('userInfo').innerText = `Logged in as: ${userID}`;
                console.log(userID);
            } else {
                throw new Error('Invalid user data');
            }
        } else {
            handleNotLoggedIn();
        }
    } catch (error) {
        console.error('Error fetching current user:', error);
        handleNotLoggedIn();
    }
}

function handleNotLoggedIn() {
    document.getElementById('userInfo').innerText = 'Not logged in';
    window.location.href = "SignIn.html";
}

fetchCurrentUser();
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
            if (xhr.status === 200) {
                nameValue = document.getElementById("Usernametxt").value = "";
                numValue = document.getElementById("Numbertxt").value = "";
                Password = document.getElementById("Passwordtxt").value = "";
                document.getElementById('SignUpMB').classList.remove('hidden');
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
                localStorage.setItem("userRole", "customer");
                document.getElementById('SignInMB').classList.remove('hidden');
            } else if (xhr.status === 401) {
                alert("Invalid username or password");
                document.getElementById('Passwordtxt').value = '';
            }  else if (xhr.status === 250) {
                alert("Admin");
                localStorage.setItem("userRole", "admin");
                window.location.href = "OrderList.html"
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
function LogOut() {
    fetch('/LogOut', {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => {
        if (response.ok) {
            alert('Logout successful');
            window.location.href = '/SignIn.html';
        } else {
            alert('Error logging out');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Error logging out');
    });
}
