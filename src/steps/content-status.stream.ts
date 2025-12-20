import type { StreamConfig } from "motia";
import { z } from "zod";

export const config: StreamConfig = {
    name: "contentStatus",
    schema: z.object({
        requestId: z.string(),
        stage: z.string(),
        message: z.string(),
        ts: z.string(),
    }),
    baseConfig: { storageType: "default" },
};
