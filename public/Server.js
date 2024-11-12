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
const cloudinary = require('cloudinary').v2;
const nodemailer = require('nodemailer');
const app = express();
const server = http.createServer(app);
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { Result } = require('tedious/lib/token/helpers');
app.set('view engine', 'ejs');

const port = process.env.PORT || 3000;

const upload = multer({ dest: 'uploads/' });

//app.use('/images', express.static(path.join(__dirname, 'UploadedImage')));

app.use(express.static(path.join(__dirname, 'public')));

app.use(bodyParser.json());
app.use(cors());
app.use(bodyParser.raw({ type: 'application/octet-stream', limit: '100mb' }));
app.get('/3D', (req, res) => {
    res.sendFile(path.join(__dirname, 'TEST.html'));
});

app.use('/Build', express.static(path.join(__dirname, 'Build')));

app.use(express.static(path.join(__dirname)));

const wss = new WebSocket.Server({ server });

cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});



//const socket = new WebSocket('ws://localhost:8080');


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
    pool: {
        max: 10, // Maximum number of connections in the pool
        min: 0,  // Minimum number of connections in the pool
        idleTimeoutMillis: 30000 // Close idle connections after 30 seconds
    },
    options: {
        encrypt: process.env.DB_ENCRYPT === 'true', // For Azure SQL
        trustServerCertificate: false // Change to false if needed for production
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

        if (!pool.connected) {
            await pool.connect();
            
        }

        // Proceed with the database query
        const request = await pool.request();
                
        request.input('UserID', sql.Int, userID);
        const query = `
            SELECT COUNT(NotificationID) AS NotificationID 
            FROM tbl_notification
            INNER JOIN tbl_Order ON tbl_Order.OrderID = tbl_notification.OrderID 
            WHERE tbl_Notification.Status = 'unread' 
            AND tbl_Order.UserID = @UserID
        `;
        const result = await request.query(query);
        const notifCount = result.recordset[0].NotificationID;
       // console.log(notifCount);
        notifyClients(notifCount);
    } catch (err) {
        console.error('Database error:', err);
    }
};

const getMessages = async (userID, ws) => {
    const query = `
    BEGIN
        SELECT * FROM tbl_message 
        WHERE (SenderID = @sender_id AND ReceiverID = (SELECT UserID FROM tbl_User WHERE Type = 'Admin')) 
        OR (SenderID = (SELECT UserID FROM tbl_User WHERE Type = 'Admin') AND ReceiverID = @sender_id)
    END
    `;

    try {
        const result = await pool.request()
            .input('sender_id', sql.Int, userID)
            .query(query);

        const messages = result.recordset;
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ messages }));
        }
    } catch (err) {
        console.error('Database error:', err);
    }
};

const getNotifications = async (userID, ws) => {
    try {
        const request = pool.request()
            .input('UserID', sql.Int, userID);

        const query = `
            SELECT DISTINCT CONCAT('Your Order ' , tbl_Order.TransactionID , ' is ' , NewStatus) AS Content, tbl_Order.OrderID, 
            CONVERT(varchar, NotificationDate, 0) AS NotificationDate, tbl_Product.ProductImage, NotificationID, tbl_notification.Status 
            FROM tbl_notification 
            INNER JOIN tbl_Order ON tbl_Order.OrderID = tbl_notification.OrderID 
            INNER JOIN tbl_OrderItem ON tbl_OrderItem.OrderID = tbl_Order.OrderID
            INNER JOIN tbl_Product ON tbl_Product.ProductID = tbl_OrderItem.ProductID
            WHERE tbl_Order.UserID = @UserID 
            AND tbl_Product.ProductID = (
                SELECT MIN(tbl_Product.ProductID)
                FROM tbl_OrderItem 
                INNER JOIN tbl_Product ON tbl_Product.ProductID = tbl_OrderItem.ProductID
                WHERE tbl_OrderItem.OrderID = tbl_Order.OrderID
            ) 
            ORDER BY NotificationID DESC;
        `;

        const result = await request.query(query);

        const orderItems = result.recordset.map(item => {
            return {
                OrderID: item.OrderID,
                Content: item.Content,
                Date: item.NotificationDate,
                productImage: item.ProductImage,
                Status: item.Status,
                NotificationID: item.NotificationID
            };
        });

        // Send notifications to the client via WebSocket
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ notifications: orderItems }));
        }
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

function getColorName(rgba) {
    const { r, g, b, a } = rgba;

    const colorMapping = {
        '0,0,0,1': 'black',      
        '1,1,1,1': 'white',  
        '1,0,0,1': 'red',  
        '0,1,0,1': 'green',     
        '0,0,1,1': 'blue'

    };

    const rgbaKey = `${r},${g},${b},${a}`;
    return colorMapping[rgbaKey] || 'unknown';
}

app.post('/Request/Dress',upload.single('image'), async (req, res) => {
    console.log('Received data:', req.body);
    let fileUrl = null;
    try{
        console.log('Received data:', req.body);
        const jsonData = JSON.parse(req.body.data);
        //console.log("JSON Data:", jsonData.necklace);
        if (req.file && req.file.path) {
            const result = await cloudinary.uploader.upload(req.file.path, {
            folder: "img",
            use_filename: true,
            unique_filename: false,
            transformation: [{ format: "auto", quality: "auto" }],
        });
            fileUrl = result.secure_url;
            fs.unlinkSync(req.file.path);
            }
            res.status(200).json({
                message: "Dress data uploaded successfully",
                fileUrl: fileUrl,
                jsonData: jsonData
                });
    }
    catch (err) {
        console.error("Error:", err);
        res.status(500).json({
            message: "Error",
            error: err.message
        });
    }
});
app.post('/Request/Necklace', upload.single('image'), async (req, res) => {
    //const { data } = req.body;  // Assuming data comes from the request body

    const jsonData = JSON.parse(req.body.data);
   const user = req.session.user;
    
    // Check if userID is null and redirect to sign-in if necessary
    if (!user || !user.UserID) {
        return res.status(200).json({
            success: false,
            message: "Unauthorized. Please sign in.",
            redirectTo: "/SignIn.html"
        });
    }

    const userID = parseInt(user.UserID);
    let fileUrl = null;

    try {
        if (req.file && req.file.path) {
            const result = await cloudinary.uploader.upload(req.file.path, {
                folder: "img",
                use_filename: true,
                unique_filename: false,
                transformation: [{ format: "auto", quality: "auto" }],
            });

            fileUrl = result.secure_url;
            fs.unlinkSync(req.file.path);  // Clean up the file after uploading
        }

        const request = pool.request();

        const NecklaceRequest = await request.input('imageUrl', sql.VarChar, fileUrl)
            .input('lockType', sql.NVarChar, jsonData.necklace.locktype)
            .input('size', sql.Int, jsonData.necklace.length)
            .input('totalPrice', sql.Int, jsonData.necklace.totalprice)
            // .input('UserID', sql.Int, userID)
            .query(`
                INSERT INTO tbl_CustomNecklace (Image, LockType, Size, TotalPrice, Date, UserID,Status)
                VALUES (@imageUrl, @lockType, @size, @totalPrice, GETDATE(), 1,'Requested');
            `);

        // Insert data into tbl_NecklaceMaterials
        for (const material of jsonData.necklace.materials) {
            // Dynamically create unique parameter names for each iteration
            const materialNameParam = `MName_${material.name}`;
            const quantityParam = `quantity_${material.name}`;

            await request.input(materialNameParam, sql.VarChar, material.name)
                .input(quantityParam, sql.Int, material.quantity)
                .query(`
                    DECLARE @NewRNL INT;
                    SET @NewRNL = (SELECT TOP 1 ID FROM tbl_CustomNecklace ORDER BY ID DESC);

                    INSERT INTO tbl_NecklaceMaterials (MaterialID, NecklaceID, Quantity)
                    VALUES (
                        (SELECT MaterialID FROM tbl_Materials WHERE MaterialName LIKE @${materialNameParam}),
                        @NewRNL, @${quantityParam}
                    );
                `);
        }

        res.status(200).json({
            success: true,
            message: "Necklace data uploaded successfully",
            fileUrl: fileUrl,
            jsonData: jsonData
        });

    } catch (err) {
        console.error("Error inserting data into database:", err);
        res.status(500).json({
            message: "Error inserting data into database",
            error: err.message
        });
    }
});



