const express = require('express');
const sql = require('mssql');
const path = require('path');
const session = require('express-session');
const multer = require('multer');
const fs = require('fs');
const { constrainedMemory } = require('process');
const axios = require('axios');
//const { compile } = require('ejs');
require('dotenv').config();
const RedisStore = require('connect-redis').default;
const redis = require('redis');
const WebSocket = require('ws');
const http = require('http');

const app = express();
const server = http.createServer(app);


app.set('view engine', 'ejs');

const port = process.env.PORT || 3000;

const upload = multer({ dest: 'uploads/' });

app.use('/images', express.static(path.join(__dirname, 'UploadedImage')));

app.use(express.static(path.join(__dirname, 'public')));

app.get('/3D', (req, res) => {
    res.sendFile(path.join(__dirname, '3D.html'));
});

app.use('/Build', express.static(path.join(__dirname, 'Build')));

app.use(express.static(path.join(__dirname)));

const wss = new WebSocket.Server({ port: 8080 });



const socket = new WebSocket('ws://localhost:8080');


const REDIS_URL = process.env.REDIS_URL;

// Create Redis client
const redisClient = redis.createClient({
  url: REDIS_URL
});

// Connect to Redis
// redisClient.connect()
//   .then(() => console.log('Connected to Redis'))
//   .catch(err => console.error('Redis connection error', err));

//   app.use(session({
//     store: new RedisStore({ client: redisClient }),
//     secret: 'Hatdog',  // Change this to your own secret
//     resave: false,
//     saveUninitialized: false,
//     cookie: {
//       secure: process.env.NODE_ENV === 'production',  // Secure cookie in production (Render)
//       maxAge: 24 * 60 * 60 * 1000  // Optional: set cookie expiration time (e.g., 24 hours)
//     }
//   }));
  

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
  });

app.use(session({
    secret: 'Hatdog',
    resave: true,
    saveUninitialized: true

  }));



//Local Machine sa baba
// const config = {
//     user: 'Jennie',
//     password: '2harmaine!',
//     server: 'LAPTOP-GV6HVKVU',
//     database: 'Capstone',
//     options: {
//         encrypt: false
//     }
// };

//try
const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    options: {
        encrypt: process.env.DB_ENCRYPT === 'true' // Convert 'true' or 'false' to boolean
    }
};

// MSCloud
// const config = {
//     user: 'Likha_Admin',
//     password: 'Zappnott@',
//     server: 'likha.database.windows.net',
//     database: 'Capstone',
//     options: {
//         encrypt: true
//     }
// };


//Cloud Server
// const config = {
//     user: 'sqlserver',
//     password: '$Lu=o+G<1_>);Aq8',
//     server: '34.44.250.42',
//     database: 'Capstone',
//     options: {
//         encrypt: false
//     }
// };





const pool = new sql.ConnectionPool(config);
pool.connect().then(() => {
    console.log("Database connected");
  }).catch(err => console.error("Database connection failed", err));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));


let clients = [];

const checkNotifications = async (userID) => {
    try {
        const request = pool.request().input('UserID', sql.Int, userID);
        const query = `
            SELECT COUNT(NotificationID) AS NotificationID 
            FROM tbl_notification
            INNER JOIN tbl_Order ON tbl_Order.OrderID = tbl_notification.OrderID 
            WHERE tbl_Notification.Status = 'unread' 
            AND tbl_Order.UserID = @UserID
        `;
        const result = await request.query(query);
        const notifCount = result.recordset[0].NotificationID;

        notifyClients(notifCount);
    } catch (err) {
        console.error('Database error:', err);
    }
};

const notifyClients = (notifCount) => {
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ NotificationID: notifCount }));
        }
    });
};

wss.on('connection', (ws) => {
    console.log('Client connected');
    clients.push(ws);

    // Start checking notifications every second for the connected user
    const userID = 3; // Replace with actual user ID from session
    const interval = setInterval(() => checkNotifications(userID), 1000);

    ws.on('close', () => {
        console.log('Client disconnected');
        clients = clients.filter(client => client !== ws);
        clearInterval(interval); // Stop checking when the client disconnects
    });
});

//Update
app.put('/updateProduct/:productName', async (req, res) => {
    const { productName } = req.params;
    const { updatedName, updatedPrice } = req.body;

    try {

        const request = pool.request();

        request.input('ProductName',sql.VarChar,productName);
        request.input('NewName',sql.VarChar,updatedName);
        request.input('UpdatedPrice',sql.Int,updatedPrice);

        const query = `
            UPDATE tbl_Product
            SET ProductName = @NewName, Price = @UpdatedPrice
            WHERE ProductName = @ProductName
        `;

       const result = await request.query(query);
        res.status(200).send('Product Updated')
    } catch (err) {
        console.error('Database Error:', err);
        res.status(500).json({ error: 'Database error', details: err });
    }
});

//Add To Cart

