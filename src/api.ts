// eslint-disable-next-line import/no-extraneous-dependencies
import {
    IFeedbackData,
    IFeedbackResponse,
    Entity,
    IAuthResponse,
    IAuthRequest,
    IRankingsResponse,
    IRankingItem
} from './models';
import qs from "qs";
import {Urls} from './urls';
import axios, {AxiosRequestConfig} from 'axios';
import {redisClient} from './redisClient';
import {v4 as uuidv4} from 'uuid';
import {Contract, JsonRpcProvider, Transaction} from "ethers";
import { abi as UTTAbi } from "./../contracts/UTT.abi.json";

/**
 * Use the UTU API to post feedback.
 * @param userId the telegram userId of the user posting the feedback (needed only for authentication)
 * @param sourceUuid your entity's uuid
 * @param targetUuid the uuid of the entity to post feedback for
 * @param feedbackData the feedback data to post
 * @return a promise which will resolve with an unspecified value when the feedback was posted successfully, and will reject otherwise.
 * @see IFeedbackData
 */
export async function sendFeedback(userId: string, sourceUuid: string, targetUuid: string, feedbackData: IFeedbackData): Promise<any> {
    const sourceCriteria = createEntityCriteria(sourceUuid);
    const targetCriteria = createEntityCriteria(targetUuid);
    const transactionId = uuidv4();
    return axios.post(
        Urls.feedback,
        {
            sourceCriteria,
            targetCriteria,
            transactionId,
            items: feedbackData
        },
        await withAuthHeader(userId)
    );
}

/**
 * Get the rankings of every other entity this relates to from the UTU API.
 * @param userId the telegram userId of the user getting the rankings (needed only for authentication)
 * @param sourceUuid your entity's uuid
 * @param targetType the type of the entities to get rankings for
 * @return an array of ranking items
 * @see IRankingItem
 */
export async function getRanking(userId: string, sourceUuid: string, targetType: string = "telegram_user"): Promise<IRankingItem[]> {
    const sourceCriteria = createEntityCriteria(sourceUuid);
    const queryParams = qs.stringify({
        sourceCriteria,
        targetType
    });
    return axios.get<IRankingsResponse>(
        `${Urls.ranking}?${queryParams}`,
        await withAuthHeader(userId)
    ).then(result => {
        return result.data.result;
    });
}

/**
 * Get source entity's feedback on target entity from the UTU API.
 * @param userId the telegram userId of the user getting the feedback
 * @param sourceUuid your entity's uuid
 * @param targetUuid the uuid of the entity to get feedback for
 * @return an object with the feedback summary and the submit status
 * @see IFeedback
 * @see SubmitStatus
 */
export async function getFeedbackSummary(userId: string, sourceUuid: string, targetUuid: string): Promise<IFeedbackResponse> {
    const sourceCriteria = createEntityCriteria(sourceUuid);
    const targetCriteria = createEntityCriteria(targetUuid);
    const queryParams = qs.stringify({
        sourceCriteria,
        targetCriteria
    });
    return axios.get<IFeedbackResponse>(
        `${Urls.feedbackSummary}?${queryParams}`,
        await withAuthHeader(userId)
    ).then(result => {
        return result.data;
    }).catch(err => {
        console.log(err);
        return err;
    })
}

/**
 * Add an entity to UTU.
 * @param userId the telegram userId of the user adding the entity (needed only for authentication)
 * @param entity the entity to add
 * @see Entity
 * @returns a promise which will resolve with an unspecified value when the entity was added successfully, and will reject otherwise.
 */
export async function addEntity(userId: string, entity: Entity): Promise<any> {
    return axios.post(
        Urls.entity,
        entity,
        await withAuthHeader(userId)
    ).then(result => {
        // store in redis
        redisClient.hSet("entities", entity.name, entity.ids.uuid);
        return result;
    })
}

/**
 * Creates an endorsement transaction
 * @param sourceAddress the address of the endorser
 * @param targetAddress the target address of the endorsement
 * @param amount the amount of UTT to stake on the endorsement
 * @param transactionId the business transaction id (might or might not be an Ethereum tx id) to record with the
 *      endorsement, if any
 */
export async function endorse(sourceAddress: string, targetAddress: string, amount: string, transactionId: string): Promise<Transaction> {
    const provider = new JsonRpcProvider(Urls.networkUrl);
    const contract = new Contract(Urls.uttContractAddress, UTTAbi, provider);
    const utuBalance = await contract.balanceOf(targetAddress);
    if (Number(utuBalance) < Number(amount)) {
        throw new Error("Insufficient UTU tokens");
    }
    const transaction = await contract.endorse(
        targetAddress,
        String(amount),
        transactionId
    );
    await transaction.wait();
    return transaction;
}

function createEntityCriteria(uuid: string) {
    return {ids: {uuid}};
}

/**
 * Obtain an access token from the UTU API and store it in Redis.
 * @param userId the telegram userId of the user authenticating (for us to know who to store the access token for)
 * @param payload the authorization details
 * @see IAuthRequest
 * @see IAuthResponse
 * @returns a promise which will resolve with an unspecified value when the access token was obtained and stored successfully, and will reject otherwise.
 */
export async function getAndStoreAccessToken(userId: string, payload: IAuthRequest) {
    await axios.post<IAuthResponse>(Urls.auth, payload, {withCredentials: false,})
        .then(async result => {
            //store all fields of IAuthResponse in redis with userId as the key
            await redisClient.hSet(userId, {...result.data});
            //store the address and signature too (for refreshing the access token because the UTU API doesn't have a refresh token endpoint)
            await redisClient.hSet(userId, {...payload});
            return result;
        });
}

async function withAuthHeader(userId: string, config: AxiosRequestConfig = {}) {
    // obtain access token from Redis
    let accessToken: string | undefined = await redisClient.hGet(userId, 'access_token');
    if (!accessToken) {
        throw new Error('User is not authenticated');
    }

    config.headers = {
        ...config.headers,
        Authorization: `Bearer ${accessToken}`,
    };
    return config;
}
