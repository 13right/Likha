document.addEventListener('DOMContentLoaded', () => {
    // Check if there's a hash in the URL (e.g., #About or #footer)
    if (window.location.hash) {
        const targetId = window.location.hash.substring(1);
        const targetElement = document.getElementById(targetId);

        if (targetElement) {
            // Scroll to the element with a smooth effect
            targetElement.scrollIntoView({ behavior: 'smooth' });
        }
    }
});


document.getElementById('LogOut').addEventListener('click', () => {
    document.getElementById('LogOutModal').classList.remove('hidden');
    document.getElementById('LYes').addEventListener('click', async() =>{
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
                window.location.href = 'SignIn.html';
            } else {
                alert('Error logging out: ' + body);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            //alert('Error logging outt'+ error);
        });
    });
    document.getElementById('LNo').addEventListener('click', async() => {
        document.getElementById('LogOutModal').classList.add('hidden');
    });


});

document.getElementById('search-bar').addEventListener('input', function (event) {
    const inputValue = event.target.value;

    if (inputValue === '') {
        document.getElementById('SearchCon').classList.add('hidden');
    } else {
        document.getElementById('SearchCon').classList.remove('hidden');
        
        fetch(`/SearchBar/${encodeURIComponent(inputValue)}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                const productList = document.getElementById('SearchCon');
                productList.innerHTML = '';

                data.categories.forEach(category => {
                    const categoryElement = document.createElement('div');
                    categoryElement.innerHTML = `
                        <div class="m-5 rounded-2xl p-1 cursor-pointer hover:bg-sign">${category.categoryName}</div>
                    `;
                    categoryElement.addEventListener('click', () => {

                        window.location.href = `/SearchProduct.html?query=${encodeURIComponent(category.categoryName)}`;

                        fetch(`/SearchProd/${encodeURIComponent(category.categoryName)}`)
                            .then(response => {
                                if (!response.ok) {
                                    throw new Error('Network response was not ok');
                                }
                                return response.json();
                                
                            })
                            .then(data => {
                                console.log('Fetched products by category:', data);
                            })
                            .catch(error => console.error('Error fetching products by category:', error));
                            document.getElementById('search-bar').value = '';
                    });
                    productList.appendChild(categoryElement);
                    
                });

                data.products.forEach(product => {
                    const productElement = document.createElement('div');
                    productElement.innerHTML = `
                        <div class="m-5 rounded-2xl p-1 hover:bg-sign cursor-pointer">${product.productName}</div>
                    `;
                    productElement.addEventListener('click', () => {
                        window.location.href = `/SearchProduct.html?query=${encodeURIComponent(product.productName)}`;


                        fetch(`/SearchProd/${encodeURIComponent(product.productName)}`)
                            .then(response => {
                                if (!response.ok) {
                                    throw new Error('Network response was not ok');
                                }
                                return response.json();
                            })
                            .then(data => {
                                console.log('Fetched products:', data);

                            })
                            .catch(error => console.error('Error fetching products:', error));
                            document.getElementById('search-bar').value = '';
                    });
                    productList.appendChild(productElement);
                });
            })
            .catch(error => console.error('Error fetching products:', error));
    }
});


document.getElementById('search-bar').addEventListener('keydown', function (event) {
    const inputValue = event.target.value;

    if (event.key === 'Enter' && inputValue !== '') {

        window.location.href = `/SearchProduct.html?query=${encodeURIComponent(inputValue)}`;

        fetch(`/SearchProd/${encodeURIComponent(inputValue)}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                console.log('Fetched products:', data);

            })
            .catch(error => console.error('Error fetching products:', error));
            document.getElementById('search-bar').value = '';
    }
});



