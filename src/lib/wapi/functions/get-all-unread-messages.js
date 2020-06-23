import { getAllChatsWithNewMessages } from './get-chats-with-new-messages';

/**
 * Retrieves undread messages
 * x.ack === -1
 * TODO: Test this fn, seems incorrect, should not be async
 */
export const getAllUnreadMessages = async function () {
  return window.Store.Chat.models
    .filter((chat) => chat.unreadCount && chat.unreadCount > 0)
    .map((unreadChat) =>
      unreadChat.msgs.models.slice(-1 * unreadChat.unreadCount)
    )
    .flat()
    .map(WAPI._serializeMessageObj);

  // const _partials = JSON.stringify(
  //   getAllChatsWithNewMessages()
  //     .map((c) => WAPI.getChat(c.id._serialized))
  //     .map((c) => c.msgs._models.filter((x) => x.ack === -1))
  //     .flatMap((x) => x) || []
  // );

  // const partials = JSON.parse(_partials);
  // return partials;
};
