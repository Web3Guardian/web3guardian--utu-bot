import {Bot, Context, InlineKeyboard, session, SessionFlavor} from 'grammy';
import {config} from 'dotenv';
import express, {Request, Response} from 'express';
import {ethers} from 'ethers';
import {addEntity, getAndStoreAccessToken, getFeedbackSummary, getRanking, sendFeedback} from "./api";
import {redisClient} from "./redisClient";
import {Entity, IFeedbackData, IFeedbackResponse} from "./models";

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
    myUsername: string; // the username of the user who is using the bot
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
        myUsername: '',
        otherUsername: '',
        feedback: '',
        rating: 0,
    };
}

// set up storage as redis and implement custom handlers for read, write and delete
const storage = {
    read: async (key: string): Promise<SessionData> => {
        return (await redisClient.hGetAll(key)) as unknown as SessionData;
    },
    write: async (key: string, value: SessionData) => {
        await redisClient.hSet(key, {...value});
    },
    delete: async (key: string) => {
        await redisClient.del(key);
    }
}
bot.use(session({initial, storage: storage}));

// /start command
bot.command('start', async (ctx) => {
    await ctx.reply('<b>Web3Guardian 🤖</b>\n\nA telegram bot that leverages the UTU Web3 Protocol to provide reliable reputation checks on telegram users 🧐', {parse_mode: 'HTML'});
    ctx.session.myUsername = ctx.from?.username as string;

    // Check if the user is already authenticated
    const accessToken = await redisClient.hGet(ctx.chat.id.toString(), 'access_token');
    if(accessToken){
        await ctx.reply("Enter a user's username 👤:");
        ctx.session.state = State.AWAITING_USERNAME;
    } else {
        // await ctx.reply(`To continue, please authorize our app by visiting ${process.env.BASE_URL}/connect-wallet/${ctx.chat.id} and connecting your wallet`);
        await ctx.reply('Please connect your wallet to continue', {
            reply_markup: new InlineKeyboard()
                .url("Connect Wallet", `${process.env.BASE_URL}/connect-wallet/${ctx.chat.id}`)
        });
        ctx.session.state = State.AWAITING_AUTH;
    }
});

// /reset command
bot.command('reset', async (ctx) => {
    // Delete the user's session from redis
    await redisClient.del(ctx.chat.id.toString())
        .then(async () => {
            ctx.session = initial();
            await ctx.reply('Your session has been cleared. Enter /start to start again.');
        })
        .catch(async (error) => {
            console.error(error);
            await ctx.reply('Something went wrong. Please try again.');
        });
});

// command menu
bot.api.setMyCommands([
    {command: 'start', description: 'Start or restart the bot'},
    {command: 'reset', description: 'Clear your session data'},
]).then();