app.post('/Request/Ring', upload.single('image'),async (req, res) => {
    //console.log('Received data:', req.body);
    let fileUrl = null;
    try{
        console.log('Received data:', req.body);
        const jsonData = JSON.parse(req.body.data);
        console.log("JSON Data:", jsonData);
        if (req.file && req.file.path) {
            const result = await cloudinary.uploader.upload(req.file.path, {
            folder: "img",
            use_filename: true,
            unique_filename: false,
            transformation: [{ format: "auto", quality: "auto" }],
        });
            fileUrl = result.secure_url;
            fs.unlinkSync(req.file.path);
            }
            res.status(200).json({
                message: "Ring data uploaded successfully",
                fileUrl: fileUrl,
                jsonData: jsonData
                });
    }
    catch (err) {
        console.error("Error:", err);
        res.status(500).json({
            message: "Error",
            error: err.message
        });
    }

   //const color = req.body.objectsUI[0].color;
   //console.log(color);
   //const ColorName = getColorName(color);
   //res.send({ message: 'Ring Data received!', receivedData: req.body });
    //     const { dressName, height, bust, hip, waist,price } = req.body.objectsUI[0];
    //     const request = pool.request();
    //     request.input('Name', sql.VarChar, dressName);
    //     request.input('Bust', sql.Decimal, bust);
    //     request.input('Price',sql.Int,price);
    //     //Wrequest.input('Color',sql.VarChar,ColorName);
    //     request.input('Waist',sql.Decimal,waist);
    //     request.input('hips',sql.Decimal,hip);
    //     request.input('Height',sql.Decimal,height);

    //     const query = `
    //         INSERT INTO tbl_CustomDress (Name,Bust,TotalPrice,Color,Waist,Hips,Height) VALUES (@Name,@Bust,@Price,@Color,@Waist,@hips,@Height)
    //     `;

    //     await request.query(query);
       //res.status(200).send('Necklace data uploaded successfully');
});

app.get('/Request', async (req, res) => {
    try {
        const pool = await sql.connect(config); // Assuming config is set for your DB

        // Execute all three queries
        const necklaceQuery = await pool.request().query('SELECT NecklaceID AS ProductID, convert(varchar, Date, 0) AS Date, TotalPrice, Name,tbl_CustomNecklace.Status FROM tbl_CustomNecklace INNER JOIN tbl_User ON tbl_CustomNecklace.UserID = tbl_User.UserID');
        const ringQuery = await pool.request().query('SELECT RingID AS ProductID, convert(varchar, Date, 0) AS Date, TotalPrice, Name,tbl_CustomRing.Status FROM tbl_CustomRing INNER JOIN tbl_User ON tbl_CustomRing.UserID = tbl_User.UserID');
        const dressQuery = await pool.request().query('SELECT DressID AS ProductID, convert(varchar, Date, 0) AS Date, TotalPrice, tbl_User.Name,tbl_CustomDress.Status FROM tbl_CustomDress INNER JOIN tbl_User ON tbl_CustomDress.UserID = tbl_User.UserID');

        // Combine all results into one array
        const combinedResults = [
            ...necklaceQuery.recordset.map(item => ({ ...item, ProductType: 'Necklace' })),
            ...ringQuery.recordset.map(item => ({ ...item, ProductType: 'Ring' })),
            ...dressQuery.recordset.map(item => ({ ...item, ProductType: 'Dress' }))
        ];

        // Send the combined results as a JSON response
        res.json(combinedResults);

    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

//DITO
app.get('/NeckLaceMaterials', async (req, res) => {
    const query = `SELECT MaterialName, Stock, Price FROM tbl_Materials`;
    
    try {
        const request = pool.request();
        const result = await request.query(query);

        const formattedResult = result.recordset.reduce((acc, { MaterialName, Stock, Price }) => {
            acc[MaterialName] = { Stock, Price };
            return acc;
        }, {});
        
        res.json(formattedResult);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});



app.post('/upload-screenshot/Unity',upload.single('image'), async(req, res) => {
    let fileUrl = null;
  
    try { 
      if (req.file && req.file.path) {
        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: "img",
          use_filename: true,
          unique_filename: false,
          transformation: [{ format: "auto", quality: "auto" }],
        });
  
        fileUrl = result.secure_url;

        fs.unlinkSync(req.file.path);
      }
  
      res.status(200).json({
        message: "Upload successful",
        fileUrl: fileUrl
      });
    } catch (error) {
      console.error("Error:", error);
      res.status(500).json({ error: "Upload failed", details: error.message });
    }
});


app.post("/upload/Unity", upload.single('image'), async (req, res) => {
    let fileUrl = null;
  
    try {
      const jsonData = JSON.parse(req.body.data);
      console.log("JSON Data:", jsonData);
  
      if (req.file && req.file.path) {
        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: "img",
          use_filename: true,
          unique_filename: false,
          transformation: [{ format: "auto", quality: "auto" }],
        });
  
        fileUrl = result.secure_url;

        fs.unlinkSync(req.file.path);
      }
  
      res.status(200).json({
        message: "Upload successful",
        fileUrl: fileUrl,
        jsonData: jsonData,
      });
    } catch (error) {
      console.error("Error:", error);
      res.status(500).json({ error: "Upload failed", details: error.message });
    }
  });


