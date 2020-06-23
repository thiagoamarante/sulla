import { getAllChatsWithNewMessages } from './get-chats-with-new-messages';

/**
 * Retrieves all new messages
 * TODO: Test, seems to be written incorrectly
 */
export const getAllNewMessages = function () {
  // const _newMessages = JSON.stringify(
  //   getAllChatsWithNewMessages()
  //     .map((c) => WAPI.getChat(c.id._serialized))
  //     .map((c) => c.msgs._models.filter((x) => x.isNewMsg)) || []
  // );
  // return _newMessages;
  return (
    getAllChatsWithNewMessages()
      .map((c) => WAPI.getChat(c.id._serialized))
      .map((c) => c.msgs._models.filter((x) => x.isNewMsg)) || []
  );

  //return getAllChatsWithNewMessages().map(c => WAPI.getChat(c.id)).flatMap(c => c.msgs._models.filter(x => x.isNewMsg)).map(WAPI._serializeMessageObj) || [];
  //return JSON.parse(_newMessages);
};
