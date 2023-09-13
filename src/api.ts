// eslint-disable-next-line import/no-extraneous-dependencies
import { IFeedbackData, IFeedbackResponse, IEntity, IAuthResponse } from './models';
import qs from "qs";
import { Urls } from './urls';
import axios, { AxiosRequestConfig } from 'axios';
import { redisClient } from './redisClient';

/**
 * Use the UTU API to post feedback.
 * @param userId the telegram userId of the user posting the feedback
 * @param sourceUuid
 * @param targetUuid
 * @param transactionId
 * @param feedbackData the feedback data to post
 * @return a promise which will resolve with an unspecified value when the feedback was posted successfully, and will reject otherwise.
 * @see IFeedbackData
 */
export async function sendFeedback(userId: string, sourceUuid: string, targetUuid: string, transactionId: string, feedbackData: IFeedbackData): Promise<any> {
    // TODO: where should we get the transactionId from?
    const sourceCriteria = createEntityCriteria(sourceUuid);
    const targetCriteria = createEntityCriteria(targetUuid);
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
 * Get an entity's feedback summary from the UTU API.
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
    })
}

/**
 * Add an entity to UTU.
 * @param userId the telegram userId of the user adding the entity
 * @param sourceUuid 
 * @param targetUuid 
 * @param transactionId
 * @param entityData
 * @returns a promise which will resolve with an unspecified value when the entity was added successfully, and will reject otherwise.
 */
export async function addEntity(userId: string, sourceUuid: string, targetUuid: string, transactionId: string, entityData: IEntity): Promise<any> {
    const sourceCriteria = createEntityCriteria(sourceUuid);
    const targetCriteria = createEntityCriteria(targetUuid);
    return axios.post(
        Urls.entity,
        {
            sourceCriteria,
            targetCriteria,
            transactionId,
            items: entityData
        },
        await withAuthHeader(userId)
    );
}

function createEntityCriteria(uuid: string) {
    return { ids: { uuid } };
}

export async function getAndStoreAccessToken(userId: string, address: string, signature: string) {
    await axios.post<IAuthResponse>(
        Urls.auth,
        {
            address,
            signature,
        },
        {
            withCredentials: false,
        }
    ).then(async result => {
        //store all keys in redis
        await redisClient.hSet(userId, {
            accessToken: result.data.access_token,
            accessTokenExpiry: Date.now() + result.data.expires_in * 1000,
            refreshToken: result.data.refresh_token,
            refreshTokenExpiry: Date.now() + result.data.refresh_expires_in * 1000
        });
    });
}

async function refreshAccessToken(userId: string, refreshToken: string) {
    // TODO: use the refresh token to obtain and store new access token
}

async function withAuthHeader(userId: string, config: AxiosRequestConfig = {}) {
    // obtain access token from Redis
    let accessToken: string | undefined = await redisClient.hGet(userId, 'accessToken');
    let accessTokenExpired: boolean = (await redisClient.hGet(userId, 'accessTokenExpiry') as unknown as number) > Date.now();
    let refreshToken: string | undefined = await redisClient.hGet(userId, 'refreshToken');
    if (!accessToken) {
        throw new Error('User is not authenticated');
    }
    // if (accessTokenExpired) {
    //     // refresh access token
    //     await refreshAccessToken(userId, refreshToken!);
    //     accessToken = await redisClient.hGet(userId, 'accessToken');
    // }

    config.headers = {
        ...config.headers,
        Authorization: `Bearer ${accessToken}`,
    };
    return config;
}
