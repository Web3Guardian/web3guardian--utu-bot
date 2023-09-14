import {Bot, Context, InlineKeyboard, session, SessionFlavor} from 'grammy';
import {config} from 'dotenv';
import express, {Request, Response} from 'express';
import {ethers} from 'ethers';
import {getAndStoreAccessToken} from "./api";
import {redisClient} from "./redisClient";

const app = express();

// Set EJS as the view engine for express
app.set('view engine', 'ejs');

// Load environment variables from .env file
config();

// Define the states of the bot
enum State {
    IDLE,
    AWAITING_AUTH,
    AWAITING_USERNAME,
    AWAITING_ACTION,
    AWAITING_FEEDBACK,
    AWAITING_RATING,
    AWAITING_FEEDBACK_CONFIRMATION,
}

interface SessionData {
    state: State; // the current state of the bot
    otherUsername: string; // the username of the user to get or submit feedback on
    feedback: string; // the feedback to submit
    rating: number; // the rating to submit
}

// Declare `ctx.session` to be of type `SessionData`.
type MyContext = Context & SessionFlavor<SessionData>;

// Create a bot
const bot = new Bot<MyContext>(process.env.BOT_TOKEN as string);

// Install session middleware, and define the initial session value.
function initial(): SessionData {
    return {
        state: State.IDLE,
        otherUsername: '',
        feedback: '',
        rating: 0,
    };
}

// set up storage as redis and implement custom handlers for read, write and delete
const storage = {
    read: async (key: string): Promise<SessionData> => {
        console.log('reading from redis hash ' + key);
        return (await redisClient.hGetAll(key)) as unknown as SessionData;
    },
    write: async (key: string, value: SessionData) => {
        console.log('writing to redis hash ' + key);
        await redisClient.hSet(key, {...value});
    },
    delete: async (key: string) => {
        console.log('deleting from redis hash ' + key);
        await redisClient.del(key);
    }
}
bot.use(session({initial, storage: storage}));

// /start command
bot.command('start', async (ctx) => {
    await ctx.reply('<b>Web3Guardian 🤖</b>\n\nA telegram bot that leverages the UTU Web3 Protocol to provide reliable reputation checks on telegram users 🧐', {parse_mode: 'HTML'});
    await ctx.reply(`Please [connect your wallet](${process.env.BASE_URL}/connect-wallet/${ctx.chat.id}) to continue`);
    ctx.session.state = State.AWAITING_AUTH;
});

// /restart command
bot.command('restart', async (ctx) => {
    if (ctx.session.state != State.AWAITING_AUTH) {
        ctx.session = initial();
        ctx.session.state = State.AWAITING_USERNAME;
        await ctx.reply("Enter a user's username 👤:");
    }
});

// Function to check if a username exists
async function doesUsernameExist(botToken: string, username: string) {
    try {
        const bot = new Bot(botToken);
        const chat = await bot.api.getChat(username);
        return !!chat;
    } catch (error) {
        console.error(error);
        return false;
    }
}