app.get('/getUserID', (req, res) => {
    try{
        if (req.session && req.session.user) {
            const user = req.session.user;
            const userID = parseInt(user.UserID);
            console.log(req.session.user);
            res.json({ userID: req.session.user.UserID });
        }
    }
     catch(err) {
        res.status(401).json({ message: 'User not authenticated' });
    }
});

wss.on('connection', async (ws, req) => {
    console.log('Client connected');
    clients.push(ws);

    try {
        const response = await axios.get('http://localhost:3000/getUserID', {
            headers: {
                Cookie: req.headers.cookie
            }
        });

        const userID = response.data.userID;
        console.log(`UserID: ${userID}`);

        const notifInterval = setInterval(() => checkNotifications(userID), 1000);

        const messageInterval = setInterval(() => getMessages(userID, ws), 1000);

        const notificationInterval = setInterval(() => getNotifications(userID, ws), 1000);

        getMessages(userID, ws);
        getNotifications(userID, ws);
        checkNotifications(userID, ws);

        ws.on('message', (message) => {
            const data = JSON.parse(message);

            if (data.type === 'getMessages') {
                getMessages(userID, ws);
            }

            if (data.type === 'getNotifications') {
                getNotifications(userID, ws);
            }
        });

        ws.on('close', () => {
            console.log('Client disconnected');
            clients = clients.filter(client => client !== ws);
            
            clearInterval(notifInterval); 
            clearInterval(messageInterval); 
            clearInterval(notificationInterval);
        });

    } catch (error) {
        console.log('Error fetching userID:', error);
        ws.close(); 
    }
});

app.put('/updateProfileImage', upload.single('image'), async (req, res) => {
    const user = req.session.user;
    const ID = parseInt(user.UserID);
    let result = { secure_url: null }; 

    try {
        if (req.file && req.file.path) {
            result = await cloudinary.uploader.upload(req.file.path, {
                folder: 'img',
                use_filename: true,
                unique_filename: false,
                transformation: [{ format: 'auto', quality: 'auto' }]
            });

            fs.unlinkSync(req.file.path);
        }

        const request = pool.request();
        request.input('UserId', sql.Int, ID);
        request.input('Image', sql.VarChar, result.secure_url);

        const query = `
            UPDATE tbl_User
            SET ProfilePic = @Image
            WHERE UserID = @UserId
        `;

        await request.query(query);
        res.status(200).send('Profile image updated successfully');
    } catch (err) {
        console.error('Database Error:', err);
        res.status(500).json({ error: 'Database error', details: err });
    }
});

//Update
app.put('/updateProduct/:product', upload.single('image'), async (req, res) => {
    const { product } = req.params;
    const { newProductName, productPrice, productDes, productDiscount, Stock, Cat } = req.body;
    
    let result = { secure_url: null };

    try {
        if (req.file && req.file.path) {
            result = await cloudinary.uploader.upload(req.file.path, {
                folder: 'img',
                use_filename: true,
                unique_filename: false,
                transformation: [{ format: 'auto', quality: 'auto' }]
            });

            fs.unlinkSync(req.file.path);
        }

        const request = pool.request();
        request.input('Image', sql.VarChar, result.secure_url);
        request.input('ProductName', sql.VarChar, product);
        request.input('NewName', sql.VarChar, newProductName);
        request.input('UpdatedPrice', sql.Int, productPrice);
        request.input('ProductDes', sql.VarChar, productDes);
        request.input('ProductDiscount', sql.Int, productDiscount);
        request.input('Stock', sql.Int, Stock);
        request.input('Cat', sql.Int, Cat);

        const query = `
            UPDATE tbl_Product
            SET ProductName = @NewName, Price = @UpdatedPrice,
            ProductImage = COALESCE(@Image,ProductImage),
            Stock = @Stock,CategoryID = @Cat,Description = @ProductDes,
            Discount = @ProductDiscount
            WHERE ProductName = @ProductName
        `;

        await request.query(query);
        res.status(200).send('Product Updated');
    } catch (err) {
        console.error('Database Error:', err);
        res.status(500).json({ error: 'Database error', details: err });
    }
});