app.post('/AddToCart', async (req, res) => {
    const { ProductName, Quantity } = req.body;
    const quan = parseInt(Quantity);
    const user = req.session.user;

    if (!user || user.UserID === undefined) {
        return res.status(401).json({ error: 'User not authenticated' });
    }
    const ID = parseInt(user.UserID);

    try {
        const request = pool.request();

        request.input('PN', sql.VarChar, ProductName);
        request.input('Quan', sql.Int, quan);
        request.input('ID', sql.Int, ID);

        const query = `
        BEGIN
            DECLARE @ProdID INT, @Price INT, @Total INT;

            SELECT @Price = Price FROM tbl_Product WHERE ProductName = @PN;
            SET @Total = @Price * @Quan;
            SELECT @ProdID = ProductID FROM tbl_Product WHERE ProductName = @PN;

            IF EXISTS (SELECT 1 FROM tbl_Cart WHERE ProductID = @ProdID AND UserID = @ID)
                UPDATE tbl_Cart
                SET Quantity = Quantity + @Quan, Price = Price * (Quantity + @Quan)
                WHERE ProductID = @ProdID;
            ELSE
                INSERT INTO tbl_Cart (Quantity, Price, UserID, ProductID)
                VALUES (@Quan, @Total, @ID, @ProdID);
        END
        `;

        const result = await request.query(query);
        res.status(200).json({ message: 'Added to Cart successfully' });

    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error', details: err.message });
    }
});


app.put('/UpdateCart', async (req, res) => {
    const { ProductN , Quantity} = req.body;
    const user = req.session.user;
    const ID = parseInt(user.UserID);
    try {   
        const request = pool.request();

        request.input('PN',sql.VarChar,ProductN);
        request.input('Quan',sql.Int,Quantity);
        request.input('ID',sql.Int,ID);

        const query =`
        BEGIN
            DECLARE @Quantity int = @Quan;
            DECLARE @Price int = (SELECT Price FROM tbl_Product WHERE ProductName LIKE @PN);
            DECLARE @TotalPrice int = @Quantity * @Price
            UPDATE tbl_Cart 
            SET Quantity = @Quantity , Price = @TotalPrice
            WHERE UserID = @ID AND ProductID = (SELECT ProductID FROM tbl_Product WHERE ProductName LIKE @PN);
        END
        `;

        const result = await request.query(query);

        res.status(200).json({ message: 'Cart Updated successfully' });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error', details: err });
    }
});


//Delete
app.delete('/DeleteProduct/:productName', async (req, res) => {
    const productName = req.params.productName;
    try{
        const request = pool.request();

        request.input('@PN',sql.VarChar,productName);

        const query = `
        DELETE FROM tbl_Product WHERE ProductName = ${productName}
        `;
        const result = await request.query(query);
        res.status(200).send('Product Deleted');
    }
    catch(err){
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error', details: err });
    }
});

//SignUp
app.post('/SignUp', async (req, res) => {
    const { name, num, Password } = req.body;

    try {
        const request = pool.request()
        .input('name', sql.NVarChar, name)
        .input('number', sql.NVarChar, num)
        .input('Password',sql.NVarChar,Password);
        const query = `INSERT INTO tbl_User (Name,MobileNum,Password,Type) VALUES (@name, @number,@Password,'Customer');`;
        const result = await request.query(query);
            
        res.status(200).json({messages: 'Sign Up Successful'});
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error', details: err });
    }
});


// LogIn
app.post('/LogIn', async (req, res) => {
    const { username, password } = req.body;

    try {
        const request = await pool.request()
        .input('username', sql.NVarChar, username)
        .query('SELECT * FROM tbl_User WHERE UserName = @username');

        const user = request.recordset[0];

        if (user && user.Password === password) { 
            //console.log(req.session);
            req.session.user = user;
            //console.log(req.session.user.UserID);
            if (user.Type === "Admin") {
                res.status(250).send('Admin');
            } else {
                res.status(200).send('Login successful');
            }
        } else {
            res.status(401).send('Invalid username or password');
        }
    } catch (error) {
        console.error(error);
        res.status(500).send('Error logging in');
    }
});

//UpdateProfile
app.put('/UpdateProfile', async (req, res) => {

    const user = req.session.user;
    const ID = parseInt(user.UserID);
    const {name, username, mobile, email} = req.body;

    try {

        const request = pool.request();

        request.input('Name',sql.VarChar,name);
        request.input('UserName',sql.VarChar,username);
        request.input('Mobile',sql.VarChar,mobile);
        request.input('Email',sql.VarChar,email);
        request.input('ID',sql.Int,ID);

        const query = `
            UPDATE tbl_User
            SET UserName = @UserName, Name = @Name, MobileNum = @Mobile, Email = @Email
            WHERE UserID = @ID
        `;

       const result = await request.query(query);
       res.status(200).json({ success: true });
    } catch (err) {
        console.error('Database Error:', err);
        res.status(500).json({ error: 'Database error', details: err });
    }

});
//LogOut
app.post('/LogOut', (req, res) => {
    if (req.session && req.session.user) {
        req.session.destroy((err) => {
            if (err) {
                console.error('Error destroying session:', err);
                return res.status(500).json({ error: 'Error logging out' });
            } else {
                console.log('logout na');
                return res.status(200).json({ message: 'Logout successful' });
            }
        });
    } else {
        return res.status(401).json({ error: 'Not authenticated' });
    }
});


