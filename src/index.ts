const express = require('express');
const app = express();
import { ethers } from 'ethers';
import { Request, Response } from 'express';
import { getAndStoreAccessToken } from './api';

// Set EJS as the view engine
app.set('view engine', 'ejs');

// Add any other middleware or routes here

// Start the server on port 3000
app.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});

// Example usage in your Express.js server
app.post('/connect-utu', async (req: Request, res: Response) => {
  try {
    const username = req.body.username; // Get the username from the request
    const signerAddress = req.body.signerAddress; // Get the signer's Ethereum address from the request

    // Create a signer using the signer's Ethereum address
    const signer = new ethers.Wallet(signerAddress);

    // Call the getAndStoreAccessToken function to authenticate with UTU
    await getAndStoreAccessToken(username, signer);

    // Respond with a success message or status code
    res.sendStatus(200); // You can customize the response as needed
  } catch (error) {
    // Handle errors and respond with an error status code
    console.error(error);
    res.sendStatus(500); // Internal Server Error
  }
});

app.get('/connect-wallet', (req: Request, res: Response) => {
  res.render('connect-wallet');
});
