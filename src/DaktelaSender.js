/*
 * @author David Menger
 */
'use strict';

const request = require('request-promise-native');
const crypto = require('crypto');
const { ReturnSender, parseActionPayload } = require('wingbot');

class DaktelaSender extends ReturnSender {

    /**
     *
     * @param {Object} options
     * @param {string} [options.absToken]
     * @param {Object} options.actionReplacer - conversation termination postback
     * @param {string} userId
     * @param {Object} incommingMessage
     * @param {string} incommingMessage.serviceUrl
     * @param {Object} incommingMessage.from
     * @param {Object} incommingMessage.recipient
     * @param {Object} incommingMessage.conversation
     * @param {string} incommingMessage.locale
     * @param {string} incommingMessage.channelId
     * @param {string} [incommingMessage.id]
     * @param {string} [incommingMessage.replyToId]
     * @param {console} [logger] - console like logger
     * @param {Function} [req] - request library replacement
     */
    constructor (options, userId, incommingMessage, logger = null, req = request) {
        super(options, userId, incommingMessage, logger);

        this._options = options;

        this.waits = true;

        this._req = req;

        const {
            conversation
        } = incommingMessage;

        this._conversation = conversation;
    }

    async _transformActionPayload (payload) {
        const { action, data, setState } = parseActionPayload({ payload });

        return this._options.actionReplacer.actionToReplacement(action, data, setState);
    }

    _makeStringId (texts) {
        const hash = crypto.createHash('sha1');

        for (const text of texts) {
            hash.update(text);
        }

        return hash.digest('hex');
    }

    async _createButton (btn) {
        switch (btn.type) {
            case 'web_url':
                return {
                    text: btn.title,
                    url: btn.url,
                    name: this._makeStringId([btn.title, btn.url])
                };
            case 'postback': {
                const name = await this._transformActionPayload(btn.payload);

                return {
                    text: btn.title,
                    name
                };
            }
            default:
                return null;
        }
    }

    /**
     *
     * @param {Object} payload
     * @returns {Promise<Object|null>}
     */
    async _transformPayload (payload) {
        // if (payload.sender_action === 'typing_on') {

        /**
         * PASS THREAD
         */
        if (payload.target_app_id) {
            return {
                transfer: parseInt(payload.target_app_id, 10)
            };
        }

        if (payload.message) {
            const { message } = payload;

            // if (message.attachment) {

            /**
             * BUTTON TEMPLATE
             */
            if (message.attachment
                && message.attachment.type === 'template'
                && typeof message.attachment.payload === 'object'
                && message.attachment.payload.template_type === 'button') {

                const {
                    text,
                    buttons = []
                } = message.attachment.payload;

                const button = await Promise.all(
                    buttons
                        .map(btn => this._createButton(btn))
                );

                const ret = {
                    text,
                    button: button
                        .filter(btn => btn !== null)
                };

                return ret;
            }

            if (!message.text) {
                return null;
            }

            /**
             * TEXT
             */
            const ret = {
                text: `${message.text}`
            };

            if (message.quick_replies) {
                const quickreply = await Promise.all(
                    message.quick_replies
                        .map(async (qr) => {
                            const name = await this._transformActionPayload(qr.payload);

                            return {
                                text: qr.title,
                                name
                            };
                        })
                );

                Object.assign(ret, { quickreply });
            }

            return ret;
        }
        return null;
    }

    async _send (payload) {
        let transformed = await this._transformPayload(payload);

        if (!transformed) {
            return null;
        }

        transformed = Object.assign({
            quickreply: []
        }, transformed, {
            conversation: {
                name: this._conversation.name
            }
        });

        const headers = {
            'Content-type': 'application/json; charset:utf-8'
        };

        const data = {
            uri: this._conversation.response_url,
            headers,
            method: 'POST',
            body: transformed,
            json: true
        };

        const res = await this._req(data);

        if (res.result !== 'OK') {
            throw new Error(`Daktela error: ${res.error || 'unknown error'}`);
        }

        return res;
    }

}

module.exports = DaktelaSender;