document.addEventListener('DOMContentLoaded', (event) => {
    const ProfileIcon = document.getElementById('ProfileIcon');
    const ProfileMenu = document.getElementById('ProfileMenu');
    const NotifIcon = document.getElementById('NotifIcon');
    const Notif = document.getElementById('Notif');
    const container = document.getElementById('main-container');
    //const body = document.getElementById('body');

    const closeAllMenus = () => {
        ProfileMenu.classList.add('hidden');
        Notif.classList.add('hidden');
        container.classList.remove('pointer-events-none');
        enableScroll();
    };


    ProfileIcon.addEventListener('click', async (event) => {
        event.stopPropagation(); 
        const user = await fetch('/User');

        if (user.ok) {
            if (ProfileMenu.classList.contains('hidden')) {
                closeAllMenus(); 
                ProfileMenu.classList.remove('hidden');
            } else {
                ProfileMenu.classList.add('hidden');
            }
        } else {
            window.location.href = 'SignIn.html';
        }
    });


    NotifIcon.addEventListener('click', async (event) => {
        event.stopPropagation();
        const user = await fetch('/User');

        if (user.ok) {
            if (Notif.classList.contains('hidden')) {
                closeAllMenus(); 
                Notif.classList.remove('hidden');
                container.classList.add('pointer-events-none');
                disableScroll();
                fetch('/UpdateNotif/Seen', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        UpdatedNotif: 'Seen'
                    })
                })
                .then(response => response.json())
                .catch(error => {
                    console.error('Error updating status:', error);
                });
            } else {
                Notif.classList.add('hidden');
                container.classList.remove('pointer-events-none');
                enableScroll();
            }
        } else {
            window.location.href = 'SignIn.html';
        }
    });

    window.addEventListener('click', () => {
        closeAllMenus();
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
                <div class="flex items-center space-x-10 mb-6 ml-5 relative ">
                    <input type="checkbox" class="appearance-none w-[39.36px] h-[31.33px] bg-[#F7F8EA] outline outline-2 outline-outline rounded-md" value=${productCart.productPrice}></input>
                    <div id="CartPhoto" class="w-[120px] h-[120px] relative flex cursor-pointer">
                        <img src="${productCart.productImage}" alt="Product Image" class="w-[120px] h-[120px] object-fill rounded-lg">
                        <div class="hidden w-[106px] h-[120px] bg-[#333333] bg-opacity-50 absolute rounded-lg" id="OutofStockCart">
                            <div class="w-[50px] h-[50px] bg-[#000000] bg-opacity-70 absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 opacity-100 rounded-full flex items-center justify-center">
                                <p class="font-Inter text-[8px] text-[#ffff]">
                                Out of Stock
                                </p>
                            </div>
                        </div> 
                    </div>
                    <div class="h-auto w-[20rem]">
                        <div id="NameAndPrice" class="cursor-pointer">
                            <h1 class="font-Montagu font-semibold text-[24px]">${productCart.productName}</h1>
                            <h2 class="font-Montserrat font-semibold text-[14px] mt-2">₱${productCart.productPrice.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>
                        </div>                    

                        <div class="flex w-[120px] h-[40px] bg-[#F7F8EA] justify-center space-x-2 outline outline-1 outline-outline rounded-lg mt-3 px-5">
                            <button class="MOcart">-</button>
                            <input style="background-color: transparent;" id="Quantity" class="text-center w-[138px] h-[40px] p-1 font-bold" type="number" onKeyDown="return false" value=${productCart.productQuantity} min="1" max=${productCart.Stock}>
                            <button class="AOcart">+</button>
                        </div>
                        
                    </div>
                    <img id="RemoveCart" src="img/ekis.png" alt="" class="absolute w-4 h-4 right-8 top-[-5px] cursor-pointer">
                </div>
                <hr class="border-1 border-outline w-auto ">
                        <div id="DeleteModal" class="fixed top-1/2 z-30 items-center left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#F8ECDC] w-[350px] h-[220px] text-white  rounded shadow-lg hidden transform transition-all duration-300">
                            <div class="">
                                <img src="img/DeleteOrange.png" class="w-[100px] ml-[34%]" alt="">
                                <div class="relative left-1/2 -translate-x-1/2 flex flex-col space-y-1 items-center w-[19rem] text-center">
                                    <span>Remove Product?</span>
                                </div>
                            </div>
                            
                            <div class="flex items-center justify-around mt-5">
                                <button id="Yes" class="bg-outline  text-[#FFF] rounded-3xl w-20 h-8">YES</button>
                                <button id="No"  class=" bg-outline  text-[#FFF] rounded-3xl w-20 h-8">NO</button>
                            </div>

                        </div> 
            </div>
            `;
            CartList.appendChild(CartElement);
            CartElement.querySelector('#CartPhoto').addEventListener('click', async () => {
                sessionStorage.setItem('product', productCart.productName);
                window.location.href = 'ProductDetails.html';
            });
            
            CartElement.querySelector('#NameAndPrice').addEventListener('click', async () => {
                sessionStorage.setItem('product', productCart.productName);
                window.location.href = 'ProductDetails.html';
            });

            if(productCart.Archive === 'Yes'){
                //console.log('Naka hidden', productCart.productName, ' ',productsCart.isArchive)
                CartElement.classList.add('hidden');
            }

            CartElement.querySelector('#RemoveCart').addEventListener('click', async () =>{
                CartElement.querySelector('#DeleteModal').classList.remove('hidden');
                CartElement.querySelector('#No').addEventListener('click',async () => {
                    CartElement.querySelector('#DeleteModal').classList.add('hidden');
                });
                CartElement.querySelector('#Yes').addEventListener('click',async () => {
                    const cartID = productCart.CartID;
                    try {
                        const response = await fetch(`/CartDel`, {
                            method: 'DELETE',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                id: cartID, // Include the cart ID in the request body
                                // Add any additional data you need to send
                            }),
                        });
        
                        if (response.ok) {
                            console.log(`Item with ID ${cartID} removed from the cart.`);
                            CartElement.querySelector('#DeleteModal').classList.add('hidden');
                            CartElement.remove(); // Remove the item from the UI
                        } else {
                            console.error('Failed to delete item:', response.statusText);
                        }
                    } catch (error) {
                        console.error('Error:', error);
                    }
                });
            });
            if(productCart.Stock == 0){
                CartElement.querySelector('#OutofStockCart').classList.remove('hidden');
                CartElement.querySelector('input[type="checkbox"]').disabled = true;
            }
           
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
            const MaxValue = parseInt(Quantity.getAttribute('max'));
            if(currentValue < MaxValue){
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
            else{
                console.log('Maximum limit reached');
            }

            
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

async function fetchUser() {
    try {
        const response = await fetch('/User');
        if (response.ok) {
        const data = await response.json();
        //console.log('User:', data);
        fetchUserInfo();
        } else {
        console.error('Failed to fetch user data.');
        }
    } catch (err) {
        console.error('Error fetching user:', err);
    }
}
// Initialize a WebSocket connection
//const socket = new WebSocket('wss://likhaforzappnott.onrender.com/ws');  // Replace with your servers WebSocket URL
const socket = new WebSocket('ws://localhost:3000');
//const socket = new WebSocket('ws://192.168.0.250:3000'); // Replace with actual WebSocket URL
//const socket = new WebSocket('wss://zappnott.shop/ws');
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
            <div class="flex relative w-auto py-auto justify-between mr-6 cursor-pointer">
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
        productElement.addEventListener('click', async () => {
            try {
                await updateNotificationStatus(product.OrderID,product.NotificationID);
                window.location.href = `Orders.html#Order-${product.OrderID}`;
            } catch (error) {
                console.error('Error updating notification status:', error);
            }
        });
        productList.appendChild(productElement);

        const notifdot = productElement.querySelector('.notifdot');
        if (product.Status === 'unread'|| product.Status === 'Seen') {
            notifdot.classList.remove('hidden');
        } else {
            notifdot.classList.add('hidden');
        }
    });
}