// Middleware to handle user inputs
bot.on(['message:text', 'callback_query:data'], async (ctx) => {
    if (ctx.session.state == State.AWAITING_USERNAME && ctx.message) {
        const otherUsername = ctx.message.text;

        // Create entity if it doesn't exist or update if exists
        const entity = new Entity(otherUsername);
        const resp = await addEntity((ctx.chat!.id.toString()), entity);
        if (resp.status !== 200) {
            await bot.api.sendMessage(ctx.chat!.id, 'Something went wrong. Please try again.');
            return;
        }

        ctx.session.otherUsername = otherUsername;
        ctx.session.state = State.AWAITING_ACTION;
        await ctx.reply('What would you like to do?', {
            reply_markup: new InlineKeyboard()
                .text("View User's Reputation 👀", 'View User Reputation')
                .row()
                .text('Submit Review on User 📝', 'Submit Review'),
        });
    } else if (ctx.session.state == State.AWAITING_ACTION && ctx.callbackQuery) {
        const action = ctx.callbackQuery.data;
        if (action === 'View User Reputation') {
            const targetUuid = new Entity(ctx.session.otherUsername).ids.uuid;  // this username will always return the same uuid because it is generated from the username

            // Get ranking (every other entity this has interacted with) from UTU API
            getRanking(ctx.chat!.id.toString(), targetUuid)
                .then(async (ranking) => {
                    const promises = ranking
                        .map((item) => getFeedbackSummary(ctx.chat!.id.toString(), item.entity.uuid!, targetUuid))

                    const feedbacks = (await Promise.allSettled(promises))
                        .filter((result) => result.status === 'fulfilled')  // filter out rejected promises
                        .map((result) => (result as PromiseFulfilledResult<IFeedbackResponse>).value)
                        .filter((feedback) => feedback.result.items.reviews.length > 0) // filter out feedback with no reviews

                    if (feedbacks.length > 0) {
                        await ctx.reply(`Here are the reviews for @${ctx.session.otherUsername}:`);
                        for (const feedback of feedbacks)
                            await ctx.reply(`${feedback.result.items.reviews[0].content}\n\nRating: ${'⭐'.repeat(Math.round(feedback.result.items.stars.avg))}`);
                    } else {
                        await ctx.reply(`No reviews found for @${ctx.session.otherUsername}.`);
                    }
                })
                .catch(async (error) => {
                    console.error(error);
                    await ctx.reply(`Unable to get feedback on @${ctx.session.otherUsername}.`);
                })
                .finally(async () => {
                    await ctx.reply('Thanks for using Web3 Guardian! 😊\n\nEnter /start to try another user.');
                    ctx.session.state = State.IDLE;
                })
        } else if (action === 'Submit Review') {
            await ctx.reply(
                'Tell us your objective feedback on @' + ctx.session.otherUsername + ':'
            );
            ctx.session.state = State.AWAITING_FEEDBACK;
        } else {
            await ctx.reply(
                'Invalid input. Please choose an option from the menu.'
            );
            return;
        }
    } else if (ctx.session.state == State.AWAITING_FEEDBACK && ctx.message) {
        ctx.session.feedback = ctx.message.text;
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
    } else if (ctx.session.state == State.AWAITING_RATING && ctx.callbackQuery) {
        const rating = ctx.callbackQuery.data as unknown as number; // Convert the star emoji into a rating value
        if (rating < 1 || rating > 5) {
            await ctx.reply('Invalid input. Please choose an option from the menu.');
            return;
        }
        ctx.session.rating = rating;
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
    } else if (ctx.session.state == State.AWAITING_FEEDBACK_CONFIRMATION && ctx.callbackQuery) {
        const confirmation = ctx.callbackQuery.data;
        if (confirmation === 'Yes') {
            const sourceUuid = await redisClient.hGet(ctx.chat!.id.toString(), "address") as string;    // my address
            const targetUuid = new Entity(ctx.session.otherUsername).ids.uuid;
            const feedback: IFeedbackData = {
                review: ctx.session.feedback,
                stars: Number(ctx.session.rating)   // Somehow the rating is a string here
            }
            sendFeedback(ctx.chat!.id.toString(), sourceUuid, targetUuid, feedback)
                .then(async () => {
                    await ctx.reply('Feedback submitted successfully!');
                })
                .catch(async (error) => {
                    console.error(error);
                    await ctx.reply('Something went wrong. Please try again.');
                })
                .finally(async () => {
                    await ctx.reply('Thanks for using Web3 Guardian! 😊\n\nEnter /start to try another user.');
                    ctx.session.state = State.IDLE;
                });
        } else if (confirmation === 'No') {
            await ctx.reply('Feedback submission cancelled.');
            await ctx.reply('Thanks for using Web3 Guardian! 😊\n\nEnter /start to try another user.');
            ctx.session.state = State.IDLE;
        } else {
            await ctx.reply('Invalid input. Please choose an option from the menu.');
        }
    }
});

// Handle errors
bot.catch((err) => {
    console.error('An error occurred:', err);
});

// Start the bot
bot.start().then(() => {
    console.log('Bot is running!');
});


// Start the server on port 3000
app.listen(3000, () => {
    console.log('Server is running on port 3000');
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
        .then(async () => {
            // reply to the user that the authentication was successful
            await bot.api.sendMessage(chatId, 'Wallet connected successfully!');

            // Create or update an entity for the user
            const username = await redisClient.hGet(chatId.toString(), 'myUsername') as string;
            const entity = new Entity(username, checksummedAddress);
            const resp = await addEntity(chatId, entity);
            if (resp.status !== 200) {
                await bot.api.sendMessage(chatId, 'Oops! That\'s on us. Please /start the bot again.');
                return;
            }

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
        .catch(async (error) => {
            // reply to the user that the authentication failed
            await bot.api.sendMessage(chatId, 'Wallet connection failed!');
            console.error(error);
            res.status(500).json({error});
        });

    res.json({status: 200});
});
