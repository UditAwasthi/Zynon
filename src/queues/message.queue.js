/**
 * message_queue.js
 *
 * Async message queue for offloading heavy work away from the hot
 * send-message path (e.g. push notifications, read-receipt fan-out,
 * media transcoding triggers).
 *
 * Currently implemented as a simple in-process EventEmitter queue.
 * Swap the adapter for Bull/BullMQ + Redis for production scale.
 */

import EventEmitter from "events";

class MessageQueue extends EventEmitter {
    constructor() {
        super();
        this.setMaxListeners(50);
    }

    /**
     * Enqueue a job.
     * @param {"send_notification"|"fan_out_receipt"|"index_message"} type
     * @param {object} payload
     */
    enqueue(type, payload) {
        // Emit async so callers are never blocked
        setImmediate(() => this.emit(type, payload));
    }
}

export const messageQueue = new MessageQueue();

// ─── Workers ─────────────────────────────────────────────────────────────────

messageQueue.on("send_notification", async (payload) => {
    try {
        // TODO: wire up to notificationService or a push provider
        console.log("[MessageQueue] send_notification:", payload);
    } catch (err) {
        console.error("[MessageQueue] send_notification error:", err.message);
    }
});

messageQueue.on("fan_out_receipt", async (payload) => {
    try {
        // TODO: fan out seen/delivered receipts to many participants
        console.log("[MessageQueue] fan_out_receipt:", payload);
    } catch (err) {
        console.error("[MessageQueue] fan_out_receipt error:", err.message);
    }
});

messageQueue.on("index_message", async (payload) => {
    try {
        // TODO: push to search index (e.g. Elasticsearch) if needed
        console.log("[MessageQueue] index_message:", payload);
    } catch (err) {
        console.error("[MessageQueue] index_message error:", err.message);
    }
});