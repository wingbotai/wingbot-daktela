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

    _transformActionPayload (payload) {
        const { action, data } = parseActionPayload({ payload });

        return JSON.stringify([action, data]);
    }

    _makeStringId (texts) {
        const hash = crypto.createHash('sha1');

        for (const text of texts) {
            hash.update(text);
        }

        return hash.digest('hex');
    }

    _createButton (btn) {
        switch (btn.type) {
            case 'web_url':
                return {
                    text: btn.title,
                    url: btn.url,
                    name: this._makeStringId([btn.title, btn.url])
                };
            case 'postback':
                return {
                    text: btn.title,
                    name: this._transformActionPayload(btn.payload)
                };
            default:
                return null;
        }
    }

    /**
     *
     * @param {Object} payload
     * @returns {Object|null}
     */
    _transformPayload (payload) {
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

                const ret = {
                    text,
                    button: buttons
                        .map(btn => this._createButton(btn))
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
                const quickreply = message.quick_replies
                    .map(qr => ({
                        text: qr.title,
                        name: this._transformActionPayload(qr.payload)
                    }));

                Object.assign(ret, { quickreply });
            }

            return ret;
        }
        return null;
    }

    async _send (payload) {
        const transformed = this._transformPayload(payload);

        if (!transformed) {
            return null;
        }

        Object.assign(transformed, {
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
