export class Urls {
    private static readonly utuApiBase = `https://stage-api.ututrust.com`;
    public static readonly auth = `${Urls.utuApiBase}/identity-api/verify-address`;
    public static readonly entity = `${Urls.utuApiBase}/core-api-v2/entity`;
    public static readonly feedback = `${Urls.utuApiBase}/core-api-v2/feedback`;
    public static readonly feedbackSummary = `${Urls.utuApiBase}/core-api-v2/feedbackSummary`;
    public static readonly networkUrl = `https://rpc-mumbai.maticvigil.com`;
}