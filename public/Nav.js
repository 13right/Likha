document.getElementById('LogOut').addEventListener('click', () => {
    fetch('/LogOut', {
        method: 'POST',
        credentials: 'include',
    })
    .then(response => {
        console.log('Response Status:', response.status);
        return response.json().then(data => ({ status: response.status, body: data }));
    })
    .then(({ status, body }) => {
        if (status === 200) {
            alert('Logout successful');
            window.location.href = 'SignIn.html';
        } else {
            alert('Error logging out: ' + body);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Error logging outt'+ error);
    });
});

document.addEventListener('DOMContentLoaded', (event) => {
    const ProfileIcon = document.getElementById('ProfileIcon');
    const ProfileMenu = document.getElementById('ProfileMenu');

    ProfileIcon.addEventListener('click', async () => {
       
        const user = await fetch ('/User');

        if(user.ok){
            if (!ProfileMenu.classList.contains('hidden')) {
            ProfileMenu.classList.add('hidden');
            } else {
                ProfileMenu.classList.remove('hidden');
            }
        }
        else{
            window.location.href = 'SignIn.html';
        }
           
    });
});

function expandSearchBar() {
    const searchBar = document.getElementById('search-bar');
    const searchIcon = document.getElementById('search-icon');
    
    searchBar.classList.toggle('expanded');
    searchIcon.classList.toggle('expanded');
}
//Cart
async function fetchCart() {
    const CartList = document.getElementById('Product-Cart');
    CartList.innerHTML = '';

    try {
        const response = await fetch('/Cart');
        if (!response.ok) {
            if(response.status === 401){
                window.location.href = '/SignIn.html';
                return 'redirect';
            }
            else{
                throw new Error('Network response was not ok');
            }
            
        }
        const productsCart = await response.json();

        productsCart.forEach((productCart, index) => {
            const CartElement = document.createElement('div');
            CartElement.dataset.index = index;  
            CartElement.innerHTML = `
            <div class="mt-6">
                <div class="flex items-center space-x-10 mb-6 ml-5">
                    <input type="checkbox" class="appearance-none w-[39.36px] h-[31.33px] bg-[#F7F8EA] outline outline-2 outline-outline rounded-md" value=${productCart.productPrice}></input>
                    <div>
                        <img src="${productCart.productImage}" alt="Product Image" class="w-[118px] h-[145px]">
                    </div>
                    <div>
                        <h1 class="font-Montagu font-semibold text-[24px]">${productCart.productName}</h1>
                        <h2 class="font-Montserrat font-semibold text-[14px]">₱${productCart.productPrice.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>
                        <div class="flex w-[120px] h-[40px] bg-[#F7F8EA] justify-center space-x-2 outline outline-1 outline-outline rounded-lg mt-3">
                            <button class="MOcart">-</button>
                            <input style="background-color: transparent;" id="Quantity" class="text-center w-[138px] h-[40px] p-1 font-bold" type="number" value=${productCart.productQuantity} min="1" max="100">
                            <button class="AOcart">+</button>
                        </div>
                        
                    </div>
                </div>
                <hr class="border-1 border-outline w-auto ">
            </div>
            `;
            CartList.appendChild(CartElement);
        });

        const checkboxes = CartList.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', updateSum);
        });

        updateSum();

    } catch (error) {
        console.error('Error fetching products:', error);
    }
}
function updateSum() {
        const checkboxes = document.querySelectorAll('#Product-Cart input[type="checkbox"]');
        const totalPriceDisplay = document.getElementById('totalPriceDisplay');
        let sum = 0;

        checkboxes.forEach(checkbox => {
            if (checkbox.checked) {
                sum += parseFloat(checkbox.value);
            }
        });
        totalPriceDisplay.textContent = `₱${sum.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    document.addEventListener('DOMContentLoaded', (event) => {
        const cartToggle = document.getElementById('CartIcon');
        const productCart = document.getElementById('Cartel');

        cartToggle.addEventListener('click', async () => {
           const cart = await fetchCart();
            if(cart != "redirect"){
                if (!productCart.classList.contains('hidden')) {
                productCart.classList.add('hidden');
                } 
                else {
                productCart.classList.remove('hidden');
                productCart.classList.add('animation-Cart');
                productCart.classList.remove('Close-Cart');
                }
            }

            
        });
    });
    document.addEventListener('DOMContentLoaded', (event) => {
        const cartToggle = document.getElementById('CloseCart');
        const productCart = document.getElementById('Cartel');

        cartToggle.addEventListener('click', () => {
            // event.preventDefault();
            productCart.classList.add('Close-Cart');
            productCart.addEventListener('animationend', () => {
                productCart.classList.add('hidden');
            }, { once: true });
        });
    });
    document.addEventListener('click', function(event) {
        const Increment = event.target.closest('.AOcart');
        if (Increment) {
            const CartElement = Increment.closest('div[data-index]');
            const Quantity = CartElement.querySelector('#Quantity');
            const currentValue = parseInt(Quantity.value);
            const newValue = currentValue + 1;
            Quantity.value = newValue;
            //console.log(newValue);

            const productName = CartElement.querySelector('h1').innerText;
            //console.log(productName);

            const Data = {
                ProductN: productName,
                Quantity:  newValue
            }

            fetch('/UpdateCart', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(Data)
                })
                .then(response => response.json())
                .then(data => {
                console.log('Success update:', data);
                fetchCart();
                })
                .catch((error) => {
                     console.error('Error:', error);
                });
            
        }
    });

    document.addEventListener('click', function(event) {
        const Decrement = event.target.closest('.MOcart');
        if (Decrement) {
            const CartElement = Decrement.closest('div[data-index]');
            const Quantity = CartElement.querySelector('#Quantity');
            const currentValue = parseInt(Quantity.value);
            if (currentValue > 1) {
                const newValue = currentValue - 1;
                Quantity.value = newValue;
                console.log(newValue);
                const productName = CartElement.querySelector('h1').innerText;
                //console.log(productName + " ");

            const Data = {
                ProductN: productName,
                Quantity:  newValue
            }

            fetch('/UpdateCart', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(Data)
                })
                .then(response => response.json())
                .then(data => {
                console.log('Success update:', data);
                fetchCart();
                })
                .catch((error) => {
                     console.error('Error:', error);
                });
            }
        }
    });

const PlaceOrderBtn = document.querySelector('#PlaceOrder');

PlaceOrderBtn.addEventListener('click', async function() {
    const checkboxes = document.querySelectorAll('#Product-Cart input[type="checkbox"]');
    console.log(checkboxes);
    const checkedValues = [];

    checkboxes.forEach(checkbox => {
        if (checkbox.checked) {
            const productElement = checkbox.closest('.flex');
            const productName = productElement.querySelector('h1').innerText;
            const productQuantity = productElement.querySelector('input[type="number"]').value;
            //const productPrice = parseFloat(productElement.querySelector('h2').innerText);

            checkedValues.push({
                OrderProductName: productName,
                OrderQuantity: productQuantity,
                //OrderPrice: productPrice
            });
        }
    });

    if (checkedValues.length > 0) {

        try {
                const productName = checkedValues.map(checked => checked.OrderProductName);

                sessionStorage.setItem('productName',JSON.stringify(productName));

                window.location.href = 'Checkout.html';
            } catch (error) {
                console.error('Error:', error);

            }
    } else {
        alert('Please select a product');
    }

});
function disableScroll() {

    scrollTop =
        window.pageYOffset || document.documentElement.scrollTop;
    scrollLeft =
        window.pageXOffset || document.documentElement.scrollLeft;
    
    
    
    window.onscroll = function() {
    window.scrollTo(scrollLeft, scrollTop);
    };
    }
    function enableScroll() {
    window.onscroll = function() {};
    }
document.addEventListener('DOMContentLoaded', (event) => {
        const NotifIcon = document.getElementById('NotifIcon');
        const Notif = document.getElementById('Notif');
        const container = document.getElementById('main-container');
        const body = document.getElementById('body');

        NotifIcon.addEventListener('click', async () => {

        const user = await fetch ('/User');

        if(user.ok){
            if (!Notif.classList.contains('hidden')) {
            Notif.classList.add('hidden');
            container.classList.remove('pointer-events-none');
            enableScroll();
            fetch('/UpdateNotif', {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            UpdatedNotif: 'read'
                        })
                    })
                        .then(response => {
                            return response.json;
                        })
                        .catch(error => {
                            console.error('Error updating status:', error);
                        });
            } else {
                Notif.classList.remove('hidden');
                container.classList.add('pointer-events-none');
                disableScroll();        
            }
        }
        else{
            window.location.href = 'SignIn.html';
        }
        
    });
});
async function fetchUser() {
    try {
        const response = await fetch('/User');
        if (response.ok) {
        const data = await response.json();
        console.log('User:', data);
        fetchUserInfo();
        } else {
        console.error('Failed to fetch user data.');
        }
    } catch (err) {
        console.error('Error fetching user:', err);
    }
}
// Initialize a WebSocket connection
const socket = new WebSocket('wss://likhaforzappnott.onrender.com/ws');  // Replace with your servers WebSocket URL
//const socket = new WebSocket('ws://localhost:3000'); // Replace with actual WebSocket URL

// Handle the connection open event
socket.addEventListener('open', (event) => {
    console.log('Connected to WebSocket server');

    // Request notifications and messages once the connection is open
    socket.send(JSON.stringify({ type: 'getNotifications' }));
    socket.send(JSON.stringify({ type: 'getMessages' }));
});

// Handle incoming WebSocket messages from the server
socket.addEventListener('message', (event) => {
    const data = JSON.parse(event.data);
    
    // Handle notifications
    if (data.notifications) {
        renderNotifications(data.notifications);
    }

    // Handle unread notifications count
    if (data.NotificationID !== undefined) {
        //console.log(`Unread notifications: ${data.NotificationID}`);
        updateNotificationBadge(data.NotificationID);
    }

    // Handle messages
    if (data.messages) {
        renderMessages(data.messages);
    }

    // Handle errors
    if (data.error) {
        console.error(`Error: ${data.error}`);
    }
});

// Handle connection close event
socket.addEventListener('close', () => {
    console.log('Disconnected from WebSocket server');
});

// Handle WebSocket errors
socket.addEventListener('error', (error) => {
    console.error('WebSocket error:', error);
});

// Function to render notifications
function renderNotifications(products) {
    const productList = document.getElementById('NotifContent');
    productList.innerHTML = ''; // Clear previous notifications

    products.forEach(product => {
        const productElement = document.createElement('div');
        productElement.innerHTML = `
            <div class="flex relative w-auto py-auto justify-between mr-6">
                <div class="justify-center flex pl-2">
                    <div class="items-center flex">
                        <div class="notifdot bg-outline hidden w-2 h-2 rounded-full"></div>
                    </div>
                    <div class="justify-center flex flex-col pl-5">
                        <h1 class="font-Inter text-sm">${product.Content}</h1>
                        <h1 class="font-Inter text-sm">${product.Date}</h1>
                    </div>
                </div>
                <div>
                    <img src="${product.productImage}" alt="${product.productName}" class="w-[7rem] h-[7rem]">
                </div>
            </div>
        `;
        productList.appendChild(productElement);

        const notifdot = productElement.querySelector('.notifdot');
        if (product.Status === 'unread') {
            notifdot.classList.remove('hidden');
        } else {
            notifdot.classList.add('hidden');
        }
    });
}
let previousMessageCount = 0;
// Function to render messages
function renderMessages(messages) {
    const chatBox = document.getElementById('chat-box');
    chatBox.innerHTML = ''; // Clear previous messages

    const userID = 3; // Replace with actual user ID
    messages.forEach(msg => {
        const messageElement = document.createElement('div');
        messageElement.innerHTML = `
            <div id="CC" class="flex items-start">
                <div id="Chats" class="rounded-lg my-[5px] p-3 max-w-xs">
                    <p id="Content" class="text-sm">${msg.message}</p>
                </div>
            </div>
        `;

        const ChatContainer = messageElement.querySelector('#CC');
        const ChatBG = messageElement.querySelector('#Chats');

        if (msg.SenderID === parseInt(userID)) {
            ChatContainer.classList.add('justify-end');
            ChatBG.classList.add('bg-[#6cc4f4]', 'text-[#FFF]');
            ChatBG.classList.remove('bg-outline');
        } else {
            ChatBG.classList.add('bg-outline');
        }

        chatBox.appendChild(messageElement);
    });

    // Scroll to the bottom of the chat if there are new messages
    if (messages.length > previousMessageCount) {
        scrollToBottom();
    }

    previousMessageCount = messages.length;
}

// Function to update notification badge
function updateNotificationBadge(count) {
    const notifBadge = document.getElementById('notif-badge');
    const notifPing = document.getElementById('notifBadge');

    if (count > 0) {
        notifBadge.style.display = 'inline-flex';
        notifPing.style.display = 'inline-flex';
        notifBadge.classList.remove('hidden');
        notifPing.classList.remove('hidden');
    } else {
        notifBadge.style.display = 'none';
        notifPing.style.display = 'none';
    }
}

async function fetchUserInfo() {
    try{
        const result = await fetch('/UserInfo');

        if(result.ok){

            const User = await result.json();
            const UserName = User.UserName;
            document.getElementById('UsernameMenu').innerText = UserName;
        }
    }
    catch(error){
        console.error('Error fetching user', error);
    }
}
document.addEventListener('DOMContentLoaded', async () => {
    await fetchUser();
});

function scrollToBottom() {
    const chatBox = document.getElementById('chat-box');
    if (chatBox) {
        requestAnimationFrame(() => {
            chatBox.scrollTo({
                top: chatBox.scrollHeight,
                behavior: 'smooth'
            });
        });
    } else {
        console.error('chatBox element not found.');
    }
}


document.getElementById('message-form').addEventListener('submit', function (e) {
    e.preventDefault();
    const message = document.getElementById('message-input').value;
    fetch('/Chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
    }).then(() => {
        document.getElementById('message-input').value = '';
        fetchMessages();
    });
});

//fetchMessages();
const logo = document.getElementById('ChatLogo');
const content = document.getElementById('ChatContent');
const closeButton = document.getElementById('ChatClose');

logo.addEventListener('click', () => {
    
    const logoRect = logo.getBoundingClientRect();

    content.style.right = `${window.innerWidth - logoRect.right}px`;
    content.style.bottom = `${window.innerHeight - logoRect.bottom}px`;
    content.style.width = `${logoRect.width}px`;
    content.style.height = `${logoRect.height}px`;

    logo.classList.add('spin-fade');
    

    setTimeout(() => {
        logo.classList.add('hidden'); 
        content.classList.remove('hidden', 'content-hidden');
        content.classList.add('expand-from-logo');
        content.classList.remove('collapse-to-logo');

        setTimeout(() => {
            content.style.width = '35rem';
            content.style.height = '25rem';

            setTimeout(() => {
                scrollToBottom();
                content.classList.remove('content-hidden');
                content.classList.add('content-visible');
            }, 700); 
        }, 0);
    }, 300);
});
closeButton.addEventListener('click', () => {
    content.classList.remove('expand-from-logo', 'content-visible');
    content.classList.add('collapse-to-logo');


    setTimeout(() => {
        content.classList.add('content-hidden');
        content.classList.add('hidden');
        content.style.width = 'initial';
        content.style.height = 'initial';
        

        logo.classList.remove('hidden');
        logo.classList.remove('spin-fade');
    }, 400); 
});