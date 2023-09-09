export class Urls {
    private static readonly utuApiBase = `https://stage-api.ututrust.com/core-api-v2`;
    public static readonly auth = `${Urls.utuApiBase}/identity-api/verify-address`;
    public static readonly entity = `${Urls.utuApiBase}/entity`;
    public static readonly feedback = `${Urls.utuApiBase}/feedback`;
    public static readonly feedbackSummary = `${Urls.utuApiBase}/feedbackSummary`;
    public static readonly networkUrl = `https://rpc-mumbai.maticvigil.com`;
}