// Middleware to handle user inputs
bot.on(['message:text', 'callback_query:data'], async (ctx) => {
    if (ctx.session.state == State.AWAITING_USERNAME) {
        //check if this username exists in telegram and if not, prompt the user to reenter username
        const username = ctx.message?.text || ctx.callbackQuery?.data;

        // Check if the username exists
        const usernameExists = await doesUsernameExist(
            process.env.BOT_TOKEN!,
            username as string
        );

        if (usernameExists) {
            ctx.session.otherUsername = username as string;
            ctx.session.state = State.AWAITING_ACTION;
            await ctx.reply('What would you like to do?', {
                reply_markup: new InlineKeyboard()
                    .text("View User's Reputation 👀", 'View User Reputation')
                    .row()
                    .text('Submit Review on User 📝', 'Submit Review'),
            });
        } else {
            await ctx.reply('That username is not on telegram. Please try another username 👤:');
        }
    } else if (ctx.session.state == State.AWAITING_ACTION) {
        const action = ctx.message?.text || ctx.callbackQuery?.data;
        if (action === 'View User Reputation') {
            // TODO: Fetch feedback on entity (otherUsername) from UTU API

            const reviews = [
                'Review 1: Great user!',
                'Review 2: Very trustworthy.',
                'Review 3: Highly recommended.',
            ];

            // Display reviews to the user
            if (reviews.length > 0) {
                await ctx.reply(
                    'Here are the reviews for @' + ctx.session.otherUsername + ':'
                );
                for (const review of reviews) {
                    await ctx.reply(review);
                }
            } else {
                await ctx.reply('No reviews found for @' + ctx.session.otherUsername);
            }

            await ctx.reply(
                'Thanks for using Web3 Guardian! 😊\n\nEnter /restart to try another user.'
            );
            ctx.session.state = State.IDLE;
        } else if (action === 'Submit Review') {
            await ctx.reply(
                'Tell us your objective feedback on @' + ctx.session.otherUsername + ':'
            );
            ctx.session.state = State.AWAITING_FEEDBACK;
        } else {
            await ctx.reply(
                'Invalid input. Please enter View User Reputation or Submit Review'
            );
            return;
        }
    } else if (ctx.session.state == State.AWAITING_FEEDBACK) {
        ctx.session.feedback = ctx.message?.text! || ctx.callbackQuery?.data!;
        await ctx.reply(`How would you rate your experience with @${ctx.session.otherUsername} ?`);
        ctx.session.state = State.AWAITING_RATING;

        // Create a menu with star emojis for rating
        await ctx.reply('Choose a rating:', {
            reply_markup: new InlineKeyboard()
                .text('⭐', '1')
                .text('⭐⭐', '2')
                .text('⭐⭐⭐', '3')
                .row()
                .text('⭐⭐⭐⭐', '4')
                .text('⭐⭐⭐⭐⭐', '5'),
        });
    } else if (ctx.session.state == State.AWAITING_RATING) {
        ctx.session.rating = (ctx.message?.text ||
            ctx.callbackQuery?.data) as unknown as number; // Convert the star emoji into a rating value
        if (ctx.session.rating < 1 || ctx.session.rating > 5) {
            await ctx.reply('Invalid input. Please enter a number between 1 and 5');
            return;
        }
        await ctx.reply('Feedback: ' + ctx.session.feedback);
        await ctx.reply('Rating: ' + ctx.session.rating);
        ctx.session.state = State.AWAITING_FEEDBACK_CONFIRMATION;

        // Create a menu with yes/no options
        await ctx.reply(
            'Are you sure you want to submit the following feedback? (Yes/No)',
            {
                reply_markup: new InlineKeyboard().text('Yes', 'Yes').text('No', 'No'),
            }
        );
    } else if (ctx.session.state == State.AWAITING_FEEDBACK_CONFIRMATION) {
        const confirmation = ctx.message?.text || ctx.callbackQuery?.data;
        if (confirmation === 'Yes') {
            // TODO: Create entity (whose uuid is in the format of an eth address) if it doesn't exist
            // TODO: Submit feedback on entity to UTU API
            await ctx.reply('Feedback submitted successfully!');
        } else if (confirmation === 'No') {
            await ctx.reply('Feedback submission cancelled.');
        } else {
            await ctx.reply('Invalid input. Please enter Yes or No');
            return;
        }

        await ctx.reply(
            'Thanks for using Web3 Guardian! 😊\n\nEnter /restart to try another user.'
        );
        ctx.session.state = State.IDLE;
    }
});

// Handle errors
bot.catch((err) => {
    console.error('An error occurred:', err);
});

// Start the bot
console.log('Starting bot...');
bot.start();


// Start the server on port 3000
app.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});

// Render the connect-wallet page
app.get('/connect-wallet/:chatId', (req: Request, res: Response) => {
    // Extract the chat ID and user ID from the path variables
    const {chatId} = req.params;

    // Render template with chatId and userId as local variables
    res.render('connect-wallet', {chatId});
});

// Middleware to parse JSON data
app.use(express.json());

// Handle the connect-wallet form submission
app.post('/receive-signature', (req, res) => {
    const {chatId, address, signature} = req.body;

    // Convert to a checksummed address
    const checksummedAddress = ethers.getAddress(address);

    // Authenticate with UTU API
    getAndStoreAccessToken(chatId, {
        address: checksummedAddress,
        signature: signature,
    })
        .then(() => {
            // reply to the user that the authentication was successful
            bot.api.sendMessage(chatId, 'Wallet connected successfully!');

            // Change the state of the bot to AWAITING_USERNAME
            redisClient.hSet(chatId, 'state', State.AWAITING_USERNAME)
                .then(() => {
                    bot.api.sendMessage(chatId, 'Enter a user\'s username 👤:');
                })
                .catch((error) => {
                    console.error(error);
                    bot.api.sendMessage(chatId, 'Oops! That\'s on us. Please /start the bot again.');
                });
        })
        .catch((error) => {
            // reply to the user that the authentication failed
            bot.api.sendMessage(chatId, 'Wallet connection failed!');
            console.error(error);
            res.status(500).json({error});
        });

    res.json({status: 200});
});
