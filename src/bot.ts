import { Bot, Context, session, SessionFlavor } from 'grammy';

// Define the states of the bot
enum State {
    IDLE,
    AWAITING_PRIVATE_KEY,
    AWAITING_USERNAME,
    AWAITING_ACTION,
    AWAITING_FEEDBACK,
    AWAITING_RATING,
    AWAITING_FEEDBACK_CONFIRMATION,
}

interface SessionData {
    state: State;   // the current state of the bot
    otherUsername: string;  // the username of the user to get or submit feedback on
    feedback: string;   // the feedback to submit
    rating: number; // the rating to submit
}

// Declare `ctx.session` to be of type `SessionData`.
type MyContext = Context & SessionFlavor<SessionData>;

// Create a bot
const bot = new Bot<MyContext>(process.env.BOT_TOKEN!);

// Install session middleware, and define the initial session value.
function initial(): SessionData {
    return {
        state: State.IDLE,
        otherUsername: '',
        feedback: '',
        rating: 0,
    };
}
bot.use(session({ initial }));

// Middleware to intercept /start command
bot.use(async (ctx) => {
    if (ctx.message?.text === '/start') {
        await ctx.reply('<h1>Web3 Guardian 🤖</h1>\n\nA telegram bot that leverages the UTU Web3 Protocol to provide reliable reputation checks for telegram users 🧐');
        await ctx.reply('Please enter your wallet\'s private key:');   // TODO: Should we generate our bot's responses with a language model to make them more expressive and different each time? 🤔
        ctx.session.state = State.AWAITING_PRIVATE_KEY;
    }
});

// Middleware to handle user inputs
bot.on('message', async (ctx) => {
    if (ctx.session.state === State.AWAITING_PRIVATE_KEY) {
        const privateKey = ctx.message.text;
        const myUsername = ctx.from?.username;
        // TODO: Obtain JWT from UTU API using the private key
        // TODO: Store the JWT in Redis with the hash as the user's username and the key as 'accessToken'
        // TODO: Store the refresh token (if any) in Redis with the hash as the user's username and the key as 'refreshToken'
        // Now, ask the user to enter a user's username
        await ctx.reply('Enter a user\'s username:');
        ctx.session.state = State.AWAITING_USERNAME;
    }
    else if (ctx.session.state === State.AWAITING_USERNAME) {
        ctx.session.otherUsername = ctx.message.text!;
        // TODO: check if this username exists in telegram and if not, prompt the user to reenter username
        const keyboard = [['View User\'s Reputation', 'Submit Review on User']];
        await ctx.reply('What would you like to do?', {
            reply_markup: { keyboard, one_time_keyboard: true },
        });
        ctx.session.state = State.AWAITING_ACTION;
    }
    else if (ctx.session.state === State.AWAITING_ACTION) {
        const action = ctx.message.text;
        if (action === 'View User\'s Reputation') {
            // TODO: Fetch feedback on entity (otherUsername) from UTU API

            const reviews = [
                'Review 1: Great user!',
                'Review 2: Very trustworthy.',
                'Review 3: Highly recommended.',
            ];

            // Display reviews to the user
            if (reviews.length > 0) {
                await ctx.reply('Here are the reviews for @' + ctx.session.otherUsername + ':');
                for (const review of reviews) {
                    await ctx.reply(review);
                }
            } else {
                await ctx.reply('No reviews found for @' + ctx.session.otherUsername);
            }

            await ctx.reply('Enter another user\'s username:');

            // clear the session
            ctx.session = initial();

            // Get the bot to prompt another username
            ctx.session.state = State.AWAITING_USERNAME;
        }
        else if (action === 'Submit Review on User') {
            await ctx.reply('Tell us your objective feedback on @' + ctx.session.otherUsername + ':');
            ctx.session.state = State.AWAITING_FEEDBACK;
        }
    }
    else if (ctx.session.state === State.AWAITING_FEEDBACK) {
        ctx.session.feedback = ctx.message.text!;
        await ctx.reply('How would you rate your experience with @' + ctx.session.otherUsername + '?');

        // Create a menu with star emojis for rating
        const keyboard = [
            ['⭐', '⭐⭐', '⭐⭐⭐'],
            ['⭐⭐⭐⭐', '⭐⭐⭐⭐⭐']
        ];

        await ctx.reply('Choose a rating:', {
            reply_markup: { keyboard, one_time_keyboard: true },
        });
        ctx.session.state = State.AWAITING_RATING;
    }
    else if (ctx.session.state === State.AWAITING_RATING) {
        ctx.session.rating = ctx.message.text!.length;    // Convert the star emoji into a rating value
        await ctx.reply('Are you sure you want to submit the following feedback?');
        await ctx.reply('Feedback: ' + ctx.session.feedback);
        await ctx.reply('Rating: ' + ctx.session.rating);
        // Create a menu with yes/no options
        const keyboard = [['Yes', 'No']];
        await ctx.reply('Choose an option:', {
            reply_markup: { keyboard, one_time_keyboard: true },
        });
        ctx.session.state = State.AWAITING_FEEDBACK_CONFIRMATION;
    }
    else if (ctx.session.state === State.AWAITING_FEEDBACK_CONFIRMATION) {
        const confirmation = ctx.message.text;
        if (confirmation === 'Yes') {
            // TODO: Create entity if it doesn't exist
            // TODO: Submit feedback on enitiy to UTU API
            await ctx.reply('Feedback submitted successfully!');
        }
        else if (confirmation === 'No') {
            await ctx.reply('Feedback submission cancelled.');
        }
        await ctx.reply('Enter another user\'s username:');
            
        // clear the session
        ctx.session = initial();

        // Get the bot to prompt another username
        ctx.session.state = State.AWAITING_USERNAME;
    }
});

// Handle errors
bot.catch((err) => {
    console.error('An error occurred:', err);
    // TODO: Send error message to user
});

// Start the bot
console.log('Starting bot...');
bot.start();
