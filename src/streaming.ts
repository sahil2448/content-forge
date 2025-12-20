export async function pushStatus(
    streams: any | undefined,
    requestId: string,
    stage: string,
    message: string
) {
    if (!streams?.contentStatus) return;
    await streams.contentStatus.set("requests", requestId, {
        requestId,
        stage,
        message,
        ts: new Date().toISOString(),
    });
}