app.get('/api/current_user', (req, res) => {
    if (req.session.user) {
      res.json(req.session.user);
    } else {
        res.redirect('/SignIn.html');    
        //res.status(401).send('Not authenticated');
    }
});

app.get('/UserInfo', async (req, res) => {
    const user = req.session.user;
    //console.log(user.UserID);
    const ID = parseInt(user.UserID);

    const query = `SELECT * FROM tbl_User WHERE UserID = @ID`;
    
    try {
        const request = pool.request();
        request.input('ID', sql.Int, ID);
        
        const result = await request.query(query); // Await the result
        
        if (result.recordset.length > 0) {
            const User = result.recordset[0]; // Assuming you're fetching a single user
            res.json(User); // Send the user data as JSON
        } else {
            res.status(404).send('User not found');
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});


  app.post('/upload', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send('No file uploaded');
        }
        const uploadFolder = path.join(__dirname, 'UploadedImage');

        if (!fs.existsSync(uploadFolder)) {
            fs.mkdirSync(uploadFolder, { recursive: true });
        }

        const imagePath = path.join(uploadFolder, req.file.originalname);

        fs.renameSync(req.file.path, imagePath);
        const request = await pool.request()
            .input('ImagePath', sql.VarChar, imagePath)
            .input('Pname', sql.VarChar, req.body.productName)
            .input('Price', sql.Int, req.body.productPrice)
            .input('Des', sql.VarChar, req.body.productDes)
            .input('Stock', sql.Int, req.body.Stock)
            .input('Cat', sql.Int, req.body.Cat)
            .query("INSERT INTO tbl_Product (ProductName,Price,Description,Stock,CategoryID,ProductImage) VALUES (@Pname,@Price,@Des,@Stock,@Cat,@ImagePath);");

        res.sendStatus(200);
    } catch (error) {
        console.error('Error uploading image:', error);
        res.status(500).send('Error uploading image');
    }
});


// app.post('/upload', upload.single('image'), async (req, res) => {
//     try {
//         if (!req.file) {
//             return res.status(400).send('No file uploaded');
//         }

//         const data = fs.readFileSync(req.file.path);

//         const request = await pool.request()
        
//         .input('Image', sql.VarBinary, data)
//         .input('Pname', sql.VarChar, req.body.productName)
//         .input('Price', sql.Int, req.body.productPrice)
//         .input('Des', sql.VarChar,req.body.productDes)
//         .input('Stock',sql.Int,req.body.Stock)
//         .input('Cat', sql.Int, req.body.Cat)
//         .query("INSERT INTO tbl_Product (ProductName,Price,Description,Stock,CategoryID,ProductImage) VALUES (@Pname,@Price,@Des,@Stock,@Cat,@Image);");

//         fs.unlinkSync(req.file.path);

//         res.sendStatus(200);
//     } catch (error) {
//         console.error('Error uploading image:', error);
//         res.status(500).send('Error uploading image');
//     }
// });

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'Index.html'));
});

