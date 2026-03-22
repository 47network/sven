import { NatsError } from 'nats';
import { STREAM_CONFIGS } from '../types/nats-subjects.js';
const STREAM_NOT_FOUND = 'stream not found';
const SUBJECTS_OVERLAP = 'subjects overlap';
const WORKQUEUE_POLICY_CHANGE = 'stream configuration update can not change retention policy to/from workqueue';
function isStreamNotFoundError(error) {
    if (!(error instanceof Error)) {
        return false;
    }
    const message = error.message.toLowerCase();
    return message.includes(STREAM_NOT_FOUND) || (error instanceof NatsError && error.code === '404');
}
function isSubjectsOverlapError(error) {
    if (!(error instanceof Error)) {
        return false;
    }
    return error.message.toLowerCase().includes(SUBJECTS_OVERLAP);
}
function isWorkqueuePolicyChangeError(error) {
    if (!(error instanceof Error)) {
        return false;
    }
    return error.message.toLowerCase().includes(WORKQUEUE_POLICY_CHANGE);
}
export async function ensureStreams(connection) {
    const manager = await connection.jetstreamManager();
    const streamApi = manager.streams;
    for (const config of Object.values(STREAM_CONFIGS)) {
        try {
            const info = await streamApi.info(config.name);
            const existingSubjects = info.config.subjects ?? [];
            const desiredSubjects = Array.from(new Set(config.subjects));
            const subjectsDiffer = existingSubjects.length !== desiredSubjects.length ||
                desiredSubjects.some((subject) => !existingSubjects.includes(subject));
            // Check if retention policy differs
            const retentionDiffers = info.config.retention !== config.retention;
            if (subjectsDiffer || retentionDiffers) {
                try {
                    const updateConfig = { ...info.config, subjects: desiredSubjects };
                    if (retentionDiffers) {
                        updateConfig.retention = config.retention;
                        if ('max_age' in config && config.max_age !== undefined) {
                            updateConfig.max_age = config.max_age;
                        }
                    }
                    await streamApi.update(config.name, updateConfig);
                }
                catch (updateErr) {
                    if (isSubjectsOverlapError(updateErr)) {
                        console.warn('Cannot update stream subjects because they overlap with another stream, skipping:', config.name);
                        continue;
                    }
                    if (isWorkqueuePolicyChangeError(updateErr)) {
                        console.warn('Cannot change retention policy to/from workqueue, deleting and recreating stream:', config.name);
                        try {
                            await streamApi.delete(config.name);
                            await streamApi.add(config);
                            console.log('Stream recreated successfully:', config.name);
                        }
                        catch (recreateErr) {
                            console.error('Failed to recreate stream:', config.name, recreateErr);
                            throw recreateErr;
                        }
                        continue;
                    }
                    throw updateErr;
                }
            }
            continue;
        }
        catch (err) {
            if (isStreamNotFoundError(err)) {
                try {
                    await streamApi.add(config);
                }
                catch (addErr) {
                    if (isSubjectsOverlapError(addErr)) {
                        console.warn('Stream subjects overlap with existing stream, skipping:', config.name);
                        continue;
                    }
                    throw addErr;
                }
                continue;
            }
            if (isSubjectsOverlapError(err)) {
                console.warn('Stream subjects overlap with existing stream, skipping info/add for:', config.name);
                continue;
            }
            throw err;
        }
    }
}
//# sourceMappingURL=streams.js.map