app.put('/updateMaterial/:Material', async (req, res) => {
    const { Material } = req.params;
    const { MaterialName, MaterialDes, Price, Stock } = req.body;
    try {
        const request = pool.request();
        //request.input('Image', sql.VarChar, result.secure_url);
        request.input('MaterialID', sql.VarChar, Material);
        request.input('NewName', sql.VarChar, MaterialName);
        request.input('UpdatedPrice', sql.Int, Price);
        request.input('ProductDes', sql.VarChar, MaterialDes);
        //request.input('ProductDiscount', sql.Int, productDiscount);
        request.input('Stock', sql.Int, Stock);
        //request.input('Cat', sql.Int, Cat);

        const query = `
            UPDATE tbl_Materials
            SET MaterialName = @NewName, Price = @UpdatedPrice,
            Stock = @Stock,Description = @ProductDes
            WHERE MaterialID = @MaterialID
        `;

        await request.query(query);
        res.status(200).send('Product Updated');
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
    console.log(user);
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

app.post('/AddToCartIcon', async (req, res) => {
    const { ProductName, Quantity } = req.body;
    const quan = parseInt(Quantity);
    const user = req.session.user;
    console.log(user);
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
app.put('/DeleteProduct/:productName', async (req, res) => {
    const productName = req.params.productName;
    try{
        const request = pool.request();

        request.input('@PN',sql.VarChar,productName);

        const query = `
        UPDATE tbl_Product SET isArchive = 'Yes' WHERE ProductName LIKE '${productName}'
        `;
        console.log(query);
        const result = await request.query(query);
        res.status(200).send('Product Deleted');
    }
    catch(err){
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error', details: err });
    }
});

app.put('/ReadMessage', async (req, res) => {
    const user = req.session.user;

    if (!user || user.UserID === undefined) {
        return res.status(401).json({ error: 'User not authenticated' });
    }
    const ID = parseInt(user.UserID);


    try{
        const request = pool.request();

        request.input('sender_id',sql.Int,ID);

        const query = `
                UPDATE tbl_message
                SET Status = 'Read'
                WHERE SenderID  = (SELECT UserID FROM tbl_User WHERE Type = 'Admin') AND ReceiverID = @sender_id
                AND Status = 'Unread'
        `;
        console.log(query);
        const result = await request.query(query);
        res.status(200).send('Message Read');
    }
    catch(err){
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error', details: err });
    }
});

app.delete('/CartDel', async (req,res) => {
    const {id} = req.body;
    try{
        const request = pool.request();

        request.input('ID',sql.Int,id);

        const query = `
        DELETE FROM tbl_Cart WHERE CartID = @ID
        `;
        console.log(query);
        const result = await request.query(query);
        res.status(200).send('Product Deleted');
    }
    catch(err){
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error', details: err });
    }
});

app.put('/ChangePass', async (req, res) => {
    const user = req.session.user;
    const ID = parseInt(user.UserID);
    const { oldPassword, newPassword } = req.body;

    try {
        const result = await pool.request()
            .input('ID', sql.Int, ID)
            .query('SELECT Password FROM tbl_User WHERE UserID = @ID');

        const userRecord = result.recordset[0];

        if (userRecord) {
            const match = await bcrypt.compare(oldPassword, userRecord.Password);
            
            if (match) {
                const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);
                
                await pool.request()
                    .input('ID', sql.Int, ID)
                    .input('NewPass', sql.VarChar, hashedNewPassword)
                    .query('UPDATE tbl_User SET Password = @NewPass WHERE UserID = @ID');

                res.status(200).send({ message: 'Password Changed' });
            } else {
                res.status(400).json({ message: 'Old password is incorrect.' });
            }
        } else {
            res.status(404).json({ message: 'User not found.' });
        }
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error', details: err });
    }
});



app.put('/DeleteAcc', async (req, res) => {
    const user = req.session.user;
    const ID = parseInt(user.UserID);
    try{
        const request = await pool.request();
        request.input('ID',sql.Int,ID);
        const query = `
        UPDATE tbl_User SET Status = 'InActive' WHERE UserID = @ID
        `;
        console.log(query);
        const result = await request.query(query);
        res.status(200).send('Product Deleted');
    }
    catch(err){
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error', details: err });
    }
});

//SignUp
const saltRounds = 10;

app.post('/SignUp', async (req, res) => {
    const { name, num, Password, Email } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(Password, saltRounds);

        const request = pool.request()
            .input('name', sql.NVarChar, name)
            .input('number', sql.NVarChar, num)
            .input('Password', sql.NVarChar, hashedPassword)
            .input('Email', sql.VarChar, Email);
            
        const query = `
        INSERT INTO tbl_User (UserName, MobileNum, Email, Password, Type, Status)
        VALUES (@name, @number, @Email, @Password, 'Customer', 'Active');`;
        
        await request.query(query);

        res.status(200).json({ message: 'Sign Up Successful' });
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
            .query(`SELECT * FROM tbl_User WHERE UserName = @username AND Status = 'Active'`);

        const user = request.recordset[0];

        if (user) {
            // Compare the entered password with the stored hashed password
            const match = await bcrypt.compare(password, user.Password);
            if (match) {
                req.session.user = user; // Store user session data
                if (user.Type === "Admin") {
                    res.status(250).send('Admin'); // Send response for admin
                } else {
                    res.status(200).send('Login successful'); // Send response for regular user
                }
            } else {
                res.status(401).send('Invalid username or password'); // Incorrect password
            }
        } else {
            res.status(401).send('Invalid username or password'); // Username not found
        }
    } catch (error) {
        console.error(error);
        res.status(500).send('Error logging in'); // General error
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



app.get('/SearchBar/:inputValue', async (req, res) => {
    const Input = req.params.inputValue;

    const productQuery = `
        SELECT TOP 4 ProductName 
        FROM tbl_Product 
        INNER JOIN tbl_Category ON tbl_Category.CategoryID = tbl_Product.CategoryID
        WHERE (ProductName LIKE '%' + @Input + '%' 
        OR tbl_Category.CategoryName LIKE '%' + @Input + '%') AND tbl_Product.isArchive = 'No'
    `;

    const categoryQuery = `
        SELECT TOP 1 CategoryName 
        FROM tbl_Category 
        WHERE CategoryName LIKE '%' + @Input + '%'
    `;

    try {
        const request = pool.request();
        request.input('Input', sql.VarChar, Input);

        // Execute the product query
        const productResult = await request.query(productQuery);
        const products = productResult.recordset.map(product => {
            return {
                productName: product.ProductName
            };
        });

        // Execute the category query
        const categoryResult = await request.query(categoryQuery);
        const categories = categoryResult.recordset.map(category => {
            return {
                categoryName: category.CategoryName
            };
        });

        // Combine results into a single response
        res.json({ products, categories });
    } catch (error) {
        console.error('Error executing query:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});



app.post('/upload', upload.single('image'), async (req, res) => {
    try {
        console.log(req.file.path);
        if (!req.file) {
            return res.status(400).send('No file uploaded');
        }

        const result = await cloudinary.uploader.upload(req.file.path, {
            folder: 'img',
            use_filename: true,
            unique_filename: false,
            transformation: [{ format: 'auto', quality: 'auto' }] 
        });

        fs.unlinkSync(req.file.path);

        const request = await pool.request()
            .input('ImagePath', sql.VarChar, result.secure_url)
            .input('Pname', sql.VarChar, req.body.productName)
            .input('Price', sql.Int, req.body.productPrice)
            .input('Des', sql.VarChar, req.body.productDes)
            .input('Stock', sql.Int, req.body.Stock)
            .input('Cat', sql.Int, req.body.Cat)
            .query("INSERT INTO tbl_Product (ProductName,Price,Description,Stock,CategoryID,ProductImage, isArchive) VALUES (@Pname,@Price,@Des,@Stock,@Cat,@ImagePath,'No');");
        res.sendStatus(200);
    } catch (error) {
        console.error('Error uploading image:', error);
        res.status(500).send('Error uploading image');
    }
});

//LOcal storage

//   app.post('/upload', upload.single('image'), async (req, res) => {
//     try {
//         if (!req.file) {
//             return res.status(400).send('No file uploaded');
//         }
//         const uploadFolder = path.join(__dirname, 'UploadedImage');

//         if (!fs.existsSync(uploadFolder)) {
//             fs.mkdirSync(uploadFolder, { recursive: true });
//         }

//         const imagePath = path.join(uploadFolder, req.file.originalname);

//         fs.renameSync(req.file.path, imagePath);    
//         const request = await pool.request()
//             .input('ImagePath', sql.VarChar, imagePath)
//             .input('Pname', sql.VarChar, req.body.productName)
//             .input('Price', sql.Int, req.body.productPrice)
//             .input('Des', sql.VarChar, req.body.productDes)
//             .input('Stock', sql.Int, req.body.Stock)
//             .input('Cat', sql.Int, req.body.Cat)
//             .query("INSERT INTO tbl_Product (ProductName,Price,Description,Stock,CategoryID,ProductImage) VALUES (@Pname,@Price,@Des,@Stock,@Cat,@ImagePath);");

//         res.sendStatus(200);
//     } catch (error) {
//         console.error('Error uploading image:', error);
//         res.status(500).send('Error uploading image');
//     }
// });


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
            AND ReceiverID = (SELECT UserID FROM tbl_User WHERE UserName = 'Zappnott' AND Type = 'Admin') 
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
                    AND (SenderID = (SELECT UserID FROM tbl_User WHERE UserName = 'Zappnott' AND Type = 'Admin') 
                        OR ReceiverID = (SELECT UserID FROM tbl_User WHERE UserName = 'Zappnott' AND Type = 'Admin'))
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

app.get('/get-materials', async (req, res) => {
    const query = "SELECT MaterialName FROM tbl_Materials WHERE Stock = 2";
    const db = await pool.request();
    // Run the SQL query
    db.query(query, (err, result) => {
        if (err) {
            console.error('Error running query:', err);
            res.status(500).send({ error: 'Failed to retrieve materials' });
        } else {
            // Send the materials back as a JSON response
            const materials = result.recordset;
            res.json({ materials });
        }
    });
});

app.get('/ChatNotif', async (req, res) => {

    const query = `
        SELECT COUNT(*) AS Notif FROM tbl_message WHERE ReceiverID = @Admin AND Status = 'Unread'
    `;
    try {
        const user = req.session.user;
        const ID = parseInt(user.UserID);
        const result = await pool.request()
            .input('Admin',sql.Int,ID)
            .query(query);
        const notif = result.recordset[0].Notif;
        res.json({ Notif: notif });
    } catch (err) {
        //console.error('Database error:', err);
        res.status(500).json({ error: 'Database error', details: err });
    }
});

app.get('/ChatNotifCustomer', async (req, res) => {

    const query = `
        SELECT COUNT(Status) AS Unread FROM tbl_message
        WHERE ReceiverID = @User AND Status = 'Unread'
    `;
    try {
        const user = req.session.user;
        const ID = parseInt(user.UserID);
        const result = await pool.request()
            .input('User',sql.Int,ID)
            .query(query);
        const notif = result.recordset[0].Unread;
        //console.log(notif);
        res.json({ Notif: notif });
    } catch (err) {
        //console.error('Database error:', err);
        res.status(500).json({ error: 'Database error', details: err });
    }
});

app.get('/api/messages', async (req, res) => {
    const user = req.session.user;

    if(!user || user.UserID === undefined){
        return res.redirect('SignIn.html');
    }

    const ID = parseInt(user.UserID);
    const query = `
        BEGIN
            SELECT * 
            FROM tbl_message  
            WHERE (SenderID = @sender_id AND ReceiverID = (SELECT UserID FROM tbl_User WHERE Type = 'Admin')) 
            OR (SenderID = (SELECT UserID FROM tbl_User WHERE Type = 'Admin') AND ReceiverID = @sender_id);

            UPDATE tbl_message
            SET Status = 'Read'
            WHERE SenderID = (SELECT UserID FROM tbl_User WHERE Type = 'Admin') 
            AND ReceiverID = @sender_id
            AND Status = 'Unread';
        END

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
app.get('/AdminProducts', async (req, res) => {
    try {
        const result = await pool.request()
            .query("SELECT COUNT(Rate) AS Count,CAST(AVG(CAST(Rate AS FLOAT)) AS DECIMAL(10, 2)) AS AvgRating,ProductName,FORMAT(CAST(Price AS DECIMAL(10, 2)), 'N2')  as Price, Description, Stock, CategoryID, ProductImage FROM tbl_Product LEFT JOIN tbl_FeedBack ON tbl_Product.ProductID = tbl_Feedback.ProductID WHERE tbl_Product.isArchive = 'No' GROUP BY ProductName, Price, Description, Stock, CategoryID, ProductImage");

        if (result.recordset.length === 0) {
            return res.status(404).send('Product not found');
        }
        const products = result.recordset.map(product => {
            return {
                Count: product.Count,
                Avg: product.AvgRating,
                productName: product.ProductName,
                productPrice: product.Price,
                description: product.Description,
                stock: product.Stock,
                categoryId: product.CategoryID,
                imagePath: product.ProductImage,
                isArchive: product.isArchive
            };
            
        });

        res.json(products);
    } catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).send('Error fetching product');
    }
});

app.get('/products', async (req, res) => {
    const order = req.query.order || 'default';
    let orderByClause = '';
    if (order === 'LH') {
        orderByClause = 'ORDER BY tbl_Product.Price ASC'; // Low to High
    } else if (order === 'HL') {
        orderByClause = 'ORDER BY tbl_Product.Price DESC'; // High to Low
    }
    try {
        const result = await pool.request()
            .query(`SELECT CAST(AVG(CAST(Rate AS FLOAT)) AS DECIMAL(10, 2)) AS AvgRating,ProductName,FORMAT(CAST(Price AS DECIMAL(10, 2)), 'N2')  as PriceDecimal, Description, Stock, CategoryID, ProductImage FROM tbl_Product LEFT JOIN tbl_FeedBack ON tbl_Product.ProductID = tbl_Feedback.ProductID WHERE tbl_Product.Stock > 0 AND isArchive = 'No' GROUP BY ProductName, Price, Description, Stock, CategoryID, ProductImage ${orderByClause}`);

        if (result.recordset.length === 0) {
            return res.status(404).send('Product not found');
        }
        const products = result.recordset.map(product => {
            return {
                Count: product.Count,
                Avg: product.AvgRating,
                productName: product.ProductName,
                productPrice: product.PriceDecimal,
                description: product.Description,
                stock: product.Stock,
                categoryId: product.CategoryID,
                imagePath: product.ProductImage
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
            return {
                productName: product.ProductName,
                productPrice: product.Price,
                description: product.Description,
                stock: product.Stock,
                categoryId: product.CategoryID,
                imagePath: product.ProductImage
            };
        });
        res.json(products);
    }catch(err){
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error', details: err });
    }
});

app.get('/Edit/:product', async (req, res) => {
    const product = req.params.product;
    try{
        const request = pool.request();
        request.input('productName', sql.VarChar, product);
        const query = `SELECT ProductName,Price, Description,Stock, CategoryID, ProductImage, Discount FROM tbl_Product WHERE ProductName = @productName`;
        const result = await request.query(query);
        const products = result.recordset.map(product => {
            return {
                productName: product.ProductName,
                productPrice: product.Price,
                description: product.Description,
                stock: product.Stock,
                categoryID: product.CategoryID,
                imagePath: product.ProductImage,
                discount: product.Discount
            };
        });

        res.json(products);
    }catch(err){
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error', details: err });
    }
});

app.get('/Edit-Material/:Material', async (req, res) => {
    const ID = req.params.Material;
    try{
        const request = pool.request();
        request.input('ID', sql.Int, ID);
        const query = `SELECT MaterialName,Price, Description,Stock FROM tbl_Materials WHERE MaterialID = @ID`;
        const result = await request.query(query);
        const products = result.recordset.map(product => {
            return {
                Name: product.MaterialName,
                Price: product.Price,
                Description: product.Description,
                Stock: product.Stock
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
            .query("SELECT ProductName, FORMAT(CAST(Price AS DECIMAL(10, 2)), 'N2')  as Price, Description, Stock, CategoryID, ProductImage FROM tbl_Product WHERE CategoryID = 3 AND Stock > 0 AND isArchive = 'No'");

        if (result.recordset.length === 0) {
            return res.status(404).send('Product not found');
        }

        const products = result.recordset.map(product => {
            return {
                productName: product.ProductName,
                productPrice: product.Price,
                description: product.Description,
                stock: product.Stock,
                categoryId: product.CategoryID,
                imagePath: product.ProductImage 
            };
        });

        res.json(products);
    } catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).send('Error fetching product');
    }
});

app.get('/SearchProd/:inputValue', async (req, res) => {
    const Input = req.params.inputValue;
    try{
        const request = pool.request();
        request.input('Input', sql.VarChar, Input);
        const query = `SELECT ProductName,FORMAT(CAST(Price AS DECIMAL(10, 2)), 'N2')  as Price, Description, Stock, tbl_Product.CategoryID, ProductImage FROM tbl_Product
        INNER JOIN tbl_Category ON tbl_Category.CategoryID = tbl_Product.CategoryID
        WHERE  (tbl_Product.ProductName LIKE '%' + @Input + '%' 
        OR tbl_Category.CategoryName LIKE '%' + @Input + '%') AND tbl_Product.isArchive = 'No' `;
        const result = await request.query(query);
        const products = result.recordset.map(product => {
            return {
                productName: product.ProductName,
                productPrice: product.Price,
                description: product.Description,
                stock: product.Stock,
                categoryId: product.CategoryID,
                imagePath: product.ProductImage
            };
        });

        res.json(products);
    }catch(err){
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error', details: err });
    }
});

app.get('/productsBag', async (req, res) => {
    try {
        const result = await pool.request()
            .query("SELECT ProductName,FORMAT(CAST(Price AS DECIMAL(10, 2)), 'N2')  as Price, Description, Stock, CategoryID, ProductImage FROM tbl_Product WHERE CategoryID = 1 AND Stock > 0 AND isArchive = 'No'");

        if (result.recordset.length === 0) {
            return res.status(404).send('Product not found');
        }
        const products = result.recordset.map(product => {
            return {
                productName: product.ProductName,
                productPrice: product.Price,
                description: product.Description,
                stock: product.Stock,
                categoryId: product.CategoryID,
                imagePath: product.ProductImage 
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
            .query("SELECT ProductName,FORMAT(CAST(Price AS DECIMAL(10, 2)), 'N2')  as Price, Description, Stock, CategoryID, ProductImage FROM tbl_Product WHERE CategoryID = 2 AND Stock > 0 AND isArchive = 'No'");

        if (result.recordset.length === 0) {
            return res.status(404).send('Product not found');
        }
        const products = result.recordset.map(product => {
            return {
                productName: product.ProductName,
                productPrice: product.Price,
                description: product.Description,
                stock: product.Stock,
                categoryId: product.CategoryID,
                imagePath: product.ProductImage 
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
    const Status = req.query.Status;
    try {
        const request = pool.request();
        request.input('UserID', sql.Int, ID);

        let query = `SELECT OrderID, TransactionID, convert(varchar, Date, 0) AS Date, Status FROM tbl_Order WHERE UserID = @UserID`;

        if (Status) {
            query += ` AND Status = '${Status}'`;
        }

       query += ` ORDER BY OrderID DESC`;

        console.log(query);
        const result = await request.query(query);
        const products = result.recordset;

        res.json(products);
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error', details: err });
    }
});


app.post('/rate', async (req, res) => {
    const { rating, comment, productID} = req.body;
    const userId = req.session.user.UserID;
    console.log(rating);
    try{
        const request = pool.request();
        request.input('UserID',sql.Int,userId);
        request.input('Rating',sql.Int,rating);
        request.input('Comment', sql.VarChar, comment);
        request.input('ProdID',sql.Int,productID);
        request.query('INSERT INTO tbl_Feedback (Rate,Comment,ProductID,UserID) VALUES (@Rating,@Comment,@ProdID,@UserID)');

        res.redirect('Orders.html');
    }
    catch{
        res.status(500).send({ message: "Error submitting feedback" });
    }
});

app.get('/Feedback/:product', async (req, res) => {
    const product = req.params.product;

    try {
        const feedbackResult = await pool.request()
            .input('Product', sql.VarChar, product)
            .query(`SELECT Rate, Comment, UserName,ProfilePic FROM tbl_Feedback 
                     INNER JOIN tbl_User ON tbl_User.UserID = tbl_Feedback.UserID 
                     WHERE ProductID = (SELECT ProductID FROM tbl_Product WHERE ProductName = @Product)`);

        const avgRatingResult = await pool.request()
            .input('Product', sql.VarChar, product)
            .query(`SELECT CAST(AVG(CAST(Rate AS FLOAT)) AS DECIMAL(10, 2)) AS AvgRating FROM tbl_Feedback 
                     WHERE ProductID = (SELECT ProductID FROM tbl_Product WHERE ProductName = @Product)`);

        const NumRev = await pool.request()
        .input('Product', sql.VarChar, product)
        .query(`SELECT COUNT(Rate) AS Reviews FROM tbl_Feedback 
                     WHERE ProductID = (SELECT ProductID FROM tbl_Product WHERE ProductName = @Product)`);             
        const products = feedbackResult.recordset.map(feedback => {
            return {
                Profile: feedback.ProfilePic,
                Rate: feedback.Rate,
                Comment: feedback.Comment,
                Username: feedback.UserName
            };
        });

        const avgRating = avgRatingResult.recordset.length > 0 ? avgRatingResult.recordset[0].AvgRating : null;

        console.log(NumRev);
        res.json({ feedback: products, averageRating: avgRating, NumRev: NumRev.recordset[0] });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error', details: err });
    }
});


app.get('/FeedbackAvg/:product', async (req, res) => {
    const product = req.params.product;

    try {
        const result = await pool.request()
            .input('Product', sql.VarChar, product)
            .query(`SELECT CAST(AVG(CAST(Rate AS FLOAT)) AS DECIMAL(10, 2))as Avg FROM tbl_Feedback
                     WHERE ProductID = (SELECT ProductID FROM tbl_Product WHERE ProductName = @Product)`); // Use parameterized query

        const products = result.recordset.map(feedback => {
            return {
                Avg: feedback.Avg
            };
        });

        res.json(products);
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error', details: err });
    }
});

app.get('/Counts', async (req, res) => {
    try {
      const result = await pool.request().query(`
        SELECT 
          COUNT(Status) AS [All],
          SUM(CASE WHEN Status = 'Confirmed' THEN 1 ELSE 0 END) AS Confirmed,
          SUM(CASE WHEN Status = 'Order Packed' THEN 1 ELSE 0 END) AS OrderPacked,
          SUM(CASE WHEN Status = 'Ready to Pick Up' THEN 1 ELSE 0 END) AS ReadyToPickUp
        FROM tbl_Order
      `);
  
      res.json(result.recordset[0]);
    } catch (error) {
      console.error('Error fetching order statistics:', error);
      res.status(500).send('Internal Server Error');
    }
  });

  app.get('/SoldOut', async (req, res) => {
    try {

  
      const result = await pool.request()
      .query(`
        SELECT ProductName FROM tbl_Product WHERE Stock = 0;
        SELECT MaterialName FROM tbl_Materials WHERE Stock = 0;
      `);
  
      const productsOutOfStock = result.recordsets[0]; 
      const materialsOutOfStock = result.recordsets[1]; 
  
      res.json({ productsOutOfStock, materialsOutOfStock });
    } catch (error) {
      console.error('Error fetching out-of-stock items:', error);
      res.status(500).send('Internal Server Error');
    }
  });

  app.get('/BestSeller', async (req, res) => {
    try {
      const result = await pool.request()
      .query(`
            SELECT TOP 5 ProductName, tbl_OrderItem.ProductID, SUM(Quantity) AS TOTAL FROM tbl_OrderItem
            INNER JOIN tbl_Product ON tbl_Product.ProductID = tbl_OrderItem.ProductID
            GROUP BY tbl_OrderItem.ProductID, tbl_Product.ProductName
            ORDER BY TOTAL DESC
      `);
  
      const BestSeller = result.recordsets[0]; 
  
      res.json({ BestSeller });
    } catch (error) {
      console.error('Error fetching out-of-stock items:', error);
      res.status(500).send('Internal Server Error');
    }
  });

//   app.post('/forgot-password',async (req,res) =>{
//         const {Email} = req.body;
//         console.log(Email);
//         try{
//             const result = await pool.request()
//             .input('Email',sql.VarChar,Email)
//             .query('SELECT UserID FROM tbl_User WHERE Email = @Email');

//             if (result.recordset.length === 0) {
//                 return res.status(404).json({ message: 'Phone number not found' });
//             }
    
//             const userId = result.recordset[0].UserID;
//             const otp = Math.floor(100000 + Math.random() * 900000).toString();

            

//             console.log(userId, ' ',otp);
//             //res.status(200).json({ message: 'OTP sent successfully' });
//         }
//         catch(error){
//             console.error('Error:', error);
//             res.status(500).send('Internal Server Error');
//         }
//   });
  app.post('/forgot-password', async (req, res) => {
    const { Email } = req.body;
    console.log(Email);
    try {
        const result = await pool.request()
            .input('Email', sql.VarChar, Email)
            .query('SELECT UserID FROM tbl_User WHERE Email = @Email');
        if (result.recordset.length === 0) {
            return res.status(404).json({ message: 'Email not found' });
        }
        const userId = result.recordset[0].UserID;
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expirationTime = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now
        // Store OTP and its expiration time in the database
        await pool.request()
            .input('UserID', sql.Int, userId)
            .input('OTP', sql.VarChar, otp)
            .input('otpExpiration', sql.DateTime, expirationTime)
            .query('UPDATE tbl_User SET OTP = @OTP, OtpExpiration = @otpExpiration WHERE UserID = @UserID');
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS
                }
            });

            const mailOptions = {
                from: 'likhaproto@gmail.com', // Your email
                to: Email, // Recipient's email from the request
                subject: 'Your OTP Code',
                text: `Your OTP code is: ${otp}`,
                html: `<h2>Your OTP code is: ${otp}</h2>`
            };

            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.error('Error sending email:', error);
                    return res.status(500).json({ message: 'Failed to send OTP' });
                }
                //console.log('Email sent:', info.response);
                // Optionally, store the OTP in your database for verification
                res.status(200).json({ message: 'OTP sent successfully' });
            });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
    }
});
// app.post('/reset-otp', async (req, res) => {
//     const { Email } = req.body;

//     try {
//         // Reset the OTP and expiration time in the database
//         await pool.request()
//             .input('Email', sql.VarChar, Email)
//             .query('UPDATE tbl_User SET OTP = NULL, otpExpiration = NULL WHERE Email = @Email');

//         const otp = Math.floor(100000 + Math.random() * 900000).toString();
//         const expirationTime = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

//         await pool.request()
//             .input('Email', sql.VarChar, Email)
//             .input('OTP', sql.VarChar, otp)
//             .input('otpExpiration', sql.DateTime, expirationTime)
//             .query('UPDATE tbl_User SET OTP = @OTP, otpExpiration = @otpExpiration WHERE Email = @Email');

//         return res.status(200).json({ message: 'OTP reset successfully and new OTP generated.' });
//     } catch (error) {
//         console.error('Error:', error);
//         res.status(500).send('Internal Server Error');
//     }
// });
  app.post('/verify-otp', async (req, res) => {
    const { Email, otp } = req.body;
    console.log(Email,otp);
    try {
        // Retrieve the OTP and expiration time associated with the user's email
        const result = await pool.request()
            .input('Email', sql.VarChar, Email)
            .query('SELECT OTP, OtpExpiration,UserID FROM tbl_User WHERE Email = @Email');
        if (result.recordset.length === 0) {
            return res.status(404).json({ message: 'Email not found' });
        }
        const storedOtp = result.recordset[0].OTP;
        const userId = result.recordset[0].UserID;
        const expirationTime = result.recordset[0].OtpExpiration;
        const currentTime = new Date();
        console.log('Compare:',storedOtp, otp,userId)
        // Check if OTP is expired
        if (currentTime > expirationTime) {
            return res.status(400).json({ message: 'OTP has expired' });
        }
        // Compare stored OTP with user input
        if (parseInt(storedOtp) == parseInt(otp)) {
            // OTP is correct, clear the OTP and proceed
            await pool.request()
                .input('Email', sql.VarChar, Email)
                .query('UPDATE tbl_User SET OTP = NULL, otpExpiration = NULL WHERE Email = @Email');

            return res.status(200).json({ message: 'OTP verified successfully' , userId});
        } else {
            // OTP does not match
            return res.status(400).json({ message: 'Invalid OTP' });
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
    }
});


app.put('/NewPassword', async (req, res) => {
    const { NewPass, UserID } = req.body; // Use NewPass to match the frontend

    try {
        await pool.request()
            .input('NewPass', sql.VarChar, NewPass) // Ensure the parameter is NewPass
            .input('UserID', sql.Int, UserID)
            .query('UPDATE tbl_User SET Password = @NewPass WHERE UserID = @UserID');

        res.status(200).json({ message: 'Password updated successfully' });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
    }
});


  app.get('/RecentOrder', async (req, res) => {
    try {
      const result = await pool.request()
      .query(`
            SELECT TransactionID, ProductName, CategoryName, Quantity, tbl_OrderItem.Price, [Status] FROM tbl_Order
            INNER JOIN tbl_OrderItem ON tbl_OrderItem.OrderID = tbl_Order.OrderID
            INNER JOIN tbl_Product ON tbl_Product.ProductID = tbl_OrderItem.ProductID
            INNER JOIN tbl_Category ON tbl_Category.CategoryID = tbl_Product.CategoryID
            WHERE CONVERT(VARCHAR,Date,1) = CONVERT(VARCHAR,GETDATE(),1)
      `);
  
      const RecentOrder = result.recordsets[0]; 
  
      res.json({ RecentOrder });
    } catch (error) {
      console.error('Error fetching out-of-stock items:', error);
      res.status(500).send('Internal Server Error');
    }
  });

//OrderList AdminView
app.get('/Orders', async (req, res) => {
        
    try {
        const request = pool.request();
        const query = `SELECT TransactionID,tbl_Order.Status, convert(varchar, Date, 0) AS Date,convert(varchar, PickUp, 0) AS PickUp, Name, TotalPrice
                       FROM tbl_Order INNER JOIN tbl_User ON tbl_Order.UserID = tbl_User.UserID ORDER BY OrderID DESC;`;
        const result = await request.query(query);
        const products = result.recordset.map(product => {
            return {
                OrderedDate: product.Date,
                productOrder: product.TransactionID,
                ProductName: product.Name,
                ProductTotal: product.TotalPrice,
                Status: product.Status,
                PickUp: product.PickUp
            };
        });
        res.json(products);
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error', details: err });
    }
});

app.get('/Materials', async (req, res) => {
        
    try {
        const request = pool.request();
        const query = `SELECT * FROM tbl_Materials`;
        const result = await request.query(query);
        const products = result.recordset.map(product => {
            return {
                Name: product.MaterialName,
                Price: product.Price,
                Stock: product.Stock,
                MaterialID: product.MaterialID
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
        const query = `SELECT PaymentLink,TransactionID,Email,MobileNum, convert(varchar, Date, 0) AS Date, tbl_Order.Status, TotalPrice, Name
                       FROM tbl_Order
                       INNER JOIN tbl_User ON tbl_Order.UserID = tbl_User.UserID
                       WHERE 'OZPNT' + RIGHT('0000' + CONVERT(varchar(4), tbl_Order.OrderID), 4) = @Transac;`;
        const result = await request.query(query);
        const products = result.recordset.map(product => {

            return {
                PaymentLink: product.PaymentLink,
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
            SELECT OI.ProductID, P.ProductImage, P.ProductName, OI.Quantity, FORMAT(CAST(OI.Price AS DECIMAL(10, 2)), 'N2')  as Price
            FROM tbl_OrderItem OI
            INNER JOIN tbl_Product P ON OI.ProductID = P.ProductID
            WHERE OI.OrderID = @OrderID
        `;
        const result = await request.query(query);

        const orderItems = result.recordset.map(item => {
            return {
                ProductID: item.ProductID,
                productName: item.ProductName,
                Quantity: item.Quantity,
                Price: item.Price,
                productImage: item.ProductImage
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

            return {
                Content: item.Content,
                Date: item.NotificationDate,
                productImage: item.ProductImage,
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
            return {
                productName: item.ProductName,
                Quantity: item.Quantity,
                Price: item.Price,
                productImage: item.ProductImage
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
                tbl_Cart.CartID,
                tbl_Product.isArchive, 
                tbl_Product.ProductName,
                tbl_Product.Stock, 
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
                return {
                    Stock: productCart.Stock,
                    productName: productCart.ProductName,
                    productPrice: productCart.Price,
                    productQuantity: productCart.Quantity,
                    productImage: productCart.ProductImage,
                    CartID: productCart.CartID,
                    Archive: productCart.isArchive
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
    const {OrderData, retrieve,PickUp}  = req.body;
    try {

        const user = req.session.user;
            const ID = parseInt(user.UserID);
            console.log(OrderData)
            const order =  await pool.request()
                .input('ID',sql.Int,ID)
                .input('Link',sql.VarChar,retrieve)
                .input('PickUp',sql.VarChar,PickUp)
                .query('INSERT INTO tbl_Order ([Date], UserID, Status,PaymentLink,PickUp) VALUES (convert(varchar,getdate(), 0), @ID,DEFAULT,@Link,@PickUp)');
        for (const order of OrderData) {
            
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

                        UPDATE tbl_Product
                        SET Stock = Stock - @quantity
                        WHERE ProductID = @ProdID

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

                return {
                    ProductName: item.ProductName,
                    Price: item.Price,
                    Quantity: item.Quantity,
                    Image: item.ProductImage
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
    const { UpdatedNotif, OrderId,NotifID } = req.body;
    console.log('Runnning sya boss', UpdatedNotif, ' ',OrderId);
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
        .input('OrderID',sql.Int,OrderId)
        .input('NotifID',sql.Int,NotifID)
        await request.query("UPDATE tbl_notification SET tbl_notification.Status = @Status FROM tbl_notification INNER JOIN tbl_Order ON tbl_Order.OrderID = tbl_notification.OrderID WHERE (tbl_notification.Status = 'unread' OR tbl_notification.Status = 'Seen') AND tbl_Order.UserID = @UserID AND tbl_notification.OrderID = @OrderID AND tbl_notification.NotificationID = @NotifID");

        res.status(200).json();
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error', details: err });
    }
});

app.put('/UpdateNotif/Seen', async (req, res) => {
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