app.get('/Admin', async (req, res) => {
    const Type = "Admin";
    const query = `SELECT UserID FROM tbl_User WHERE Type = @Type`;
    
    try {
        const request = pool.request();
        request.input('Type', sql.VarChar, Type);
        
        const result = await request.query(query);
        
        const Admin = result.recordset;
        
        res.json(Admin);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

    app.post('/create-payment-link', async (req, res) => {
        const { amount } = req.body;
      
        const options = {
          method: 'POST',
          url: 'https://api.paymongo.com/v1/links',
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            authorization: 'Basic c2tfdGVzdF9jcXk0ak5BNHUyTHIxcXBKR2E2OTg1Mkc6'
          },
          data: {
            data: {
              attributes: {
                amount: amount,  
                description: 'Payment'
              }
            }
          }
        };
      
        try {
          const response = await axios.request(options);
          res.status(200).json(response.data);
        } catch (error) {
          console.error('Error creating payment link:', error);
          res.status(500).json({ error: error.message });
        }
      });


      app.post('/archive-link', async (req, res) => {
        const { ID } = req.body;
    
        try {
            const options = {
                method: 'POST',
                url: `https://api.paymongo.com/v1/links/${ID}/archive`,
                headers: {
                    accept: 'application/json',
                    authorization: 'Basic c2tfdGVzdF9jcXk0ak5BNHUyTHIxcXBKR2E2OTg1Mkc6'
                }
            };
    
            const response = await axios.request(options);
            console.log(response.data);
            res.status(200).json(response.data);
    
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Failed to archive payment link' });
        }
    });

      app.post('/retrieve-payment-link', async (req, res) => {
        const { reference_number } = req.body;
        console.log(reference_number);
        try {
            const options = {
                method: 'GET',
                url: `https://api.paymongo.com/v1/links?reference_number=${reference_number}`,
                headers: {
                    accept: 'application/json',
                    authorization: 'Basic c2tfdGVzdF9jcXk0ak5BNHUyTHIxcXBKR2E2OTg1Mkc6', 
                },
            };

        const response = await axios.request(options);
        res.status(200).json(response.data);
    } catch (error) {
        console.error('Error retrieving payment link:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: error.response ? error.response.data : 'Internal Server Error' });
    }
});
// app.post('/Chat', (req, res) => {
//     const { sender_id, receiver_id, message } = req.body;
//     const query = 'INSERT INTO tbl_message (SenderID, ReceiverID, message) VALUES (?, ?, ?)';
//     config.query(query, [sender_id, receiver_id, message], (err, result) => {
//         if (err) throw err;
//         res.send({ message: 'Message sent' });
//     });
// });

//SignUp
app.post('/Chat', async (req, res) => {
    const {receiver_id, message } = req.body;

    const user = req.session.user;
    const ID = parseInt(user.UserID);
    const query = `BEGIN
                    DECLARE @UserID INT, @Admin INT, @ConvoID INT, @LatestConvo INT
                    SET @UserID = @Sender
                    SET @LatestConvo = (SELECT ISNULL(MAX(ConversationID),0) FROM tbl_message)
                    SET @Admin = (SELECT UserID FROM tbl_User WHERE Type = 'Admin' )
                    IF EXISTS (SELECT 1 FROM tbl_message WHERE (SenderID = @UserID AND ReceiverID = @Admin) OR (SenderID = @Admin AND ReceiverID = @UserID))
                        BEGIN
                            INSERT INTO tbl_message (SenderID, ReceiverID, message, ConversationID,Status) VALUES (@UserID,@Admin,@message,(SELECT TOP 1 ConversationID FROM tbl_message WHERE (SenderID = @UserID AND ReceiverID = @Admin) OR (SenderID = @Admin AND ReceiverID = @UserID)),DEFAULT)
                        END
                    ELSE 
                        BEGIN
                            INSERT INTO tbl_message (SenderID, ReceiverID, message, ConversationID,Status) VALUES (@UserID,@Admin,@message,@LatestConvo + 1,DEFAULT)
                        END
                    END`;
    try {
        const request = pool.request();
        request.input('Sender', sql.Int, ID);
        request.input('message',sql.Text,message);
        const result = await request.query(query);
        res.status(200).send('Chat successfully!');
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error', details: err });
    }
});

app.post('/Chat/Admin', async (req, res) => {
    const CustomerName = req.query.Name;
    //console.log(CustomerName);
    const { message } = req.body;
    const query = `BEGIN
                    DECLARE @LatestConvo INT, @recei INT
                    SET @LatestConvo = (SELECT ISNULL(MAX(ConversationID),0) FROM tbl_message)
                    SET @recei = (SELECT UserID FROM tbl_User WHERE Name LIKE @Receiver)
                    IF EXISTS (SELECT 1 FROM tbl_message WHERE (SenderID = @Sender AND ReceiverID = @recei) OR (SenderID = @recei AND ReceiverID = @Sender))
                        BEGIN
                            INSERT INTO tbl_message (SenderID, ReceiverID, message, ConversationID,Status) VALUES (@Sender,@recei,@message,(SELECT TOP 1 ConversationID FROM tbl_message WHERE (SenderID = @Sender AND ReceiverID = @recei) OR (SenderID = @recei AND ReceiverID = @Sender)),DEFAULT)
                        END
                    ELSE 
                        BEGIN
                            INSERT INTO tbl_message (SenderID, ReceiverID, message,ConversationID,Status) VALUES (@Sender,@recei,@message,@LatestConvo + 1,DEFAULT)
                        END
                    END`;
    const user = req.session.user;
    const ID = parseInt(user.UserID);
    try {
        const request = pool.request();
        request.input('Sender', sql.Int, ID);
        request.input('Receiver',sql.VarChar,CustomerName)
        request.input('message',sql.Text,message);
        const result = await request.query(query);
        res.status(200).send('Chat successfully inserted!');
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error', details: err });
    }
});

app.get('/Inbox', async (req, res) => {
    const query = `
        SELECT 
            m.message,
            u.Name AS CustomerName,
            (SELECT COUNT(*) 
            FROM tbl_message 
            WHERE conversationID = m.conversationID
            AND ReceiverID = (SELECT UserID FROM tbl_User WHERE Name = 'Zappnott' AND Type = 'Admin') 
            AND SenderID = u.UserID 
            AND Status = 'Unread') AS Notif_Count
        FROM 
            tbl_message m
        JOIN 
            tbl_User u ON (
                (u.UserID = m.ReceiverID AND u.Type = 'Customer') 
                OR 
                (u.UserID = m.SenderID AND u.Type = 'Customer')
            )
        WHERE 
            m.ID = (
                SELECT 
                    MAX(ID) 
                FROM 
                    tbl_message 
                WHERE 
                    conversationID = m.conversationID
                    AND (SenderID = (SELECT UserID FROM tbl_User WHERE Name = 'Zappnott' AND Type = 'Admin') 
                        OR ReceiverID = (SELECT UserID FROM tbl_User WHERE Name = 'Zappnott' AND Type = 'Admin'))
            )
        ORDER BY 
            m.conversationID;

    `;
    try {
        const result = await pool.request()
            .query(query);
        const messages = result.recordset;
        res.json(messages);
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error', details: err });
    }
});

app.get('/ChatNotif', async (req, res) => {
    const user = req.session.user;
    const ID = parseInt(user.UserID);
    const query = `
        SELECT COUNT(*) AS Notif FROM tbl_message WHERE ReceiverID = @Admin AND Status = 'Unread'
    `;
    try {
        const result = await pool.request()
            .input('Admin',sql.Int,ID)
            .query(query);
        const notif = result.recordset[0].Notif;
        res.json({ Notif: notif });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error', details: err });
    }
});

//Resume later
app.get('/api/messages', async (req, res) => {
    const user = req.session.user;

    if(!user || user.UserID === undefined){
        return res.redirect('SignIn.html');
    }

    const ID = parseInt(user.UserID);
    const query = `
        SELECT * FROM tbl_message 
        WHERE (SenderID = @sender_id AND ReceiverID = (SELECT UserID FROM tbl_User WHERE Type = 'Admin')) 
        OR (SenderID = (SELECT UserID FROM tbl_User WHERE Type = 'Admin') AND ReceiverID = @sender_id)
    `;

    try {
        const result = await pool.request()
            .input('sender_id', sql.Int, ID)
            .query(query);
        const messages = result.recordset;
        res.json(messages);
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error', details: err });
    }
});

app.get('/api/messages/Admin', async (req, res) => {
    const user = req.session.user;
    const CustomerName = req.query.Name;
    //console.log(CustomerName);
    const ID = parseInt(user.UserID);
    const query = `
        BEGIN
        BEGIN
        SELECT * FROM tbl_message 
        WHERE (SenderID = (SELECT UserID FROM tbl_User WHERE Name = @Receiver) AND ReceiverID = @sender_id) 
        OR (SenderID = @sender_id AND ReceiverID = (SELECT UserID FROM tbl_User WHERE Name = @Receiver))
        END
        BEGIN
        UPDATE tbl_message
        SET Status = 'Read'
        WHERE SenderID = (SELECT UserID FROM tbl_User WHERE Name = @Receiver) AND ReceiverID = @sender_id
        END
        END
        
    `;

    try {
        const pool = await sql.connect(config);
        const result = await pool.request()
            .input('sender_id', sql.Int, ID)
            .input('Receiver',sql.VarChar,CustomerName)
            .query(query);
        const messages = result.recordset;
        res.json(messages);
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error', details: err });
    }
});

app.get('/products', async (req, res) => {
    try {
        const result = await pool.request()
            .query("SELECT ProductName,FORMAT(CAST(Price AS DECIMAL(10, 2)), 'N2')  as Price, Description, Stock, CategoryID, ProductImage FROM tbl_Product");

        if (result.recordset.length === 0) {
            return res.status(404).send('Product not found');
        }
        const products = result.recordset.map(product => {
            const fileName = path.basename(product.ProductImage);
            const imagePath = `UploadedImage/${fileName}`;
            console.log(imagePath);
            return {
                productName: product.ProductName,
                productPrice: product.Price,
                description: product.Description,
                stock: product.Stock,
                categoryId: product.CategoryID,
                imagePath: imagePath
            };
            
        });

        res.json(products);
    } catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).send('Error fetching product');
    }
});


app.get('/productsDetails/:product', async (req, res) => {
    const product = req.params.product;
    try{
        const request = pool.request();
        request.input('productName', sql.VarChar, product);
        const query = `SELECT ProductName,FORMAT(CAST(Price AS DECIMAL(10, 2)), 'N2')  as Price, Description, Stock, CategoryID, ProductImage FROM tbl_Product WHERE ProductName LIKE @productName`;
        const result = await request.query(query);
        const products = result.recordset.map(product => {
            const fileName = path.basename(product.ProductImage);
            const imagePath = `UploadedImage/${fileName}`;

            return {
                productName: product.ProductName,
                productPrice: product.Price,
                description: product.Description,
                stock: product.Stock,
                categoryId: product.CategoryID,
                imagePath: imagePath
            };
        });

        res.json(products);
    }catch(err){
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error', details: err });
    }
});

app.get('/productsJewelry', async (req, res) => {
    try {

        const result = await pool.request()
            .query("SELECT ProductName, FORMAT(CAST(Price AS DECIMAL(10, 2)), 'N2')  as Price, Description, Stock, CategoryID, ProductImage FROM tbl_Product WHERE CategoryID = 3");

        if (result.recordset.length === 0) {
            return res.status(404).send('Product not found');
        }

        const products = result.recordset.map(product => {
            const fileName = path.basename(product.ProductImage);

            const imagePath = `UploadedImage/${fileName}`;

            return {
                productName: product.ProductName,
                productPrice: product.Price,
                description: product.Description,
                stock: product.Stock,
                categoryId: product.CategoryID,
                imagePath: imagePath 
            };
        });

        res.json(products);
    } catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).send('Error fetching product');
    }
});

