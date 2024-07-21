const express = require('express');
const net = require('net');
const dns = require('dns');

const app = express();
const port = 5000;

// Middleware to parse JSON requests
app.use(express.json());

const validateEmail = (email) => {
    return new Promise((resolve, reject) => {
        const domain = email.split('@')[1];

        if (!domain) {
            return reject('Invalid email format');
        }

        dns.resolveMx(domain, (err, addresses) => {
            if (err || addresses.length === 0) {
                return reject('No MX record found');
            }

            const mxRecord = addresses[0].exchange;
            const client = net.createConnection(25, mxRecord);

            let isValid = false;

            client.on('data', (data) => {
                const response = data.toString();
                console.log('Server response:', response);

                if (response.startsWith('250') || response.startsWith('221')) {
                    isValid = true; // Email address is likely valid
                }else{
                    isValid=false
                }
            });

            client.on('end', () => {
                resolve(isValid);
            });

            client.on('error', (err) => {
                reject('Connection error');
            });

            // Set a timeout for the connection
            client.setTimeout(5000); // 5 seconds
            client.on('timeout', () => {
                client.destroy();
                reject('Connection timeout');
            });

            client.write(`HELO ${domain}\r\n`);
            client.write(`MAIL FROM:<test@${domain}>\r\n`);
            client.write(`RCPT TO:<${email}>\r\n`);
            client.write('QUIT\r\n');
        });
    });
};

app.post('/validate', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).send('Email is required');
    }

    try {
        const isValid = await validateEmail(email);
        res.json({ valid: isValid });
    } catch (error) {
        res.status(500).send(error);
    }
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