async function updateNotificationStatus(orderId,NotifID) {
    const response = await fetch('/UpdateNotif', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            UpdatedNotif: 'read',
            OrderId: orderId,
            NotifID: NotifID
        })
    });

    if (!response.ok) {
        throw new Error('Network response was not ok');
    }

}

let previousMessageCount = 0;
let UserID; 

async function GetID(){
    const ID = await fetch('/getUserID');
    if(ID.ok){
        const result = await ID.json();
        UserID = result;
        //console.log('hmm',UserID);
    }
}
GetID();

function SendBot() {
    const Chatbot = document.getElementById('CB').innerText;
    fetch('/Chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'ChatBot' })
    }).then(() => {
        fetchMessages();
    });
}
function Zapp(){
    const Chatbot = document.getElementById('CB').innerText;
    fetch('/Chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Zappnott' })
    }).then(() => {
        fetchMessages();
    });
}


function renderMessages(messages) {
    const chatBox = document.getElementById('chat-box');
    chatBox.innerHTML = '';

    messages.forEach(msg => {
        const messageElement = document.createElement('div');
        
        const materials = msg.message.split(';'); 
        
        if (materials.length > 1) {
            const buttonContainer = document.createElement('div');
            buttonContainer.classList.add('flex','flex-col', 'items-start', 'gap-2');
            
            materials.forEach(material => {
                const button = document.createElement('button');
                button.innerText = material.trim();
                button.classList.add('rounded-lg', 'p-3', 'bg-outline', 'text-[#FFF]');
                
                button.onclick = () => {
                    fetch('/Chat', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message: material })
                    }).then(() => {
                        fetchMessages();
                    });
                    console.log('Material button clicked:', material);
                };
                
                buttonContainer.appendChild(button);
            });
            
            messageElement.appendChild(buttonContainer);
        } else {
            messageElement.innerHTML = `
                <div id="CC" class="flex items-start">
                    <div id="Chats" class="rounded-lg my-[5px] p-3 max-w-xs">
                        <p id="Content" class="text-sm">${msg.message}</p>
                    </div>
                </div>
            `;
        }

        const ChatContainer = messageElement.querySelector('#CC');
        const ChatBG = messageElement.querySelector('#Chats');

        if (msg.SenderID === parseInt(UserID)) {
            ChatContainer.classList.add('justify-end');
            if (materials.length <= 1) { 
                ChatBG.classList.add('bg-[#6cc4f4]', 'text-[#FFF]');
                ChatBG.classList.remove('bg-outline');
            }
        } else {
            if (materials.length <= 1) { 
                ChatBG.classList.add('bg-outline');
            }
        }
        //ChatBadge();
        

        chatBox.appendChild(messageElement);
    });

    if (messages.length > previousMessageCount) {
        scrollToBottom();
    }

    previousMessageCount = messages.length;
}