app.get('/productsBag', async (req, res) => {
    try {
        const result = await pool.request()
            .query("SELECT ProductName,FORMAT(CAST(Price AS DECIMAL(10, 2)), 'N2')  as Price, Description, Stock, CategoryID, ProductImage FROM tbl_Product WHERE CategoryID = 1");

        if (result.recordset.length === 0) {
            return res.status(404).send('Product not found');
        }
        const products = result.recordset.map(product => {
            const fileName = path.basename(product.ProductImage);
            const imagePath = `UploadedImage/${fileName}`;

            return {
                productName: product.ProductName,
                productPrice: product.Price,
                description: product.Description,
                stock: product.Stock,
                categoryId: product.CategoryID,
                imagePath: imagePath 
            };
        });

        res.json(products);
    } catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).send('Error fetching product');
    }
});

app.get('/productsDress', async (req, res) => {
    try {
        const result = await pool.request()
            .query("SELECT ProductName,FORMAT(CAST(Price AS DECIMAL(10, 2)), 'N2')  as Price, Description, Stock, CategoryID, ProductImage FROM tbl_Product WHERE CategoryID = 2");

        if (result.recordset.length === 0) {
            return res.status(404).send('Product not found');
        }
        const products = result.recordset.map(product => {
            const fileName = path.basename(product.ProductImage);
            const imagePath = `UploadedImage/${fileName}`;

            return {
                productName: product.ProductName,
                productPrice: product.Price,
                description: product.Description,
                stock: product.Stock,
                categoryId: product.CategoryID,
                imagePath: imagePath 
            };
        });

        res.json(products);
    } catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).send('Error fetching product');
    }
});


