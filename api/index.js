// const express = require('express');
// const dns = require('dns');
// const bodyParser = require('body-parser');
// const net = require('net');

// const app = express();
// const port = 3000;

// app.use(bodyParser.json());

// function isValidEmailSyntax(email) {
//     const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
//     return emailRegex.test(email);
// }

// function checkMxRecords(domain) {
//     return new Promise((resolve, reject) => {
//         dns.resolveMx(domain, (err, addresses) => {
//             if (err) {
//                 console.error('DNS error:', err);
//                 return resolve(false);
//             }
//             if (!addresses || addresses.length === 0) {
//                 console.log('No MX records found for domain:', domain);
//                 return resolve(false);
//             }
//             resolve(addresses);
//         });
//     });
// }

// function verifyEmailSmtp(email, mxRecords) {
//     return new Promise((resolve, reject) => {
//         const [recipient, domain] = email.split('@');
//         const mx = mxRecords[0].exchange;
//         const client = net.createConnection(25, mx);

//         let step = 0;

//         client.setTimeout(10000); // Set timeout to avoid hanging connections

//         client.on('connect', () => {
//             console.log(`Connected to MX server: ${mx}`);
//             client.write(`HELO ${domain}\r\n`);
//         });

//         client.on('timeout', () => {
//             console.error('SMTP connection timed out');
//             client.end();
//             resolve(false);
//         });

//         client.on('data', (data) => {
//             const response = data.toString();
//             console.log('SMTP response:', response);

//             switch (step) {
//                 case 0:
//                     if (response.includes('220')) {
//                         client.write(`MAIL FROM:<test@${domain}>\r\n`);
//                         step++;
//                     } else {
//                         client.end();
//                         resolve(false);
//                     }
//                     break;
//                 case 1:
//                     if (response.includes('250')) {
//                         client.write(`RCPT TO:<${email}>\r\n`);
//                         step++;
//                     } else {
//                         client.end();
//                         resolve(false);
//                     }
//                     break;
//                 case 2:
//                     if (response.includes('250')) {
//                         client.end();
//                         resolve(true);
//                     } else if (response.includes('550')) {
//                         client.end();
//                         resolve(false);
//                     } else {
//                         client.end();
//                         resolve(false);
//                     }
//                     break;
//                 default:
//                     client.end();
//                     resolve(false);
//                     break;
//             }
//         });

//         client.on('end', () => {
//             console.log('SMTP connection ended');
//         });

//         client.on('error', (err) => {
//             console.error('SMTP error:', err);
//             resolve(false);
//         });

//         client.on('close', () => {
//             console.log('SMTP connection closed');
//         });
//     });
// }

// app.post('/verify-email', async (req, res) => {
//     const { email } = req.body;

//     if (!email) {
//         return res.status(400).json({ error: 'Email is required' });
//     }

//     if (!isValidEmailSyntax(email)) {
//         return res.json({ valid: false, reason: 'Invalid email syntax' });
//     }

//     const domain = email.split('@')[1];

//     try {
//         const mxRecords = await checkMxRecords(domain);
//         if (!mxRecords) {
//             return res.json({ valid: false, reason: 'Domain does not have MX records' });
//         }

//         const isValid = await verifyEmailSmtp(email, mxRecords);
//         if (isValid) {
//             res.json({ valid: true });
//         } else {
//             res.json({ valid: false, reason: 'Email does not exist' });
//         }
//     } catch (error) {
//         console.error('Error verifying email:', error);
//         res.status(500).json({ error: 'Internal server error' });
//     }
// });

// app.listen(port, () => {
//     console.log(`Server is running on http://localhost:${port}`);
// });


const express = require('express');
const dns = require('dns');
const bodyParser = require('body-parser');
const net = require('net');

const app = express();
const port = 3000;

app.use(bodyParser.json());

function isValidEmailSyntax(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function checkMxRecords(domain) {
    return new Promise((resolve, reject) => {
        dns.resolveMx(domain, (err, addresses) => {
            if (err) {
                console.error('DNS error:', err);
                return resolve(false);
            }
            if (!addresses || addresses.length === 0) {
                console.log('No MX records found for domain:', domain);
                return resolve(false);
            }
            resolve(addresses);
        });
    });
}

function verifyEmailSmtp(email, mxRecords, ports = [25, 587, 465]) {
    return new Promise((resolve, reject) => {
        const [recipient, domain] = email.split('@');
        let index = 0;

        const tryNextPort = () => {
            if (index >= ports.length) {
                return resolve(false);
            }

            const mx = mxRecords[0].exchange;
            const port = ports[index++];
            const client = net.createConnection(port, mx);

            let step = 0;

            client.setTimeout(10000); // Set timeout to avoid hanging connections

            client.on('connect', () => {
                console.log(`Connected to MX server: ${mx} on port ${port}`);
                client.write(`HELO ${domain}\r\n`);
            });

            client.on('timeout', () => {
                console.error('SMTP connection timed out');
                client.end();
                tryNextPort();
            });

            client.on('data', (data) => {
                const response = data.toString();
                console.log('SMTP response:', response);

                switch (step) {
                    case 0:
                        if (response.includes('220')) {
                            client.write(`MAIL FROM:<test@${domain}>\r\n`);
                            step++;
                        } else {
                            client.end();
                            tryNextPort();
                        }
                        break;
                    case 1:
                        if (response.includes('250')) {
                            client.write(`RCPT TO:<${email}>\r\n`);
                            step++;
                        } else {
                            client.end();
                            tryNextPort();
                        }
                        break;
                    case 2:
                        if (response.includes('250')) {
                            client.end();
                            resolve(true);
                        } else if (response.includes('550')) {
                            client.end();
                            resolve(false);
                        } else {
                            client.end();
                            tryNextPort();
                        }
                        break;
                    default:
                        client.end();
                        tryNextPort();
                        break;
                }
            });

            client.on('end', () => {
                console.log('SMTP connection ended');
            });

            client.on('error', (err) => {
                console.error('SMTP error:', err);
                tryNextPort();
            });

            client.on('close', () => {
                console.log('SMTP connection closed');
            });
        };

        tryNextPort();
    });
}

app.post('/verify-email', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    if (!isValidEmailSyntax(email)) {
        return res.json({ valid: false, reason: 'Invalid email syntax' });
    }

    const domain = email.split('@')[1];

    try {
        const mxRecords = await checkMxRecords(domain);
        if (!mxRecords) {
            return res.json({ valid: false, reason: 'Domain does not have MX records' });
        }

        const isValid = await verifyEmailSmtp(email, mxRecords);
        if (isValid) {
            res.json({ valid: true });
        } else {
            res.json({ valid: false, reason: 'Email does not exist' });
        }
    } catch (error) {
        console.error('Error verifying email:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
