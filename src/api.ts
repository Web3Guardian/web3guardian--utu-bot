// eslint-disable-next-line import/no-extraneous-dependencies
import { IFeedbackData, IFeedbackResponse, IEntity, IAuthResponse } from './models';
import qs from "qs";
import { Urls } from './urls';
import axios, { AxiosRequestConfig } from 'axios';
import { redisClient } from './redisClient';
import { Wallet, ethers } from 'ethers';

/**
 * Use the UTU API to post feedback.
 * @param username the username of the user posting the feedback
 * @param sourceUuid
 * @param targetUuid
 * @param transactionId
 * @param feedbackData the feedback data to post
 * @return a promise which will resolve with an unspecified value when the feedback was posted successfully, and will reject otherwise.
 * @see IFeedbackData
 */
export async function sendFeedback(username: string, sourceUuid: string, targetUuid: string, transactionId: string, feedbackData: IFeedbackData): Promise<any> {
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
        await withAuthHeader(username)
    ).then(result => {
        return result;
    }).catch(error => {
        return error;
    });
}

/**
 * Get an entity's feedback summary from the UTU API.
 * @param username the username of the user getting the feedback
 * @param sourceUuid your entity's uuid
 * @param targetUuid the uuid of the entity to get feedback for
 * @return an object with the feedback summary and the submit status
 * @see IFeedback
 * @see SubmitStatus
 */
export async function getFeedbackSummary(username: string, sourceUuid: string, targetUuid: string): Promise<IFeedbackResponse> {
    const sourceCriteria = createEntityCriteria(sourceUuid);
    const targetCriteria = createEntityCriteria(targetUuid);
    const queryParams = qs.stringify({
        sourceCriteria,
        targetCriteria
    });
    return axios.get<IFeedbackResponse>(
        `${Urls.feedbackSummary}?${queryParams}`,
        await withAuthHeader(username)
    ).then(result => {
        return result.data;
    }).catch(error => {
        return error;
    });
}

/**
 * Add an entity to UTU.
 * @param username the username of the user adding the entity
 * @param sourceUuid 
 * @param targetUuid 
 * @param transactionId
 * @param entityData
 * @returns a promise which will resolve with an unspecified value when the entity was added successfully, and will reject otherwise.
 */
export async function addEntity(username: string, sourceUuid: string, targetUuid: string, transactionId: string, entityData: IEntity): Promise<any> {
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
        await withAuthHeader(username)
    ).then(result => {
        return result;
    }).catch(error => {
        return error;
    });
}

function createEntityCriteria(uuid: string) {
    return { ids: { uuid } };
}
export async function getAndStoreAccessToken(username: string, signer: Wallet) {
  try {
    // Get the signer's Ethereum address
    const address = signer.address;

    // Sign a message for authentication
    const signature = await signer.signMessage('Sign in at UTU');

    // Send a request to your backend to authenticate with UTU
    const response = await axios.post<IAuthResponse>(
      Urls.auth,
      {
        address,
        signature,
      },
      {
        withCredentials: false,
      }
    );

    // Store the access token in Redis
    await redisClient.hSet(username, {
      accessToken: response.data.access_token,
      accessTokenExpiry: Date.now() + response.data.expires_in * 1000,
      refreshToken: response.data.refresh_token,
      refreshTokenExpiry: Date.now() + response.data.refresh_expires_in * 1000,
    });
  } catch (error) {
    // Handle errors
    console.error(error);
    // Throw an error or handle it according to your application's logic
    throw error;
  }
}

async function refreshAccessToken(username: string, refreshToken: string) {
    // TODO: use the refresh token to obtain and store new access token
}

async function withAuthHeader(username: string, config: AxiosRequestConfig = {}) {
    // obtain access token from Redis
    let accessToken: string | undefined = await redisClient.hGet(username, 'accessToken');
    let accessTokenExpired: boolean = (await redisClient.hGet(username, 'accessTokenExpiry') as unknown as number) > Date.now();
    let refreshToken: string | undefined = await redisClient.hGet(username, 'refreshToken');
    if (!accessToken) {
        throw new Error('User is not authenticated');
    }
    if (accessTokenExpired) {
        // refresh access token
        await refreshAccessToken(username, refreshToken!);
        accessToken = await redisClient.hGet(username, 'accessToken');
    }

    config.headers = {
        ...config.headers,
        Authorization: `Bearer ${accessToken}`,
    };
    return config;
}