app.get('/User', async (req, res) => {

    const user = req.session.user;

    if (!user || user.UserID === undefined) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const ID = parseInt(user.UserID);
    
    try{
        const request = pool.request();
        request.input('UserID', sql.Int, ID);
        const query = 'SELECT UserName FROM tbl_User WHERE UserID = @UserID';
        const result = await request.query(query);
        const Name = result.recordset;
        res.json(Name);
    }catch(err){
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error', details: err });
    }
});

app.get('/Order', async (req, res) => {
    const user = req.session.user;
    const ID = parseInt(user.UserID);
    try {
        const request = pool.request();
        request.input('UserID', sql.Int, ID);
        const query = `SELECT OrderID, TransactionID, convert(varchar, Date, 0) AS Date, Status FROM tbl_Order WHERE UserID = @UserID`;
        const result = await request.query(query);
        const products = result.recordset;
        
        res.json(products);
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error', details: err });
    }
});
//OrderList AdminView
app.get('/Orders', async (req, res) => {
           
    try {
        const request = pool.request();
        const query = `SELECT TransactionID,Status, convert(varchar, Date, 0) AS Date, Name, TotalPrice
                       FROM tbl_Order INNER JOIN tbl_User ON tbl_Order.UserID = tbl_User.UserID;`;
        const result = await request.query(query);
        const products = result.recordset.map(product => {
            return {
                OrderedDate: product.Date,
                productOrder: product.TransactionID,
                ProductName: product.Name,
                ProductTotal: product.TotalPrice,
                Status: product.Status

            };
        });
        res.json(products);
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error', details: err });
    }
});

app.get('/OrderDetails', async (req, res) => {
    const transactionId = req.query.transac;
    try {
        const request = pool.request();
        request.input('Transac', sql.VarChar, transactionId);
        //console.log(transactionId);
        const query = `SELECT TransactionID,Email,MobileNum, convert(varchar, Date, 0) AS Date, Status, TotalPrice, Name
                       FROM tbl_Order
                       INNER JOIN tbl_User ON tbl_Order.UserID = tbl_User.UserID
                       WHERE 'OZPNT' + RIGHT('0000' + CONVERT(varchar(4), tbl_Order.OrderID), 4) = @Transac;`;
        const result = await request.query(query);
        const products = result.recordset.map(product => {

            return {
                OrderedDate: product.Date,
                productOrder: product.TransactionID,
                CustomerName: product.Name,
                ProductTotal: product.TotalPrice,
                CustomerEmail: product.Email,
                CustomerNum: product.MobileNum,
                Status: product.Status
            };
        });
        //console.log(products);
        res.json(products);
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error', details: err });
    }
});

app.put('/UpdateStat', async (req, res) => {
    const { status, TransID } = req.body;

    try {
        const request = pool.request()
        .input('Stat', sql.VarChar, status)
        .input('TransID',sql.VarChar,TransID);
        await request.query("UPDATE tbl_Order SET Status = @Stat WHERE 'OZPNT' + RIGHT('0000' + CONVERT(varchar(4), OrderID), 4) = @TransID");
            
        console.log("Status successfully Updated!");
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error', details: err });
    }
});

