const express = require('express');
const app = express();
import { Request, Response } from 'express';


// Set EJS as the view engine
app.set('view engine', 'ejs');


// Add any other middleware or routes here

// Start the server on port 3000
app.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});


   app.get('/connect-wallet', (req: Request, res: Response) => {
     res.render('connect-wallet');
   });
