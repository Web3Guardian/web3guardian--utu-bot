import {ethers} from "ethers";

export interface IAuthRequest {
    address: string;
    signature: string;
}

export interface IAuthResponse {
    access_token: string;
    expires_in: number;
    refresh_expires_in: number;
    refresh_token: string;
    token_type: string;
    session_state: string;
    scope: string;
}

/** for creating an entity */
export class Entity {
    name: string;
    ids: {
        uuid: string;
    }
    image: string;
    type: string;
    uuid?: string;

    constructor(name: string, uuid?: string, image?: string) {
        this.name = name;
        this.ids = {uuid: uuid || ethers.id(name).slice(0, 40 + 2)};
        this.image = image || `https://api.dicebear.com/7.x/adventurer/svg?seed=${this.ids.uuid}`;
        this.type = "telegram_user"
    }
}

/** for providing feedback */
export interface IFeedbackData {
    review: string;
    stars: number;
}

export interface IFeedbackResponse {
    status: "success" | "error";
    result: IFeedbackItem;
}

export interface IFeedbackItem {
    items: IFeedback;
    targetCriteria: IFeedbackTarget;
}

export interface IFeedbackTarget {
    ids: [id: string]
}

/** for viewing feedback */
export interface IFeedback {
    summaryText: string;
    reviews: IReviews[];
    stars: IStars;
}

export interface IReviews {
    content: string;
    date: number;
    image: string;
    summary: string;
}

export interface IStars {
    avg: number;
    count: number;
    sum: number;
    name: [];
    summaryText: string;
}

export interface IRankingItem {
    entity: Entity;
    relationshipPaths: [];
    summaryText: string;
    summaryImages: string[];
}

export interface IRankingsResponse {
    status: "success" | "error";
    result: IRankingItem[];
}
