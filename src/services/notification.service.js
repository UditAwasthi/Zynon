import { notificationQueue } from "../queues/notification.queue.js";
import { NOTIFICATION_JOBS } from "../modules/notifications/notification.jobs.js";

export const notificationService = {

  sendPostLikeNotification: async ({ actorId, recipientId, postId }) => {

    if (actorId.toString() === recipientId.toString()) return;

    await notificationQueue.add(
      NOTIFICATION_JOBS.POST_LIKE,
      { actorId, recipientId, postId },
      { attempts: 3 }
    );
  },
  sendCommentLikeNotification: async ({ actorId, recipientId, commentId }) => {
    if (actorId.toString() === recipientId.toString()) return;
    await notificationQueue.add(
      NOTIFICATION_JOBS.COMMENT_LIKE,
      { actorId, recipientId, commentId },
      { attempts: 3 }
    );
  },
  sendNewPostNotification: async ({ actorId, postId }) => {

    await notificationQueue.add(
      NOTIFICATION_JOBS.NEW_POST,
      { actorId, postId }
    );

  },

  sendPostCommentNotification: async ({ actorId, recipientId, commentId, postId }) => {

    if (actorId.toString() === recipientId.toString()) return;

    await notificationQueue.add(
      NOTIFICATION_JOBS.POST_COMMENT,
      { actorId, recipientId, commentId, postId },
      { attempts: 3 }
    );
  },


  sendFollowRequestNotification: async ({ actorId, recipientId }) => {

    await notificationQueue.add(
      NOTIFICATION_JOBS.FOLLOW_REQUEST,
      { actorId, recipientId },
      { attempts: 3 }
    );
  },


  sendFollowAcceptedNotification: async ({ actorId, recipientId }) => {

    await notificationQueue.add(
      NOTIFICATION_JOBS.FOLLOW_ACCEPTED,
      { actorId, recipientId },
      { attempts: 3 }
    );
  },


  sendMessageNotification: async ({ actorId, recipientId, messageId, threadId }) => {

    await notificationQueue.add(
      NOTIFICATION_JOBS.NEW_MESSAGE,
      { actorId, recipientId, messageId, threadId },
      { attempts: 3 }
    );
  },


  sendMentionNotification: async ({ actorId, recipientId, postId }) => {

    await notificationQueue.add(
      NOTIFICATION_JOBS.MENTION,
      { actorId, recipientId, postId },
      { attempts: 3 }
    );
  }

};