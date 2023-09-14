// eslint-disable-next-line import/no-extraneous-dependencies
import {IFeedbackData, IFeedbackResponse, IEntity, IAuthResponse, IAuthRequest} from './models';
import qs from "qs";
import {Urls} from './urls';
import axios, {AxiosRequestConfig} from 'axios';
import {redisClient} from './redisClient';

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
    return {ids: {uuid}};
}

export async function getAndStoreAccessToken(userId: string, payload: IAuthRequest) {
    await axios.post<IAuthResponse>(Urls.auth, payload, {withCredentials: false,})
        .then(async result => {
            //store all fields of IAuthResponse in redis with userId as the key
            await redisClient.hSet(userId, {...result.data});
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
