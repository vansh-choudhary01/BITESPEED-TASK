import express from 'express';
import mysql from "mysql2";
import dotenv from "dotenv"

const app = express();
dotenv.config();

const connection = mysql.createConnection({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    port: process.env.MYSQL_PORT,
});

connection.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL');
});

function createDatabase() {
    let database = "bitespeed";
    let q = `CREATE DATABASE IF NOT EXISTS ${database}`;

    connection.query(q, (err, result) => {
        if (err) throw err;
        console.log("Database created or already exists");

        connection.changeUser({ database: database }, (err) => {
            if (err) {
                console.error('Error switching to database:', err);
                return;
            }
            console.log(`Connected to database ${database}`);
        });
    })
}
createDatabase();

app.use(express.json());

app.get("/", (req, res) => {
    res.send("Hello world!");
})

function queryPromise(sql) {
    return new Promise((resolve, reject) => {
        connection.query(sql, (err, result) => {
            if (err) reject(err);
            resolve(result);
        });
    })
}

app.post("/identify", async (req, res) => {
    const { phoneNumber, email } = req.body;
    let q = `CREATE TABLE IF NOT EXISTS Contact (
        id INT NOT NULL AUTO_INCREMENT,
        phoneNumber VARCHAR(10),
        email VARCHAR(100),
        linkedId INT,
        linkPrecedence VARCHAR(10) NOT NULL,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deletedAt DATETIME,
        PRIMARY KEY (id),
        FOREIGN KEY (linkedId) REFERENCES Contact(id)
    )`;
    await queryPromise(q);
    let q1;
    if (phoneNumber && email) {
        q1 = `SELECT id, linkedId FROM Contact WHERE phoneNumber = '${phoneNumber}' OR email = '${email}'`;
    } else if (phoneNumber) {
        q1 = `SELECT id, linkedId FROM Contact WHERE phoneNumber = '${phoneNumber}'`;
    } else if (email) {
        q1 = `SELECT id, linkedId FROM Contact WHERE email = '${email}'`;
    } else {
        q1 = `SELECT id, linkedId FROM Contact WHERE 1=0`; // This will return an empty result set
    }
    let ids = await queryPromise(q1);

    const linkedIds = ids.map(contact => contact.linkedId).filter(id => id !== null && id !== undefined);
    const contactIds = ids.map(contact => contact.id);

    let q2;
    if (linkedIds.length === 0 && contactIds.length === 0) {
        q2 = `SELECT * FROM Contact WHERE 1=0`;
    } else if (linkedIds.length === 0) {
        q2 = `SELECT * FROM Contact WHERE id IN (${contactIds.join(',')}) OR linkedId IN (${contactIds.join(',')})`;
    } else {
        q2 = `SELECT * FROM Contact WHERE id IN (${linkedIds.join(',')}) OR id IN (${contactIds.join(',')})`;
    }

    let result = await queryPromise(q2);
    let contact = {
        primaryContactId: null,
        emails: [],
        phoneNumbers: [],
        secondaryContactIds: [],
    };

    if ((phoneNumber || email) && result.length === 0) {
        let q2 = `INSERT INTO Contact 
        (phoneNumber, email, linkPrecedence) 
        VALUES 
        ('${phoneNumber}', '${email}', 'primary')`;
        let result = await queryPromise(q2);
        contact.primaryContactId = result.insertId;

        if (email) {
            contact.emails.push(email);
        }
        if (phoneNumber) {
            contact.phoneNumbers.push(phoneNumber);
        }
    } else {
        const primaryContacts = result.filter(contact => contact.linkPrecedence === "primary");
        const emails = new Set(result.map(contact => contact.email));
        const phoneNumbers = new Set(result.map(contact => contact.phoneNumber));
        const secondaryContactIds = result.filter(contact => contact.linkPrecedence === "secondary").map(contact => contact.id);
        let primaryContact = primaryContacts[0], secondaryContact = primaryContacts[1] ? primaryContacts[1] : null;

        if (primaryContacts.length === 2) {
            let q3 = `UPDATE Contact SET linkedId = '${primaryContact.id}', linkPrecedence = 'secondary' WHERE id = '${secondaryContact.id}'`;
            await queryPromise(q3);
            secondaryContactIds.push(secondaryContact.id);
        } else if (email && !emails.has(email)) {
            let q3 = `INSERT INTO Contact 
            (phoneNumber, email, linkPrecedence, linkedId)
            VALUES 
            ('${phoneNumber}', '${email}', 'secondary', '${primaryContact.id}')`;
            let result = await queryPromise(q3);
            emails.add(email);
            secondaryContactIds.push(result.insertId);
        } else if (phoneNumber && !phoneNumbers.has(phoneNumber)) {
            let q3 = `INSERT INTO Contact 
            (phoneNumber, email, linkPrecedence, linkedId)
            VALUES 
            ('${phoneNumber}', '${email}', 'secondary', '${primaryContact.id}')`;
            let result = await queryPromise(q3);
            phoneNumbers.add(phoneNumber);
            secondaryContactIds.push(result.insertId);
        }

        contact.primaryContactId = primaryContact.id;
        contact.emails = [...emails];
        contact.phoneNumbers = [...phoneNumbers];
        contact.secondaryContactIds = secondaryContactIds;
    }

    console.log(contact);
    res.status(200).send({ contact });
})

app.listen(8080, () => {
    console.log("Server is running on port 8080");
});