app.get('/OrderItem/:productOrder', async (req, res) => {
    const productOrder = req.params.productOrder;
    //console.log(productOrder);
    try {
        const request = pool.request();
        request.input('OrderID', sql.VarChar, productOrder);
        
        const query = `
            SELECT P.ProductImage, P.ProductName, OI.Quantity, OI.Price
            FROM tbl_OrderItem OI
            INNER JOIN tbl_Product P ON OI.ProductID = P.ProductID
            WHERE OI.OrderID = @OrderID
        `;
        const result = await request.query(query);

        const orderItems = result.recordset.map(item => {
        const fileName = path.basename(item.ProductImage);
        const imagePath = `UploadedImage/${fileName}`;
            return {
                productName: item.ProductName,
                Quantity: item.Quantity,
                Price: item.Price,
                productImage: imagePath
            };
        });

        res.json(orderItems);
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error', details: err });
    }
});

app.get('/Notif', async (req, res) => {
    const user = req.session.user;

    if(!user || user.UserID === undefined){
        return res.status(401).json();
    }

    const ID = parseInt(user.UserID);
    try {
        const request = pool.request()
        .input('UserID', sql.Int, ID);
        
        const query = `
            SELECT DISTINCT CONCAT('Your Order ' , tbl_Order.TransactionID , ' is ' , NewStatus) AS Content, convert(varchar, NotificationDate, 0)AS NotificationDate, 
            tbl_Product.ProductImage, NotificationID, tbl_notification.Status FROM tbl_notification 
            INNER JOIN tbl_Order ON tbl_Order.OrderID = tbl_notification.OrderID 
            INNER JOIN tbl_OrderItem ON tbl_OrderItem.OrderID = tbl_Order.OrderID
            INNER JOIN tbl_Product ON tbl_Product.ProductID = tbl_OrderItem.ProductID
            WHERE tbl_Order.UserID = @UserID AND tbl_Product.ProductID =(SELECT MIN(tbl_Product.ProductID)
            FROM tbl_OrderItem INNER JOIN tbl_Product ON tbl_Product.ProductID = tbl_OrderItem.ProductID
            WHERE tbl_OrderItem.OrderID = tbl_Order.OrderID) ORDER BY NotificationID DESC ;
        `;
        const result = await request.query(query);
       
        const orderItems = result.recordset.map(item => {
        const fileName = path.basename(item.ProductImage);
        const imagePath = `UploadedImage/${fileName}`;
            return {
                Content: item.Content,
                Date: item.NotificationDate,
                productImage: imagePath,
                Status: item.Status
            };
        });

        res.json(orderItems);
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error', details: err });
    }
});

app.get('/Items/:productOrder', async (req, res) => {
    const productOrder = req.params.productOrder;
    try {
        const request = pool.request()
        .input('OrderID', sql.VarChar, productOrder);
        //console.log(productOrder)

        const query = `
            SELECT P.ProductImage, P.ProductName, OI.Quantity, OI.Price
            FROM tbl_OrderItem OI
            INNER JOIN tbl_Product P ON OI.ProductID = P.ProductID
            WHERE 'OZPNT' + RIGHT('0000' + CONVERT(varchar(4), OI.OrderID), 4) = @OrderID
        `;
        const result = await request.query(query);

        const orderItems = result.recordset.map(item => {
            const base64Image = Buffer.from(item.ProductImage, 'binary').toString('base64');
            return {
                productName: item.ProductName,
                Quantity: item.Quantity,
                Price: item.Price,
                productImage: base64Image
            };
        });


        res.json(orderItems);
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error', details: err });
    }
});

app.get('/Cart', async (req, res) => {
    try {
        const user = req.session.user;

    if (!user || user.UserID === undefined) {
        return res.status(401).json();
    }
    const ID = parseInt(user.UserID);
        const request = pool.request()
        .input('UserID', sql.Int, ID);
        const query = `
            SELECT 
                tbl_Product.ProductName, 
                tbl_Cart.Price, 
                tbl_Cart.Quantity, 
                tbl_Product.ProductImage 
            FROM 
                tbl_Product 
            INNER JOIN 
                tbl_Cart 
            ON 
                tbl_Cart.ProductID = tbl_Product.ProductID 
            INNER JOIN 
                tbl_User 
            ON 
                tbl_Cart.UserID = tbl_User.UserID 
            WHERE 
                tbl_User.UserID = @UserID`;

        

            const result = await request.query(query);
            const productsCart = result.recordset.map(productCart => {

            const fileName = path.basename(productCart.ProductImage);

            const imagePath = `UploadedImage/${fileName}`;
                return {
                    productName: productCart.ProductName,
                    productPrice: productCart.Price,
                    productQuantity: productCart.Quantity,
                    productImage: imagePath
                };
            });
            res.json(productsCart);
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error', details: err });
    }
});
//PlaceOrder
app.post('/PlaceOrder', async (req, res) => {
    const orders  = req.body;

    try {

        const user = req.session.user;
            const ID = parseInt(user.UserID);
            console.log(orders)
            const order =  pool.request()
                .input('ID',sql.Int,ID)
                .query('INSERT INTO tbl_Order ([Date], UserID, Status) VALUES (convert(varchar, getdate(), 0), @ID,DEFAULT)');
        for (const order of orders) {
            
            const request = await pool.request()
                .input('productName', sql.NVarChar(255), order.name)
                .input('quantity', sql.Int, order.quantity)
                .query(`
                    BEGIN 
                        DECLARE @NewOrderID INT;
                        DECLARE @Price INT;
                        DECLARE @Total INT;
                        DECLARE @ProdID INT;


                        SELECT @Price = Price FROM tbl_Product WHERE ProductName LIKE @productName;
                        SELECT @ProdID = ProductID FROM tbl_Product WHERE ProductName LIKE @productName;
                        SET @NewOrderID = (SELECT TOP 1 OrderID FROM tbl_Order ORDER BY OrderID DESC);
                        SET @Total = @Price * @quantity;


                        INSERT INTO tbl_OrderItem (Quantity, Price, ProductID, OrderID)
                        VALUES (@quantity, @Total, @ProdID, @NewOrderID);
                        
                        UPDATE tbl_Order
                        SET TotalPrice = (SELECT SUM(Price) FROM tbl_OrderItem WHERE OrderID = @NewOrderID)
                        WHERE OrderID = @NewOrderID

                        DELETE tbl_cart FROM tbl_Cart INNER JOIN tbl_Product ON tbl_Product.ProductID = tbl_Cart.ProductID WHERE ProductName LIKE @productName AND Quantity = @quantity;
                    END
                `);


        }

        res.status(200).json({message: 'Order placed successfully'});
    } catch (error) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error', details: err });
    }
});