// async function ChatBadge(){
//     const ChatBadge = document.getElementById('Chat-Badge');

//     try {
//         const response = await fetch('/ChatNotifCustomer', {
//             method: 'GET',
//             headers: {
//                 'Content-Type': 'application/json',
//             },
//         });

//         if (!response.ok) {
//             throw new Error(`HTTP error! Status: ${response.status}`);
//         }

//         const data = await response.json();
//         const notifCount = data.Notif;
//         //console.log(notifCount);
//         //ChatBadge.textContent = notifCount > 0 ? notifCount : '';
        
//         // if(notifCount > 0){
//         //     ChatBadge.classList.remove('hidden');
//         // }
//         // else{
//         //     ChatBadge.classList.add('hidden');
//         // }
        
//     } catch (error) {
//         console.error('Error fetching chat notifications:', error);
//     }
// }


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
            UserID = User.UserID;
            document.getElementById('UsernameMenu').innerText = UserName;
            //console.log(UserID);
            if(User.ProfilePic){
                console.log('Meron sya ayaw lang lumabas');
                document.getElementById('ProfilePicMenu').src = User.ProfilePic;
            }
            else{
                console.log('null pic');
            }
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
    });
});

//fetchMessages();
const logo = document.getElementById('ChatLogo');
const content = document.getElementById('ChatContent');
const closeButton = document.getElementById('ChatClose');

logo.addEventListener('click', async () => {
    
    const user = await fetch ('/User');

    if(user.ok){

    }
    else{
        window.location.href = 'SignIn.html';
    }

    try {
        const response = await fetch('/ReadMessage', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });

        if (response.ok) {
            const message = await response.text();
            //alert(message);
        }
        else if(response.status === 401){
            window.location.href = 'SignIn.html';
        } else {
            const errorData = await response.json();
            console.error('Error:', errorData);
            alert('Failed to mark messages as read');
        }
    } catch (error) {
        console.error('Request error:', error);
        alert('An error occurred while marking messages as read');
    }
    document.getElementById('Chat-Badge').classList.add('hidden');

    

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
            content.style.height = '27rem';

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