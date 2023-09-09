export interface AuthResponse {
    access_token: string;
    expires_in: number;
    refresh_expires_in: number;
    refresh_token: string;
    token_type: string;
    session_state: string;
    scope: string;
}

export interface IEntity {
    name: string;
    uuid: string;
    image: string;
    type: string;
    properties: Record<string, unknown>;
}

/** for providing feedback */
export interface IFeedbackData {
    review?: string;
    stars?: number;
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

/*for viewing feedback*/
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