app.get('/CheckOut', async (req, res) => {
    try {
        const user = req.session.user;

        if (!user || user.UserID === undefined) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const ID = parseInt(user.UserID);

        // Parse the orders from the query string
        const orders = JSON.parse(decodeURIComponent(req.query.orders));

        const results = [];

        for (const order of orders) {
            const result = await pool.request()
                .input('productName', sql.NVarChar, `%${order}%`)
                .input('ID', sql.Int, ID)
                .query(`
                    SELECT tbl_Product.ProductName, FORMAT(CAST(tbl_Cart.Price AS DECIMAL(10, 2)), 'N2')  as Price, tbl_Cart.Quantity, tbl_Product.ProductImage 
                    FROM tbl_Cart
                    INNER JOIN tbl_Product
                    ON tbl_Cart.ProductID = tbl_Product.ProductID
                    WHERE tbl_Product.ProductName LIKE @productName AND tbl_Cart.UserID = @ID
                `);

            // Map the results and push them into the results array
            results.push(...result.recordset.map(item => {
                const fileName = path.basename(item.ProductImage);
                const imagePath = `UploadedImage/${fileName}`;
                return {
                    ProductName: item.ProductName,
                    Price: item.Price,
                    Quantity: item.Quantity,
                    Image: imagePath
                };
            }));
        }

        // Send the mapped results as JSON
        res.json(results);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('An error occurred');
    }
});





app.put('/Cancel', async (req, res) => {
    const { status, OrderID } = req.body;

    try {
        const request = pool.request()
        .input('Stat', sql.VarChar, status)
        .input('TransID',sql.VarChar,OrderID);
        const result = await request.query("UPDATE tbl_Order SET Status = @Stat WHERE 'OZPNT' + RIGHT('0000' + CONVERT(varchar(4), OrderID), 4) = @TransID");     
        //console.log(result);
        res.status(200).json({message: "Status successfully Updated!", result});
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error', details: err });
    }
});

app.get('/NotifBadge', async (req, res) => {
    const user = req.session.user;

    if (!user || user.UserID === undefined) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const ID = parseInt(user.UserID);
    try {

        
        const request = pool.request()
        .input('UserID', sql.Int, ID);
        
        const query = `
            SELECT COUNT(NotificationID) AS NotificationID FROM tbl_notification
            INNER JOIN tbl_Order ON tbl_Order.OrderID = tbl_notification.OrderID 
            WHERE tbl_Notification.Status = 'unread' AND tbl_Order.UserID = @UserID
        `;
        const result = await request.query(query);

        const notif = result.recordset[0].NotificationID

        //console.log(notif);

        res.json({NotificationID : notif});
        
        
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error', details: err });
    }
});


app.put('/UpdateNotif', async (req, res) => {
    const { UpdatedNotif } = req.body;
    //console.log(UpdatedNotif);
    const user = req.session.user;

    if (!user || user.UserID === undefined) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const ID = parseInt(user.UserID);
    try {
        //console.log(UpdatedNotif);
        const request = pool.request()
        .input('UserID', sql.Int, ID)
        .input('Status',sql.VarChar,UpdatedNotif)
        await request.query("UPDATE tbl_notification SET tbl_notification.Status = @Status FROM tbl_notification INNER JOIN tbl_Order ON tbl_Order.OrderID = tbl_notification.OrderID WHERE tbl_notification.Status = 'unread' AND tbl_Order.UserID = @UserID");

        res.status(200).json();
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error', details: err });
    }
});

//Server itu guys
server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});