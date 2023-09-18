# Project Title: UTU Protocol Web3Guardian Telegram Bot

## Table of Contents

- [Description](#Description)
- [Problem Statement](#ProblemStatement)
- [Key Features](#KeyFeatures)
- [Usage](#Usage)
- [Local Installation and Contribution Guidelines](#LocalInstallationandCotributionGuidelines)
- [Demo Video  & ScreenShots(WIP)](#DemoVideo&ScreenShots(WIP))
- [License](#License)
- [Contact](#contact)


## Description
The Web3Guardian Telegram bot is a powerful and user-friendly bot that leverages **UTU** protocol's trust engine to enhance trustworthiness in digital interactions on the internet.

The bot allows users to securely give and receive feedback on other users on Telegram hence strengthening their reputation.

## Problem Statement
The online space has been marred with malicious actors and spam, specifically on telegram. By using our UTU Web3Guardian bot, you will be able to identify bad actors and therefore protect yourself from fraudulent activities such as:
- Revealing your PII (Personally Identifiable Information) to malicious groups.

- Losing funds to scammers and grifters.

## Key Features
- **Submit Feedback:** Write reviews for a user and provide them a  rating based on the provided context.

- **View Reputation:** Check out a user's reputation (feedback and rating) given by other users and entities that interacted with the bot before.

- **Decentralized Storage:** Create, store, and manage reviews and feedback in UTU's decentralized protocol.

- **Wallet Integration:**  A web3 wallet connector, and sign a verfication message to be able to interact with the _Web3Guadian_ Telegram bot.

## Usage
To use the UTU Web3Guardian Telegram Bot, follow these steps:
1. Navigate to your web browser of choice and click this [link](https://t.me/web3guardian_utu_bot) to redirect you to Web3Guardian (UTU) telegram bot.

2. Click ```/start``` and connect your web3 wallet extension of choice (e.g Metamask)

3. Enter a username whose review or feedback you want to view or give.

4. Choose whether you want to **View a User's Reputation** or **Submit a Review on a User**.

5. Based on your choice in step 4 above:-
    - _The first option returns the reviews given by other users' and your as well_.
    - _Write down feedback for a user and give them a rating on a scale of 1-5 if you choose the 2nd option_.

6. Confirm your choice and click ```/start``` to start another session or ```/reset``` to reset the bot.

## Local Installation and Contribution Guidelines
### Prerequisites
- A publicly accessible environment (either a cloud server or a local machine exposed to the internet)
- [Git](https://git-scm.com/downloads)
and either:
- [Docker](https://docs.docker.com/install/)
or if you like pain:
- [npm](https://www.npmjs.com/get-npm)
- [Node.js](https://nodejs.org/en/download/)
- [redis](https://redis.io/download)


### Installation

1. Clone the project's github repository. 
```bash
git clone git@github.com:DennohKim/web3guardian--utu-bot.git
```

2. To install all the project's dependencies on your package.json file, run:
```bash
npm install
```


3. Create your own `.env` file using the template provided after acquiring your specific bot token. Guidance on how to generate your bot token can be found [HERE](https://medium.com/geekculture/generate-telegram-token-for-bot-api-d26faf9bf064). You can visit the [redis](https://redis.io/docs/ui/cli/#:~:text=Host%2C%20port%2C%20password%2C%20and,%2C%20use%20the%20%2Dh%20option.) documentation to get redis port number and host. 

4. On the terminal, navigate to the project's root directory and spin up the docker containers by running the command
 ```bash 
docker compose up
```

5. Navigate to another terminal and expose the container's port _3000_ using the command 
```bash 
ngrok http 3000
```
- Ps. you will have to install **ngrok** using 
 ```bash 
 sudo snap install ngrok
 ```

6. Once everything is up and running, you can follow the steps outlaid on the [**Usage**](#Usage) section above to interact with the Telegram bot.

## Demo Video  & ScreenShots(WIP)

## License
The **UTU** Web3Guardian Telegram Bot is open-source software licensed under the [MIT License](https://github.com/git/git-scm.com/blob/main/MIT-LICENSE.txt)
## Contact
For questions, suggestions, or support, please contact our team at contact@email.com or 
